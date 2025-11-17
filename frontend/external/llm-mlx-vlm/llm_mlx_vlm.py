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
import os
import subprocess
from typing import Optional

import llm


@llm.hookimpl
def register_models(register):
    """Register MLX-VLM models with the LLM CLI."""
    
    # ✅ RECOMMENDED: Tested and working models
    
    # pixtral-12b-4bit - Best overall choice
    # - Memory: 9.2 GB peak
    # - Speed: 107 tokens/sec (prompt), 15 tokens/sec (generation)
    # - Quality: Excellent vision understanding
    # - Note: Uses slow image processor (warning only, works fine)
    register(MlxVlmModel("pixtral-12b-4bit", "mlx-community/pixtral-12b-4bit"))
    
    # paligemma2-3b-mix-448-4bit - Google's vision model
    # - Memory: Low (estimated 3-4 GB)
    # - Speed: Fast
    # - Quality: Good for general vision tasks
    register(MlxVlmModel("paligemma2-3b", "mlx-community/paligemma2-3b-mix-448-4bit"))
    
    # InternVL3-1B-4bit - Smallest option (new in mlx-vlm v0.3.6)
    # - Memory: 2.3 GB peak (very light!)
    # - Speed: 728 tokens/sec (prompt), 214 tokens/sec (generation)
    # - Quality: Poor - refuses to answer many queries, has safety filters
    # - Use case: Memory-constrained environments only
    register(MlxVlmModel("InternVL3-1B-4bit", "mlx-community/InternVL3-1B-4bit"))
    
    # ⚠️ LEGACY: Older models (may not work on all systems)
    
    # SmolVLM models - Small
    register(MlxVlmModel("SmolVLM-256M", "HuggingfaceTB/SmolVLM-256M-Instruct"))
    register(MlxVlmModel("SmolVLM-500M", "HuggingfaceTB/SmolVLM-500M-Instruct"))
    
    # Qwen models - Good quality but high memory requirements
    # Note: Qwen2-VL-2B-Instruct-4bit hits Metal buffer limits (25GB allocation)
    register(MlxVlmModel("Qwen2-VL-2B", "Qwen/Qwen2-VL-2B-Instruct"))
    register(MlxVlmModel("Qwen3-VL-4B-Instruct-4bit", "mlx-community/Qwen3-VL-4B-Instruct-4bit"))
    register(MlxVlmModel("Qwen2.5-VL-3B", "mlx-community/Qwen2.5-VL-3B-Instruct-8bit"))
    


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
            '-m', 'mlx_vlm',
            'generate',
            '--model', self.hf_model_path,
            '--max-tokens', str(prompt.options.max_tokens),
            '--temperature', str(prompt.options.temperature),
            '--image', str(image_path),
            '--prompt', prompt_text,
        ]
        timeout_seconds = int(os.environ.get("MLX_VLM_TIMEOUT", "240"))

        # Set up environment with HuggingFace cache for model reuse
        env = os.environ.copy()
        hf_home = os.path.expanduser('~/.cache/huggingface')
        env['HF_HOME'] = env.get('HF_HOME', hf_home)
        # Also set HF_HUB_CACHE - this is where models are actually cached
        env['HF_HUB_CACHE'] = env.get('HF_HUB_CACHE', os.path.join(env['HF_HOME'], 'hub'))
        # Set offline mode to False to allow downloads but use cache when available
        env['HF_HUB_OFFLINE'] = env.get('HF_HUB_OFFLINE', '0')
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,  # Explicitly close stdin to avoid blocking
                timeout=timeout_seconds,
                check=True,
                env=env,
            )

            output = result.stdout.strip()

            # MLX-VLM outputs the response directly
            yield output

        except subprocess.TimeoutExpired:
            raise RuntimeError(f"MLX-VLM timed out after {timeout_seconds} seconds")
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
