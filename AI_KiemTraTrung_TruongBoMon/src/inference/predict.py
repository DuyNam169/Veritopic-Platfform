import argparse

import torch

from tqdm import tqdm

from src.inference.database import (
    get_existing_titles
)

from src.inference.model_loader import (
    get_model
)

from src.inference.embedding import (
    encode_title
)

from src.inference.similarity import (
    cosine_similarity,
    model_score_to_percent,
    warning_level
)


# ============================================================
# CHECK TITLE
# ============================================================

def rank_title_candidates(
    new_title,
    topics,
    top_k=10,
    show_progress=False
):

    new_embedding = encode_title(
        new_title
    )

    topic_iter = (
        tqdm(topics, desc="Comparing topics")
        if show_progress
        else topics
    )

    results = []

    for topic in topic_iter:

        old_title = topic["title"]
        cached_embedding = topic.get("embedding")
        if (
            isinstance(cached_embedding, list)
            and len(cached_embedding) == new_embedding.shape[1]
        ):
            old_embedding = torch.tensor(
                cached_embedding,
                dtype=new_embedding.dtype,
                device=new_embedding.device,
            ).unsqueeze(0)
        else:
            old_embedding = encode_title(old_title)
        score = cosine_similarity(
            new_embedding,
            old_embedding
        )
        percent = model_score_to_percent(score)

        results.append({
            "topic_id": topic.get("topic_id"),
            "title": old_title,
            "similarity": score,
            "percent": round(percent, 2),
            "warning": warning_level(percent)
        })

    results.sort(
        key=lambda item: item["similarity"],
        reverse=True
    )

    return results[:top_k]


def check_title(
    new_title,
    top_k=10
):

    # --------------------------------------------------------
    # 1. Lấy đề tài từ MySQL
    # --------------------------------------------------------

    topics = get_existing_titles()


    if not topics:

        print(
            "Không tìm thấy đề tài APPROVED trong database."
        )

        return []


    # --------------------------------------------------------
    # 2. Encode title mới
    # --------------------------------------------------------

    print(
        f"Đang kiểm tra: {new_title}"
    )


    return rank_title_candidates(
        new_title,
        topics,
        top_k,
        show_progress=True
    )


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "AI Tầng 1 - "
            "Kiểm tra tương đồng tên đề tài"
        )
    )


    parser.add_argument(
        "--title",
        type=str,
        help="Tên đề tài mới"
    )


    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Số lượng đề tài tương đồng cần trả về"
    )


    args = parser.parse_args()


    # --------------------------------------------------------
    # Input
    # --------------------------------------------------------

    if args.title:

        new_title = args.title

    else:

        new_title = input(
            "\nNhập tên đề tài mới: "
        ).strip()


    if not new_title:

        print(
            "Tên đề tài không được để trống."
        )

        return


    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------

    results = check_title(
        new_title,
        args.top_k
    )


    # --------------------------------------------------------
    # Output
    # --------------------------------------------------------

    print()

    print("=" * 80)

    print(
        "KẾT QUẢ KIỂM TRA ĐỀ TÀI"
    )

    print("=" * 80)

    print()

    print(
        f"Đề tài mới:"
    )

    print(
        new_title
    )

    print()

    print(
        "TOP ĐỀ TÀI TƯƠNG ĐỒNG:"
    )

    print()


    for index, item in enumerate(
        results,
        start=1
    ):

        print(
            f"{index}. "
            f"[ID: {item['topic_id']}] "
            f"{item['title']}"
        )

        print(
            f"   Similarity: "
            f"{item['percent']:.2f}%"
        )

        print(
            f"   Cảnh báo: "
            f"{item['warning']}"
        )

        print()


if __name__ == "__main__":

    main()