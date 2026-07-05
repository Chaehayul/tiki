"""토스페이먼츠 결제 승인 API 클라이언트."""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger(__name__)

TOSS_API_BASE = "https://api.tosspayments.com/v1"


class TossPaymentError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(f"Toss payment error {code}: {message}")


@dataclass
class TossPaymentResult:
    payment_key: str
    order_id: str
    total_amount: int
    method: str | None
    approved_at: str | None
    status: str
    receipt_url: str | None


class TossPaymentsClient:
    def __init__(self, secret_key: str | None = None) -> None:
        self.secret_key = secret_key or settings.toss_secret_key or ""
        if not self.secret_key:
            raise RuntimeError("TOSS_SECRET_KEY is not configured")
        credentials = f"{self.secret_key}:"
        self._auth_header = "Basic " + base64.b64encode(credentials.encode()).decode()

    def confirm_payment(self, payment_key: str, order_id: str, amount: int) -> TossPaymentResult:
        """결제창에서 승인된 결제를 서버에서 최종 확정한다.

        이 호출이 성공해야 실제로 카드가 승인/매입되며, 이 단계를 생략하면
        토스 결제창에서 성공한 것처럼 보여도 실제로는 결제가 확정되지 않는다.
        """
        body = json.dumps({
            "paymentKey": payment_key,
            "orderId": order_id,
            "amount": amount,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{TOSS_API_BASE}/payments/confirm",
            data=body,
            method="POST",
            headers={
                "Authorization": self._auth_header,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(error_body)
                code = parsed.get("code", "UNKNOWN_ERROR")
                message = parsed.get("message", error_body)
            except json.JSONDecodeError:
                code = "UNKNOWN_ERROR"
                message = error_body
            logger.error("Toss payment confirm failed %s: %s", code, message)
            raise TossPaymentError(code, message) from exc

        return TossPaymentResult(
            payment_key=payload["paymentKey"],
            order_id=payload["orderId"],
            total_amount=payload["totalAmount"],
            method=payload.get("method"),
            approved_at=payload.get("approvedAt"),
            status=payload.get("status", "DONE"),
            receipt_url=(payload.get("receipt") or {}).get("url"),
        )
