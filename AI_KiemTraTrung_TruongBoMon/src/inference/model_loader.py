import torch

from src.config import (
    MODEL_NAME,
    MODEL_PATH
)

from src.training.model import (
    SiamesePhoBERT
)


_model = None

_device = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)


def get_device():

    return _device


def get_model():

    global _model


    if _model is None:

        if not MODEL_PATH.exists():

            raise FileNotFoundError(
                f"Không tìm thấy model: "
                f"{MODEL_PATH}\n"
                f"Hãy chạy train trước."
            )


        print(
            "Loading Tier 1 model..."
        )


        _model = SiamesePhoBERT(
            MODEL_NAME
        )


        _model.load_state_dict(
            torch.load(
                MODEL_PATH,
                map_location=_device
            )
        )


        _model.to(
            _device
        )


        _model.eval()


        print("Model loaded.")


    return _model