#!/usr/bin/env python3
"""
AI Image Generation using Seedream 4.0 / 4.6 via Volcengine Visual API

Usage:
    python seedream_generate.py "a cute robot" -o robot.png
    python seedream_generate.py "landscape" -r 16:9 -o landscape.png
    python seedream_generate.py "forest" -r 9:16 -s 4K -o forest.png
    python seedream_generate.py "retouch portrait" -m 4.6 -i https://example.com/photo.jpg -o out.png

Environment:
    VOLC_ACCESSKEY  — Volcengine access key
    VOLC_SECRETKEY  — Volcengine secret key
    (or place them in a .env file next to this script)

    Get credentials: https://console.volcengine.com/iam/keymanage/
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests as _req
except ImportError:
    _req = None

try:
    from volcengine.visual.VisualService import VisualService
except ImportError:
    print("Error: volcengine SDK not installed.")
    print("Install with: pip install volcengine")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
#
# scale差异（官方文档）：
#   4.0: float 0.0~1.0，默认 0.5
#   4.6: int   1~100，  默认 50
# CLI 统一接收 0~1 float，内部按模型转换。

MODELS = {
    "4.0": {
        "req_key":      "jimeng_t2i_v40",
        "scale_to_api": lambda s: round(s, 2),           # float 0.0~1.0
    },
    "4.6": {
        "req_key":      "jimeng_seedream46_cvtob",
        "scale_to_api": lambda s: int(round(s * 100)),   # int 0~100 (API range 1~100)
    },
}

DEFAULT_MODEL = "4.0"
POLL_INTERVAL = 3    # seconds between status checks
MAX_WAIT      = 300  # timeout in seconds

# ---------------------------------------------------------------------------
# Size tables  — official recommended (width, height) from Volcengine docs
#
# Default (no --size):  2K official sizes  (API default area = 2048×2048)
# --size 4K:            4K official sizes  (area up to 4096×4096)
#
# Note: API recommends ≥2K; sub-2K output has degraded face/text quality.
# ---------------------------------------------------------------------------

VALID_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]

# 2K — official recommended
_SIZE_2K = {
    "1:1":  (2048, 2048),
    "4:3":  (2304, 1728),
    "3:4":  (1728, 2304),
    "3:2":  (2496, 1664),
    "2:3":  (1664, 2496),
    "16:9": (2560, 1440),
    "9:16": (1440, 2560),
    "21:9": (3024, 1296),
}

# 4K — official recommended
_SIZE_4K = {
    "1:1":  (4096, 4096),
    "4:3":  (4694, 3520),
    "3:4":  (3520, 4694),
    "3:2":  (4992, 3328),
    "2:3":  (3328, 4992),
    "16:9": (5404, 3040),
    "9:16": (3040, 5404),
    "21:9": (6198, 2656),
}

_SIZE_TABLES = {None: _SIZE_2K, "2K": _SIZE_2K, "4K": _SIZE_4K}


def ratio_to_dims(ratio, image_size):
    """Return (width, height), or (None, None) if ratio is None."""
    if ratio is None:
        return None, None
    return _SIZE_TABLES[image_size].get(ratio, (None, None))


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _load_dotenv():
    if os.environ.get("VOLC_ACCESSKEY") and os.environ.get("VOLC_SECRETKEY"):
        return
    for base in (Path(__file__).resolve().parent.parent, Path.cwd()):
        env_file = base / ".env"
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key   = key.strip()
            value = value.strip().strip("'\"").strip()
            if key and key not in os.environ:
                os.environ[key] = value
        break


def create_service():
    _load_dotenv()
    ak = os.environ.get("VOLC_ACCESSKEY")
    sk = os.environ.get("VOLC_SECRETKEY")
    if not ak or not sk:
        raise EnvironmentError(
            "VOLC_ACCESSKEY and VOLC_SECRETKEY are required.\n"
            "Set via environment variables or a .env file.\n"
            "Get credentials: https://console.volcengine.com/iam/keymanage/"
        )
    svc = VisualService()
    svc.set_ak(ak)
    svc.set_sk(sk)
    svc.set_scheme("https")
    return svc


# ---------------------------------------------------------------------------
# API calls
# ---------------------------------------------------------------------------

def _submit(svc, req_key, prompt, image_urls, width, height, api_scale, verbose):
    body = {
        "req_key":      req_key,
        "prompt":       prompt,
        "force_single": True,
    }
    if image_urls:
        body["image_urls"] = image_urls
    if width and height:
        body["width"]  = width
        body["height"] = height
    if api_scale is not None:
        body["scale"] = api_scale

    if verbose:
        print(f"Model:  {req_key}")
        print(f"Prompt: {prompt}")
        if width:
            print(f"Size:   {width}x{height}")
        print("Submitting task...")

    resp = svc.cv_sync2async_submit_task(body)
    if resp.get("code") != 10000:
        raise RuntimeError(
            f"Submit failed (code={resp.get('code')}): {resp.get('message')} "
            f"[request_id={resp.get('request_id')}]"
        )
    return resp["data"]["task_id"]


def _poll(svc, req_key, task_id, verbose):
    start = time.time()
    attempt = 0
    while True:
        elapsed = time.time() - start
        if elapsed > MAX_WAIT:
            raise TimeoutError(f"Task not completed after {MAX_WAIT}s")

        attempt += 1
        resp = svc.cv_sync2async_get_result({
            "req_key":  req_key,
            "task_id":  task_id,
            "req_json": json.dumps({"return_url": True}),
        })

        data   = resp.get("data") or {}
        status = data.get("status", "unknown")

        if status == "done":
            if verbose:
                print(f"\nDone (attempt #{attempt}, {elapsed:.1f}s)")
            return resp

        if status in ("not_found", "expired"):
            raise RuntimeError(f"Task {status}. ID={task_id}")

        if verbose:
            print(f"  [{elapsed:.0f}s] {status}", end="\r", flush=True)
        time.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Save helpers
# ---------------------------------------------------------------------------

def _download(url, path):
    if _req is None:
        raise ImportError("requests not installed. Run: pip install requests")
    r = _req.get(url, timeout=60)
    r.raise_for_status()
    Path(path).write_bytes(r.content)


def generate_output_path(output_dir=None):
    if output_dir is None:
        output_dir = os.environ.get("IMAGE_OUTPUT_DIR", "./generated-images")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    return str(Path(output_dir) / f"seedream_{ts}.png")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_image(
    prompt,
    output_path=None,
    input_url=None,
    aspect_ratio=None,
    image_size=None,
    scale=None,
    model=DEFAULT_MODEL,
    verbose=False,
):
    """
    Generate an image using Seedream via Volcengine Visual API.

    Args:
        prompt:       Text description for the image.
        output_path:  Where to save the generated image (.png).
        input_url:    URL of a reference image for image-to-image editing.
        aspect_ratio: One of VALID_ASPECT_RATIOS (e.g. "16:9").
        image_size:   "2K" or "4K"; None defaults to 2K official sizes.
        scale:        Text influence weight 0~1.
                      4.0: passed as float; 4.6: multiplied ×100 to int.
        model:        "4.0" or "4.6" (default "4.0").
        verbose:      Print progress to stdout.

    Returns:
        dict with 'success', 'path', 'metadata'
    """
    if model not in MODELS:
        return {"success": False, "error": f"Unknown model '{model}'. Choose: {list(MODELS)}", "path": None}

    if aspect_ratio and aspect_ratio not in VALID_ASPECT_RATIOS:
        return {
            "success": False,
            "error": f"Invalid aspect ratio '{aspect_ratio}'. Valid: {VALID_ASPECT_RATIOS}",
            "path": None,
        }

    if scale is not None and not (0.0 <= scale <= 1.0):
        return {"success": False, "error": f"--scale must be between 0 and 1, got {scale}", "path": None}

    if output_path is None:
        output_path = generate_output_path()
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    cfg     = MODELS[model]
    req_key = cfg["req_key"]
    width, height = ratio_to_dims(aspect_ratio, image_size)
    api_scale = cfg["scale_to_api"](scale) if scale is not None else None

    try:
        svc = create_service()
    except EnvironmentError as e:
        return {"success": False, "error": str(e), "path": None}

    try:
        task_id = _submit(
            svc, req_key, prompt,
            image_urls=[input_url] if input_url else None,
            width=width, height=height,
            api_scale=api_scale, verbose=verbose,
        )

        if verbose:
            print(f"Waiting (task_id={task_id})...")

        result = _poll(svc, req_key, task_id, verbose)

        data       = result.get("data", {})
        image_urls = data.get("image_urls") or []
        b64_list   = data.get("binary_data_base64") or []

        if image_urls:
            _download(image_urls[0], output_path)
        elif b64_list:
            Path(output_path).write_bytes(base64.b64decode(b64_list[0]))
        else:
            return {"success": False, "error": "No image data in response.", "path": None}

        if verbose:
            size_kb = Path(output_path).stat().st_size / 1024
            print(f"Saved:  {output_path} ({size_kb:.0f} KB)")

        return {
            "success": True,
            "path": output_path,
            "metadata": {
                "model":        req_key,
                "prompt":       prompt,
                "aspect_ratio": aspect_ratio,
                "image_size":   image_size or "2K",
                "width":        width,
                "height":       height,
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e), "path": None}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Seedream 4.0/4.6 (Volcengine Visual API)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Models (-m):
  4.0  →  jimeng_t2i_v40           (通用生成，文/图生图，最多10张输入)
  4.6  →  jimeng_seedream46_cvtob  (人像写真/平面设计/风格化，最多14张输入)

Examples:
  %(prog)s "a cute robot mascot" -o robot.png
  %(prog)s "cyberpunk city at night" -r 16:9 -o city.png
  %(prog)s "dreamy forest" -r 9:16 -s 4K -o forest.png
  %(prog)s "retouch portrait" -m 4.6 -i https://example.com/photo.jpg -o out.png
  %(prog)s "千军万马" -m 4.6 -r 16:9 -o battle.png
        """,
    )

    parser.add_argument("prompt", help="Text prompt for image generation")
    parser.add_argument("-o", "--output", help="Output file path (.png)")
    parser.add_argument("-i", "--input", metavar="URL",
                        help="Reference image URL for image-to-image editing")
    parser.add_argument(
        "-r", "--ratio",
        choices=VALID_ASPECT_RATIOS,
        metavar="RATIO",
        help=f"Aspect ratio. Choices: {', '.join(VALID_ASPECT_RATIOS)}",
    )
    parser.add_argument(
        "-s", "--size",
        choices=["2K", "4K", "2k", "4k"],
        help="Resolution tier (default: 2K official sizes)",
    )
    parser.add_argument(
        "-m", "--model",
        choices=list(MODELS),
        default=DEFAULT_MODEL,
        help=f"Model version: 4.0 or 4.6 (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--scale", type=float, metavar="0~1",
        help="Text influence weight 0~1 (4.0 default 0.5 / 4.6 default 0.5→50)",
    )
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Show detailed output")

    args = parser.parse_args()

    result = generate_image(
        prompt=args.prompt,
        output_path=args.output,
        input_url=args.input,
        aspect_ratio=args.ratio,
        image_size=args.size.upper() if args.size else None,
        scale=args.scale,
        model=args.model,
        verbose=args.verbose or (args.output is None),
    )

    if result["success"]:
        print(result["path"])
        sys.exit(0)
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
