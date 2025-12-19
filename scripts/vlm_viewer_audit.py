#!/usr/bin/env python3
"""Viewer VLM audit runner using llm CLI + Pydantic schema parsing."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal

from pydantic import BaseModel, Field, ValidationError, conint, confloat

ROOT = Path(__file__).resolve().parents[1]
PROMPT_PATH = ROOT / "prompts" / "vlm" / "viewer-audit.txt"
LLM_BIN = os.environ.get("LLM_BIN", "llm")
LLM_CMD = shlex.split(LLM_BIN)
DEFAULT_MODEL = os.environ.get("VLM_MODEL")
if DEFAULT_MODEL is None and ("llm-mlx-vlm" in LLM_BIN or "external/llm-mlx-vlm" in LLM_BIN):
    # If the user explicitly points at the MLX-VLM llm environment but did not choose a model,
    # default to a known local model instead of `llm`'s remote default.
    DEFAULT_MODEL = "pixtral-12b-4bit"
REMINDER = (
    "\n\nREMINDER: Return only the JSON object defined in the schema. "
    "Do not use markdown fences and escape any embedded quotes."
)
JSON_FENCE_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]+?)\s*```", re.IGNORECASE)

FormFactor = Literal["desktop", "tablet", "phone", "unknown"]
Severity = Literal["low", "medium", "high"]


class AuditChecks(BaseModel):
    """Structured answers for each checklist item."""

    buttonsClipped: bool = Field(description="True when any action button is cropped/cut off")
    canvasCoveragePercent: conint(ge=0, le=100) = Field(
        description="Estimated percent of viewport occupied by the slide/canvas"
    )
    headerAligned: bool = Field(description="True when toolbar/header is aligned without overlap")
    textLegible: bool = Field(description="True when key labels are readable")
    controlsCompact: bool = Field(
        description="On narrow layouts, true only if controls remain usable without overlap"
    )


class AuditResponse(BaseModel):
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


class FatalLlmError(RuntimeError):
    """Errors that should not be retried (e.g., bad config, missing model)."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run viewer VLM audit using a JSON schema.")
    parser.add_argument(
        "--screenshots",
        default=None,
        help="Override screenshots directory path (default: playwright-artifacts/viewer)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help="LLM model identifier passed to `llm -m` (default: use llm's configured default model).",
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


def resolve_screenshot_dir(override: str | None) -> Path:
    if override:
        path = Path(override)
        return path if path.is_absolute() else (ROOT / path)
    return ROOT / "playwright-artifacts" / "viewer"


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
    model: str | None,
    timeout_ms: int,
    extra_args: list[str],
) -> str:
    model_args: list[str] = ["-m", model] if model else []
    cmd = [
        *LLM_CMD,
        *model_args,
        "--no-stream",
        "--no-log",
        "-a",
        str(image_path),
        *extra_args,
        prompt,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
            check=False,
        )
    except FileNotFoundError as exc:
        raise FatalLlmError(
            f"`llm` command not found.\n\n"
            f"Configured `LLM_BIN`: {LLM_BIN}\n"
            "Fix options:\n"
            "- Install the `llm` CLI (https://llm.datasette.io/)\n"
            "- Or set `LLM_BIN` to a working `llm` command\n"
            "- Or (Apple Silicon) use `external/llm-mlx-vlm` and set:\n"
            "  `LLM_BIN=\"pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm\"`"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"llm invocation timed out after {timeout_ms}ms") from exc
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        combined = stderr or stdout or f"(exit code {result.returncode})"

        if "Unknown model:" in combined:
            model_label = model or "<llm default>"
            message_lines = [
                f"Unknown model: {model_label}",
                "",
                "This audit runs via the `llm` CLI. Available models depend on installed providers/plugins.",
                "",
                "Fix options:",
                f"- List available models: `{LLM_BIN} models list` (or `pixi run llm models list`)",
                "- Set `VLM_MODEL` to one of the listed models and rerun `pixi run vlm-audit`",
            ]
            if (ROOT / "external" / "llm-mlx-vlm").exists():
                message_lines.extend(
                    [
                        "",
                        "Local (Apple Silicon) option via MLX-VLM plugin:",
                        "- Install plugin: `pixi install --manifest-path external/llm-mlx-vlm/pixi.toml`",
                        "- Enable plugin: `pixi run --manifest-path external/llm-mlx-vlm/pixi.toml install-dev`",
                        "- Run audit:",
                        "  `LLM_BIN=\"pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm\" "
                        "VLM_MODEL=pixtral-12b-4bit pixi run vlm-audit`",
                        "  (If you need a smaller model: `VLM_MODEL=SmolVLM-500M`)",
                        "",
                        "Notes:",
                        "- MLX-VLM models download on first use (HuggingFace cache); no server process is required.",
                        "- The `llm -m` value is the model alias (see `llm models list`), not a HuggingFace repo id.",
                    ]
                )
            raise FatalLlmError("\n".join(message_lines))

        if "OPENAI_API_KEY" in combined:
            raise FatalLlmError(
                "OpenAI credentials are not configured for the selected `llm` model.\n\n"
                "Fix options:\n"
                "- Set `OPENAI_API_KEY` and rerun, or run `llm keys set openai`\n"
                "- Or choose a different model/provider via `llm models list` / `VLM_MODEL`\n"
                "- Or use the local MLX-VLM plugin under `external/llm-mlx-vlm` on Apple Silicon"
            )

        raise RuntimeError(f"llm invocation failed ({result.returncode}). stderr/stdout:\n{combined}")
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
    response.severity = adjust_severity(response, form_factor)
    return response


def prompt_context_for(image_name: str) -> str:
    """Return contextual instructions based on screenshot name."""

    lower = image_name.lower()
    is_phone = ("phone" in lower) or ("mobile" in lower)
    contexts: list[str] = []

    if "viewer-context" in lower:
        contexts.append(
            "Viewer layout: fixed header at the top, hamburger menu on the left, workspace selector in the center. "
            "On desktop/tablet the sidebar is a fixed left column; on phones it becomes an overlay drawer below the header."
        )

    if "viewer-context" in lower and is_phone:
        contexts.append(
            "This phone screenshot is captured with the sidebar drawer CLOSED (default state) so the canvas should be full width. "
            "Expect the hamburger menu to be visible in the header so the sidebar can be opened when needed."
        )

    if is_phone and "roi" in lower:
        contexts.append(
            "Screenshot captured after the user draws ROI annotations on the canvas with the sidebar CLOSED. "
            "Expect to see at least one newly drawn ROI box (colored rectangle) on top of the slide."
        )

    if not contexts:
        return ""
    return "\n\nCONTEXT:\n" + "\n".join(contexts)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def iterate(args: argparse.Namespace) -> Iterable[Finding]:
    prompt = load_prompt()
    screenshots_dir = resolve_screenshot_dir(args.screenshots)
    screenshots = list_screenshots(screenshots_dir)
    if not screenshots:
        raise SystemExit(f"No screenshots found in {screenshots_dir}")
    extra_args = args.extra_args.split() if args.extra_args else []

    for image in screenshots:
        form_factor = detect_form_factor(image)
        tag = tag_for(image)
        print(f"[VLM] Processing {image.name} ({form_factor}) …")
        response: AuditResponse | None = None
        full_prompt = prompt + prompt_context_for(image.name)
        for attempt in range(1, args.attempts + 1):
            try:
                raw = run_llm(image, full_prompt, args.model, args.timeout, extra_args)
                response = parse_response(raw, form_factor)
                break
            except FatalLlmError:
                raise
            except (RuntimeError, ValueError) as err:
                print(f"[VLM] Attempt {attempt}/{args.attempts} failed: {err}")
                if attempt == args.attempts:
                    raise
                full_prompt = prompt + prompt_context_for(image.name) + REMINDER
        assert response is not None
        print(f"[VLM] ✓ Parsed response for {image.name} (severity: {response.severity})")
        yield Finding(image=image, tag=tag, severity=response.severity, response=response)


def write_report(model: str | None, findings: list[Finding], directory: Path) -> Path:
    lines = [
        "# VLM UX Audit",
        "",
        f"Model: {model or '<llm default>'}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]
    for finding in findings:
        lines.append(f"## {finding.image.name}")
        lines.append("")
        try:
            digest = sha256_file(finding.image)
            mtime = datetime.fromtimestamp(finding.image.stat().st_mtime, tz=timezone.utc).isoformat()
            lines.append(f"- SHA256: `{digest}`")
            lines.append(f"- Modified: `{mtime}`")
            lines.append("")
        except OSError:
            pass

        # Embed the screenshot so the report always includes the visual context.
        lines.append(f"![{finding.image.name}]({finding.image.name})")
        lines.append("")

        payload = finding.response.model_dump()
        payload["severity"] = finding.severity
        payload["tag"] = finding.tag
        payload["image"] = finding.image.name
        lines.append("```json")
        lines.append(json.dumps(payload, indent=2))
        lines.append("```")
        lines.append("")
    report_path = directory / "vlm-report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main() -> None:
    args = parse_args()
    print(f"[VLM] llm command: {LLM_BIN}")
    print(f"[VLM] model: {args.model or '<llm default>'}")
    try:
        findings = list(iterate(args))
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[VLM] FATAL: {exc}", file=sys.stderr)
        sys.exit(1)

    screenshots_dir = resolve_screenshot_dir(args.screenshots)
    report_path = write_report(args.model, findings, screenshots_dir)
    order = {"low": 0, "medium": 1, "high": 2}
    worst = max((f.severity for f in findings), default="low", key=lambda s: order[s])
    print(f"[VLM] Report written to {report_path}")
    if worst in {"medium", "high"}:
        sys.exit(1)


if __name__ == "__main__":
    main()
