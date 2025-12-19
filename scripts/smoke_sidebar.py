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
    device_scale_factor: float
    initial_visible: bool
    initial_clickable: bool
    after_first_toggle: bool
    after_second_toggle: bool
    after_second_clickable: bool
    cls_after_first: str
    cls_after_second: str
    global_css_ok: bool
    css_probe: dict
    states: list

    @property
    def passed(self) -> bool:
        return (
            self.global_css_ok
            and self.initial_visible
            and self.initial_clickable
            and (not self.after_first_toggle)
            and self.after_second_toggle
            and self.after_second_clickable
        )

def _probe_css_health(page) -> dict:
    return page.evaluate(
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


def _is_sidebar_clickable(page) -> bool:
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


def run_check(browser_type: BrowserType, url: str, *, device_scale_factor: float) -> SidebarResult:
    browser = browser_type.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=device_scale_factor)
    page = context.new_page()
    resp = page.goto(url, wait_until="load", timeout=40_000)

    if resp and resp.status >= 400:
        raise RuntimeError(f"{browser_type.name} failed to load {url}: status {resp.status}")

    # Wait for hamburger to exist so we don't crash if the page is still loading
    page.wait_for_selector("#mobileMenuBtn", timeout=10_000)

    css_probe = _probe_css_health(page)
    global_css_ok = (
        (not css_probe.get("hasNiivueCssLink"))
        and (css_probe.get("bodyPosition") != "absolute")
        and (css_probe.get("workspaceDisplay") != "table-row")
        and (css_probe.get("glCanvasPosition") != "absolute")
    )

    initial_visible = page.is_visible("#sidebar")
    initial_clickable = initial_visible and _is_sidebar_clickable(page)

    page.click("#mobileMenuBtn")
    page.wait_for_timeout(300)
    after_first_toggle = page.is_visible("#sidebar")
    cls_after_first = page.eval_on_selector("#sidebar", "el => el.className")

    page.click("#mobileMenuBtn")
    page.wait_for_timeout(300)
    after_second_toggle = page.is_visible("#sidebar")
    after_second_clickable = after_second_toggle and _is_sidebar_clickable(page)
    cls_after_second = page.eval_on_selector("#sidebar", "el => el.className")
    states = page.evaluate("() => window.__sidebarStates || []")

    context.close()
    browser.close()
    return SidebarResult(
        browser=browser_type.name,
        device_scale_factor=device_scale_factor,
        initial_visible=initial_visible,
        initial_clickable=initial_clickable,
        after_first_toggle=after_first_toggle,
        after_second_toggle=after_second_toggle,
        after_second_clickable=after_second_clickable,
        cls_after_first=cls_after_first,
        cls_after_second=cls_after_second,
        global_css_ok=global_css_ok,
        css_probe=css_probe,
        states=states,
    )


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sidebar toggle smoke test (Chromium + WebKit).")
    parser.add_argument("--url", default="http://localhost:8000/", help="URL of the served static viewer")
    parser.add_argument(
        "--dpr",
        type=float,
        action="append",
        default=[],
        help="Device scale factor(s) to test. Can be repeated.",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    dprs = args.dpr or [1.0, 1.25, 1.5]

    with sync_playwright() as p:
        results: list[SidebarResult] = []
        for dpr in dprs:
            for bt in (p.chromium, p.webkit):
                try:
                    results.append(run_check(bt, args.url, device_scale_factor=dpr))
                except Exception as e:  # noqa: BLE001 - smoke test should keep going
                    print(f"{bt.name:8s} | dpr={dpr:4.2f} | ERROR: {e}", file=sys.stderr)
                    return 1

    for r in results:
        print(
            f"{r.browser:8s} | dpr={r.device_scale_factor:4.2f} "
            f"| css_ok={r.global_css_ok} "
            f"| initial: visible={r.initial_visible} clickable={r.initial_clickable} "
            f"-> after 1st toggle: visible={r.after_first_toggle} "
            f"-> after 2nd toggle: visible={r.after_second_toggle} clickable={r.after_second_clickable} "
            f"| cls1='{r.cls_after_first}' cls2='{r.cls_after_second}' "
            f"| {'OK' if r.passed else 'FAIL'}"
        )
        if not r.global_css_ok:
            print(f"  css_probe={r.css_probe}")
        if not r.passed:
            print(f"  states={r.states}")

    if not all(r.passed for r in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
