#!/usr/bin/env python3
"""Fetch WeChat Official Account (gongzhonghao) article as Markdown. Standalone script using Playwright + BeautifulSoup."""

import sys
import json
import asyncio
import re
from urllib.parse import urlparse

_BLOCK_TAGS = frozenset({
    "p", "div", "section", "article", "figure", "figcaption",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "pre", "blockquote", "table",
})
_WEIXIN_BULLETS = re.compile(r'^[•◆·◦▪▸►\-\*]\s*')


def normalize_and_validate_url(raw_url: str) -> tuple[str | None, str | None]:
    """Normalize and validate WeChat article URL.
    Only allow https://mp.weixin.qq.com and handle missing scheme.
    Returns (normalized_url, error_message).
    """
    if not raw_url:
        return None, "Empty URL"

    candidate = raw_url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", candidate):
        candidate = "https://" + candidate

    parsed = urlparse(candidate)
    if parsed.scheme.lower() != "https":
        return None, "Only https scheme is allowed for WeChat articles"

    host = (parsed.hostname or "").lower()
    if host != "mp.weixin.qq.com":
        return None, "Only mp.weixin.qq.com is allowed for WeChat articles"

    # Rebuild normalized URL (preserve path/query/fragment)
    normalized = f"https://{host}{parsed.path or ''}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    if parsed.fragment:
        normalized += f"#{parsed.fragment}"
    return normalized, None


def extract_inline(el):
    """Extract inline content as a markdown string (no block structure)."""
    if not hasattr(el, "children"):
        return str(el)
    parts = []
    for child in el.children:
        name = getattr(child, "name", None)
        if name is None:
            t = str(child)
            if t:
                parts.append(t)
        elif name in ("script", "style"):
            pass
        elif name == "br":
            parts.append("\n")
        elif name == "img":
            src = child.get("data-src") or child.get("src") or ""
            # Skip data-URI placeholders (WeChat lazy-load SVG)
            if src and not src.startswith("data:"):
                alt = child.get("alt") or "image"
                parts.append(f"\n\n![{alt}]({src})\n\n")
        elif name == "a":
            href = child.get("href") or ""
            inner = extract_inline(child).strip()
            if href and not href.startswith("javascript:") and inner:
                parts.append(f"[{inner}]({href})")
            elif inner:
                parts.append(inner)
        elif name in ("strong", "b"):
            inner = extract_inline(child).strip()
            if inner:
                parts.append(f"**{inner}**")
        elif name in ("em", "i"):
            inner = extract_inline(child).strip()
            if inner:
                parts.append(f"*{inner}*")
        elif name == "code":
            inner = extract_inline(child).strip()
            if inner:
                parts.append(f"`{inner}`")
        else:
            parts.append(extract_inline(child))
    return "".join(parts)


def _extract_table(table_node, lines):
    rows = table_node.find_all("tr")
    for i, row in enumerate(rows):
        cells = [extract_inline(td).strip() for td in row.find_all(["td", "th"])]
        if not any(cells):
            continue
        lines.append("| " + " | ".join(cells) + " |")
        if i == 0:
            lines.append("| " + " | ".join("---" for _ in cells) + " |")


def _extract_list(list_node, lines, depth):
    indent = "  " * depth
    for child in list_node.children:
        name = getattr(child, "name", None)
        if name is None:
            continue
        if name == "li":
            all_children = list(child.children)
            nested = [c for c in all_children if getattr(c, "name", None) in ("ul", "ol")]
            inline_parts = [c for c in all_children if getattr(c, "name", None) not in ("ul", "ol")]
            raw = " ".join(extract_inline(p) for p in inline_parts).strip()
            item_text = _WEIXIN_BULLETS.sub("", raw)
            if item_text:
                lines.append(f"{indent}- {item_text}")
            for nl in nested:
                _extract_list(nl, lines, depth + 1)
        elif name in ("ul", "ol"):
            # WeChat non-standard: <ul> directly inside <ul> (not via <li>)
            _extract_list(child, lines, depth + 1)


def extract_block(node, lines):
    """Recursively walk block structure, appending markdown lines."""
    name = getattr(node, "name", None)
    if name is None:
        # Bare text node in mixed content — preserve if non-empty
        t = str(node).strip()
        if t:
            lines.append(t)
        return
    if name in ("script", "style"):
        return

    if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
        text = node.get_text(strip=True)
        if text:
            lines.append(f"{'#' * int(name[1])} {text}")
        return

    if name == "blockquote":
        sub_lines = []
        for child in node.children:
            extract_block(child, sub_lines)
        for sl in sub_lines:
            lines.append(f"> {sl}")
        return

    if name == "pre":
        # Fenced code block — handle <br> as newlines
        code_el = node.find("code") or node
        for br in code_el.find_all("br"):
            br.replace_with("\n")
        code_text = code_el.get_text()
        if code_text.strip():
            lines.append(f"```\n{code_text.rstrip()}\n```")
        return

    if name in ("ul", "ol"):
        _extract_list(node, lines, 0)
        return

    if name == "table":
        _extract_table(node, lines)
        return

    if name == "img":
        src = node.get("data-src") or node.get("src") or ""
        if src and not src.startswith("data:"):
            alt = node.get("alt") or "image"
            lines.append(f"![{alt}]({src})")
        return

    # p / figure / section / div / article / other containers:
    # If they have block-level children → recurse; otherwise treat as inline leaf.
    children = list(node.children)
    if any(getattr(c, "name", None) in _BLOCK_TAGS for c in children):
        for child in children:
            extract_block(child, lines)
    else:
        text = extract_inline(node).strip()
        if text:
            lines.append(text)


async def fetch_weixin_article(url: str) -> dict:
    """Fetch and parse a WeChat article, return dict with title, author, publish_time, content."""
    normalized_url, err = normalize_and_validate_url(url)
    if err:
        return {"error": err}

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "playwright not installed. Run: pip install playwright && playwright install chromium"}

    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return {"error": "beautifulsoup4 not installed. Run: pip install beautifulsoup4 lxml"}

    html = None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        try:
            await page.goto(normalized_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_selector("#js_content", timeout=15000)
            # Scroll to bottom to trigger WeChat lazy-load for all images
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1500)
            html = await page.content()
        except Exception as e:
            await browser.close()
            return {"error": f"Failed to load page: {e}"}
        await browser.close()

    if not html:
        return {"error": "No HTML content retrieved"}

    soup = BeautifulSoup(html, "lxml")

    # Extract title
    title_el = soup.select_one("#activity-name")
    title = title_el.get_text(strip=True) if title_el else ""

    # Extract author
    author_el = soup.select_one("#js_author_name") or soup.select_one(".rich_media_meta_text")
    author = author_el.get_text(strip=True) if author_el else ""

    # Extract publish time
    time_el = soup.select_one("#publish_time")
    publish_time = time_el.get_text(strip=True) if time_el else ""

    # Extract content
    content_el = soup.select_one("#js_content")
    if not content_el:
        return {"error": "Could not find article content (#js_content)"}

    # Remove scripts and styles
    for tag in content_el.find_all(["script", "style"]):
        tag.decompose()

    lines = []
    for child in content_el.children:
        extract_block(child, lines)

    content = "\n\n".join(lines)

    # If structured extraction got nothing, fall back to plain text
    if not content.strip():
        content = content_el.get_text("\n", strip=True)

    return {
        "title": title,
        "author": author,
        "publish_time": publish_time,
        "content": content,
        "url": normalized_url,
    }


def format_as_markdown(result: dict) -> str:
    """Format result dict as a Markdown document."""
    if "error" in result:
        return f"Error: {result['error']}"

    parts = ["---"]
    if result.get("title"):
        parts.append(f"title: \"{result['title']}\"")
    if result.get("author"):
        parts.append(f"author: \"{result['author']}\"")
    if result.get("publish_time"):
        parts.append(f"date: \"{result['publish_time']}\"")
    parts.append(f"url: \"{result['url']}\"")
    parts.append("---")
    parts.append("")
    if result.get("title"):
        parts.append(f"# {result['title']}")
        parts.append("")
    parts.append(result.get("content", ""))
    return "\n".join(parts)


if __name__ == "__main__":
    # Ensure UTF-8 output on Windows where the default code page may not be UTF-8
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: fetch_weixin.py <weixin_url> [--json]", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    use_json = "--json" in sys.argv

    result = asyncio.run(fetch_weixin_article(url))

    if use_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_as_markdown(result))
