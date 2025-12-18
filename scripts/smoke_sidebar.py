"""Playwright smoke test for the static viewer sidebar toggle.

Usage:
    pixi run python -m scripts.smoke_sidebar --url http://localhost:8000/

Prereq:
    - Serve the static site in another terminal: `pixi run serve-static`
    - Ensure Playwright browsers are installed: `pixi run install-browsers`
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from typing import Iterable

from playwright.sync_api import BrowserType, sync_playwright


@dataclass
class SidebarResult:
    browser: str
    initial_visible: bool
    after_first_toggle: bool
    after_second_toggle: bool
    cls_after_first: str
    cls_after_second: str
    states: list

    @property
    def passed(self) -> bool:
        return self.initial_visible and not self.after_first_toggle and self.after_second_toggle


def run_check(browser_type: BrowserType, url: str) -> SidebarResult:
    browser = browser_type.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    resp = page.goto(url, wait_until="load", timeout=40_000)

    if resp and resp.status >= 400:
        raise RuntimeError(f"{browser_type.name} failed to load {url}: status {resp.status}")

    # Wait for hamburger to exist so we don't crash if the page is still loading
    page.wait_for_selector("#mobileMenuBtn", timeout=10_000)

    initial_visible = page.is_visible("#sidebar")

    page.evaluate("() => toggleSidebar()")
    page.wait_for_timeout(300)
    after_first_toggle = page.is_visible("#sidebar")
    cls_after_first = page.eval_on_selector("#sidebar", "el => el.className")

    page.evaluate("() => toggleSidebar()")
    page.wait_for_timeout(300)
    after_second_toggle = page.is_visible("#sidebar")
    cls_after_second = page.eval_on_selector("#sidebar", "el => el.className")
    states = page.evaluate("() => window.__sidebarStates || []")

    browser.close()
    return SidebarResult(
        browser=browser_type.name,
        initial_visible=initial_visible,
        after_first_toggle=after_first_toggle,
        after_second_toggle=after_second_toggle,
        cls_after_first=cls_after_first,
        cls_after_second=cls_after_second,
        states=states,
    )


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sidebar toggle smoke test (Chromium + WebKit).")
    parser.add_argument("--url", default="http://localhost:8000/", help="URL of the served static viewer")
    args = parser.parse_args(list(argv) if argv is not None else None)

    with sync_playwright() as p:
        results = [
            run_check(p.chromium, args.url),
            run_check(p.webkit, args.url),
        ]

    for r in results:
        print(
            f"{r.browser:8s} | initial: {r.initial_visible} "
            f"-> after 1st toggle: {r.after_first_toggle} "
            f"-> after 2nd toggle: {r.after_second_toggle} "
            f"| cls1='{r.cls_after_first}' cls2='{r.cls_after_second}' "
            f"| states={r.states} "
            f"| {'OK' if r.passed else 'FAIL'}"
        )

    if not all(r.passed for r in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
