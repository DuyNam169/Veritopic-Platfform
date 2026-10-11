from threading import Lock

import torch

from src.config import MODEL_MODE, MODEL_NAME, MODEL_PATH
from src.training.model import SiamesePhoBERT


_model = None
_model_lock = Lock()
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def validate_checkpoint():
    # Docker's short bind syntax can create a directory for a missing file.
    if not MODEL_PATH.is_file() or MODEL_PATH.stat().st_size == 0:
        raise FileNotFoundError(
            "Thiếu file checkpoint PhoBERT đã huấn luyện. "
            "Đặt file tier1_best.pt (không phải thư mục hoặc file rỗng) vào "
            "AI_KiemTraTrung_TruongBoMon/models rồi khởi động lại dịch vụ AI."
        )


def get_device():
    return _device


def get_model():
    global _model

    with _model_lock:
        if _model is None:
            if MODEL_MODE == "checkpoint":
                validate_checkpoint()
            print(f"Loading PhoBERT model ({MODEL_MODE})...")
            model = SiamesePhoBERT(MODEL_NAME)
            if MODEL_MODE == "checkpoint":
                model.load_state_dict(
                    torch.load(MODEL_PATH, map_location=_device, weights_only=True)
                )
            model.to(_device)
            model.eval()
            # Publish only a fully initialized model after loading succeeds.
            _model = model
            print("Model loaded.")

    return _model
