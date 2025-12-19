#!/usr/bin/env python3
"""Capture screenshots for VLM-based audits using Playwright (Python)."""

from __future__ import annotations

import argparse
import socket
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Literal

import requests
from playwright.sync_api import Browser, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]

BrowserName = Literal["chromium", "webkit"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture viewer screenshots for VLM audits.")
    parser.add_argument(
        "--url",
        default=None,
        help="Base URL to capture (if omitted, starts scripts/serve_static.py on a free port).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port to use when starting the local static server (default: random free port).",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output directory (default: playwright-artifacts/viewer).",
    )
    parser.add_argument(
        "--browsers",
        nargs="+",
        default=["chromium", "webkit"],
        choices=["chromium", "webkit"],
        help="Playwright browser engines to use.",
    )
    return parser.parse_args()


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("", 0))
        sock.listen(1)
        return int(sock.getsockname()[1])


def wait_for_http_ok(url: str, timeout_s: float = 15.0) -> None:
    deadline = time.monotonic() + timeout_s
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            resp = requests.get(url, timeout=2)
            if resp.status_code < 500:
                return
        except Exception as exc:  # noqa: BLE001 - best-effort polling
            last_error = exc
        time.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for server at {url}: {last_error}")


@contextmanager
def resolved_base_url(url: str | None, port: int | None) -> Iterable[str]:
    if url:
        yield url.rstrip("/")
        return

    chosen_port = port or get_free_port()
    process = subprocess.Popen(
        ["python", "-m", "scripts.serve_static", "--port", str(chosen_port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    base_url = f"http://localhost:{chosen_port}"
    try:
        wait_for_http_ok(base_url + "/")
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def default_out_dir(override: str | None) -> Path:
    if override:
        path = Path(override)
        return path if path.is_absolute() else (ROOT / path)
    return ROOT / "playwright-artifacts" / "viewer"


def wait_for_viewer_ready(page: Page) -> None:
    page.wait_for_selector("#viewContainer", timeout=20_000)
    page.wait_for_selector("#glCanvas", state="attached", timeout=20_000)
    page.wait_for_selector("#overlayCanvas", state="attached", timeout=20_000)
    page.wait_for_function(
        """() => {
        const status = document.getElementById('status');
        if (!status) return false;
        return (status.textContent || '').toLowerCase().includes('ready');
      }""",
        timeout=25_000,
    )
    page.wait_for_function(
        """() => {
        const dz = document.getElementById('dropZone');
        if (!dz) return false;
        return window.getComputedStyle(dz).display === 'none';
      }""",
        timeout=25_000,
    )


def ensure_sidebar_closed(page: Page) -> None:
    page.wait_for_function("typeof window.closeSidebar === 'function'")
    page.evaluate("window.closeSidebar()")
    page.wait_for_timeout(150)


def capture_full_page(page: Page, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(target), full_page=True)


def draw_phone_roi(page: Page) -> None:
    overlay = page.locator("#overlayCanvas")
    box = overlay.bounding_box()
    if not box:
        raise RuntimeError("overlayCanvas missing bounding box")

    start_x = box["x"] + box["width"] * 0.35
    start_y = box["y"] + box["height"] * 0.35
    end_x = box["x"] + box["width"] * 0.6
    end_y = box["y"] + box["height"] * 0.6

    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(end_x, end_y)
    page.mouse.up()

    page.wait_for_selector("#confirmLabel", timeout=10_000)
    page.click("#confirmLabel")
    page.wait_for_selector("#confirmLabel", state="detached", timeout=10_000)
    page.wait_for_function(
        """() => {
        const status = document.getElementById('status');
        if (!status) return false;
        return (status.textContent || '').toLowerCase().includes('rectangle added');
      }""",
        timeout=10_000,
    )


def device_specs(playwright) -> list[tuple[str, dict]]:
    return [
        ("viewer-desktop", {"viewport": {"width": 1400, "height": 900}}),
        ("viewer-tablet", playwright.devices["iPad Pro 11"]),
        ("viewer-small-phone", playwright.devices["iPhone SE"]),
    ]


def capture_for_browser(
    playwright, browser_name: BrowserName, browser: Browser, base_url: str, out_dir: Path
) -> None:
    for project, spec in device_specs(playwright):
        context = browser.new_context(**spec)
        page = context.new_page()
        try:
            page.goto(base_url + "/", wait_until="domcontentloaded")
            wait_for_viewer_ready(page)

            ensure_sidebar_closed(page)

            capture_full_page(
                page,
                out_dir / f"{browser_name}-{project}-viewer-context.png",
            )

            if "phone" in project:
                draw_phone_roi(page)
                capture_full_page(
                    page,
                    out_dir / f"{browser_name}-{project}-viewer-mobile-roi.png",
                )
        finally:
            context.close()


def main() -> None:
    args = parse_args()
    out_dir = default_out_dir(args.out)

    with resolved_base_url(args.url, args.port) as base_url:
        with sync_playwright() as playwright:
            for browser_name in args.browsers:
                launcher = getattr(playwright, browser_name)
                browser = launcher.launch(headless=True)
                try:
                    capture_for_browser(playwright, browser_name, browser, base_url, out_dir)
                finally:
                    browser.close()

    print(f"[VLM] Screenshots written to {out_dir}")


if __name__ == "__main__":
    main()
