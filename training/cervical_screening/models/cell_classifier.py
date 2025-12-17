"""
Cell Classifier (Stage 2)

EfficientNet-based classifier for individual cell crops.
Used in two-stage approach: YOLO detects → Classifier refines.
"""

from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms
from tqdm import tqdm


class CellCropDataset(Dataset):
    """Dataset for cropped cell images"""

    def __init__(self, crop_dir, split="train", transform=None, class_names=None):
        """
        Initialize dataset

        Args:
            crop_dir: Directory containing cropped images
            split: Split name (train/val)
            transform: Image transformations
            class_names: List of class names
        """
        self.crop_dir = Path(crop_dir) / split
        self.transform = transform
        self.class_names = class_names or []
        self.samples = []

        # Collect all image paths and labels
        for class_idx, class_name in enumerate(self.class_names):
            class_dir = self.crop_dir / class_name
            if not class_dir.exists():
                continue

            for img_path in class_dir.glob("*.png"):
                self.samples.append((str(img_path), class_idx))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        image = Image.open(img_path).convert("RGB")

        if self.transform:
            image = self.transform(image)

        return image, label


class CellClassifier:
    """
    EfficientNet-based cell classifier

    Stage 2 of two-stage approach. Takes cell crops as input
    and classifies them into Bethesda categories.
    """

    def __init__(self, num_classes=6, device=None):
        """
        Initialize classifier

        Args:
            num_classes: Number of cell classes
            device: Torch device (cuda/cpu)
        """
        self.num_classes = num_classes
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    def build_model(self):
        """Build EfficientNet-B0 model"""
        # Load pre-trained EfficientNet
        self.model = models.efficientnet_b0(pretrained=True)

        # Replace classifier head
        num_features = self.model.classifier[1].in_features
        self.model.classifier = nn.Sequential(
            nn.Dropout(0.3), nn.Linear(num_features, self.num_classes)
        )

        self.model = self.model.to(self.device)
        print(f"✅ Model created on {self.device}")

    def get_transforms(self):
        """Get train and validation transforms"""
        train_transform = transforms.Compose(
            [
                transforms.RandomHorizontalFlip(),
                transforms.RandomVerticalFlip(),
                transforms.RandomRotation(20),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )

        val_transform = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )

        return train_transform, val_transform

    def prepare_dataloaders(self, crop_dir, class_names, batch_size=32, num_workers=2):
        """
        Prepare train and validation dataloaders

        Args:
            crop_dir: Directory with extracted crops
            class_names: List of class names
            batch_size: Batch size
            num_workers: Number of data loading workers

        Returns:
            Tuple of (train_loader, val_loader)
        """
        train_transform, val_transform = self.get_transforms()

        train_dataset = CellCropDataset(crop_dir, "train", train_transform, class_names)
        val_dataset = CellCropDataset(crop_dir, "val", val_transform, class_names)

        train_loader = DataLoader(
            train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers
        )
        val_loader = DataLoader(
            val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers
        )

        print(f"✅ Train samples: {len(train_dataset)}")
        print(f"✅ Val samples: {len(val_dataset)}")
        print(f"✅ Train batches: {len(train_loader)}")
        print(f"✅ Val batches: {len(val_loader)}")

        return train_loader, val_loader

    def train(self, train_loader, val_loader, epochs=30, learning_rate=0.001, save_path=None):
        """
        Train the classifier

        Args:
            train_loader: Training data loader
            val_loader: Validation data loader
            epochs: Number of epochs
            learning_rate: Learning rate
            save_path: Path to save best model

        Returns:
            Training history
        """
        if self.model is None:
            self.build_model()

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, "min", patience=3, factor=0.5)

        best_val_acc = 0.0

        print("\n" + "=" * 80)
        print("TRAINING")
        print("=" * 80)

        for epoch in range(epochs):
            # Training phase
            self.model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0

            for images, labels in tqdm(train_loader, desc=f"Epoch {epoch + 1}/{epochs} [Train]"):
                images, labels = images.to(self.device), labels.to(self.device)

                optimizer.zero_grad()
                logits = self.model(images)
                loss = criterion(logits, labels)
                loss.backward()
                optimizer.step()

                train_loss += loss.item()
                _, predicted = torch.max(logits, 1)
                train_total += labels.size(0)
                train_correct += (predicted == labels).sum().item()

            train_loss /= len(train_loader)
            train_acc = 100 * train_correct / train_total

            # Validation phase
            self.model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0

            with torch.no_grad():
                for images, labels in tqdm(val_loader, desc=f"Epoch {epoch + 1}/{epochs} [Val]"):
                    images, labels = images.to(self.device), labels.to(self.device)

                    logits = self.model(images)
                    loss = criterion(logits, labels)

                    val_loss += loss.item()
                    _, predicted = torch.max(logits, 1)
                    val_total += labels.size(0)
                    val_correct += (predicted == labels).sum().item()

            val_loss /= len(val_loader)
            val_acc = 100 * val_correct / val_total

            scheduler.step(val_loss)

            # Save history
            self.history["train_loss"].append(train_loss)
            self.history["train_acc"].append(train_acc)
            self.history["val_loss"].append(val_loss)
            self.history["val_acc"].append(val_acc)

            print(f"\nEpoch {epoch + 1}/{epochs}:")
            print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
            print(f"  Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")

            # Save best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                if save_path:
                    torch.save(self.model.state_dict(), save_path)  # nosec B614
                    print(f"  ✅ Best model saved (Val Acc: {val_acc:.2f}%)")

        print("\n" + "=" * 80)
        print("TRAINING COMPLETE")
        print("=" * 80)
        print(f"Best Validation Accuracy: {best_val_acc:.2f}%")

        return self.history

    def evaluate(self, val_loader, class_names):
        """
        Evaluate model and return predictions

        Args:
            val_loader: Validation data loader
            class_names: List of class names

        Returns:
            Dictionary with predictions, labels, probabilities
        """
        self.model.eval()

        all_preds = []
        all_labels = []
        all_probs = []

        with torch.no_grad():
            for images, labels in tqdm(val_loader, desc="Evaluating"):
                images = images.to(self.device)

                logits = self.model(images)
                probs = torch.nn.functional.softmax(logits, dim=1)
                _, preds = torch.max(probs, 1)

                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.numpy())
                all_probs.extend(probs.cpu().numpy())

        return {
            "predictions": np.array(all_preds),
            "labels": np.array(all_labels),
            "probabilities": np.array(all_probs),
        }

    def load_model(self, model_path):
        """Load trained model weights"""
        if self.model is None:
            self.build_model()
        self.model.load_state_dict(torch.load(model_path))  # nosec B614
        self.model.eval()
        print(f"✅ Model loaded from {model_path}")
