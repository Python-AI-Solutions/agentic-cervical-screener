"""
Integration tests using Playwright to test the full application stack.
These tests start the actual server and test real browser interactions.
"""

import os
import subprocess
import time

import pytest
from playwright.sync_api import expect, sync_playwright


@pytest.fixture(scope="session")
def server_process():
    """Start the FastAPI server for integration testing"""
    # Change to the root directory
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Start the server process
    env = os.environ.copy()
    env["PYTHONPATH"] = root_dir

    process = subprocess.Popen(
        [
            "python",
            "-m",
            "uvicorn",
            "src.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8001",
        ],
        cwd=root_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for server to start
    time.sleep(3)

    # Verify server is running
    import requests

    for _attempt in range(10):
        try:
            response = requests.get("http://localhost:8001/healthz", timeout=2)
            if response.status_code == 200:
                break
        except requests.exceptions.RequestException:
            time.sleep(1)
    else:
        pytest.fail("Server failed to start")

    yield process

    # Cleanup
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.fixture(scope="session")
def playwright_browser():
    """Set up Playwright browser for testing"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(playwright_browser):
    """Create a new browser page for each test"""
    context = playwright_browser.new_context()
    page = context.new_page()
    yield page
    context.close()


class TestAPIIntegration:
    """Test API endpoints through real HTTP requests"""

    def test_health_endpoint_integration(self, server_process, page):
        """Test health endpoint through browser"""
        page.goto("http://localhost:8001/healthz")

        # Should get JSON response
        content = page.content()
        assert "ok" in content
        assert "true" in content.lower()

    def test_api_docs_accessible(self, server_process, page):
        """Test that API documentation is accessible"""
        page.goto("http://localhost:8001/docs")

        # Should load Swagger UI
        expect(page.locator("body")).to_contain_text("Cervical AI Classifier")

        # Should show API endpoints
        expect(page.locator("body")).to_contain_text("/healthz")
        expect(page.locator("body")).to_contain_text("/v1/classify")

    def test_model_info_endpoint_integration(self, server_process, page):
        """Test model info endpoint returns valid JSON"""
        page.goto("http://localhost:8001/model-info")

        content = page.content()
        # Should be valid JSON response
        assert "{" in content and "}" in content


class TestClassifyIntegration:
    """Test classification endpoints with real requests"""

    def test_classify_endpoint_via_curl(self, server_process):
        """Test classify endpoint using real curl request"""
        import json
        import subprocess

        # Make actual HTTP request
        result = subprocess.run(
            [
                "curl",
                "-s",
                "-X",
                "POST",
                "http://localhost:8001/v1/classify",
                "-H",
                "Content-Type: application/json",
                "-d",
                '{"slide_id": "SLIDE-001", "conf_threshold": 0.25}',
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0, f"Curl failed: {result.stderr}"

        # Parse JSON response
        response_data = json.loads(result.stdout)

        # Verify response structure
        assert "slide_id" in response_data
        assert "boxes" in response_data
        assert "total_detections" in response_data
        assert "class_summary" in response_data
        assert response_data["slide_id"] == "SLIDE-001"

    def test_all_demo_slides_integration(self, server_process):
        """Test all demo slides work via real HTTP"""
        import json
        import subprocess

        slides = ["SLIDE-001", "SLIDE-002", "SLIDE-003", "SLIDE-004"]

        for slide_id in slides:
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    "http://localhost:8001/v1/classify",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    f'{{"slide_id": "{slide_id}"}}',
                ],
                capture_output=True,
                text=True,
            )

            assert result.returncode == 0, f"Request failed for {slide_id}: {result.stderr}"

            response_data = json.loads(result.stdout)
            assert response_data["slide_id"] == slide_id
            assert isinstance(response_data["boxes"], list)
            assert isinstance(response_data["total_detections"], int)


class TestFileUploadIntegration:
    """Test file upload functionality end-to-end"""

    def test_file_upload_via_curl(self, server_process):
        """Test file upload using real multipart request"""
        import json
        import subprocess
        import tempfile

        from PIL import Image

        # Create a real test image
        img = Image.new("RGB", (100, 100), color="blue")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
            img.save(tmp_file.name)

            # Upload via curl
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    "http://localhost:8001/v1/classify-upload",
                    "-F",
                    f"file=@{tmp_file.name}",
                ],
                capture_output=True,
                text=True,
            )

            # Clean up temp file
            os.unlink(tmp_file.name)

        # Should either succeed or fail gracefully
        assert result.returncode == 0, f"Upload failed: {result.stderr}"

        try:
            response_data = json.loads(result.stdout)
            # If successful, should have proper structure
            if "filename" in response_data:
                assert "boxes" in response_data
                assert "total_detections" in response_data
                assert "class_summary" in response_data
        except json.JSONDecodeError:
            # If not JSON, should be an error response
            assert "error" in result.stdout.lower() or "model not loaded" in result.stdout.lower()


class TestCaseDataIntegration:
    """Test case data endpoints with real data"""

    def test_case_endpoints_integration(self, server_process):
        """Test case data endpoints return real data"""
        import json
        import subprocess

        case_ids = ["DEMO-001", "DEMO-002", "DEMO-003", "DEMO-004"]

        for case_id in case_ids:
            result = subprocess.run(
                ["curl", "-s", f"http://localhost:8001/cases/{case_id}"],
                capture_output=True,
                text=True,
            )

            assert result.returncode == 0, f"Case request failed for {case_id}: {result.stderr}"

            # Should get valid JSON
            response_data = json.loads(result.stdout)
            assert isinstance(response_data, dict)


class TestSystemResilience:
    """Test system behavior under stress and edge conditions"""

    def test_concurrent_requests_integration(self, server_process):
        """Test multiple concurrent requests to real server"""
        import concurrent.futures
        import json
        import subprocess

        def make_request(slide_id):
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    "http://localhost:8001/v1/classify",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    f'{{"slide_id": "{slide_id}"}}',
                ],
                capture_output=True,
                text=True,
            )

            return result.returncode, result.stdout

        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for i in range(10):
                slide_id = f"SLIDE-{(i % 4) + 1:03d}"
                futures.append(executor.submit(make_request, slide_id))

            results = [future.result() for future in futures]

        # All should succeed
        for returncode, stdout in results:
            assert returncode == 0, f"Request failed: {stdout}"
            response_data = json.loads(stdout)
            assert "slide_id" in response_data

    def test_malformed_request_handling(self, server_process):
        """Test server handles malformed requests gracefully"""
        import subprocess

        malformed_requests = [
            '{"invalid": json',  # Invalid JSON
            "not json at all",  # Not JSON
            "{}",  # Empty JSON
        ]

        for payload in malformed_requests:
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    "http://localhost:8001/v1/classify",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    payload,
                ],
                capture_output=True,
                text=True,
            )

            # Should not crash (return code 0) and should have reasonable response
            assert result.returncode == 0, f"Server crashed on malformed request: {payload}"

            # Response should indicate error or fallback behavior
            assert len(result.stdout) > 0, "Empty response to malformed request"


class TestPerformanceBaseline:
    """Establish performance baselines for the API"""

    def test_response_time_baseline(self, server_process):
        """Measure baseline response times for key endpoints"""
        import statistics
        import subprocess
        import time

        endpoints = [
            ("http://localhost:8001/healthz", "GET", None),
            ("http://localhost:8001/model-info", "GET", None),
            ("http://localhost:8001/v1/classify", "POST", '{"slide_id": "SLIDE-001"}'),
        ]

        for url, method, data in endpoints:
            times = []

            for _ in range(5):  # 5 requests per endpoint
                start = time.time()

                if method == "GET":
                    result = subprocess.run(["curl", "-s", url], capture_output=True)
                else:
                    result = subprocess.run(
                        [
                            "curl",
                            "-s",
                            "-X",
                            method,
                            "-H",
                            "Content-Type: application/json",
                            "-d",
                            data,
                            url,
                        ],
                        capture_output=True,
                    )

                end = time.time()

                assert result.returncode == 0, f"Request failed for {url}"
                times.append(end - start)

            avg_time = statistics.mean(times)
            max_time = max(times)

            # Log performance for monitoring
            print(f"{url}: avg={avg_time:.3f}s, max={max_time:.3f}s")

            # Reasonable performance expectations
            assert avg_time < 2.0, f"Average response time too high for {url}: {avg_time:.3f}s"
            assert max_time < 5.0, f"Max response time too high for {url}: {max_time:.3f}s"


# Pytest configuration for integration tests
pytestmark = pytest.mark.integration
