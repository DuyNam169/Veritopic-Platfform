-- Tự động chạy khi container Postgres khởi tạo lần đầu (mount vào docker-entrypoint-initdb.d).
CREATE EXTENSION IF NOT EXISTS vector;
