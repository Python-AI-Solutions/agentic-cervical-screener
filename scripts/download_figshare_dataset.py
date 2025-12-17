#!/usr/bin/env python3
"""
Download Figshare dataset with progress tracking and resume capability.

Usage:
    python scripts/download_figshare_dataset.py
"""

import requests
from pathlib import Path
from tqdm import tqdm


def download_figshare_dataset(url, output_dir="data", filename=None):
    """
    Download a dataset from Figshare with progress bar and resume capability.

    Args:
        url: The Figshare download URL
        output_dir: Directory to save the downloaded file
        filename: Custom filename (if None, will use Content-Disposition header)
    """
    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # First, make a HEAD request to get file info
    print(f"Fetching file information from: {url}")
    head_response = requests.head(url, allow_redirects=True)

    # Get filename from Content-Disposition header if not provided
    if filename is None:
        content_disposition = head_response.headers.get('Content-Disposition', '')
        if 'filename=' in content_disposition:
            filename = content_disposition.split('filename=')[-1].strip('"\'')
        else:
            # Default filename if header not available
            filename = "figshare_dataset_27901206.zip"

    file_path = output_path / filename

    # Get file size
    total_size = int(head_response.headers.get('Content-Length', 0))

    # Check if file already exists and get its size for resume
    resume_byte_pos = 0
    if file_path.exists():
        resume_byte_pos = file_path.stat().st_size
        if resume_byte_pos == total_size:
            print(f"File already fully downloaded: {file_path}")
            return str(file_path)
        print(f"Resuming download from byte {resume_byte_pos}")

    # Set up headers for resume
    headers = {}
    if resume_byte_pos > 0:
        headers['Range'] = f'bytes={resume_byte_pos}-'

    # Download the file
    print(f"Downloading to: {file_path}")
    print(f"Total size: {total_size / (1024**2):.2f} MB")

    response = requests.get(url, headers=headers, stream=True, allow_redirects=True)
    response.raise_for_status()

    # Open file in append mode if resuming, write mode otherwise
    mode = 'ab' if resume_byte_pos > 0 else 'wb'

    with open(file_path, mode) as f:
        with tqdm(
            total=total_size,
            initial=resume_byte_pos,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
            desc=filename
        ) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))

    print(f"\nDownload complete: {file_path}")
    return str(file_path)


if __name__ == "__main__":
    # Figshare dataset URL
    FIGSHARE_URL = "https://figshare.com/ndownloader/articles/27901206/versions/1"

    try:
        downloaded_file = download_figshare_dataset(FIGSHARE_URL)
        print(f"\nDataset successfully downloaded to: {downloaded_file}")

        # If it's a zip file, suggest extraction
        if downloaded_file.endswith('.zip'):
            print("\nTo extract the dataset, run:")
            print(f"  unzip {downloaded_file} -d data/")

    except Exception as e:
        print(f"Error downloading dataset: {e}")
        raise
