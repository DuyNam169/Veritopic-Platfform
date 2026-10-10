import torch
from transformers import AutoTokenizer
from src.config import (MODEL_NAME, MAX_LENGTH)
from src.preprocess import (normalize_text)
from src.inference.model_loader import (get_model,get_device)
# ============================================================
# TOKENIZER
# ============================================================
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
# ============================================================
# ENCODE ONE TITLE
# ============================================================
def encode_title(title: str):
    return encode_titles([title])


def encode_titles(titles: list[str]):
    if not titles:
        return torch.empty((0, 0))

    model = get_model()
    device = get_device()
    texts = [normalize_text(title) for title in titles]
    encoded = tokenizer(
        texts,
        max_length=MAX_LENGTH,
        padding="max_length",
        truncation=True,
        return_tensors="pt"
    )
    input_ids = (encoded["input_ids"].to(device))
    attention_mask = (encoded["attention_mask"].to(device))
    with torch.no_grad():
        embedding = model.encode(input_ids,attention_mask)
    return embedding