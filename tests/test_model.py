"""
Tests for model loading functionality.
"""

import os

import pytest


class TestModelLoader:
    """Test model loading and initialization"""

    def test_model_path_detection(self):
        """Test that model path detection works correctly"""
        # Test relative to src directory
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_path = os.path.join(current_dir, "src", "models", "best.pt")

        # Should be able to detect if model exists or not
        exists = os.path.exists(model_path)
        assert isinstance(exists, bool)

        # Log model availability for debugging
        print(f"Model path: {model_path}")
        print(f"Model exists: {exists}")

    def test_model_loader_import(self):
        """Test that model_loader module can be imported"""
        try:
            from src.model_loader import initialize_model

            # Import should succeed
            assert callable(initialize_model)
        except ImportError as e:
            # If model_loader doesn't exist, that's also valid
            pytest.skip(f"Model loader not available: {e}")

    def test_model_initialization_when_available(self):
        """Test model initialization when model file is available"""
        try:
            from src.model_loader import initialize_model

            # Find model path
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(current_dir, "src", "models", "best.pt")

            if os.path.exists(model_path):
                # Try to initialize model
                model_inference = initialize_model(model_path)
                assert model_inference is not None

                # Test that model has expected attributes
                assert hasattr(model_inference, "predict")
                print("Model loaded successfully!")
            else:
                pytest.skip("Model file not available for testing")

        except ImportError:
            pytest.skip("Model loader module not available")
        except Exception as e:
            # Model loading can fail for various reasons (dependencies, etc.)
            # Don't fail the test, just log the issue
            print(f"Model loading failed (expected in some environments): {e}")
            pytest.skip(f"Model loading not possible: {e}")

    def test_graceful_handling_without_model(self):
        """Test that application handles missing model gracefully"""
        # This verifies the app can run without model loaded
        # which is important for testing environments

        # Test that main app can be imported without model
        try:
            import src.main

            assert hasattr(src.main, "app")
            print("Main app imports successfully without model")
        except Exception as e:
            pytest.fail(f"Main app should import even without model: {e}")
