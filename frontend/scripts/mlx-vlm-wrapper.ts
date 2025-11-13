#!/usr/bin/env node
/**
 * MLX-VLM Wrapper Script
 * 
 * This script wraps mlx-vlm calls to match the Ollama/llm CLI interface
 * for use with the VLM audit script.
 * 
 * Usage:
 *   node mlx-vlm-wrapper.ts --model SmolVLM-500M --image <path> --prompt "<prompt>"
 */

import { execa } from 'execa';
import path from 'path';

const args = process.argv.slice(2);
let model = 'HuggingfaceTB/SmolVLM-500M-Instruct';
let imagePath: string | null = null;
let prompt: string | null = null;

// Parse arguments (simple parser, matches llm CLI style)
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-m' || arg === '--model') {
    model = args[i + 1];
    i++;
  } else if (arg === '-a' || arg === '--attach' || arg === '--image') {
    imagePath = args[i + 1];
    i++;
  } else if (!arg.startsWith('-')) {
    // Assume it's the prompt
    prompt = arg;
  }
}

if (!imagePath || !prompt) {
  console.error('Usage: mlx-vlm-wrapper.ts -m <model> -a <image> <prompt>');
  console.error('Example: mlx-vlm-wrapper.ts -m SmolVLM-500M -a image.png "What do you see?"');
  process.exit(1);
}

async function main() {
  try {
    // Map model names to HuggingFace paths
    const modelMap: Record<string, string> = {
      'SmolVLM-256M': 'HuggingfaceTB/SmolVLM-256M-Instruct',
      'SmolVLM-500M': 'HuggingfaceTB/SmolVLM-500M-Instruct',
      'SmolVLM-500M-Instruct': 'HuggingfaceTB/SmolVLM-500M-Instruct',
      'SmolVLM-256M-Instruct': 'HuggingfaceTB/SmolVLM-256M-Instruct',
    };
    
    const hfModel = modelMap[model] || model;
    
    // Call mlx-vlm
    const { stdout } = await execa('python3', [
      '-m',
      'mlx_vlm.generate',
      '--model',
      hfModel,
      '--max-tokens',
      '400',
      '--temp',
      '0.0',
      '--image',
      path.resolve(imagePath),
      '--prompt',
      prompt,
    ], {
      timeout: 60000, // 60 second timeout
    });
    
    // Output the result (mlx-vlm outputs directly)
    console.log(stdout.trim());
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMsg}`);
    process.exit(1);
  }
}

void main();

