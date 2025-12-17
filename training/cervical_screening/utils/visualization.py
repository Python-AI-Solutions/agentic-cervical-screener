"""
Visualization utilities
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns


def plot_confusion_matrix(confusion_matrix, class_names, save_path=None, figsize=(10, 8)):
    """
    Plot confusion matrix

    Args:
        confusion_matrix: Confusion matrix array
        class_names: List of class names
        save_path: Path to save figure (optional)
        figsize: Figure size
    """
    plt.figure(figsize=figsize)

    sns.heatmap(
        confusion_matrix,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        cbar_kws={"label": "Count"},
    )

    plt.title("Confusion Matrix", fontsize=16, fontweight="bold")
    plt.ylabel("True Label", fontsize=12)
    plt.xlabel("Predicted Label", fontsize=12)
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        print(f"✅ Confusion matrix saved to: {save_path}")

    plt.show()


def plot_metrics_comparison(metrics_dict, save_path=None, figsize=(12, 6)):
    """
    Plot metrics comparison across classes

    Args:
        metrics_dict: Dictionary with class metrics
                     {class_name: {'precision': X, 'recall': Y, 'f1': Z}}
        save_path: Path to save figure (optional)
        figsize: Figure size
    """
    classes = list(metrics_dict.keys())

    precision = [metrics_dict[c]["precision"] for c in classes]
    recall = [metrics_dict[c]["recall"] for c in classes]
    f1 = [metrics_dict[c]["f1"] for c in classes]

    x = np.arange(len(classes))
    width = 0.25

    fig, ax = plt.subplots(figsize=figsize)

    ax.bar(x - width, precision, width, label="Precision", color="#3498db")
    ax.bar(x, recall, width, label="Recall", color="#2ecc71")
    ax.bar(x + width, f1, width, label="F1-Score", color="#e74c3c")

    ax.set_xlabel("Class", fontsize=12, fontweight="bold")
    ax.set_ylabel("Score", fontsize=12, fontweight="bold")
    ax.set_title("Per-Class Metrics Comparison", fontsize=14, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(classes, rotation=45, ha="right")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    ax.set_ylim(0, 1.1)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        print(f"✅ Metrics comparison saved to: {save_path}")

    plt.show()


def plot_training_curves(results_dir, save_path=None):
    """
    Plot training curves from YOLO results

    Args:
        results_dir: Directory containing YOLO results
        save_path: Path to save figure (optional)
    """
    results_dir = Path(results_dir)
    results_csv = results_dir / "results.csv"

    if not results_csv.exists():
        print(f"❌ Results CSV not found: {results_csv}")
        return

    import pandas as pd

    df = pd.read_csv(results_csv)
    df.columns = df.columns.str.strip()  # Remove whitespace

    fig, axes = plt.subplots(2, 2, figsize=(15, 10))

    # Loss curves
    if "train/box_loss" in df.columns:
        axes[0, 0].plot(df["epoch"], df["train/box_loss"], label="Box Loss")
        axes[0, 0].plot(df["epoch"], df["train/cls_loss"], label="Class Loss")
        axes[0, 0].plot(df["epoch"], df["train/dfl_loss"], label="DFL Loss")
        axes[0, 0].set_title("Training Losses", fontweight="bold")
        axes[0, 0].set_xlabel("Epoch")
        axes[0, 0].set_ylabel("Loss")
        axes[0, 0].legend()
        axes[0, 0].grid(alpha=0.3)

    # mAP curves
    if "metrics/mAP50(B)" in df.columns:
        axes[0, 1].plot(df["epoch"], df["metrics/mAP50(B)"], label="mAP50")
        if "metrics/mAP50-95(B)" in df.columns:
            axes[0, 1].plot(df["epoch"], df["metrics/mAP50-95(B)"], label="mAP50-95")
        axes[0, 1].set_title("mAP Metrics", fontweight="bold")
        axes[0, 1].set_xlabel("Epoch")
        axes[0, 1].set_ylabel("mAP")
        axes[0, 1].legend()
        axes[0, 1].grid(alpha=0.3)

    # Precision/Recall
    if "metrics/precision(B)" in df.columns:
        axes[1, 0].plot(df["epoch"], df["metrics/precision(B)"], label="Precision")
        axes[1, 0].plot(df["epoch"], df["metrics/recall(B)"], label="Recall")
        axes[1, 0].set_title("Precision & Recall", fontweight="bold")
        axes[1, 0].set_xlabel("Epoch")
        axes[1, 0].set_ylabel("Score")
        axes[1, 0].legend()
        axes[1, 0].grid(alpha=0.3)

    # Learning rate
    if "lr/pg0" in df.columns:
        axes[1, 1].plot(df["epoch"], df["lr/pg0"])
        axes[1, 1].set_title("Learning Rate", fontweight="bold")
        axes[1, 1].set_xlabel("Epoch")
        axes[1, 1].set_ylabel("Learning Rate")
        axes[1, 1].grid(alpha=0.3)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        print(f"✅ Training curves saved to: {save_path}")

    plt.show()
