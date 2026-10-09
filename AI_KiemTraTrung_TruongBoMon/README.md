# AI Kiểm Tra Trùng Đề Tài - Tầng 1

Mục tiêu: nhận tên đề tài mới, tính mức độ tương đồng với các tên đề tài cũ, trả Top-K và mức cảnh báo.

## Mô hình
- Vietnamese Transformer: `vinai/phobert-base-v2`
- Kiến trúc: Siamese encoder dùng chung PhoBERT
- Similarity: cosine similarity
- Huấn luyện: regression với target 5 mức (0..4), ánh xạ về [-1, 1]
- Đánh giá: MAE, RMSE, Spearman, Accuracy/F1 sau khi lượng tử hóa về 5 mức, confusion matrix.
- Biểu đồ: train/validation loss, prediction-vs-label, confusion matrix.

## Cấu trúc
AI_KiemTraTrung_Tier1/
├── data/
│   └── title_pairs_200.csv   # đặt dataset của bạn vào đây
├── models/
├── results/
│   ├── training/
│   └── evaluation/
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── preprocess.py
│   ├── dataset.py
│   ├── model.py
│   ├── train.py
│   ├── evaluate.py
│   └── predict.py
├── requirements.txt
└── README.md

## CSV bắt buộc
Header:
id,title_a,title_b,label,similarity_level

label:
0 = Không tương đồng
1 = Tương đồng thấp
2 = Tương đồng trung bình
3 = Tương đồng cao
4 = Gần như trùng

## Cài đặt
Python 3.10 hoặc 3.11 được khuyến nghị.

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Chạy
Từ thư mục gốc:

```bash
python -m src.train
python -m src.evaluate
python -m src.predict
```

Lần đầu chạy Hugging Face sẽ tải PhoBERT về cache.

## API cho backend

Cài dependency (nếu chưa cài) và chạy API từ thư mục gốc:

```bash
pip install -r requirements.txt
python -m uvicorn src.inference.api:app --host 127.0.0.1 --port 8001
```

AI Service chạy cổng `8001`; Django backend chạy riêng ở cổng `8000`.
Mở `http://localhost:8001/docs` để test bằng Swagger UI. Endpoint kiểm tra là `POST /api/v1/check-title`:

```json
{
	"title": "Ứng dụng trí tuệ nhân tạo trong giáo dục",
	"top_k": 5,
	"candidates": [
		{"topic_id": 1, "title": "Ứng dụng AI hỗ trợ học tập"}
	]
}
```

`candidates` là tùy chọn. Nếu bỏ qua, API đọc đề tài APPROVED từ PostgreSQL theo cấu hình trong `.env`. Response trả về `query`, `count`, và `results` gồm `topic_id`, `title`, `similarity`, `percent`, `warning`. Health check: `GET /health`.

Mỗi candidate có thể gửi thêm `embedding` (vector 768 chiều) đã được mã hóa
trước. API dùng vector này để so sánh mà không mã hóa lại tiêu đề candidate;
nếu thiếu vector hoặc vector không khớp chiều, API sẽ tự mã hóa tiêu đề đó.
Backend Django lưu vector theo model trong `topic_embeddings` và gửi các vector
đã lưu cùng danh sách candidate. Tên đề tài mới được gửi để kiểm tra vẫn cần
được mã hóa một lần cho mỗi yêu cầu.

## Kết quả
- `models/tier1_best.pt`: checkpoint tốt nhất.
- `results/training/loss_curve.png`: train/validation loss.
- `results/evaluation/metrics.json`: metrics test.
- `results/evaluation/confusion_matrix.png`: confusion matrix 5 lớp.
- `results/evaluation/prediction_vs_label.png`: so sánh nhãn thật và dự đoán.
- `results/evaluation/test_predictions.csv`: dự đoán trên test.

## Lưu ý
200 cặp là dataset nhỏ cho fine-tuning. Dùng để xây pipeline/debug trước; khi báo cáo chính thức nên có nhiều cặp được gán nhãn bởi người đánh giá.
