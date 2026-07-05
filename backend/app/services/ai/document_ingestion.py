"""Document loading and normalization helpers for role 1 document intake."""

from __future__ import annotations

import base64
import logging
import re
import subprocess
import shutil
import tempfile
import zipfile
import zlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from app.schemas.ai_input import AIInputChunk, build_ai_input_contract

logger = logging.getLogger(__name__)

PDF_OBJECT_PATTERN = re.compile(rb"(\d+)\s+0\s+obj(.*?)endobj", re.S)
PDF_TOUNICODE_PATTERN = re.compile(rb"/ToUnicode\s+(\d+)\s+0\s+R")
PDF_CONTENT_REF_PATTERN = re.compile(rb"/Contents\s+(?:\[(.*?)\]|(\d+)\s+0\s+R)", re.S)
PDF_FONT_PATTERN = re.compile(rb"(/F[^\s]+)\s+[\d.]+\s+Tf")
PDF_TEXT_TJ_PATTERN = re.compile(rb"(\((?:\\.|[^\\()])*\))\s*Tj", re.S)
PDF_TEXT_TJ_ARRAY_PATTERN = re.compile(rb"\[(.*?)\]\s*TJ", re.S)
PDF_STRING_PATTERN = re.compile(rb"\((?:\\.|[^\\()])*\)")
PDF_OPERATORS_WITH_NEWLINE = {b"T*", b"Td", b"TD"}
TEXT_SPLIT_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")
WHITESPACE_PATTERN = re.compile(r"\s+")
DOCUMENT_PARTICIPANT_STOPWORDS = {
    "회의",
    "회의록",
    "마케팅팀",
    "콘텐츠기획팀",
    "디자인팀",
    "퍼포먼스",
    "브랜드",
    "전원",
    "작성자",
    "작성",
    "검토",
    "승인",
    "서명",
    "참석",
    "참석자",
    "불참",
    "병가",
    "사전",
    "공지",
    "문서번호",
    "일시",
    "장소",
    "배포",
    "대상",
    "버전",
    "현황",
    "구분",
    "성명",
    "직책",
    "역할",
    "비고",
    "주재",
    "팀장",
    "담당",
}

DOCUMENT_PARTICIPANT_NAME_PATTERN = re.compile(r"(?<![가-힣])[가-힣]{2,4}(?![가-힣])")


def _normalize_text(value: Any) -> str:
    return WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()


def _normalize_paragraph(text: str) -> str:
    text = _normalize_text(text)
    if not text:
        return ""
    text = re.sub(r"\s*\n\s*", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _infer_document_title(pages: list[str], metadata: dict[str, Any], path: Path) -> str:
    explicit_title = _normalize_text(metadata.get("source_title"))
    if explicit_title:
        return explicit_title

    title_markers = ("문서번호", "회의일시", "작성자", "작성일", "배포 대상", "버전", "참석자 현황")
    for page in pages:
        candidate = _normalize_text(page)
        if not candidate:
            continue

        for marker in title_markers:
            if marker in candidate:
                candidate = candidate.split(marker, 1)[0]
                break

        candidate = re.sub(r"^회\s*의\s*록\s*", "", candidate)
        candidate = re.sub(r"^[\s\-\*\d\.\)\(\[\]#]+", "", candidate).strip()
        candidate = re.sub(r"\s+", " ", candidate).strip(" -_/")
        if not candidate:
            continue
        if len(candidate) <= 90:
            return candidate

    return path.stem


def _extract_document_participants(pages: list[str]) -> list[str]:
    participants: list[str] = []
    seen: set[str] = set()
    focus_pages = pages[:2] if pages else []

    for page in focus_pages:
        for marker in ("참석", "불참", "작성자", "검토", "승인", "서명"):
            marker_index = page.find(marker)
            if marker_index < 0:
                continue
            snippet = page[max(0, marker_index - 160): marker_index + 260]
            for token in DOCUMENT_PARTICIPANT_NAME_PATTERN.findall(snippet):
                if token in DOCUMENT_PARTICIPANT_STOPWORDS:
                    continue
                if token.endswith(("팀", "록", "자", "용", "부", "안", "표", "일", "회", "록")):
                    continue
                if token in seen:
                    continue
                seen.add(token)
                participants.append(token)
                if len(participants) >= 20:
                    return participants

    return participants


def _decode_pdf_literal_string(token: bytes) -> bytes:
    if not token or len(token) < 2 or token[:1] != b"(" or token[-1:] != b")":
        return token

    inner = token[1:-1]
    output = bytearray()
    index = 0
    length = len(inner)

    while index < length:
        current = inner[index]
        if current != 0x5C:
            output.append(current)
            index += 1
            continue

        index += 1
        if index >= length:
            break

        escaped = inner[index]
        if escaped in b"nrtbf()\\":
            output.extend(
                {
                    ord("n"): b"\n",
                    ord("r"): b"\r",
                    ord("t"): b"\t",
                    ord("b"): b"\b",
                    ord("f"): b"\f",
                    ord("("): b"(",
                    ord(")"): b")",
                    ord("\\"): b"\\",
                }[escaped]
            )
            index += 1
            continue

        if escaped in b"\r\n":
            while index < length and inner[index] in b"\r\n":
                index += 1
            if index < length and inner[index] == 0x0A:
                index += 1
            continue

        if 48 <= escaped <= 55:
            octal = bytes([escaped])
            index += 1
            for _ in range(2):
                if index < length and 48 <= inner[index] <= 55:
                    octal += bytes([inner[index]])
                    index += 1
                else:
                    break
            output.append(int(octal, 8))
            continue

        output.append(escaped)
        index += 1

    return bytes(output)


def _decode_pdf_stream(obj_bytes: bytes) -> bytes:
    stream_part = obj_bytes.split(b"stream", 1)[1].split(b"endstream", 1)[0]
    stream_part = stream_part.lstrip(b"\r\n").rstrip(b"\r\n")
    if b"/ASCII85Decode" in obj_bytes:
        stream_part = base64.a85decode(stream_part, adobe=True)
    if b"/FlateDecode" in obj_bytes:
        stream_part = zlib.decompress(stream_part)
    return stream_part


def _parse_pdf_cmap(cmap_bytes: bytes) -> dict[int, str]:
    text = cmap_bytes.decode("latin1", errors="ignore")
    mapping: dict[int, str] = {}

    def _hex_to_unicode(hex_text: str) -> str:
        if not hex_text:
            return ""
        raw = bytes.fromhex(hex_text)
        if len(raw) == 1:
            return chr(raw[0])
        try:
            return raw.decode("utf-16-be")
        except Exception:
            try:
                return raw.decode("utf-8")
            except Exception:
                return "".join(chr(byte) for byte in raw)

    for block in re.finditer(r"(\d+)\s+beginbfchar(.*?)endbfchar", text, re.S):
        body = block.group(2)
        for source, target in re.findall(r"<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>", body):
            mapping[int(source, 16)] = _hex_to_unicode(target)

    for block in re.finditer(r"(\d+)\s+beginbfrange(.*?)endbfrange", text, re.S):
        body = block.group(2)
        for source_start, source_end, target in re.findall(
            r"<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+(<([0-9A-Fa-f]+)>|\[[^\]]+\])",
            body,
        ):
            start = int(source_start, 16)
            end = int(source_end, 16)
            if target.startswith("["):
                targets = re.findall(r"<([0-9A-Fa-f]+)>", target)
                for offset, target_hex in enumerate(targets):
                    mapping[start + offset] = _hex_to_unicode(target_hex)
                continue

            base = bytes.fromhex(target.strip("<>"))
            for offset, code in enumerate(range(start, end + 1)):
                current = int.from_bytes(base, "big") + offset
                byte_length = max(2, len(base))
                try:
                    mapping[code] = current.to_bytes(byte_length, "big").decode("utf-16-be")
                except Exception:
                    mapping[code] = _hex_to_unicode(current.to_bytes(byte_length, "big").hex())

    return mapping


def _build_pdf_font_maps(objects: dict[int, bytes]) -> dict[str, dict[int, str]]:
    font_maps: dict[str, dict[int, str]] = {}
    for object_number, obj_bytes in objects.items():
        if b"/Type /Font" not in obj_bytes or b"/ToUnicode" not in obj_bytes:
            continue
        font_match = re.search(rb"/Name\s+(/F[^\s]+)", obj_bytes)
        cmap_match = PDF_TOUNICODE_PATTERN.search(obj_bytes)
        if not font_match or not cmap_match:
            continue
        cmap_object_number = int(cmap_match.group(1))
        cmap_source = objects.get(cmap_object_number)
        if not cmap_source:
            continue
        try:
            cmap_bytes = _decode_pdf_stream(cmap_source)
        except Exception as exc:  # pragma: no cover - fallback path
            logger.warning("Failed to decode PDF CMap %s: %s", cmap_object_number, exc)
            continue
        font_maps[font_match.group(1).decode("latin1")] = _parse_pdf_cmap(cmap_bytes)
    return font_maps


def _map_pdf_bytes(raw: bytes, font_map: dict[int, str] | None) -> str:
    if not raw:
        return ""
    if not font_map:
        return raw.decode("latin1", errors="ignore")
    parts: list[str] = []
    for byte in raw:
        value = font_map.get(byte)
        if value is None:
            if 32 <= byte <= 126:
                parts.append(chr(byte))
            continue
        parts.append(value)
    return "".join(parts)


def _extract_pdf_text_from_content(content_bytes: bytes, font_maps: dict[str, dict[int, str]]) -> str:
    tokens = re.findall(
        rb"/[A-Za-z0-9+_.-]+|\[(?:[^\[\]]|\[[^\[\]]*\])*\]|\((?:\\.|[^\\()])*\)|-?\d*\.?\d+|[A-Za-z*]+",
        content_bytes,
    )
    stack: list[bytes] = []
    current_font_name: str | None = None
    output: list[str] = []

    for token in tokens:
        if token.startswith(b"/"):
            stack.append(token)
            continue

        if token in PDF_OPERATORS_WITH_NEWLINE:
            output.append("\n")
            stack.clear()
            continue

        if token == b"Tf":
            if len(stack) >= 2 and stack[-2].startswith(b"/"):
                current_font_name = stack[-2].decode("latin1")
            stack.clear()
            continue

        if token == b"Tj":
            if stack:
                literal = stack.pop()
                while stack and stack[-1].startswith(b"/"):
                    stack.pop()
                text_bytes = _decode_pdf_literal_string(literal)
                output.append(_map_pdf_bytes(text_bytes, font_maps.get(current_font_name or "")))
            stack.clear()
            continue

        if token == b"TJ":
            if stack:
                array_token = stack.pop()
                strings = PDF_STRING_PATTERN.findall(array_token)
                text_parts = [
                    _map_pdf_bytes(_decode_pdf_literal_string(string_token), font_maps.get(current_font_name or ""))
                    for string_token in strings
                ]
                output.append("".join(text_parts))
            stack.clear()
            continue

        if token in {b"BT", b"ET"}:
            if token == b"ET" and output and output[-1] != "\n":
                output.append("\n")
            stack.clear()
            continue

        stack.append(token)

    normalized = _normalize_text("".join(output))
    return normalized


def _extract_pdf_pages(pdf_bytes: bytes) -> tuple[list[str], dict[str, Any]]:
    objects = {int(match.group(1)): match.group(2) for match in PDF_OBJECT_PATTERN.finditer(pdf_bytes)}
    font_maps = _build_pdf_font_maps(objects)
    pages: list[tuple[int, str]] = []

    for object_number, obj_bytes in objects.items():
        if b"/Type /Page" not in obj_bytes or b"/Contents" not in obj_bytes:
            continue
        content_refs: list[int] = []
        match = PDF_CONTENT_REF_PATTERN.search(obj_bytes)
        if match:
            if match.group(1):
                content_refs = [int(ref) for ref in re.findall(rb"(\d+)\s+0\s+R", match.group(1))]
            elif match.group(2):
                content_refs = [int(match.group(2))]
        page_text_parts: list[str] = []
        for content_ref in content_refs:
            content_object = objects.get(content_ref)
            if not content_object or b"stream" not in content_object:
                continue
            try:
                content_bytes = _decode_pdf_stream(content_object)
            except Exception as exc:  # pragma: no cover - fallback path
                logger.warning("Failed to decode PDF content stream %s: %s", content_ref, exc)
                continue
            page_text_parts.append(_extract_pdf_text_from_content(content_bytes, font_maps))
        page_text = _normalize_paragraph("\n".join(part for part in page_text_parts if part.strip()))
        if page_text:
            pages.append((object_number, page_text))

    pages.sort(key=lambda item: item[0])
    ordered_pages = [page_text for _, page_text in pages]
    metadata = {
        "font_count": len(font_maps),
        "object_count": len(objects),
        "page_count": len(ordered_pages),
    }
    return ordered_pages, metadata


def _extract_docx_text(file_path: Path) -> tuple[str, dict[str, Any]]:
    paragraphs: list[str] = []
    with zipfile.ZipFile(file_path) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    for paragraph in root.findall(".//w:p", namespace):
        parts = [node.text for node in paragraph.findall(".//w:t", namespace) if node.text]
        text = _normalize_paragraph("".join(parts))
        if text:
            paragraphs.append(text)

    body_text = "\n\n".join(paragraphs)
    return body_text, {"page_count": 1 if body_text else 0}


def _extract_plain_text(file_path: Path) -> tuple[str, dict[str, Any]]:
    raw = file_path.read_bytes()
    for encoding in ("utf-8", "utf-8-sig", "cp949", "euc-kr", "latin1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover - fallback
        text = raw.decode("latin1", errors="ignore")
    return _normalize_paragraph(text), {"page_count": 1 if text else 0}


_SOFFICE_FALLBACK_PATHS = (
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "/usr/bin/soffice",
    "/opt/libreoffice/program/soffice",
)


def _find_soffice() -> str | None:
    found = shutil.which("soffice") or shutil.which("libreoffice")
    if found:
        return found
    # A freshly-installed LibreOffice won't be on PATH for processes started before
    # the install (Windows doesn't propagate PATH changes to running processes), so
    # also check well-known install locations directly rather than depending on the
    # backend process being restarted after every install.
    for candidate in _SOFFICE_FALLBACK_PATHS:
        if Path(candidate).is_file():
            return candidate
    return None


def _extract_hwp_text(file_path: Path) -> tuple[str, dict[str, Any]]:
    soffice = _find_soffice()
    if not soffice:
        raise FileNotFoundError("LibreOffice/soffice is required for HWP/HWPX extraction")

    with tempfile.TemporaryDirectory(prefix="tiki-hwp-") as tmpdir:
        output_dir = Path(tmpdir)
        subprocess.run(
            # Explicitly request UTF-8 output — LibreOffice's plain "Text" filter
            # otherwise defaults to the OS locale encoding (e.g. CP949 on Korean
            # Windows), which silently mangles Korean text if read back as UTF-8.
            [soffice, "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", str(output_dir), str(file_path)],
            check=True,
            capture_output=True,
        )
        converted_files = sorted(output_dir.glob("*.txt"))
        if not converted_files:
            raise FileNotFoundError(f"Converted text file not found for {file_path}")
        raw = converted_files[0].read_bytes()
        text = None
        for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            text = raw.decode("utf-8", errors="ignore")
        return (
            _normalize_paragraph(text),
            {
                "page_count": 1 if text else 0,
                "extraction_tool": "soffice",
            },
        )


def _extract_document_pages(file_path: Path) -> tuple[list[str], dict[str, Any]]:
    extension = file_path.suffix.lower().lstrip(".")

    if extension == "pdf":
        return _extract_pdf_pages(file_path.read_bytes())

    if extension == "docx":
        text, metadata = _extract_docx_text(file_path)
        return ([text] if text else []), metadata

    if extension in {"txt", "md"}:
        text, metadata = _extract_plain_text(file_path)
        return ([text] if text else []), metadata

    if extension in {"hwp", "hwpx"}:
        try:
            text, metadata = _extract_hwp_text(file_path)
            return ([text] if text else []), metadata
        except Exception as exc:
            # Do NOT fall through to _extract_plain_text here: HWP/HWPX is a binary
            # OLE2/zip container, not text, so decoding it as text (the fallback below)
            # silently produces garbage that still gets summarized by the LLM and saved
            # as a "completed" meeting with no visible error. Fail loudly instead.
            logger.warning("HWP/HWPX extraction failed for %s: %s", file_path, exc)
            raise RuntimeError(f"한글(HWP) 파일을 변환할 수 없습니다: {exc}") from exc

    if extension == "doc":
        try:
            completed = subprocess.run(
                ["/usr/bin/textutil", "-convert", "txt", "-stdout", str(file_path)],
                check=True,
                capture_output=True,
            )
            text = completed.stdout.decode("utf-8", errors="ignore")
            return ([ _normalize_paragraph(text) ] if text else []), {"page_count": 1 if text else 0, "extraction_tool": "textutil"}
        except Exception as exc:
            # Same reasoning as HWP above: .doc is a binary format, don't silently
            # decode it as text and pretend the analysis succeeded.
            logger.warning(".doc extraction failed for %s: %s", file_path, exc)
            raise RuntimeError(f".doc 파일을 변환할 수 없습니다: {exc}") from exc

    text, metadata = _extract_plain_text(file_path)
    return ([text] if text else []), metadata


def _split_text_into_chunks(pages: list[str], *, chunk_size: int = 1200, overlap: int = 120) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []

    def _emit_chunk(text: str, page_number: int | None, paragraph_index: int | None) -> None:
        normalized = _normalize_paragraph(text)
        if not normalized:
            return
        chunks.append(
            {
                "index": len(chunks),
                "chunk_kind": "paragraph" if paragraph_index is not None else "page",
                "title": None,
                "text": normalized,
                "masked_text": normalized,
                "page_number": page_number,
                "paragraph_index": paragraph_index,
                "metadata": {
                    "page_number": page_number,
                    "paragraph_index": paragraph_index,
                    "char_length": len(normalized),
                },
            }
        )

    for page_index, page_text in enumerate(pages, start=1):
        if not page_text.strip():
            continue

        paragraphs = [part.strip() for part in re.split(r"\n{2,}", page_text) if part.strip()]
        if not paragraphs:
            paragraphs = [page_text.strip()]

        buffer = ""
        buffer_paragraph_index: int | None = None

        for paragraph_index, paragraph in enumerate(paragraphs):
            paragraph = _normalize_paragraph(paragraph)
            if not paragraph:
                continue

            if len(paragraph) > chunk_size:
                if buffer:
                    _emit_chunk(buffer, page_index, buffer_paragraph_index)
                    buffer = ""
                    buffer_paragraph_index = None
                sentences = [part.strip() for part in TEXT_SPLIT_PATTERN.split(paragraph) if part.strip()]
                if not sentences:
                    sentences = [paragraph]
                current = ""
                for sentence in sentences:
                    if not current:
                        current = sentence
                        continue
                    if len(current) + 1 + len(sentence) <= chunk_size:
                        current = f"{current} {sentence}"
                        continue
                    _emit_chunk(current, page_index, paragraph_index)
                    if overlap and len(current) > overlap:
                        current = current[-overlap:]
                    else:
                        current = ""
                    current = f"{current} {sentence}".strip() if current else sentence
                if current:
                    _emit_chunk(current, page_index, paragraph_index)
                continue

            if not buffer:
                buffer = paragraph
                buffer_paragraph_index = paragraph_index
                continue

            if len(buffer) + 2 + len(paragraph) <= chunk_size:
                buffer = f"{buffer}\n\n{paragraph}"
                continue

            _emit_chunk(buffer, page_index, buffer_paragraph_index)
            if overlap and len(buffer) > overlap:
                buffer = buffer[-overlap:]
            else:
                buffer = ""
            buffer = f"{buffer}\n\n{paragraph}".strip() if buffer else paragraph
            buffer_paragraph_index = paragraph_index

        if buffer:
            _emit_chunk(buffer, page_index, buffer_paragraph_index)

    return chunks


@dataclass(slots=True)
class DocumentExtractionResult:
    source_path: str
    source_name: str
    source_kind: str
    extraction_method: str
    pages: list[str] = field(default_factory=list)
    text: str = ""
    masked_text: str = ""
    chunks: list[dict[str, Any]] = field(default_factory=list)
    page_count: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_ai_input_contract(self) -> dict[str, Any]:
        return build_ai_input_contract(
            source_kind=self.source_kind,
            source_text=self.text,
            masked_source_text=self.masked_text,
            source_name=self.source_name,
            source_path=self.source_path,
            source_title=self.metadata.get("source_title"),
            chunks=self.chunks,
            context={"page_count": self.page_count, **dict(self.metadata)},
            metadata={
                "extraction_method": self.extraction_method,
                "page_count": self.page_count,
                "chunk_count": len(self.chunks),
            },
        ).model_dump()


def load_document_file(file_path: str | Path) -> DocumentExtractionResult:
    path = Path(file_path)
    extension = path.suffix.lower().lstrip(".")
    pages, metadata = _extract_document_pages(path)
    text = _normalize_paragraph("\n\n".join(page for page in pages if page.strip()))
    chunks = _split_text_into_chunks(pages)
    source_title = _infer_document_title(pages, metadata, path)
    participants = _extract_document_participants(pages)
    masked_text = text

    return DocumentExtractionResult(
        source_path=str(path),
        source_name=path.name,
        source_kind="document" if extension != "txt" and extension != "md" else "text",
        extraction_method=f"document_{extension}" if extension else "document",
        pages=pages,
        text=text,
        masked_text=masked_text,
        chunks=chunks,
        page_count=metadata.get("page_count"),
        metadata={
            **metadata,
            "participants": participants,
            "source_title": source_title,
            "file_extension": extension,
        },
    )
