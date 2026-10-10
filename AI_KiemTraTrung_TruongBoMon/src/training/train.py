import json
import random

import numpy as np
import torch
import matplotlib.pyplot as plt

from torch.utils.data import DataLoader
from torch.optim import AdamW

from tqdm import tqdm

from src.config import (
    MODEL_NAME,
    MODEL_PATH,
    MODEL_DIR,
    BATCH_SIZE,
    EPOCHS,
    LEARNING_RATE,
    PATIENCE,
    RANDOM_SEED,
    TRAINING_RESULTS_DIR
)

from src.training.dataset import (
    TitlePairDataset,
    load_and_split
)

from src.training.model import (
    SiamesePhoBERT
)


# ============================================================
# SEED
# ============================================================

def set_seed(seed):

    random.seed(seed)

    np.random.seed(seed)

    torch.manual_seed(seed)

    if torch.cuda.is_available():

        torch.cuda.manual_seed_all(seed)


# ============================================================
# TRAIN / VALIDATION
# ============================================================

def run_epoch(
    model,
    loader,
    criterion,
    optimizer,
    device,
    training=True
):

    if training:

        model.train()

    else:

        model.eval()

    total_loss = 0.0

    progress = tqdm(
        loader,
        desc="Training" if training else "Validation"
    )

    for batch in progress:

        input_ids_a = (
            batch["input_ids_a"]
            .to(device)
        )

        attention_mask_a = (
            batch["attention_mask_a"]
            .to(device)
        )

        input_ids_b = (
            batch["input_ids_b"]
            .to(device)
        )

        attention_mask_b = (
            batch["attention_mask_b"]
            .to(device)
        )

        labels = (
            batch["label"]
            .to(device)
        )

        if training:

            optimizer.zero_grad()

        with torch.set_grad_enabled(training):

            predictions = model(
                input_ids_a,
                attention_mask_a,
                input_ids_b,
                attention_mask_b
            )

            loss = criterion(
                predictions,
                labels
            )

            if training:

                loss.backward()

                torch.nn.utils.clip_grad_norm_(
                    model.parameters(),
                    max_norm=1.0
                )

                optimizer.step()

        total_loss += loss.item()

        progress.set_postfix(
            loss=f"{loss.item():.4f}"
        )

    return (
        total_loss /
        max(len(loader), 1)
    )


# ============================================================
# MAIN
# ============================================================

def main():

    set_seed(
        RANDOM_SEED
    )

    # --------------------------------------------------------
    # Device
    # --------------------------------------------------------

    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    print("=" * 60)

    print(
        f"Device: {device}"
    )

    if torch.cuda.is_available():

        print(
            f"GPU: {torch.cuda.get_device_name(0)}"
        )

    print("=" * 60)


    # --------------------------------------------------------
    # Load dataset
    # --------------------------------------------------------

    train_df, val_df, test_df = (
        load_and_split()
    )

    print(
        f"Train: {len(train_df)}"
    )

    print(
        f"Validation: {len(val_df)}"
    )

    print(
        f"Test: {len(test_df)}"
    )


    # --------------------------------------------------------
    # Save split
    # --------------------------------------------------------

    split_dir = (
        TRAINING_RESULTS_DIR /
        "splits"
    )

    split_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    train_df.to_csv(
        split_dir / "train.csv",
        index=False
    )

    val_df.to_csv(
        split_dir / "val.csv",
        index=False
    )

    test_df.to_csv(
        split_dir / "test.csv",
        index=False
    )


    # --------------------------------------------------------
    # Dataset
    # --------------------------------------------------------

    train_dataset = TitlePairDataset(
        train_df
    )

    val_dataset = TitlePairDataset(
        val_df
    )


    # --------------------------------------------------------
    # DataLoader
    # --------------------------------------------------------

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False
    )


    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = SiamesePhoBERT(
        MODEL_NAME
    )

    model.to(device)


    # --------------------------------------------------------
    # Optimizer
    # --------------------------------------------------------

    optimizer = AdamW(
        model.parameters(),
        lr=LEARNING_RATE
    )


    # --------------------------------------------------------
    # Loss
    # --------------------------------------------------------

    criterion = torch.nn.MSELoss()


    # --------------------------------------------------------
    # History
    # --------------------------------------------------------

    train_losses = []

    val_losses = []


    # --------------------------------------------------------
    # Best model
    # --------------------------------------------------------

    best_val_loss = float("inf")

    patience_counter = 0


    # --------------------------------------------------------
    # Training
    # --------------------------------------------------------

    for epoch in range(EPOCHS):

        print()
        print(
            f"========== EPOCH "
            f"{epoch + 1}/{EPOCHS} =========="
        )

        train_loss = run_epoch(
            model=model,
            loader=train_loader,
            criterion=criterion,
            optimizer=optimizer,
            device=device,
            training=True
        )

        val_loss = run_epoch(
            model=model,
            loader=val_loader,
            criterion=criterion,
            optimizer=optimizer,
            device=device,
            training=False
        )

        train_losses.append(
            train_loss
        )

        val_losses.append(
            val_loss
        )

        print(
            f"Train Loss: {train_loss:.6f}"
        )

        print(
            f"Val Loss:   {val_loss:.6f}"
        )


        # ----------------------------------------------------
        # Save best model
        # ----------------------------------------------------

        if val_loss < best_val_loss:

            best_val_loss = val_loss

            patience_counter = 0

            MODEL_DIR.mkdir(
                parents=True,
                exist_ok=True
            )

            torch.save(
                model.state_dict(),
                MODEL_PATH
            )

            print(
                f"✓ Saved best model: "
                f"{MODEL_PATH}"
            )

        else:

            patience_counter += 1

            print(
                f"No improvement: "
                f"{patience_counter}/{PATIENCE}"
            )

            if (
                patience_counter
                >= PATIENCE
            ):

                print(
                    "Early stopping."
                )

                break


    # --------------------------------------------------------
    # Save history
    # --------------------------------------------------------

    TRAINING_RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    history = {
        "train_loss": train_losses,
        "val_loss": val_losses
    }

    with open(
        TRAINING_RESULTS_DIR /
        "history.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            history,
            file,
            indent=4
        )


    # --------------------------------------------------------
    # Plot loss
    # --------------------------------------------------------

    plt.figure(
        figsize=(9, 6)
    )

    plt.plot(
        train_losses,
        marker="o",
        label="Train Loss"
    )

    plt.plot(
        val_losses,
        marker="o",
        label="Validation Loss"
    )

    plt.xlabel(
        "Epoch"
    )

    plt.ylabel(
        "MSE Loss"
    )

    plt.title(
        "Tier 1 - Training / Validation Loss"
    )

    plt.legend()

    plt.grid(
        alpha=0.3
    )

    plt.tight_layout()

    plt.savefig(
        TRAINING_RESULTS_DIR /
        "loss_curve.png",
        dpi=200
    )

    plt.close()


    print()
    print("=" * 60)

    print(
        "TRAINING HOÀN TẤT"
    )

    print(
        f"Model: {MODEL_PATH}"
    )

    print("=" * 60)


if __name__ == "__main__":

    main()