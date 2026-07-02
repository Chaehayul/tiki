from __future__ import annotations

import base64
import hashlib
import hmac
import os

from app.core.config import settings


def _key() -> bytes:
    secret = settings.integration_token_encryption_key or settings.auth_secret_key
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    blocks: list[bytes] = []
    counter = 0
    while sum(len(block) for block in blocks) < length:
        blocks.append(hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return b"".join(blocks)[:length]


def encrypt_secret(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.encode("utf-8")
    key = _key()
    nonce = os.urandom(16)
    stream = _keystream(key, nonce, len(raw))
    cipher = bytes(a ^ b for a, b in zip(raw, stream, strict=True))
    tag = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
    return "v1:" + base64.urlsafe_b64encode(nonce + tag + cipher).decode("ascii")


def decrypt_secret(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.startswith("v1:"):
        return value
    payload = base64.urlsafe_b64decode(value[3:].encode("ascii"))
    nonce = payload[:16]
    tag = payload[16:32]
    cipher = payload[32:]
    key = _key()
    expected = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(tag, expected):
        raise ValueError("Encrypted secret signature mismatch")
    stream = _keystream(key, nonce, len(cipher))
    raw = bytes(a ^ b for a, b in zip(cipher, stream, strict=True))
    return raw.decode("utf-8")
