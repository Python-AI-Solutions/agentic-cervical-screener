#!/usr/bin/env python3
"""Import a subset of a YOLO-style dataset into the static demo.

This script:
- Copies selected dataset images into `public/images/` as lossless WebP.
- Converts YOLO label `.txt` files (normalized xywh) into GeoJSON polygons.
- Writes per-case manifests into `public/cases/`.
- Writes/updates a simple index file (`public/cases/dataset-samples.json`) for the UI.

The output is intentionally static-site friendly (relative URIs under `public/`).
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

LOG = logging.getLogger("import_dataset_cases")


@dataclass(frozen=True)
class DatasetItem:
    image_id: str
    split: str
    image_path: Path
    label_path: Path


def parse_names_from_ultralytics_yaml(path: Path) -> list[str]:
    """Parse the `names:` list from an Ultralytics/YOLO `data.yaml` without PyYAML."""
    lines = path.read_text(encoding="utf-8").splitlines()
    in_names = False
    names: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("names:"):
            in_names = True
            continue
        if in_names:
            if stripped.startswith("-"):
                value = stripped.lstrip("-").strip()
                value = value.strip("'\"")
                names.append(value)
                continue
            # Stop when we hit the next top-level key
            if ":" in stripped:
                break
    if not names:
        raise ValueError(f"Failed to parse class names from: {path}")
    return names


def find_dataset_item(dataset_root: Path, image_id: str, splits: list[str]) -> DatasetItem:
    for split in splits:
        image_path = dataset_root / split / "images" / f"{image_id}.png"
        label_path = dataset_root / split / "labels" / f"{image_id}.txt"
        if image_path.exists() and label_path.exists():
            return DatasetItem(
                image_id=image_id, split=split, image_path=image_path, label_path=label_path
            )
    raise FileNotFoundError(
        f"Could not find image/label for {image_id} under {dataset_root} (splits={splits})"
    )


def convert_to_webp(src: Path, dest: Path, *, overwrite: bool) -> tuple[int, int]:
    if dest.exists() and not overwrite:
        with Image.open(dest) as im:
            return im.size

    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        width, height = im.size
        im.save(dest, "WEBP", lossless=True, quality=90, method=6)
    return width, height


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def yolo_labels_to_geojson(
    label_path: Path, *, image_width: int, image_height: int, class_names: list[str]
) -> dict:
    features: list[dict] = []
    counts: dict[str, int] = {}
    num_skipped = 0

    for idx, raw in enumerate(label_path.read_text(encoding="utf-8").splitlines()):
        line = raw.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 5:
            num_skipped += 1
            continue

        try:
            class_id = int(float(parts[0]))
            cx = float(parts[1])
            cy = float(parts[2])
            w = float(parts[3])
            h = float(parts[4])
        except ValueError:
            num_skipped += 1
            continue

        # YOLO: normalized center-x/center-y/width/height (0..1)
        cx_px = cx * image_width
        cy_px = cy * image_height
        w_px = w * image_width
        h_px = h * image_height

        x1 = clamp(cx_px - (w_px / 2), 0, image_width)
        y1 = clamp(cy_px - (h_px / 2), 0, image_height)
        x2 = clamp(cx_px + (w_px / 2), 0, image_width)
        y2 = clamp(cy_px + (h_px / 2), 0, image_height)

        # Ensure non-degenerate boxes (skip if invalid)
        if x2 <= x1 or y2 <= y1:
            num_skipped += 1
            continue

        label = class_names[class_id] if 0 <= class_id < len(class_names) else f"class_{class_id}"
        counts[label] = counts.get(label, 0) + 1

        ring = [
            [round(x1, 2), round(y1, 2)],
            [round(x2, 2), round(y1, 2)],
            [round(x2, 2), round(y2, 2)],
            [round(x1, 2), round(y2, 2)],
            [round(x1, 2), round(y1, 2)],
        ]

        features.append(
            {
                "type": "Feature",
                "id": idx,
                "properties": {
                    "source": "yolo",
                    "class_id": class_id,
                    "label": label,
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "image_width": image_width,
            "image_height": image_height,
            "counts": counts,
            "skipped": num_skipped,
            "source_label_file": label_path.name,
        },
    }


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import YOLO dataset samples into public/ for static demo.")
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("data/CRIC_YOLO_Dataset"),
        help="YOLO dataset root with train/val/test folders.",
    )
    parser.add_argument(
        "--data-yaml",
        type=Path,
        default=Path("data/CRIC_YOLO_Dataset/data.yaml"),
        help="Ultralytics data.yaml (for class names).",
    )
    parser.add_argument(
        "--splits",
        nargs="+",
        default=["train", "val", "test"],
        help="Search order for splits (default: train val test).",
    )
    parser.add_argument("--public-dir", type=Path, default=Path("public"))
    parser.add_argument("--program-id", type=str, default="CRIC_YOLO_Dataset")
    parser.add_argument("--schema-version", type=str, default="0.1.0")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing WebP/case/geojson outputs.",
    )
    parser.add_argument(
        "--ids",
        nargs="+",
        required=True,
        help="Image IDs (filestems) to import, e.g. 2cefdbf... (without extension).",
    )
    parser.add_argument(
        "--case-prefix",
        type=str,
        default="CRIC",
        help="Prefix for case_id and filenames (default: CRIC).",
    )
    parser.add_argument(
        "--index-file",
        type=Path,
        default=None,
        help="Optional dataset index json (default: public/cases/dataset-samples.json).",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    dataset_root: Path = args.dataset_root
    public_dir: Path = args.public_dir
    images_out = public_dir / "images"
    cases_out = public_dir / "cases"
    index_file: Path = args.index_file or (cases_out / "dataset-samples.json")

    class_names = parse_names_from_ultralytics_yaml(args.data_yaml)

    entries: list[dict] = []
    for image_id in args.ids:
        item = find_dataset_item(dataset_root, image_id, splits=list(args.splits))
        webp_path = images_out / f"{image_id}.webp"
        width, height = convert_to_webp(item.image_path, webp_path, overwrite=args.overwrite)

        geojson = yolo_labels_to_geojson(
            item.label_path, image_width=width, image_height=height, class_names=class_names
        )
        gt_geojson_path = cases_out / f"{args.case_prefix.lower()}-{image_id}-gt.geojson"
        if args.overwrite or not gt_geojson_path.exists():
            write_json(gt_geojson_path, geojson)

        # Case manifest references static-site relative paths.
        case_file = f"{args.case_prefix.lower()}-{image_id}.json"
        case_path = cases_out / case_file

        counts = geojson.get("properties", {}).get("counts", {})
        total = sum(int(v) for v in counts.values()) if isinstance(counts, dict) else len(geojson["features"])
        title = f"{args.case_prefix} sample {image_id[:8]} ({item.split}, {total} labels)"

        case_doc = {
            "schema_version": args.schema_version,
            "case_id": f"{args.case_prefix}-{image_id}",
            "program_id": args.program_id,
            "dataset_split": item.split,
            "slides": [
                {
                    "slide_id": f"{args.case_prefix}-{image_id}",
                    "title": title,
                    "uri": f"images/{image_id}.webp",
                    "layers": [
                        {
                            "layer_id": "gt-boxes",
                            "kind": "roi",
                            "geometry": "polygons",
                            "uri": f"cases/{gt_geojson_path.name}",
                        }
                    ],
                }
            ],
            "label_counts": counts,
        }
        if args.overwrite or not case_path.exists():
            write_json(case_path, case_doc)

        entries.append(
            {
                "case_id": case_doc["case_id"],
                "title": title,
                "file": case_file,
                "image_uri": case_doc["slides"][0]["uri"],
                "gt_uri": case_doc["slides"][0]["layers"][0]["uri"],
                "label_counts": counts,
            }
        )

        LOG.info("Imported %s (%s) -> %s", image_id, item.split, case_path.as_posix())

    index_doc = {
        "schema_version": args.schema_version,
        "title": f"{args.case_prefix} dataset samples",
        "program_id": args.program_id,
        "cases": entries,
    }
    write_json(index_file, index_doc)
    LOG.info("Wrote index: %s", index_file.as_posix())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

