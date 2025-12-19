"""
Integration tests using Playwright to test the full application stack.
These tests start the actual server and test real browser interactions.
"""

import json
import os
import socket
import subprocess
import threading
import time
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

# Global lock to ensure resource-intensive tests run sequentially
_resource_intensive_lock = threading.Lock()


class ServerProcess:
    """Wrapper for subprocess.Popen with port information"""

    def __init__(self, process, port):
        self.process = process
        self.port = port

    def __getattr__(self, name):
        # Delegate all other attributes to the underlying process
        return getattr(self.process, name)


def get_free_port():
    """Get a free port dynamically"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def start_test_server(port=None):
    """Start a test server with proper module resolution"""
    if port is None:
        port = get_free_port()

    # Get the project root directory
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Start server using python -m to avoid PYTHONPATH issues
    process = subprocess.Popen(
        ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", str(port)],
        cwd=root_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for server to start and verify it's running
    import requests

    for _attempt in range(15):  # Increased attempts for reliability
        try:
            response = requests.get(f"http://localhost:{port}/healthz", timeout=2)
            if response.status_code == 200:
                return ServerProcess(process, port)
        except requests.exceptions.RequestException as err:
            if process.poll() is not None:
                # Process died
                stdout, stderr = process.communicate()
                raise RuntimeError(f"Server failed to start: {stderr.decode()}") from err
            time.sleep(0.5)

    # If we get here, server didn't start
    process.terminate()
    process.wait()
    raise RuntimeError(f"Server on port {port} failed to start within timeout")


@pytest.fixture(scope="session")
def dataset_case_ids():
    """Return a small list of dataset-backed case IDs for integration tests."""
    repo_root = Path(__file__).resolve().parent.parent
    index_path = repo_root / "public" / "cases" / "dataset-samples.json"
    doc = json.loads(index_path.read_text(encoding="utf-8"))
    case_ids = [c["case_id"] for c in (doc.get("cases") or [])[:4] if "case_id" in c]
    assert case_ids, "public/cases/dataset-samples.json must contain cases"
    return case_ids


@pytest.fixture(scope="session")
def server_process():
    """Start the FastAPI server for integration testing"""
    server = start_test_server()  # Use a free port to avoid local port conflicts

    yield server

    # Cleanup
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()


@pytest.fixture(scope="function")
def fresh_server_process():
    """
    Start a fresh FastAPI server for resource-intensive tests.
    Uses a lock to ensure only one resource-intensive test runs at a time.
    """
    # Acquire lock to ensure sequential execution of resource-intensive tests
    with _resource_intensive_lock:
        # Start server with dynamic port allocation
        server = start_test_server()

        try:
            yield server
        finally:
            # Cleanup - ensure server is fully stopped before releasing lock
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()  # Ensure it's really dead

            # Small delay to ensure port is fully released
            time.sleep(0.5)


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
        page.goto(f"http://localhost:{server_process.port}/healthz")

        # Should get JSON response
        content = page.content()
        assert "ok" in content
        assert "true" in content.lower()

    def test_api_docs_accessible(self, server_process, page):
        """Test that API documentation is accessible"""
        page.goto(f"http://localhost:{server_process.port}/docs")

        # Should load Swagger UI
        expect(page.locator("body")).to_contain_text("Cervical AI Classifier")

        # Should show API endpoints
        expect(page.locator("body")).to_contain_text("/healthz")
        expect(page.locator("body")).to_contain_text("/v1/classify")

    def test_model_info_endpoint_integration(self, server_process, page):
        """Test model info endpoint returns valid JSON"""
        page.goto(f"http://localhost:{server_process.port}/model-info")

        content = page.content()
        # Should be valid JSON response
        assert "{" in content and "}" in content


class TestClassifyIntegration:
    """Test classification endpoints with real requests"""

    def test_classify_endpoint_via_curl(self, server_process, dataset_case_ids):
        """Test classify endpoint using real curl request"""
        import subprocess

        case_id = dataset_case_ids[0]
        # Make actual HTTP request
        result = subprocess.run(
            [
                "curl",
                "-s",
                "-X",
                "POST",
                f"http://localhost:{server_process.port}/v1/classify",
                "-H",
                "Content-Type: application/json",
                "-d",
                json.dumps({"slide_id": case_id, "conf_threshold": 0.25}),
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
        assert response_data["slide_id"] == case_id

    def test_dataset_cases_integration(self, server_process, dataset_case_ids):
        """Test a few dataset-backed cases work via real HTTP"""
        import subprocess

        for case_id in dataset_case_ids[:3]:
            result = subprocess.run(
                [
                    "curl",
                    "-s",
                    "-X",
                    "POST",
                    f"http://localhost:{server_process.port}/v1/classify",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    json.dumps({"slide_id": case_id}),
                ],
                capture_output=True,
                text=True,
            )

            assert result.returncode == 0, f"Request failed for {case_id}: {result.stderr}"

            response_data = json.loads(result.stdout)
            assert response_data["slide_id"] == case_id
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
                    f"http://localhost:{server_process.port}/v1/classify-upload",
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
        from pathlib import Path

        repo_root = Path(__file__).resolve().parent.parent
        index_path = repo_root / "public" / "cases" / "dataset-samples.json"
        doc = json.loads(index_path.read_text(encoding="utf-8"))
        case_ids = [c["case_id"] for c in (doc.get("cases") or [])[:3] if "case_id" in c]
        assert case_ids, "dataset-samples.json must contain cases for integration tests"

        for case_id in case_ids:
            result = subprocess.run(
                ["curl", "-s", f"http://localhost:{server_process.port}/cases/{case_id}"],
                capture_output=True,
                text=True,
            )

            assert result.returncode == 0, f"Case request failed for {case_id}: {result.stderr}"

            # Should get valid JSON
            response_data = json.loads(result.stdout)
            assert isinstance(response_data, dict)


class TestSystemResilience:
    """Test system behavior under stress and edge conditions"""

    def test_concurrent_requests_integration(self, fresh_server_process, dataset_case_ids):
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
                    f"http://localhost:{fresh_server_process.port}/v1/classify",
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
                case_id = dataset_case_ids[i % len(dataset_case_ids)]
                futures.append(executor.submit(make_request, case_id))

            results = [future.result() for future in futures]

        # All should succeed
        for returncode, stdout in results:
            assert returncode == 0, f"Request failed: {stdout}"
            response_data = json.loads(stdout)
            assert "slide_id" in response_data

    def test_malformed_request_handling(self, fresh_server_process):
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
                    f"http://localhost:{fresh_server_process.port}/v1/classify",
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

    @pytest.mark.timeout(30)
    def test_response_time_baseline(self, server_process, dataset_case_ids):
        """Measure baseline response times for key endpoints"""
        import statistics
        import subprocess
        import time

        endpoints = [
            (f"http://localhost:{server_process.port}/healthz", "GET", None),
            (f"http://localhost:{server_process.port}/model-info", "GET", None),
            (
                f"http://localhost:{server_process.port}/v1/classify",
                "POST",
                json.dumps({"slide_id": dataset_case_ids[0]}),
            ),
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
                            data or "{}",  # Ensure data is never None
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


class TestStaticViewerLayout:
    """Regression checks for the static viewer layout."""

    @pytest.mark.timeout(60)
    def test_sidebar_toggle_is_visible_and_on_top(self, server_process, playwright_browser):
        """Ensure the sidebar is actually visible/clickable (not just toggled in DOM)."""
        url = f"http://localhost:{server_process.port}/"

        def sidebar_is_on_top(page) -> bool:
            box = page.locator("#sidebar").bounding_box()
            if not box:
                return False
            x = box["x"] + min(20, box["width"] / 2)
            y = box["y"] + min(20, box["height"] / 2)
            return bool(
                page.evaluate(
                    """({x, y}) => {
                  const el = document.elementFromPoint(x, y);
                  if (!el) return false;
                  return Boolean(el.closest && el.closest('#sidebar'));
                }""",
                    {"x": x, "y": y},
                )
            )

        def run_check(page) -> None:
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_selector("#mobileMenuBtn", timeout=10_000)
            page.wait_for_selector("#datasetSamples button", timeout=15_000)
            page.wait_for_function("typeof window.toggleSidebar === 'function'")

            css_probe = page.evaluate(
                """() => {
                const sheetHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                  .map(l => l.getAttribute('href') || '')
                  .filter(Boolean);
                const body = window.getComputedStyle(document.body);
                const workspace = document.querySelector('.workspace-area');
                const workspaceStyle = workspace ? window.getComputedStyle(workspace) : null;
                const glCanvas = document.getElementById('glCanvas');
                const glCanvasStyle = glCanvas ? window.getComputedStyle(glCanvas) : null;
                const hasNiivueCssLink = sheetHrefs.some(h => /niivue\\.css(\\?|$)/.test(h));
                return {
                  hasNiivueCssLink,
                  bodyPosition: body.position,
                  workspaceDisplay: workspaceStyle ? workspaceStyle.display : null,
                  glCanvasPosition: glCanvasStyle ? glCanvasStyle.position : null,
                  sheetHrefs
                };
              }"""
            )
            assert not css_probe[
                "hasNiivueCssLink"
            ], f"Unexpected niivue.css loaded: {css_probe['sheetHrefs']}"
            assert css_probe["bodyPosition"] != "absolute"
            assert css_probe["workspaceDisplay"] != "table-row"
            assert css_probe["glCanvasPosition"] != "absolute"

            # Ensure the app has actually loaded a case and painted the image canvas.
            page.wait_for_function(
                """() => {
                const status = document.getElementById('status');
                if (!status) return false;
                return (status.textContent || '').toLowerCase().includes('ready');
              }""",
                timeout=20_000,
            )
            page.wait_for_function(
                """() => {
                const dz = document.getElementById('dropZone');
                if (!dz) return false;
                return window.getComputedStyle(dz).display === 'none';
              }""",
                timeout=20_000,
            )
            page.wait_for_selector("#imageCanvas", timeout=20_000)

            assert page.is_visible("#sidebar")
            assert sidebar_is_on_top(page)

            # Click a real button inside the sidebar to ensure it's not occluded.
            page.click("#datasetSamples button")
            page.wait_for_function(
                """() => {
                const status = document.getElementById('status');
                if (!status) return false;
                return (status.textContent || '').toLowerCase().includes('ready');
              }""",
                timeout=20_000,
            )
            assert sidebar_is_on_top(page)

            page.click("#mobileMenuBtn")
            page.wait_for_timeout(250)
            assert not page.is_visible("#sidebar")

            page.click("#mobileMenuBtn")
            page.wait_for_timeout(250)
            assert page.is_visible("#sidebar")
            assert sidebar_is_on_top(page)

        # Approximate browser-zoom/DPR behavior with different device scale factors.
        for dpr in (1.0, 1.25, 1.5):
            context = playwright_browser.new_context(
                viewport={"width": 1280, "height": 720},
                device_scale_factor=dpr,
            )
            page = context.new_page()
            try:
                run_check(page)
            finally:
                context.close()


# Pytest configuration for integration tests
pytestmark = pytest.mark.integration
