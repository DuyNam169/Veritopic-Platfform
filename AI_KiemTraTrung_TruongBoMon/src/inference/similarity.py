import torch


def cosine_similarity(
    embedding_a,
    embedding_b
):

    similarity = torch.sum(
        embedding_a * embedding_b,
        dim=1
    )

    return float(
        similarity.item()
    )


def model_score_to_percent(
    score
):

    # Model được train với target 0.0 -> 1.0

    score = max(
        0.0,
        min(1.0, score)
    )

    return score * 100.0


def warning_level(
    percent
):
    return "Cần đối chiếu"
