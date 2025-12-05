from pathlib import Path
import sys

import pytest

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import vlm_viewer_audit as audit


def make_checks(
    *,
    buttons: bool = False,
    coverage: int = 80,
    header: bool = True,
    text: bool = True,
    compact: bool = True,
) -> audit.AuditChecks:
    return audit.AuditChecks(
        buttonsClipped=buttons,
        canvasCoveragePercent=coverage,
        headerAligned=header,
        textLegible=text,
        controlsCompact=compact,
    )


def test_detect_form_factor_variants() -> None:
    assert audit.detect_form_factor(Path("viewer-desktop-viewer-context.png")) == "desktop"
    assert audit.detect_form_factor(Path("viewer-tablet.png")) == "tablet"
    assert audit.detect_form_factor(Path("viewer-small-phone.png")) == "phone"
    assert audit.detect_form_factor(Path("viewer-unknown.png")) == "unknown"


def test_extract_json_block_prefers_last_fence() -> None:
    raw = """Noise
```json
{"value": 1}
```
More Noise
```json
{"value": 2}
```"""
    assert audit.extract_json_block(raw) == '{"value": 2}'


def test_adjust_severity_promotes_high_for_buttons() -> None:
    response = audit.AuditResponse(
        severity="low",
        summary="All good",
        checks=make_checks(buttons=True),
        violations=["buttons clipped"],
        confidence=0.9,
    )
    assert audit.adjust_severity(response, "desktop") == "high"


def test_adjust_severity_promotes_medium_for_canvas_gap() -> None:
    response = audit.AuditResponse(
        severity="low",
        summary="Coverage low",
        checks=make_checks(coverage=55),
        violations=["canvas small"],
    )
    assert audit.adjust_severity(response, "desktop") == "medium"


def test_parse_response_overrides_declared_severity() -> None:
    payload = {
        "severity": "low",
        "summary": "Buttons broken",
        "checks": {
            "buttonsClipped": True,
            "canvasCoveragePercent": 80,
            "headerAligned": True,
            "textLegible": True,
            "controlsCompact": True,
        },
        "violations": ["buttons clipped"],
        "confidence": 0.5,
    }
    raw = f"```json\n{audit.json.dumps(payload)}\n```"
    response = audit.parse_response(raw, "desktop")
    assert response.severity == "high"


def test_parse_response_raises_on_invalid_json() -> None:
    with pytest.raises(ValueError):
        audit.parse_response("not json", "desktop")


def test_prompt_context_for_mobile_roi() -> None:
    context = audit.prompt_context_for("viewer-mobile-roi.png")
    assert "user ROI missing" in context
    assert "phone layout" in context
