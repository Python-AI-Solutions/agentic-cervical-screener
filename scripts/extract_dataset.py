#!/usr/bin/env python3
"""
Extract the split ZIP archive dataset.

Usage:
    python scripts/extract_dataset.py
"""

import subprocess
from pathlib import Path


def extract_split_zip(base_path="data", output_dir="data/images"):
    """
    Extract a split ZIP archive using 7z or unzip.

    Args:
        base_path: Directory containing the split archive files
        output_dir: Directory to extract files to
    """
    base_path = Path(base_path)
    output_path = Path(output_dir)

    # The main ZIP file that references the split parts
    zip_file = base_path / "JPEGImages.zip"

    if not zip_file.exists():
        raise FileNotFoundError(f"Main ZIP file not found: {zip_file}")

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Extracting split archive from: {zip_file}")
    print(f"Output directory: {output_path}")

    try:
        # Try using 7z first (handles split archives well)
        result = subprocess.run(
            ["7z", "x", str(zip_file), f"-o{output_path}"],
            check=True,
            capture_output=True,
            text=True
        )
        print("Extraction successful using 7z!")
        print(result.stdout)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        # If 7z fails or is not available, try unzip
        print("7z not available or failed, trying unzip...")
        try:
            result = subprocess.run(
                ["unzip", "-o", str(zip_file), "-d", str(output_path)],
                check=True,
                capture_output=True,
                text=True
            )
            print("Extraction successful using unzip!")
            print(result.stdout)
        except subprocess.CalledProcessError as e:
            print(f"Error during extraction: {e}")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            raise

    # List extracted files
    extracted_files = list(output_path.rglob("*"))
    print(f"\nExtracted {len(extracted_files)} items to {output_path}")

    # Show some statistics
    image_files = list(output_path.rglob("*.jpg")) + list(output_path.rglob("*.jpeg"))
    if image_files:
        print(f"Found {len(image_files)} JPEG images")
        print(f"\nFirst few files:")
        for f in sorted(image_files)[:5]:
            print(f"  {f.relative_to(output_path)}")

    return str(output_path)


if __name__ == "__main__":
    try:
        output = extract_split_zip()
        print(f"\n✓ Dataset successfully extracted to: {output}")
    except Exception as e:
        print(f"Error extracting dataset: {e}")
        raise
