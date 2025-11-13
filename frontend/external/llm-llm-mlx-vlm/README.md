# llm-llm-mlx-vlm

[![PyPI](https://img.shields.io/pypi/v/llm-llm-mlx-vlm.svg)](https://pypi.org/project/llm-llm-mlx-vlm/)
[![Changelog](https://img.shields.io/github/v/release/Python-AI-Solutions/llm-llm-mlx-vlm?include_prereleases&label=changelog)](https://github.com/Python-AI-Solutions/llm-llm-mlx-vlm/releases)
[![Tests](https://github.com/Python-AI-Solutions/llm-llm-mlx-vlm/actions/workflows/test.yml/badge.svg)](https://github.com/Python-AI-Solutions/llm-llm-mlx-vlm/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/Python-AI-Solutions/llm-llm-mlx-vlm/blob/main/LICENSE)

LLM plugin for running vision language models using MLX on Apple Silicon

## Installation

Install this plugin in the same environment as [LLM](https://llm.datasette.io/).
```bash
llm install llm-llm-mlx-vlm
```
## Usage

Usage instructions go here.

## Development

To set up this plugin locally, first checkout the code. Then create a new virtual environment:
```bash
cd llm-llm-mlx-vlm
python -m venv venv
source venv/bin/activate
```
Now install the dependencies and test dependencies:
```bash
python -m pip install -e '.[test]'
```
To run the tests:
```bash
python -m pytest
```
