#!/usr/bin/env python3
"""Serve the static site with COOP/COEP headers for WASM threading."""

from __future__ import annotations

import argparse
import http.server
import os
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlparse


class StaticHandler(http.server.SimpleHTTPRequestHandler):
    add_headers: ClassVar[dict[str, str]] = {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Access-Control-Allow-Origin": "*",
    }
    index_path: ClassVar[Path]

    def end_headers(self):
        path = urlparse(self.path).path
        if path.endswith((".html", ".js", ".mjs", ".css", ".onnx", ".json")) or path in ("/", ""):
            self.send_header("Cache-Control", "no-store")
        for k, v in self.add_headers.items():
            self.send_header(k, v)
        super().end_headers()

    def do_GET(self):  # noqa: N802 - upstream naming
        # Map "/" to the configured index (defaults to public/index.html)
        if self.path in ("/", ""):
            return self._serve_index()
        return super().do_GET()

    def _serve_index(self):
        try:
            with open(self.index_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404, "Index file not found")


def main():
    parser = argparse.ArgumentParser(description="Serve static files with COOP/COEP headers.")
    parser.add_argument("--port", type=int, default=8000)
    repo_root = Path(__file__).resolve().parent.parent
    parser.add_argument(
        "--root",
        type=Path,
        default=repo_root / "public",
        help="Root directory to serve. Defaults to ./public.",
    )
    parser.add_argument(
        "--index",
        type=Path,
        default=repo_root / "public" / "index.html",
        help="Index file served at '/'. Defaults to ./public/index.html.",
    )
    args = parser.parse_args()

    # Configure handler
    StaticHandler.index_path = args.index
    os.chdir(args.root)

    with http.server.ThreadingHTTPServer(("", args.port), StaticHandler) as httpd:
        print(f"Serving {args.root} at http://localhost:{args.port}/ (index -> {args.index})")
        print("Headers: COOP/COEP set for WASM multithreading.")
        httpd.serve_forever()


if __name__ == "__main__":
    raise SystemExit(main())
