#!/usr/bin/env python3
"""
AI Image Generation using Google Gemini 3 Pro Image

Usage:
    python generate.py "a cute robot" -o robot.png
    python generate.py "make it blue" -i input.jpg -o output.png
    python generate.py "landscape" --ratio 16:9 --size 4K -o landscape.png
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai package not installed.")
    print("Install with: pip install google-genai")
    sys.exit(1)

MODEL_NAME = "gemini-3.1-flash-image-preview"

VALID_ASPECT_RATIOS = [
    "1:1", "2:3", "3:2", "3:4", "4:3",
    "4:5", "5:4", "9:16", "16:9", "21:9"
]

VALID_SIZES = ["2K", "4K"]


def _load_dotenv() -> None:
    """Load GEMINI_API_KEY from a .env file if not already in the environment."""
    if os.environ.get("GEMINI_API_KEY"):
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
            key = key.strip()
            value = value.strip().strip("'\"").strip()
            if key and key not in os.environ:
                os.environ[key] = value
        break


def get_api_key() -> str:
    _load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY environment variable not set.\n"
            "Get your API key from: https://aistudio.google.com/apikey"
        )
    return api_key


def load_image_bytes(path: str) -> tuple[bytes, str]:
    """Load image file and return raw bytes and mime type."""
    p = Path(path)
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    mime_type = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        return f.read(), mime_type


def generate_output_path(output_dir: str = None) -> str:
    if output_dir is None:
        output_dir = os.environ.get("IMAGE_OUTPUT_DIR", "./generated-images")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return str(Path(output_dir) / f"image_{timestamp}.png")


def generate_image(
    prompt: str,
    output_path: str = None,
    input_path: str = None,
    aspect_ratio: str = None,
    image_size: str = None,
    use_search: bool = False,
    verbose: bool = False,
) -> dict:
    """
    Generate or edit an image using Gemini API.

    Args:
        prompt: Text description or editing instruction
        output_path: Where to save the generated image
        input_path: Input image for editing (optional)
        aspect_ratio: Aspect ratio (1:1, 16:9, etc.)
        image_size: Resolution (2K or 4K)
        use_search: Enable Google Search grounding
        verbose: Print detailed output

    Returns:
        dict with 'success', 'path', 'metadata'
    """
    try:
        api_key = get_api_key()
    except EnvironmentError as e:
        return {"success": False, "error": str(e), "path": None}

    client = genai.Client(api_key=api_key)

    if output_path is None:
        output_path = generate_output_path()

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    contents = []

    if input_path:
        input_bytes, input_mime = load_image_bytes(input_path)
        contents.append(types.Part.from_bytes(data=input_bytes, mime_type=input_mime))
        if verbose:
            print(f"Input image: {input_path}")

    contents.append(prompt)

    image_config_kwargs = {}
    if aspect_ratio:
        if aspect_ratio not in VALID_ASPECT_RATIOS:
            print(f"Warning: Invalid aspect ratio '{aspect_ratio}'. Valid options: {VALID_ASPECT_RATIOS}")
        else:
            image_config_kwargs["aspect_ratio"] = aspect_ratio
    if image_size:
        if image_size.upper() not in VALID_SIZES:
            print(f"Warning: Invalid size '{image_size}'. Valid options: {VALID_SIZES}")
        else:
            image_config_kwargs["image_size"] = image_size.upper()

    config_kwargs = {"response_modalities": ["IMAGE", "TEXT"]}
    if image_config_kwargs:
        config_kwargs["image_config"] = types.ImageConfig(**image_config_kwargs)
    generate_config = types.GenerateContentConfig(**config_kwargs)

    if verbose:
        print(f"Model: {MODEL_NAME}")
        print(f"Prompt: {prompt}")
        if aspect_ratio:
            print(f"Aspect ratio: {aspect_ratio}")
        if image_size:
            print(f"Size: {image_size}")
        print("Generating...")

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=generate_config,
        )

        output_image_bytes = None
        text_response = None

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                output_image_bytes = part.inline_data.data
            elif part.text:
                text_response = part.text

        if not output_image_bytes:
            return {
                "success": False,
                "error": text_response or "No image generated",
                "path": None,
            }

        with open(output_path, "wb") as f:
            f.write(output_image_bytes)

        if verbose:
            print(f"Saved: {output_path}")
            if text_response:
                print(f"Model response: {text_response}")

        return {
            "success": True,
            "path": output_path,
            "metadata": {
                "model": MODEL_NAME,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "image_size": image_size,
                "input_image": input_path,
                "timestamp": datetime.now().isoformat(),
            }
        }

    except Exception as e:
        error_msg = str(e)
        if "safety" in error_msg.lower():
            error_msg = "Content blocked by safety filters. Try rephrasing your prompt."
        elif "quota" in error_msg.lower() or "rate" in error_msg.lower():
            error_msg = "Rate limit exceeded. Wait a moment and try again."

        return {"success": False, "error": error_msg, "path": None}


def edit_image(
    prompt: str,
    input_path: str,
    output_path: str = None,
    verbose: bool = False,
) -> dict:
    """Convenience function for image editing."""
    return generate_image(
        prompt=prompt,
        output_path=output_path,
        input_path=input_path,
        verbose=verbose,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Google Gemini 3 Pro Image",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "a cute robot mascot" -o robot.png
  %(prog)s "make the sky purple" -i photo.jpg -o edited.png
  %(prog)s "cinematic landscape" --ratio 21:9 --size 4K -o landscape.png
        """
    )

    parser.add_argument("prompt", help="Text prompt for image generation")
    parser.add_argument("-o", "--output", help="Output file path")
    parser.add_argument("-i", "--input", help="Input image for editing")
    parser.add_argument("-r", "--ratio", choices=VALID_ASPECT_RATIOS,
                        help="Aspect ratio (default: 1:1)")
    parser.add_argument("-s", "--size", choices=["2K", "4K", "2k", "4k"],
                        help="Image size (2K or 4K)")
    parser.add_argument("--search", action="store_true",
                        help="Enable Google Search grounding")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Show detailed output")

    args = parser.parse_args()

    result = generate_image(
        prompt=args.prompt,
        output_path=args.output,
        input_path=args.input,
        aspect_ratio=args.ratio,
        image_size=args.size.upper() if args.size else None,
        use_search=args.search,
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
