"""
LLM plugin for running vision language models using MLX on Apple Silicon.

This plugin integrates mlx-vlm to provide fast, local VLM inference on Mac.

Usage:
    llm -m SmolVLM-500M "Describe this image" -a image.png

When calling from Node.js/subprocess:
    The `llm` CLI waits for stdin EOF before processing. When using execa or spawn,
    explicitly close stdin to avoid hanging:

    // Using execa
    await execa('llm', ['-m', 'SmolVLM-500M', 'prompt', '-a', 'image.png'], {
        input: '',  // Close stdin immediately
    })

    // Using spawn
    const proc = spawn('llm', [...]);
    proc.stdin?.end();  // Close stdin immediately
"""
import llm
from typing import Optional
import subprocess


@llm.hookimpl
def register_models(register):
    """Register MLX-VLM models with the LLM CLI."""
    # Register popular small VLMs optimized for Apple Silicon
    register(MlxVlmModel("SmolVLM-256M", "HuggingfaceTB/SmolVLM-256M-Instruct"))
    register(MlxVlmModel("SmolVLM-500M", "HuggingfaceTB/SmolVLM-500M-Instruct"))
    register(MlxVlmModel("Qwen2-VL-2B", "Qwen/Qwen2-VL-2B-Instruct"))
    # Note: LLaVA-1.6 models use llava_next architecture which is not yet supported by mlx-vlm


class MlxVlmModel(llm.Model):
    """Model class for MLX-VLM integration."""

    needs_key = None
    can_stream = False
    attachment_types = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}

    def __init__(self, model_id: str, hf_model_path: str):
        self.model_id = model_id
        self.hf_model_path = hf_model_path

    class Options(llm.Options):
        max_tokens: Optional[int] = 400
        temperature: Optional[float] = 0.0

    def __str__(self):
        return f"MLX-VLM: {self.model_id}"

    def execute(self, prompt, stream, response, conversation):
        """Execute the model with MLX-VLM."""
        # Check if there are attachments (images)
        attachments = []
        if conversation and conversation.responses:
            for resp in conversation.responses:
                if hasattr(resp, 'attachments'):
                    attachments.extend(resp.attachments)

        # Get attachments from current prompt if any
        if hasattr(prompt, 'attachments'):
            attachments.extend(prompt.attachments)

        # For now, use the first image attachment
        image_path = None
        if attachments:
            attachment = attachments[0]
            if hasattr(attachment, 'path'):
                image_path = attachment.path
            elif hasattr(attachment, 'url'):
                # TODO: Download URL to temp file
                raise NotImplementedError("URL attachments not yet supported")

        if not image_path:
            raise ValueError("MLX-VLM requires an image attachment. Use: llm -m SmolVLM-500M 'prompt' -a image.png")

        # Get prompt text
        prompt_text = prompt.prompt if hasattr(prompt, 'prompt') else str(prompt)

        # Build command for mlx_vlm
        cmd = [
            'python3',
            '-m', 'mlx_vlm.generate',
            '--model', self.hf_model_path,
            '--max-tokens', str(prompt.options.max_tokens),
            '--temp', str(prompt.options.temperature),
            '--image', str(image_path),
            '--prompt', prompt_text,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,  # Explicitly close stdin to avoid blocking
                timeout=60,  # 60 second timeout
                check=True,
            )

            output = result.stdout.strip()

            # MLX-VLM outputs the response directly
            yield output

        except subprocess.TimeoutExpired:
            raise RuntimeError(f"MLX-VLM timed out after 60 seconds")
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr if e.stderr else str(e)
            if "No module named 'mlx_vlm'" in error_msg:
                raise RuntimeError(
                    "mlx-vlm is not installed. Install it with: pip install mlx-vlm"
                )
            raise RuntimeError(f"MLX-VLM error: {error_msg}")
        except FileNotFoundError:
            raise RuntimeError(
                "python3 not found. Ensure Python 3.10+ is installed and in PATH."
            )
