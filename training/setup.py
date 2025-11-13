"""
Setup script for cervical-screening package
"""

from pathlib import Path

from setuptools import find_packages, setup

# Read README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

setup(
    name="cervical-screening",
    version="0.1.0",
    description="Cervical cell classification using YOLO",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(exclude=["tests", "experiments", "notebooks"]),
    python_requires=">=3.8,<3.13",  # ← CHANGED: Relaxed from 3.10
    install_requires=[
        "ultralytics>=8.0.0",  # ← CHANGED: Relaxed from 8.3.0
        "torch>=2.0.0",
        "torchvision>=0.15.0",
        "opencv-python>=4.5.0",  # ← CHANGED: Relaxed from 4.8.0
        "numpy>=1.19.0,<2.2.0",  # ← CHANGED: Added upper bound for Colab
        "pandas>=1.3.0,<2.3.0",  # ← CHANGED: Added upper bound for Colab
        "matplotlib>=3.3.0",  # ← CHANGED: Relaxed from 3.7.0
        "seaborn>=0.11.0",  # ← CHANGED: Relaxed from 0.12.0
        "pillow>=8.0.0,<12.0.0",  # ← CHANGED: Added upper bound for Colab
        "scikit-learn>=0.24.0",  # ← CHANGED: Relaxed from 1.3.0
        "tqdm>=4.50.0",  # ← CHANGED: Relaxed from 4.65.0
        "pyyaml>=5.4.0",  # ← ADDED: Missing dependency
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "ruff>=0.1.0",
            "pre-commit>=3.5.0",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    keywords="cervical cancer screening yolo deep-learning",
)
