import pandas as pd
import torch

from torch.utils.data import Dataset
from transformers import AutoTokenizer

from sklearn.model_selection import train_test_split

from src.config import (
    MODEL_NAME,
    MAX_LENGTH,
    DATA_FILE
)

from src.preprocess import normalize_text


# ============================================================
# TOKENIZER
# ============================================================

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME
)


# ============================================================
# DATASET
# ============================================================

class TitlePairDataset(Dataset):

    def __init__(self, dataframe):

        self.df = dataframe.reset_index(
            drop=True
        )

    def __len__(self):

        return len(self.df)

    def __getitem__(self, index):

        row = self.df.iloc[index]

        title_a = normalize_text(
            row["title_a"]
        )

        title_b = normalize_text(
            row["title_b"]
        )

        # ----------------------------------------------------
        # Tokenize title A
        # ----------------------------------------------------

        encoded_a = tokenizer(
            title_a,
            max_length=MAX_LENGTH,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        # ----------------------------------------------------
        # Tokenize title B
        # ----------------------------------------------------

        encoded_b = tokenizer(
            title_b,
            max_length=MAX_LENGTH,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        # ----------------------------------------------------
        # Label
        #
        # 0 -> Không tương đồng
        # 1 -> Thấp
        # 2 -> Trung bình
        # 3 -> Cao
        # 4 -> Gần như trùng
        #
        # Normalize về 0 -> 1
        # ----------------------------------------------------

        label = float(
            row["label"]
        ) / 4.0

        return {
            "input_ids_a":
                encoded_a["input_ids"].squeeze(0),

            "attention_mask_a":
                encoded_a["attention_mask"].squeeze(0),

            "input_ids_b":
                encoded_b["input_ids"].squeeze(0),

            "attention_mask_b":
                encoded_b["attention_mask"].squeeze(0),

            "label":
                torch.tensor(
                    label,
                    dtype=torch.float32
                )
        }


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    df = pd.read_csv(
        DATA_FILE
    )

    required_columns = {
        "title_a",
        "title_b",
        "label"
    }

    missing = (
        required_columns
        - set(df.columns)
    )

    if missing:

        raise ValueError(
            f"CSV thiếu cột: {missing}"
        )

    # Kiểm tra label
    invalid_labels = df[
        ~df["label"].isin([0, 1, 2, 3, 4])
    ]

    if len(invalid_labels) > 0:

        raise ValueError(
            "Label phải nằm trong khoảng 0-4"
        )

    return df


# ============================================================
# TRAIN / VAL / TEST
# ============================================================

def load_and_split():

    df = load_data()

    # --------------------------------------------------------
    # Train + temporary
    # 85% train/val
    # 15% test
    # --------------------------------------------------------

    try:

        train_val, test = train_test_split(
            df,
            test_size=0.15,
            random_state=42,
            stratify=df["label"]
        )

    except ValueError:

        # Dataset quá ít mẫu ở một số class
        train_val, test = train_test_split(
            df,
            test_size=0.15,
            random_state=42
        )

    # --------------------------------------------------------
    # Train + Validation
    #
    # 70% train
    # 15% validation
    # --------------------------------------------------------

    try:

        train, val = train_test_split(
            train_val,
            test_size=0.1765,
            random_state=42,
            stratify=train_val["label"]
        )

    except ValueError:

        train, val = train_test_split(
            train_val,
            test_size=0.1765,
            random_state=42
        )

    return (
        train.reset_index(drop=True),
        val.reset_index(drop=True),
        test.reset_index(drop=True)
    )