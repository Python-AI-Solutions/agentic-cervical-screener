import pytest


def pytest_configure(config):
    """Configure pytest settings"""
    config.addinivalue_line("markers", "unit: marks tests as unit tests")
    config.addinivalue_line("markers", "integration: marks tests as integration tests")
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )


# Only suppress warnings that are unavoidable
@pytest.fixture(autouse=True)
def suppress_unavoidable_warnings():
    """Suppress only truly unavoidable warnings"""
    import warnings

    warnings.filterwarnings("ignore", message=".*on_event is deprecated.*")
    warnings.filterwarnings("ignore", message=".*user config directory.*not writeable.*")
    warnings.filterwarnings("ignore", message=".*Creating new Ultralytics Settings.*")
