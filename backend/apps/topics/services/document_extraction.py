import io
import re
import unicodedata
import zipfile
from xml.etree import ElementTree

from pypdf import PdfReader


MAX_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_PDF_PAGES = 50
MAX_DOCX_EXPANDED_SIZE = 30 * 1024 * 1024
PREVIEW_CHARACTERS = 12_000
TITLE_LABEL = re.compile(
    r"^\s*(?:ten\s+de\s+tai|de\s+tai|research\s+title|project\s+title|title|topic)\s*[:：\-]?\s*(.*)$",
    re.IGNORECASE,
)
IGNORED_LINE = re.compile(
    r"^(?:cong\s+hoa|doc\s+lap|truong\s+dai\s+hoc|khoa\s+|bo\s+mon\s+|"
    r"giang\s+vien\s+huong\s+dan|sinh\s+vien\s+thuc\s+hien|ho\s+va\s+ten|"
    r"ma\s+so\s+sinh\s+vien|nam\s+hoc|khoa\s+luan|bao\s+cao|luan\s+van|do\s+an\s+tot\s+nghiep)",
    re.IGNORECASE,
)
TOPIC_TERMS = re.compile(
    r"\b(xay\s*dung|phat\s*trien|nghien\s*cuu|ung\s*dung|thiet\s*ke|he\s*thong|"
    r"mo\s*hinh|giai\s*phap|phan\s*tich|quan\s*ly|application|system|model|development|research)\b",
    re.IGNORECASE,
)


class FileExtractionError(ValueError):
    pass


def _fold_diacritics(value: str) -> str:
    folded = []
    for character in value:
        if character in {"đ", "Đ"}:
            folded.append("d" if character == "đ" else "D")
        else:
            folded.append(
                "".join(
                    part
                    for part in unicodedata.normalize("NFD", character)
                    if not unicodedata.combining(part)
                )
            )
    return "".join(folded)


def extract_document_text(uploaded_file) -> str:
    suffix = uploaded_file.name.rsplit(".", 1)[-1].lower() if "." in uploaded_file.name else ""
    if suffix not in {"pdf", "docx"}:
        raise FileExtractionError("Chỉ hỗ trợ tệp PDF hoặc DOCX.")
    if uploaded_file.size > MAX_UPLOAD_SIZE:
        raise FileExtractionError("Tệp vượt quá giới hạn 10 MB.")

    content = uploaded_file.read()
    if suffix == "pdf":
        text = _extract_pdf(content)
    else:
        text = _extract_docx(content)

    text = text.replace("\x00", "")
    if not text.strip():
        raise FileExtractionError(
            "Không trích xuất được chữ trong tệp. PDF scan/ảnh cần OCR và hiện chưa được hỗ trợ."
        )
    return text[:PREVIEW_CHARACTERS]


def _extract_pdf(content: bytes) -> str:
    if not content.startswith(b"%PDF-"):
        raise FileExtractionError("Tệp không đúng định dạng PDF.")
    try:
        reader = PdfReader(io.BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise FileExtractionError("PDF đang được bảo vệ bằng mật khẩu; hãy tải bản không khóa.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise FileExtractionError(f"PDF vượt quá {MAX_PDF_PAGES} trang được phép xử lý.")
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except FileExtractionError:
        raise
    except Exception as error:
        raise FileExtractionError(
            "Không đọc được PDF. Hãy kiểm tra tệp có bị lỗi hoặc mã hóa không."
        ) from error


def _extract_docx(content: bytes) -> str:
    stream = io.BytesIO(content)
    if not zipfile.is_zipfile(stream):
        raise FileExtractionError("Tệp không đúng định dạng DOCX.")
    try:
        with zipfile.ZipFile(stream) as archive:
            expanded_size = sum(item.file_size for item in archive.infolist())
            if expanded_size > MAX_DOCX_EXPANDED_SIZE:
                raise FileExtractionError("DOCX giải nén vượt quá giới hạn xử lý 30 MB.")
            xml_content = archive.read("word/document.xml")
        root = ElementTree.fromstring(xml_content)
    except FileExtractionError:
        raise
    except (KeyError, OSError, ElementTree.ParseError, zipfile.BadZipFile) as error:
        raise FileExtractionError("Không đọc được nội dung DOCX; hãy kiểm tra tệp có bị lỗi không.") from error

    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paragraphs = []
    for paragraph in root.iter(f"{namespace}p"):
        text = "".join(node.text or "" for node in paragraph.iter(f"{namespace}t"))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def find_title_candidates(text: str, limit: int = 5) -> list[dict]:
    lines = [
        re.sub(r"\s+", " ", line).strip(" \t•·-–—:：")
        for line in text.splitlines()
    ]
    lines = [line for line in lines if line]
    candidates = {}

    def add_candidate(value: str, position: int, labeled: bool):
        value = re.sub(r"\s+", " ", value).strip(" \t•·-–—:：\"“”")
        folded_value = _fold_diacritics(value)
        if not 12 <= len(value) <= 300 or IGNORED_LINE.search(folded_value):
            return
        alpha = [character for character in value if character.isalpha()]
        uppercase_ratio = (
            sum(character.isupper() for character in alpha) / len(alpha) if alpha else 0
        )
        score = 0.48 + (0.28 if labeled else 0)
        score += 0.12 if TOPIC_TERMS.search(folded_value) else 0
        score += 0.08 if uppercase_ratio >= 0.55 else 0
        score += max(0, 0.04 * (1 - position / max(len(lines), 1)))
        score = min(score, 0.99)
        current = candidates.get(value)
        if current is None or score > current["confidence"]:
            candidates[value] = {"title": value, "confidence": round(score, 2)}

    for index, line in enumerate(lines[:80]):
        label_match = TITLE_LABEL.match(_fold_diacritics(line))
        if label_match:
            inline_title = line[label_match.start(1):].strip()
            if inline_title:
                add_candidate(inline_title, index, True)
            else:
                for following in lines[index + 1:index + 4]:
                    if following:
                        add_candidate(following, index, True)
                        break
        add_candidate(line, index, False)

    return sorted(
        candidates.values(),
        key=lambda candidate: (-candidate["confidence"], len(candidate["title"])),
    )[:limit]
