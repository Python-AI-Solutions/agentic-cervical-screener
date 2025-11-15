#!/usr/bin/env python3
"""Viewer VLM audit runner using llm CLI + Instructor schema parsing."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal

import instructor
from pydantic import BaseModel, Field, ValidationError, conint, confloat

ROOT = Path(__file__).resolve().parents[1]
PROMPT_PATH = ROOT / "prompts" / "vlm" / "viewer-audit.txt"
DEFAULT_SUITE = "viewer"
DEFAULT_MODEL = os.environ.get("VLM_MODEL", "pixtral-12b-4bit")
LLM_BIN = os.environ.get("LLM_BIN", "llm")
REMINDER = (
    "\n\nREMINDER: Return only the JSON object defined in the schema. "
    "Do not use markdown fences and escape any embedded quotes."
)
JSON_FENCE_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]+?)\s*```", re.IGNORECASE)

FormFactor = Literal["desktop", "tablet", "phone", "unknown"]
Severity = Literal["low", "medium", "high"]


class AuditChecks(instructor.OpenAISchema):
    """Structured answers for each checklist item."""

    buttonsClipped: bool = Field(description="True when any action button is cropped/cut off")
    canvasCoveragePercent: conint(ge=0, le=100) = Field(
        description="Estimated percent of viewport occupied by the slide/canvas"
    )
    headerAligned: bool = Field(description="True when toolbar/header is aligned without overlap")
    textLegible: bool = Field(description="True when key labels are readable")
    controlsCompact: bool = Field(
        description="On narrow layouts, true only if controls collapse to icon-sized buttons"
    )


class AuditResponse(instructor.OpenAISchema):
    """Expected schema for viewer audits."""

    severity: Severity = Field(description="Overall UX severity (low/medium/high)")
    summary: str = Field(description="One sentence summary in <=25 words", max_length=120)
    checks: AuditChecks
    violations: list[str] = Field(
        default_factory=list, description="List of concrete issues that were observed"
    )
    confidence: confloat(ge=0, le=1) | None = Field(
        default=None, description="Model confidence between 0 and 1 if provided"
    )


class Finding(BaseModel):
    image: Path
    tag: str
    severity: Severity
    response: AuditResponse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run viewer VLM audit using Instructor schema.")
    parser.add_argument(
        "--suite",
        default=os.environ.get("DOCS_VLM_SUITE", DEFAULT_SUITE),
        help="Screenshot suite directory under playwright-artifacts/ (default: viewer)",
    )
    parser.add_argument(
        "--screenshots",
        default=None,
        help="Override screenshots directory path (default: playwright-artifacts/<suite>)",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("DOCS_VLM_MODEL", DEFAULT_MODEL),
        help=f"LLM model identifier (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=int(os.environ.get("VLM_MAX_ATTEMPTS", "3")),
        help="Maximum attempts per screenshot when schema validation fails",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("VLM_TIMEOUT_MS", "180000")),
        help="Timeout per llm invocation in milliseconds",
    )
    parser.add_argument(
        "--extra-args",
        default=os.environ.get("VLM_ARGS"),
        help="Additional arguments appended to llm CLI (quoted string)",
    )
    return parser.parse_args()


def resolve_screenshot_dir(suite: str, override: str | None) -> Path:
    if override:
        path = Path(override)
        return path if path.is_absolute() else (ROOT / path)
    return ROOT / "playwright-artifacts" / suite


def list_screenshots(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(p for p in directory.iterdir() if p.suffix.lower() == ".png")


def load_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise SystemExit(f"Prompt file missing: {PROMPT_PATH}") from exc


def detect_form_factor(path: Path) -> FormFactor:
    lower = path.name.lower()
    if "phone" in lower:
        return "phone"
    if "tablet" in lower:
        return "tablet"
    if "desktop" in lower:
        return "desktop"
    return "unknown"


def tag_for(path: Path) -> str:
    ff = detect_form_factor(path)
    return {
        "desktop": "[Viewer-Desktop]",
        "tablet": "[Viewer-Tablet]",
        "phone": "[Viewer-Mobile]",
    }.get(ff, "[Viewer]")


def extract_json_block(text: str) -> str:
    matches = JSON_FENCE_PATTERN.findall(text)
    if matches:
        return matches[-1].strip()
    start = text.rfind("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    raise ValueError("No JSON object found in LLM response")


def run_llm(
    image_path: Path,
    prompt: str,
    model: str,
    timeout_ms: int,
    extra_args: list[str],
) -> str:
    cmd = [LLM_BIN, "-m", model, "--no-stream", "--no-log", "-a", str(image_path), *extra_args, prompt]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout_ms / 1000,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"llm invocation failed ({result.returncode}). stderr:\n{result.stderr.strip()}"
        )
    return result.stdout.strip()


def clamp_severity(value: Severity, candidate: Severity) -> Severity:
    order = {"low": 0, "medium": 1, "high": 2}
    return candidate if order[candidate] > order[value] else value


def adjust_severity(response: AuditResponse, form_factor: FormFactor) -> Severity:
    severity: Severity = response.severity
    checks = response.checks
    if checks.buttonsClipped or not checks.headerAligned or checks.canvasCoveragePercent < 50:
        severity = clamp_severity(severity, "high")
    else:
        min_allowed = 60 if form_factor == "phone" else 70
        if checks.canvasCoveragePercent < min_allowed:
            severity = clamp_severity(severity, "medium")
    if not checks.textLegible:
        severity = clamp_severity(severity, "medium")
    if not checks.controlsCompact and form_factor in {"phone", "tablet"}:
        severity = clamp_severity(severity, "medium")
    return severity


def parse_response(raw: str, form_factor: FormFactor) -> AuditResponse:
    block = extract_json_block(raw)
    try:
        response = AuditResponse.model_validate_json(block)
    except ValidationError as exc:
        raise ValueError(f"Schema validation failed: {exc}") from exc
    # recompute severity to align with deterministic rules
    response.severity = adjust_severity(response, form_factor)
    return response


def iterate(args: argparse.Namespace) -> Iterable[Finding]:
    prompt = load_prompt()
    screenshots_dir = resolve_screenshot_dir(args.suite, args.screenshots)
    screenshots = list_screenshots(screenshots_dir)
    if not screenshots:
        raise SystemExit(f"No screenshots found in {screenshots_dir}")
    extra_args = args.extra_args.split() if args.extra_args else []

    for image in screenshots:
        form_factor = detect_form_factor(image)
        tag = tag_for(image)
        print(f"[VLM] Processing {image.name} ({form_factor}) …")
        response: AuditResponse | None = None
        full_prompt = prompt
        for attempt in range(1, args.attempts + 1):
            try:
                raw = run_llm(image, full_prompt, args.model, args.timeout, extra_args)
                response = parse_response(raw, form_factor)
                break
            except (RuntimeError, ValueError) as err:
                print(f"[VLM] Attempt {attempt}/{args.attempts} failed: {err}")
                if attempt == args.attempts:
                    raise
                full_prompt = prompt + REMINDER
        assert response is not None
        print(f"[VLM] ✓ Parsed response for {image.name} (severity: {response.severity})")
        yield Finding(image=image, tag=tag, severity=response.severity, response=response)


def write_report(suite: str, model: str, findings: list[Finding], directory: Path) -> Path:
    lines = [
        "# VLM UX Audit",
        "",
        f"Suite: {suite}",
        f"Model: {model}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]
    for finding in findings:
        lines.append(f"## {finding.image.name}")
        lines.append("")
        payload = finding.response.model_dump()
        payload["severity"] = finding.severity
        payload["tag"] = finding.tag
        lines.append("```json")
        lines.append(json.dumps(payload, indent=2))
        lines.append("```")
        lines.append("")
    report_path = directory / "vlm-report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main() -> None:
    args = parse_args()
    try:
        findings = list(iterate(args))
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[VLM] FATAL: {exc}", file=sys.stderr)
        sys.exit(1)

    screenshots_dir = resolve_screenshot_dir(args.suite, args.screenshots)
    report_path = write_report(args.suite, args.model, findings, screenshots_dir)
    worst = max((f.severity for f in findings), default="low", key=lambda s: {"low": 0, "medium": 1, "high": 2}[s])
    print(f"[VLM] Report written to {report_path}")
    if worst in {"medium", "high"}:
        sys.exit(1)


if __name__ == "__main__":
    main()
