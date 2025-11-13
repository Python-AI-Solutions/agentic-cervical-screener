"""
Input/Output utilities
"""

import json
import pickle
from pathlib import Path

import pandas as pd


def save_results(results, output_path, format="json"):
    """
    Save results to file

    Args:
        results: Results dictionary
        output_path: Output file path
        format: Format ('json', 'pickle', 'csv')
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if format == "json":
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)

    elif format == "pickle":
        with open(output_path, "wb") as f:
            pickle.dump(results, f)

    elif format == "csv":
        if isinstance(results, dict):
            df = pd.DataFrame([results])
        else:
            df = pd.DataFrame(results)
        df.to_csv(output_path, index=False)

    else:
        raise ValueError(f"Unsupported format: {format}")

    print(f"✅ Results saved to: {output_path}")


def load_results(input_path, format="json"):
    """
    Load results from file

    Args:
        input_path: Input file path
        format: Format ('json', 'pickle', 'csv')

    Returns:
        Loaded results
    """
    input_path = Path(input_path)

    if not input_path.exists():
        raise FileNotFoundError(f"File not found: {input_path}")

    if format == "json":
        with open(input_path) as f:
            results = json.load(f)

    elif format == "pickle":
        with open(input_path, "rb") as f:
            results = pickle.load(f)

    elif format == "csv":
        results = pd.read_csv(input_path)

    else:
        raise ValueError(f"Unsupported format: {format}")

    return results


def save_metrics_table(metrics, output_path):
    """
    Save metrics as formatted table

    Args:
        metrics: Dictionary of metrics per class
        output_path: Output CSV path
    """
    rows = []

    for class_name, class_metrics in metrics.items():
        row = {
            "Class": class_name,
            "Precision": f"{class_metrics['precision']:.3f}",
            "Recall": f"{class_metrics['recall']:.3f}",
            "F1-Score": f"{class_metrics['f1']:.3f}",
            "TP": class_metrics.get("tp", 0),
            "FP": class_metrics.get("fp", 0),
            "FN": class_metrics.get("fn", 0),
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)

    print(f"✅ Metrics table saved to: {output_path}")

    return df
