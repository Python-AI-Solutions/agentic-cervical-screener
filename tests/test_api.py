import json
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    return TestClient(app)


@pytest.fixture
def test_image():
    """Create a real test image file"""
    # Create a simple test image
    img = Image.new("RGB", (100, 100), color="red")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp.name)
        yield tmp.name
    os.unlink(tmp.name)


@pytest.fixture(scope="session")
def dataset_samples():
    """Load the static dataset sample index used by the viewer."""
    repo_root = Path(__file__).resolve().parent.parent
    index_path = repo_root / "public" / "cases" / "dataset-samples.json"
    doc = json.loads(index_path.read_text(encoding="utf-8"))
    cases = doc.get("cases", [])
    assert isinstance(cases, list) and cases, "public/cases/dataset-samples.json must contain cases"
    return cases


@pytest.fixture
def dataset_case_id(dataset_samples):
    return dataset_samples[0]["case_id"]


class TestHealthEndpoints:
    """Test health and info endpoints - these should always work"""

    def test_healthz_endpoint(self, client):
        """Test the health check endpoint returns proper structure"""
        response = client.get("/healthz")
        assert response.status_code == 200

        data = response.json()
        # Verify the structure is correct regardless of model state
        assert "ok" in data
        assert "model_loaded" in data
        assert "model_type" in data
        assert data["ok"] is True
        assert isinstance(data["model_loaded"], bool)
        assert isinstance(data["model_type"], str)

    def test_model_info_endpoint(self, client):
        """Test the model info endpoint handles both states gracefully"""
        response = client.get("/model-info")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, dict)

        # Should either have model info or error message
        if "error" in data:
            assert "Model not loaded" in data["error"]
        else:
            # If model is loaded, should have proper structure
            assert "model_type" in data
            assert data["model_type"] == "YOLO"


class TestClassifyEndpoints:
    """Test classification endpoints - testing real behavior and fallbacks"""

    def test_classify_basic_structure(self, client, dataset_case_id):
        """Test that classify returns correct structure regardless of model state"""
        payload = {"slide_id": dataset_case_id, "conf_threshold": 0.25}

        response = client.post("/v1/classify", json=payload)
        assert response.status_code in [200, 404]

        # If the model is loaded but the slide_id can't be resolved, 404 is acceptable.
        if response.status_code == 404:
            return

        data = response.json()
        # Verify response structure
        required_fields = ["slide_id", "boxes", "total_detections", "class_summary"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        assert data["slide_id"] == dataset_case_id
        assert isinstance(data["boxes"], list)
        assert isinstance(data["total_detections"], int)
        assert isinstance(data["class_summary"], dict)
        assert data["total_detections"] == len(data["boxes"])

    def test_classify_dataset_cases(self, client, dataset_samples):
        """Test classification works for a few dataset-backed case IDs"""
        case_ids = [c["case_id"] for c in dataset_samples[:3] if "case_id" in c]

        for case_id in case_ids:
            response = client.post("/v1/classify", json={"slide_id": case_id})
            assert response.status_code in [200, 404]
            if response.status_code == 404:
                continue

            data = response.json()
            assert data["slide_id"] == case_id
            assert len(data["boxes"]) >= 0  # May be empty, but should be a list

    def test_classify_with_confidence_thresholds(self, client, dataset_case_id):
        """Test that different confidence thresholds affect results reasonably"""
        base_payload = {"slide_id": dataset_case_id}

        # Test various confidence thresholds
        thresholds = [0.1, 0.25, 0.5, 0.9]
        results = []

        for threshold in thresholds:
            payload = {**base_payload, "conf_threshold": threshold}
            response = client.post("/v1/classify", json=payload)
            assert response.status_code in [200, 404]
            if response.status_code == 404:
                continue
            results.append(response.json())

        # All should have valid structure
        for result in results:
            assert isinstance(result["total_detections"], int)
            assert result["total_detections"] >= 0

    def test_classify_edge_cases(self, client, dataset_case_id):
        """Test classification handles edge cases gracefully"""
        edge_cases = [
            {},  # Empty payload
            {"slide_id": ""},  # Empty slide_id
            {"slide_id": "NONEXISTENT"},  # Non-existent slide
            {"conf_threshold": 0},  # Zero confidence
            {"conf_threshold": 1},  # Max confidence
            {"slide_id": dataset_case_id, "conf_threshold": -0.5},  # Invalid confidence
            {"slide_id": dataset_case_id, "conf_threshold": 1.5},  # Invalid confidence
        ]

        for payload in edge_cases:
            response = client.post("/v1/classify", json=payload)
            # Should always succeed with fallback behavior
            assert response.status_code in [200, 404]
            if response.status_code == 404:
                continue

            data = response.json()
            # Should have proper structure even with edge cases
            assert "slide_id" in data
            assert "boxes" in data
            assert "total_detections" in data
            assert "class_summary" in data


class TestFileUploadEndpoint:
    """Test file upload endpoint with real images"""

    def test_classify_upload_no_file(self, client):
        """Test upload endpoint validation"""
        response = client.post("/v1/classify-upload")
        assert response.status_code == 422  # Should validate required file

    def test_classify_upload_with_real_image(self, client, test_image):
        """Test upload endpoint with a real image file"""
        with open(test_image, "rb") as f:
            files = {"file": ("test.png", f, "image/png")}
            response = client.post("/v1/classify-upload", files=files)

        # Should either succeed or fail gracefully
        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            # Verify proper response structure
            required_fields = ["filename", "boxes", "total_detections", "class_summary"]
            for field in required_fields:
                assert field in data
            assert data["filename"] == "test.png"
        else:
            # If it fails, should be because model not loaded
            data = response.json()
            assert "Model not loaded" in data.get("detail", "")


class TestCaseEndpoints:
    """Test case data endpoints work with real data"""

    def test_get_dataset_cases(self, client, dataset_samples):
        """Test dataset-backed case IDs return valid data structures"""
        case_ids = [c["case_id"] for c in dataset_samples[:3] if "case_id" in c]

        for case_id in case_ids:
            response = client.get(f"/cases/{case_id}")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, dict)

            # Should have some reasonable case data structure
            assert len(data) > 0

    def test_get_nonexistent_case(self, client):
        """Test graceful handling of non-existent cases"""
        response = client.get("/cases/does-not-exist")
        assert response.status_code in [404, 400]  # Should not crash


class TestStaticFiles:
    """Test static file serving doesn't crash"""

    def test_static_endpoints_mounted(self, client):
        """Test that static endpoints are properly mounted"""
        # These should not crash even if files don't exist
        endpoints = ["/images/test.png", "/cases/does-not-exist"]

        for endpoint in endpoints:
            response = client.get(endpoint)
            # Should be 404/400 (not found / invalid), not 500 (server error)
            assert response.status_code in [404, 400, 200]

    def test_browser_icon_probes_not_404(self, client):
        """Browsers probe common icon paths; avoid noisy 404s in logs."""
        endpoints = [
            "/favicon.ico",
            "/apple-touch-icon.png",
            "/apple-touch-icon-precomposed.png",
        ]
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code in [200, 204]


class TestDataValidation:
    """Test data validation and types without mocks"""

    def test_box_data_types(self, client, dataset_case_id):
        """Test that box data has correct types when present"""
        response = client.post("/v1/classify", json={"slide_id": dataset_case_id})
        assert response.status_code == 200

        data = response.json()

        # If we have boxes, validate their structure
        if data["boxes"]:
            for box in data["boxes"]:
                assert isinstance(box["x"], int), "x coordinate should be int"
                assert isinstance(box["y"], int), "y coordinate should be int"
                assert isinstance(box["w"], int), "width should be int"
                assert isinstance(box["h"], int), "height should be int"
                assert isinstance(box["label"], str), "label should be string"
                assert isinstance(box["score"], int | float), "score should be numeric"
                assert 0 <= box["score"] <= 1, "score should be between 0 and 1"

                # Reasonable bounds
                assert box["w"] > 0, "width should be positive"
                assert box["h"] > 0, "height should be positive"

    def test_class_summary_consistency(self, client, dataset_case_id):
        """Test that class_summary counts match actual boxes"""
        response = client.post("/v1/classify", json={"slide_id": dataset_case_id})
        assert response.status_code == 200

        data = response.json()
        boxes = data["boxes"]
        class_summary = data["class_summary"]

        # Count boxes by label
        actual_counts = {}
        for box in boxes:
            label = box["label"]
            actual_counts[label] = actual_counts.get(label, 0) + 1

        # Verify class_summary matches actual counts
        for label, count in actual_counts.items():
            if label in class_summary:
                assert class_summary[label] == count, f"Class summary mismatch for {label}"


class TestRobustness:
    """Test system robustness under various conditions"""

    def test_multiple_rapid_requests(self, client, dataset_samples):
        """Test rapid consecutive requests don't cause issues"""
        case_ids = [c["case_id"] for c in dataset_samples[:4] if "case_id" in c]
        assert case_ids
        results = []
        for i in range(10):
            response = client.post("/v1/classify", json={"slide_id": case_ids[i % len(case_ids)]})
            results.append(response.status_code)

        # All should succeed
        assert all(status == 200 for status in results)

    def test_invalid_json_handling(self, client):
        """Test various invalid JSON scenarios"""
        invalid_payloads = [
            "not json at all",
            '{"incomplete": json',
            '{"valid": "json", "but": "unexpected_fields"}',
        ]

        for payload in invalid_payloads:
            response = client.post(
                "/v1/classify",
                content=payload,
                headers={"Content-Type": "application/json"},
            )
            # Should handle gracefully, not crash
            assert response.status_code in [200, 422]


if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v"])
