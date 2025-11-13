"""
Google Drive utilities for Colab
"""

from pathlib import Path


def mount_drive(mount_point="/content/drive"):
    """
    Mount Google Drive in Colab

    Args:
        mount_point: Where to mount drive (default: /content/drive)
    """
    try:
        # Check if drive is already mounted
        drive_path = Path(mount_point)
        if drive_path.exists() and any(drive_path.iterdir()):
            print(f"✅ Drive already mounted at {mount_point}")
            return

        # Try to mount
        from google.colab import drive

        drive.mount(mount_point, force_remount=False)
        print(f"✅ Drive mounted at {mount_point}")

    except ImportError:
        # Not in Colab environment
        print("⚠️  Not in Colab environment - skipping drive mount")

    except AttributeError as e:
        # Already mounted or kernel issue
        if "'NoneType' object has no attribute 'kernel'" in str(e):
            print(f"✅ Drive already mounted at {mount_point}")
        else:
            print(f"⚠️  Drive mount issue: {e}")

    except Exception as e:
        print(f"⚠️  Could not mount drive: {e}")
        print("If drive is already mounted, you can continue.")


def verify_paths(*paths):
    """
    Verify that paths exist

    Args:
        *paths: Variable number of Path objects to verify

    Returns:
        bool: True if all paths exist
    """
    print("\n" + "=" * 80)
    print("VERIFYING PATHS")
    print("=" * 80)

    all_exist = True

    for path in paths:
        path = Path(path)
        exists = path.exists()
        status = "✅" if exists else "❌"
        print(f"{status} {path}")

        if not exists:
            all_exist = False

    print("=" * 80)

    if all_exist:
        print("✅ All paths verified")
    else:
        print("❌ Some paths are missing")

    return all_exist
