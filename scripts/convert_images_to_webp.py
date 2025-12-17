#!/usr/bin/env python3
"""Convert demo images to WebP for static hosting.

Defaults to *lossless* WebP to avoid changing pixel values (important for ML inference consistency).
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Iterable

from PIL import Image

LOG = logging.getLogger("convert_images_to_webp")
SUPPORTED_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp")


def iter_images(input_dir: Path) -> Iterable[Path]:
    for path in sorted(input_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTS:
            yield path


def convert_image(
    src: Path, dest: Path, quality: int = 90, lossless: bool = True, overwrite: bool = False
) -> Path:
    if dest.exists() and not overwrite:
        LOG.info("Skipping %s (already exists)", dest.name)
        return dest

    with Image.open(src) as img:
        img = img.convert("RGB")
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "WEBP", quality=quality, lossless=lossless, method=6)
    LOG.info("Converted %s -> %s", src.name, dest.name)
    return dest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Convert images to WebP.")
    parser.add_argument("--input-dir", type=Path, default=Path("public/images"))
    parser.add_argument("--output-dir", type=Path, default=None, help="Defaults to input-dir.")
    parser.add_argument("--quality", type=int, default=90, help="WebP quality (0-100).")
    parser.add_argument(
        "--lossless",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Use lossless WebP (recommended for ML). Use --no-lossless for smaller lossy files.",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing WebP files.")
    parser.add_argument(
        "--delete-originals",
        action="store_true",
        help="Delete source images after successful conversion (use with care).",
    )

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir or input_dir

    if not input_dir.exists():
        LOG.error("Input directory not found: %s", input_dir)
        return 1

    for src in iter_images(input_dir):
        dest = output_dir / f"{src.stem}.webp"
        convert_image(
            src, dest, quality=args.quality, lossless=args.lossless, overwrite=args.overwrite
        )
        if args.delete_originals:
            try:
                src.unlink()
                LOG.info("Deleted original %s", src.name)
            except OSError as e:
                LOG.warning("Failed to delete %s: %s", src, e)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
