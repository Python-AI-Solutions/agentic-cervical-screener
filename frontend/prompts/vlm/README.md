# VLM Audit Prompts

This directory contains prompt templates for VLM-based visual quality audits.

## Files

- **`viewer-audit.txt`** - Prompt for analyzing the cervical screener viewer UI
- **`docs-audit.txt`** - Prompt for analyzing documentation/workflow screens

## Usage

These prompts are automatically loaded by `scripts/docs-overview-vlm.ts` based on the `--suite` parameter:
- `--suite viewer` → uses `viewer-audit.txt`
- `--suite docs-overview` → uses `docs-audit.txt`

## Customization

You can customize these prompts to:
- Focus on specific UI concerns
- Adjust severity criteria
- Add domain-specific checks
- Improve the model's accuracy

The prompts use plain language and avoid complex structured output requirements, as SmolVLM-500M works best with natural language instructions.

## Testing Prompts

Test a prompt manually:

```bash
pixi run llm -m SmolVLM-500M -a screenshot.png "$(cat prompts/vlm/viewer-audit.txt)"
```

## Tips for Writing Effective VLM Prompts

1. **Be specific** - Mention exact UI elements to check (buttons, menus, text)
2. **Use natural language** - Avoid complex JSON schemas or structured formats
3. **Provide examples** - Describe what good/bad looks like
4. **Set clear severity levels** - Define what constitutes high/medium/low issues
5. **Keep it concise** - Shorter prompts work better with smaller models
6. **Test iteratively** - Try prompts on real screenshots and refine

## Model Limitations

SmolVLM-500M is a small (500M parameter) vision-language model:
- **Strengths**: Fast inference (~8s), good at describing visible elements, low memory usage
- **Limitations**: May miss subtle issues, struggles with complex reasoning, can be overly literal
- **Best for**: Obvious visual problems (cut-off elements, misalignment, overlap)
- **Not ideal for**: Subjective aesthetic judgments, complex interaction flows

For higher accuracy, consider using larger models like Qwen2-VL-2B, though they're slower.
