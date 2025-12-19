#!/usr/bin/env python3
"""Export the YOLO model to ONNX and create an int8-quantized variant for the browser.

CPU/WASM is the primary target; WebGPU can consume the same ONNX model via onnxruntime-web.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Iterable
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import (
    CalibrationDataReader,
    CalibrationMethod,
    QuantFormat,
    QuantType,
    quantize_dynamic,
    quantize_static,
)
from PIL import Image, ImageOps
from ultralytics import YOLO

LOG = logging.getLogger("export_to_onnx")
SUPPORTED_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff")


def _names_to_list(names) -> list[str]:
    if names is None:
        return []
    if isinstance(names, list | tuple):
        return [str(n) for n in names]
    if isinstance(names, dict):
        items: list[tuple[int, str]] = []
        for k, v in names.items():
            try:
                idx = int(k)
            except (TypeError, ValueError):
                continue
            items.append((idx, str(v)))
        items.sort(key=lambda t: t[0])
        return [v for _, v in items]
    return []


def write_labels_json(output_dir: Path, class_names: list[str]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "labels.json"
    payload = {"schema_version": "0.1.0", "names": class_names}
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    LOG.info("Wrote label metadata: %s", path)
    return path


def _preprocess_image(path: Path, imgsz: int) -> np.ndarray:
    """Resize, normalize, and arrange channels for YOLO ONNX input."""
    img = Image.open(path).convert("RGB")
    # Letterbox-style padding to preserve aspect ratio without stretching
    img = ImageOps.pad(img, (imgsz, imgsz), method=Image.Resampling.BILINEAR, color=(0, 0, 0))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)  # HWC -> CHW
    return arr[None, ...]  # Add batch dimension


def _get_input_name(model_path: Path) -> str:
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    return session.get_inputs()[0].name


class YoloCalibrationDataReader(CalibrationDataReader):
    """Feeds calibration images through the typical YOLO preprocessing pipeline."""

    def __init__(self, image_paths: list[Path], input_name: str, imgsz: int):
        self.image_paths = image_paths
        self.input_name = input_name
        self.imgsz = imgsz
        self._iter = None

    def get_next(self):  # noqa: D401 - onnxruntime expects this name
        if self._iter is None:
            self._iter = iter(self._yield_batches())
        return next(self._iter, None)

    def _yield_batches(self):
        for path in self.image_paths:
            data = _preprocess_image(path, self.imgsz)
            yield {self.input_name: data}

    def rewind(self):
        self._iter = None


def _collect_calibration_images(calibration_dir: Path, limit: int | None = None) -> list[Path]:
    if not calibration_dir.exists():
        return []
    images = [
        p
        for p in calibration_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_IMAGE_EXTS
    ]
    images.sort()
    return images[:limit] if limit else images


def export_to_onnx(
    model: YOLO, model_path: Path, output_path: Path, imgsz: int, opset: int, nms: bool
) -> Path:
    LOG.info("Exporting YOLO model from %s -> %s", model_path, output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    exported = model.export(
        format="onnx",
        imgsz=imgsz,
        opset=opset,
        simplify=True,
        dynamic=False,
        half=False,
        device="cpu",
        nms=nms,
    )

    exported_path = Path(exported)
    if exported_path.resolve() != output_path.resolve():
        exported_path.replace(output_path)

    # Sanity check
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    LOG.info("ONNX export complete: %s (opset=%s)", output_path, opset)
    return output_path


def quantize_to_int8_static(
    fp32_model: Path,
    int8_model: Path,
    calibration_images: Iterable[Path],
    imgsz: int,
    activation_type: QuantType = QuantType.QUInt8,
    weight_type: QuantType = QuantType.QInt8,
):
    calibration_images = list(calibration_images)
    if not calibration_images:
        raise ValueError("No calibration images provided for static quantization.")

    input_name = _get_input_name(fp32_model)
    reader = YoloCalibrationDataReader(calibration_images, input_name=input_name, imgsz=imgsz)
    LOG.info(
        "Running static int8 quantization on %d calibration images -> %s",
        len(calibration_images),
        int8_model,
    )

    quantize_static(
        model_input=str(fp32_model),
        model_output=str(int8_model),
        calibration_data_reader=reader,
        quant_format=QuantFormat.QDQ,
        per_channel=True,
        reduce_range=False,
        activation_type=activation_type,
        weight_type=weight_type,
        calibrate_method=CalibrationMethod.MinMax,
    )
    LOG.info("Static quantization complete: %s", int8_model)
    return int8_model


def quantize_to_int8_dynamic(fp32_model: Path, int8_model: Path):
    LOG.info("Running dynamic quantization -> %s", int8_model)
    quantize_dynamic(
        model_input=str(fp32_model),
        model_output=str(int8_model),
        per_channel=True,
        reduce_range=False,
        weight_type=QuantType.QInt8,
    )
    LOG.info("Dynamic quantization complete: %s", int8_model)
    return int8_model


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Export YOLO .pt to ONNX and produce an int8-quantized version."
    )
    parser.add_argument("--model-path", type=Path, default=Path("src/models/best.pt"))
    parser.add_argument("--output-dir", type=Path, default=Path("public/model"))
    parser.add_argument("--imgsz", type=int, default=640, help="Square image size used at export.")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument(
        "--nms",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Include built-in NMS in the ONNX graph (recommended for browser inference).",
    )
    parser.add_argument(
        "--quantize",
        choices=["static", "dynamic", "none"],
        default="none",
        help=(
            "Quantization strategy (experimental for this model). Use 'none' for fp32 export only."
        ),
    )
    parser.add_argument(
        "--calibration-dir",
        type=Path,
        default=Path("public/images"),
        help="Directory of sample images for calibration (static quantization).",
    )
    parser.add_argument(
        "--calibration-limit",
        type=int,
        default=32,
        help="Limit number of calibration images (0 = no limit).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing ONNX artifacts.",
    )

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not args.model_path.exists():
        LOG.error("Model file not found: %s", args.model_path)
        return 1

    fp32_path = args.output_dir / f"{args.model_path.stem}.onnx"
    int8_path = args.output_dir / f"{args.model_path.stem}.int8.onnx"
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Load the source model once so we can export and also persist label metadata for the browser.
    yolo = YOLO(str(args.model_path))
    class_names = _names_to_list(getattr(yolo, "names", None))
    if class_names:
        write_labels_json(args.output_dir, class_names)
    else:
        LOG.warning("No class names found on YOLO model; labels.json not written.")

    if args.force or not fp32_path.exists():
        export_to_onnx(yolo, args.model_path, fp32_path, args.imgsz, args.opset, args.nms)
    else:
        LOG.info("Skipping ONNX export, file exists: %s", fp32_path)

    if args.quantize == "none":
        LOG.info("Quantization skipped by user request.")
        return 0

    if not args.force and int8_path.exists():
        LOG.info("Skipping quantization, int8 already exists: %s", int8_path)
        return 0

    if args.quantize == "static":
        calibration_images = _collect_calibration_images(
            args.calibration_dir, None if args.calibration_limit == 0 else args.calibration_limit
        )
        try:
            quantize_to_int8_static(fp32_path, int8_path, calibration_images, imgsz=args.imgsz)
            return 0
        except Exception as exc:  # noqa: BLE001
            LOG.warning(
                "Static quantization failed (%s). Falling back to dynamic quantization.", exc
            )

    # Fallback: dynamic quantization
    quantize_to_int8_dynamic(fp32_path, int8_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
