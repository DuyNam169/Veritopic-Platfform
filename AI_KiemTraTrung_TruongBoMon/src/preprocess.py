import re
import unicodedata


def normalize_text(text: str) -> str:
    """
    Chuẩn hóa văn bản tiếng Việt.
    """

    if text is None:
        return ""

    text = str(text)

    # Chuẩn hóa Unicode
    text = unicodedata.normalize(
        "NFC",
        text
    )

    # Chuyển chữ thường
    text = text.lower()

    # Xóa khoảng trắng thừa
    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()