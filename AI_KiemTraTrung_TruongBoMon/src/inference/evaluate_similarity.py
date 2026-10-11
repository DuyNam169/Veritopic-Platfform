"""Small ranking sanity check; these examples do not calibrate warning thresholds.

Run: python -m src.inference.evaluate_similarity
"""
import json

from src.config import MODEL_NAME, MODEL_MODE
from src.inference.embedding import encode_titles


CASES = [
    {
        "name": "air_quality",
        "query": "Mạng cảm biến IoT quan trắc chất lượng không khí trên tuyến giao thông\nĐo bụi mịn, nhiệt độ, độ ẩm; truyền dữ liệu LoRa và trực quan theo vị trí.",
        "related": "Hệ thống đo ô nhiễm không khí ven đường bằng cảm biến kết nối\nThu thập bụi PM2.5, nhiệt độ, độ ẩm; gửi qua LoRa và hiển thị bản đồ chất lượng không khí.",
        "different": "Hệ thống cảnh báo điểm mù cho xe tải bằng cảm biến siêu âm\nPhát hiện phương tiện bên hông xe và cảnh báo tài xế để tránh va chạm.",
    },
    {
        "name": "library",
        "query": "Phần mềm quản lý mượn trả sách thư viện\nTheo dõi bạn đọc, kho sách, hạn trả và tiền phạt.",
        "related": "Ứng dụng quản lý hoạt động thư viện\nQuản lý độc giả, sách và giao dịch mượn trả, tính phí quá hạn.",
        "different": "Phần mềm quản lý bán hàng siêu thị\nTheo dõi đơn hàng, thanh toán và doanh thu cửa hàng.",
    },
    {
        "name": "same_title_different_scope",
        "query": "Hệ thống giám sát thông minh\nĐo chất lượng không khí bằng cảm biến bụi mịn và cảnh báo ô nhiễm.",
        "related": "Giám sát môi trường không khí\nĐo bụi PM2.5, theo dõi ô nhiễm và phát cảnh báo chất lượng không khí.",
        "different": "Hệ thống giám sát thông minh\nDùng camera nhận diện khuôn mặt để kiểm soát ra vào tòa nhà.",
    },
]


def main():
    report = {"model": MODEL_NAME, "mode": MODEL_MODE,
              "purpose": "ranking sanity check, not an accuracy benchmark or threshold calibration",
              "cases": []}
    for case in CASES:
        vectors = encode_titles([case["query"], case["related"], case["different"]]).cpu()
        related = float(vectors[0] @ vectors[1]) * 100
        different = float(vectors[0] @ vectors[2]) * 100
        report["cases"].append({"name": case["name"], "related_score": round(related, 2),
                                "different_score": round(different, 2),
                                "correct_order": related > different})
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not all(case["correct_order"] for case in report["cases"]):
        raise SystemExit("Model failed a basic ranking check")


if __name__ == "__main__":
    main()
