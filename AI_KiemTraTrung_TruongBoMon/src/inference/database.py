import re
import psycopg2
from psycopg2.extras import RealDictCursor
from src.config import (
    DB_CONFIG,
    DB_TABLE,
    DB_ID_COLUMN,
    DB_TITLE_COLUMN,
    DB_STATUS_COLUMN,
    DB_APPROVED_VALUE
)

# ============================================================
# SECURITY
# ============================================================
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

def safe_identifier(value: str):
    if not IDENTIFIER_PATTERN.match(value):
        raise ValueError(f"Database identifier không hợp lệ: {value}")
    # PostgreSQL dùng dấu ngoặc kép (double quotes) cho tên bảng/cột
    return f'"{value}"'

# ============================================================
# CONNECTION
# ============================================================
def get_connection():
    # Kết nối tới PostgreSQL bằng psycopg2
    return psycopg2.connect(**DB_CONFIG)

# ============================================================
# GET TOPICS
# ============================================================
def get_existing_titles():
    table = safe_identifier(DB_TABLE)
    id_column = safe_identifier(DB_ID_COLUMN)
    title_column = safe_identifier(DB_TITLE_COLUMN)
    status_column = safe_identifier(DB_STATUS_COLUMN)
    sql = f"""
        SELECT
            {id_column} AS topic_id,
            {title_column} AS title
        FROM {table}
        WHERE
            {status_column} = %s
            AND {title_column} IS NOT NULL
            AND TRIM({title_column}) <> ''
    """
    connection = get_connection()
    # Sử dụng RealDictCursor để kết quả trả về dưới dạng dictionary (tương tự dictionary=True của MySQL)
    cursor = connection.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(sql, (DB_APPROVED_VALUE,))
        rows = cursor.fetchall()
        return rows
    finally:
        cursor.close()
        connection.close()