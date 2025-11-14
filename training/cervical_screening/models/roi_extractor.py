"""
ROI (Region of Interest) Extractor

Extracts cell crops from whole slide images using ground truth bounding boxes.
These crops are used to train a specialized cell classifier (Stage 2).
"""

from collections import defaultdict
from pathlib import Path

import cv2
from tqdm import tqdm


class ROIExtractor:
    """
    Extracts ROI crops from images using ground truth labels

    Used to create training data for Stage 2 classifier by cropping
    individual cells from whole slide images.
    """

    def __init__(self, class_names, crop_size=(224, 224)):
        """
        Initialize ROI extractor

        Args:
            class_names: List of class names
            crop_size: Size to resize crops (default: 224x224 for classifiers)
        """
        self.class_names = class_names
        self.crop_size = crop_size

    def extract_crops_from_labels(
        self, images_dir, labels_dir, output_dir, split="train", max_images=None
    ):
        """
        Extract ROI crops using ground truth bounding boxes

        Args:
            images_dir: Directory containing images
            labels_dir: Directory containing YOLO format label files
            output_dir: Directory to save crops
            split: Split name (train/val)
            max_images: Maximum images to process (None = all)

        Returns:
            Dictionary of crop counts per class
        """
        images_dir = Path(images_dir)
        labels_dir = Path(labels_dir)
        output_dir = Path(output_dir)

        # Create output directories
        for class_name in self.class_names:
            (output_dir / split / class_name).mkdir(parents=True, exist_ok=True)

        # Get image files
        image_files = list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg"))
        if max_images:
            image_files = image_files[:max_images]

        print(f"\nProcessing {len(image_files)} {split} images...")

        crop_counts = defaultdict(int)

        for img_path in tqdm(image_files, desc=f"Extracting {split} crops"):
            # Read image
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            h, w = img.shape[:2]

            # Read label file
            label_path = labels_dir / (img_path.stem + ".txt")
            if not label_path.exists():
                continue

            with open(label_path) as f:
                lines = f.readlines()

            # Extract each cell
            for idx, line in enumerate(lines):
                parts = line.strip().split()
                if len(parts) < 5:
                    continue

                # Parse YOLO format: class_id x_center y_center width height
                class_id = int(parts[0])
                x_center, y_center, width, height = map(float, parts[1:5])

                # Convert to pixel coordinates
                x_center *= w
                y_center *= h
                width *= w
                height *= h

                # Get bounding box
                x1 = int(x_center - width / 2)
                y1 = int(y_center - height / 2)
                x2 = int(x_center + width / 2)
                y2 = int(y_center + height / 2)

                # Ensure within bounds
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(w, x2)
                y2 = min(h, y2)

                # Skip if too small
                if (x2 - x1) < 10 or (y2 - y1) < 10:
                    continue

                # Crop
                crop = img[y1:y2, x1:x2]

                # Resize to standard size
                crop = cv2.resize(crop, self.crop_size)

                # Save
                class_name = (
                    self.class_names[class_id]
                    if class_id < len(self.class_names)
                    else f"class_{class_id}"
                )
                crop_filename = f"{img_path.stem}_crop_{idx}.png"
                crop_path = output_dir / split / class_name / crop_filename

                cv2.imwrite(str(crop_path), crop)
                crop_counts[class_name] += 1

        return dict(crop_counts)

    def extract_dataset(self, dataset_path, output_dir, splits=None):
        """
        Extract crops for entire dataset

        Args:
            dataset_path: Path to YOLO dataset (with train/val folders)
            output_dir: Output directory for crops
            splits: List of splits to process

        Returns:
            Dictionary with counts for each split
        """
        if splits is None:
            splits = ["train", "val"]
        dataset_path = Path(dataset_path)
        output_dir = Path(output_dir)

        all_counts = {}

        for split in splits:
            images_dir = dataset_path / split / "images"
            labels_dir = dataset_path / split / "labels"

            if not images_dir.exists() or not labels_dir.exists():
                print(f"⚠️  Skipping {split} - directories not found")
                continue

            counts = self.extract_crops_from_labels(images_dir, labels_dir, output_dir, split)
            all_counts[split] = counts

        return all_counts

    def verify_crops(self, crop_dir, splits=None):
        """
        Verify extracted crops

        Args:
            crop_dir: Directory containing extracted crops
            splits: List of splits to verify

        Returns:
            Verification summary
        """
        if splits is None:
            splits = ["train", "val"]
        crop_dir = Path(crop_dir)
        summary = {}

        print("\n" + "=" * 80)
        print("CROP VERIFICATION")
        print("=" * 80)

        for split in splits:
            print(f"\n{split.upper()} Split:")
            split_total = 0
            split_summary = {}

            for class_name in self.class_names:
                class_dir = crop_dir / split / class_name
                num_files = len(list(class_dir.glob("*.png"))) if class_dir.exists() else 0
                split_total += num_files
                split_summary[class_name] = num_files

                status = "✅" if num_files > 0 else "⚠️"
                print(f"   {status} {class_name}: {num_files} files")

            print(f"   Total: {split_total}")
            summary[split] = {"classes": split_summary, "total": split_total}

        return summary
