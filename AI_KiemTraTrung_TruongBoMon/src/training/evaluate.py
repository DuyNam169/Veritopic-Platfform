import json

import numpy as np
import torch
import matplotlib.pyplot as plt
import seaborn as sns

from torch.utils.data import DataLoader

from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error
)

from src.config import (
    MODEL_NAME,
    MODEL_PATH,
    BATCH_SIZE,
    EVALUATION_RESULTS_DIR
)

from src.training.dataset import (
    TitlePairDataset,
    load_and_split
)

from src.training.model import (
    SiamesePhoBERT
)


# ============================================================
# SCORE -> CLASS
# ============================================================

def score_to_class(score):

    score = np.clip(
        score,
        0.0,
        1.0
    )

    return int(
        np.round(score * 4)
    )


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Device
    # --------------------------------------------------------

    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        f"Device: {device}"
    )


    # --------------------------------------------------------
    # Load test
    # --------------------------------------------------------

    _, _, test_df = (
        load_and_split()
    )

    print(
        f"Test samples: {len(test_df)}"
    )


    test_dataset = TitlePairDataset(
        test_df
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False
    )


    # --------------------------------------------------------
    # Load model
    # --------------------------------------------------------

    model = SiamesePhoBERT(
        MODEL_NAME
    )

    model.load_state_dict(
        torch.load(
            MODEL_PATH,
            map_location=device
        )
    )

    model.to(device)

    model.eval()


    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    true_scores = []

    predicted_scores = []


    with torch.no_grad():

        for batch in test_loader:

            predictions = model(
                batch["input_ids_a"].to(device),
                batch["attention_mask_a"].to(device),
                batch["input_ids_b"].to(device),
                batch["attention_mask_b"].to(device)
            )

            predicted_scores.extend(
                predictions
                .cpu()
                .numpy()
                .tolist()
            )

            true_scores.extend(
                batch["label"]
                .numpy()
                .tolist()
            )


    true_scores = np.array(
        true_scores
    )

    predicted_scores = np.array(
        predicted_scores
    )


    # --------------------------------------------------------
    # Convert to classes
    # --------------------------------------------------------

    true_classes = np.array([
        score_to_class(x)
        for x in true_scores
    ])

    predicted_classes = np.array([
        score_to_class(x)
        for x in predicted_scores
    ])


    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    accuracy = accuracy_score(
        true_classes,
        predicted_classes
    )

    precision, recall, f1, _ = (
        precision_recall_fscore_support(
            true_classes,
            predicted_classes,
            labels=[0, 1, 2, 3, 4],
            average="macro",
            zero_division=0
        )
    )

    mae = mean_absolute_error(
        true_scores,
        predicted_scores
    )

    rmse = np.sqrt(
        mean_squared_error(
            true_scores,
            predicted_scores
        )
    )


    metrics = {

        "accuracy":
            float(accuracy),

        "precision_macro":
            float(precision),

        "recall_macro":
            float(recall),

        "f1_macro":
            float(f1),

        "mae":
            float(mae),

        "rmse":
            float(rmse),

        "test_size":
            len(true_scores)
    }


    # --------------------------------------------------------
    # Create result directory
    # --------------------------------------------------------

    EVALUATION_RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    # --------------------------------------------------------
    # Save metrics
    # --------------------------------------------------------

    with open(
        EVALUATION_RESULTS_DIR /
        "metrics.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            metrics,
            file,
            indent=4
        )


    # --------------------------------------------------------
    # Confusion Matrix
    # --------------------------------------------------------

    cm = confusion_matrix(
        true_classes,
        predicted_classes,
        labels=[0, 1, 2, 3, 4]
    )


    plt.figure(
        figsize=(8, 7)
    )

    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=[
            "0",
            "1",
            "2",
            "3",
            "4"
        ],
        yticklabels=[
            "0",
            "1",
            "2",
            "3",
            "4"
        ]
    )

    plt.xlabel(
        "Predicted Label"
    )

    plt.ylabel(
        "True Label"
    )

    plt.title(
        "Tier 1 Confusion Matrix"
    )

    plt.tight_layout()

    plt.savefig(
        EVALUATION_RESULTS_DIR /
        "confusion_matrix.png",
        dpi=200
    )

    plt.close()


    # --------------------------------------------------------
    # Prediction vs Label
    # --------------------------------------------------------

    plt.figure(
        figsize=(8, 6)
    )

    plt.scatter(
        true_scores * 4,
        predicted_scores * 4,
        alpha=0.7
    )

    plt.xlabel(
        "True Similarity Level"
    )

    plt.ylabel(
        "Predicted Similarity Level"
    )

    plt.title(
        "Prediction vs True Label"
    )

    plt.grid(
        alpha=0.3
    )

    plt.tight_layout()

    plt.savefig(
        EVALUATION_RESULTS_DIR /
        "prediction_vs_label.png",
        dpi=200
    )

    plt.close()


    # --------------------------------------------------------
    # Save predictions
    # --------------------------------------------------------

    result_df = test_df.copy()

    result_df[
        "true_score"
    ] = true_scores

    result_df[
        "predicted_score"
    ] = predicted_scores

    result_df[
        "true_label"
    ] = true_classes

    result_df[
        "predicted_label"
    ] = predicted_classes

    result_df.to_csv(
        EVALUATION_RESULTS_DIR /
        "test_predictions.csv",
        index=False
    )


    # --------------------------------------------------------
    # Print
    # --------------------------------------------------------

    print()
    print("=" * 60)

    print("EVALUATION RESULT")

    print("=" * 60)

    for key, value in metrics.items():

        print(
            f"{key}: {value}"
        )

    print("=" * 60)


if __name__ == "__main__":

    main()