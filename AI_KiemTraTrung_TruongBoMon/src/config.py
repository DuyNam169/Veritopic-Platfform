import os
from pathlib import Path
from dotenv import load_dotenv
# ============================================================
# ROOT PROJECT
# ============================================================
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
# ============================================================
# AI CONFIG
# ============================================================
MODEL_NAME = os.getenv( "MODEL_NAME","vinai/phobert-base-v2")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "128"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "4"))
EPOCHS = int(os.getenv("EPOCHS", "5"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "0.00002"))
PATIENCE = int(
os.getenv("PATIENCE", "2"))
RANDOM_SEED = int(os.getenv("RANDOM_SEED", "42"))
# ============================================================
# DATABASE
# ============================================================
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", ""),
}
DB_TABLE = os.getenv("DB_TABLE","topics")
DB_ID_COLUMN = os.getenv("DB_ID_COLUMN","id")
DB_TITLE_COLUMN = os.getenv("DB_TITLE_COLUMN","title")
DB_STATUS_COLUMN = os.getenv("DB_STATUS_COLUMN","status")
DB_APPROVED_VALUE = os.getenv(
    "DB_APPROVED_VALUE",
    "APPROVED"
)
# ============================================================
# PATH
# ============================================================
DATA_DIR = ROOT_DIR / "data"
DATA_FILE = (DATA_DIR /"title_pairs.csv")
MODEL_DIR = ROOT_DIR / "models"
MODEL_PATH = (MODEL_DIR /"tier1_best.pt")
RESULTS_DIR = ROOT_DIR / "results"
TRAINING_RESULTS_DIR = (RESULTS_DIR /"training")
EVALUATION_RESULTS_DIR = (RESULTS_DIR /"evaluation")