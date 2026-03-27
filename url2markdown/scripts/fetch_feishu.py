#!/usr/bin/env python3
"""Fetch Feishu/Lark document as Markdown. Standalone script using Feishu Open API."""

import sys
import json
import os
import re
import urllib.parse
import requests

FEISHU_API_BASE = "https://open.feishu.cn/open-apis"

_LIST_BLOCK_TYPES = frozenset({10, 11, 15})  # BulletList, OrderedList, Todo

_LANG_MAP = {
    1: "", 2: "abap", 3: "ada", 4: "apache", 5: "apex",
    6: "assembly", 7: "bash", 8: "c", 9: "csharp", 10: "cpp",
    11: "clojure", 12: "cmake", 13: "coffeescript", 14: "css",
    15: "d", 16: "dart", 17: "delphi", 18: "django", 19: "dockerfile",
    20: "elixir", 21: "elm", 22: "erlang", 23: "fortran",
    24: "fsharp", 25: "go", 26: "graphql", 27: "groovy", 28: "haskell",
    29: "html", 30: "http", 31: "java", 32: "javascript",
    33: "json", 34: "julia", 35: "kotlin", 36: "latex", 37: "lisp",
    38: "lua", 39: "makefile", 40: "markdown", 41: "matlab",
    42: "nginx", 43: "objectivec", 44: "ocaml", 45: "perl",
    46: "php", 47: "powershell", 48: "properties", 49: "protobuf",
    50: "python", 51: "r", 52: "ruby", 53: "rust", 54: "scala",
    55: "scheme", 56: "scss", 57: "shell", 58: "sql", 59: "swift",
    60: "thrift", 61: "toml", 62: "typescript", 63: "vbnet",
    64: "verilog", 65: "vhdl", 66: "visual_basic", 67: "vue",
    68: "xml", 69: "yaml",
}


def get_tenant_access_token():
    """Obtain tenant_access_token via Feishu internal app credentials."""
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        return None, "Environment variables FEISHU_APP_ID or FEISHU_APP_SECRET are not set"

    url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
    try:
        resp = requests.post(url, json={"app_id": app_id, "app_secret": app_secret}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        return None, f"Failed to request token: {e}"
    if data.get("code") != 0:
        return None, f"Failed to obtain token: {data.get('msg', '')}"
    return data["tenant_access_token"], None


def parse_feishu_url(url):
    """Parse document_id and doc type from a Feishu/Lark URL."""
    patterns = [
        (r"feishu\.cn/docx/([A-Za-z0-9]+)", "docx"),
        (r"feishu\.cn/docs/([A-Za-z0-9]+)", "doc"),
        (r"feishu\.cn/wiki/([A-Za-z0-9]+)", "wiki"),
        (r"larksuite\.com/docx/([A-Za-z0-9]+)", "docx"),
        (r"larksuite\.com/docs/([A-Za-z0-9]+)", "doc"),
        (r"larksuite\.com/wiki/([A-Za-z0-9]+)", "wiki"),
    ]
    for pattern, doc_type in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1), doc_type
    return None, None


def get_document_info(token, doc_id):
    """Fetch document metadata (title, etc.)."""
    url = f"{FEISHU_API_BASE}/docx/v1/documents/{doc_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError):
        return {}
    if data.get("code") == 0:
        return data.get("data", {}).get("document", {})
    return {}


def get_document_blocks(token, doc_id):
    """Fetch all blocks from a document, handling pagination."""
    url = f"{FEISHU_API_BASE}/docx/v1/documents/{doc_id}/blocks"
    headers = {"Authorization": f"Bearer {token}"}
    all_blocks = []
    page_token = None

    while True:
        params = {"page_size": 500}
        if page_token:
            params["page_token"] = page_token
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as e:
            return None, f"Failed to fetch blocks: {e}"
        if data.get("code") != 0:
            return None, f"Failed to fetch blocks: {data.get('msg', '')}"

        items = data.get("data", {}).get("items", [])
        all_blocks.extend(items)

        if not data.get("data", {}).get("has_more", False):
            break
        page_token = data["data"].get("page_token")

    return all_blocks, None


def get_wiki_node(token, wiki_token):
    """Fetch wiki node info and return the underlying obj_token and obj_type."""
    url = f"{FEISHU_API_BASE}/wiki/v2/spaces/get_node"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, params={"token": wiki_token}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError):
        return None, None
    if data.get("code") == 0:
        node = data.get("data", {}).get("node", {})
        return node.get("obj_token"), node.get("obj_type")
    return None, None


def extract_text_from_elements(elements):
    """Extract formatted text from text_run, mention_user, equation, etc. elements."""
    if not elements:
        return ""
    parts = []
    for el in elements:
        if "text_run" in el:
            tr = el["text_run"]
            text = tr.get("content", "")
            style = tr.get("text_element_style", {})
            if style.get("inline_code"):
                text = f"`{text}`"
            else:
                if style.get("bold") and style.get("italic"):
                    text = f"***{text}***"
                elif style.get("bold"):
                    text = f"**{text}**"
                elif style.get("italic"):
                    text = f"*{text}*"
                if style.get("strikethrough"):
                    text = f"~~{text}~~"
            if style.get("link", {}).get("url"):
                link_url = urllib.parse.unquote(style["link"]["url"])
                text = f"[{text}]({link_url})"
            parts.append(text)
        elif "mention_user" in el:
            parts.append(f"@{el['mention_user'].get('user_id', 'user')}")
        elif "mention_doc" in el:
            doc_ref = el["mention_doc"]
            title = doc_ref.get("title", "document")
            url = doc_ref.get("url", "")
            if not url:
                tok = doc_ref.get("token", "")
                obj_type = doc_ref.get("obj_type", "docx")
                if tok:
                    url = f"https://feishu.cn/{obj_type}/{tok}"
            parts.append(f"[{title}]({url})" if url else title)
        elif "equation" in el:
            parts.append(f"${el['equation'].get('content', '')}$")
        elif "file" in el:
            f_el = el["file"]
            name = f_el.get("name", "attachment")
            token_val = f_el.get("token", "")
            parts.append(f"[{name}](feishu-file://{token_val})")
    return "".join(parts)


def _render_table(table_block, children_map):
    """Render a Feishu table as a Markdown table; returns list of (text, block_type)."""
    table_data = table_block.get("table", {})
    num_cols = table_data.get("property", {}).get("column_size", 0)
    if not num_cols:
        return []
    table_id = table_block.get("block_id", "")

    rows = []
    current_row = []
    for cell_block in children_map.get(table_id, []):
        if cell_block.get("block_type") != 18:
            continue
        cell_id = cell_block.get("block_id", "")
        cell_parts = []
        for child in children_map.get(cell_id, []):
            for t, _ in _render_block(child, children_map):
                flat = t.strip()
                if flat:
                    cell_parts.append(flat)
        current_row.append(" / ".join(cell_parts))
        if len(current_row) == num_cols:
            rows.append(current_row)
            current_row = []
    if current_row:
        rows.append(current_row)
    if not rows:
        return []

    ncols = max(len(r) for r in rows)
    header = rows[0] + [""] * (ncols - len(rows[0]))
    md = ["| " + " | ".join(header) + " |",
          "| " + " | ".join("---" for _ in range(ncols)) + " |"]
    for row in rows[1:]:
        padded = row + [""] * (ncols - len(row))
        md.append("| " + " | ".join(padded) + " |")
    return [("\n".join(md), 19)]


def _render_children(parent_id, children_map, quote_prefix=""):
    """Render all direct children of parent_id; returns list of (text, block_type)."""
    items = []
    ol_counter = 0
    for child in children_map.get(parent_id, []):
        child_type = child.get("block_type")
        if child_type != 11:
            ol_counter = 0
        else:
            ol_counter += 1
        items.extend(_render_block(child, children_map, quote_prefix, ol_counter))
    return items


def _render_block(block, children_map, quote_prefix="", ol_counter=0):
    """Render one block; returns list of (text, block_type) tuples."""
    bt = block.get("block_type")
    bid = block.get("block_id", "")

    # 1 = Page (root), 18 = TableCell (handled by Table), skip both
    if bt in (1, 18):
        return []

    if bt == 2:  # Text
        text = extract_text_from_elements(block.get("text", {}).get("elements", []))
        if not text.strip():
            return []  # blank line: skip to avoid excess blank lines in output
        return [(quote_prefix + text, bt)]

    if bt in (3, 4, 5, 6, 7, 8, 9):  # Heading 1-7 (capped at H6)
        actual_level = bt - 2
        level = min(actual_level, 6)
        heading_data = {}
        for key in [f"heading{actual_level}", f"heading{level}", "heading"]:
            if key in block:
                heading_data = block[key]
                break
        text = extract_text_from_elements(heading_data.get("elements", []))
        return [(f"{quote_prefix}{'#' * level} {text}", bt)]

    if bt == 10:  # Bullet list
        text = extract_text_from_elements(block.get("bullet", {}).get("elements", []))
        sub = _render_children(bid, children_map, quote_prefix + "  ")
        lines = [f"{quote_prefix}- {text}"] + [t for t, _ in sub]
        return [("\n".join(lines), bt)]

    if bt == 11:  # Ordered list
        text = extract_text_from_elements(block.get("ordered", {}).get("elements", []))
        sub = _render_children(bid, children_map, quote_prefix + "   ")
        lines = [f"{quote_prefix}{ol_counter}. {text}"] + [t for t, _ in sub]
        return [("\n".join(lines), bt)]

    if bt == 12:  # Code block
        code_data = block.get("code", {})
        text = extract_text_from_elements(code_data.get("elements", []))
        lang = code_data.get("style", {}).get("language", "")
        lang_str = _LANG_MAP.get(lang, "") if isinstance(lang, int) else str(lang)
        return [(f"```{lang_str}\n{text}\n```", bt)]

    if bt == 13:  # Quote
        text = extract_text_from_elements(block.get("quote", {}).get("elements", []))
        child_items = _render_children(bid, children_map, quote_prefix + "> ")
        lines = ([f"{quote_prefix}> {text}"] if text.strip() else []) + [t for t, _ in child_items]
        return [("\n".join(lines), bt)] if lines else []

    if bt == 14:  # Equation block
        text = extract_text_from_elements(block.get("equation", {}).get("elements", []))
        return [(f"$$\n{text}\n$$", bt)]

    if bt == 15:  # Todo
        todo_data = block.get("todo", {})
        text = extract_text_from_elements(todo_data.get("elements", []))
        checkbox = "[x]" if todo_data.get("style", {}).get("done") else "[ ]"
        return [(f"{quote_prefix}- {checkbox} {text}", bt)]

    if bt == 16:  # Divider
        return [("---", bt)]

    if bt == 17:  # Image
        token_val = block.get("image", {}).get("token", "")
        return [(f"![image](feishu-image://{token_val})", bt)]

    if bt == 19:  # Table
        return _render_table(block, children_map)

    if bt == 22:  # Callout — render children with blockquote prefix
        emoji = block.get("callout", {}).get("emoji_id", "")
        child_items = _render_children(bid, children_map, "> ")
        child_lines = []
        for i, (t, _) in enumerate(child_items):
            if i > 0:
                child_lines.append("> ")  # blank blockquote line between paragraphs
            child_lines.append(t)
        lines = ([f"> {emoji}"] if emoji else []) + child_lines
        return [("\n".join(lines), bt)] if lines else []

    if bt in (27, 28):  # Grid / GridColumn — transparent containers
        return _render_children(bid, children_map, quote_prefix)

    # Unknown: try to extract any text from dict fields with "elements"
    for val in block.values():
        if isinstance(val, dict) and "elements" in val:
            text = extract_text_from_elements(val["elements"])
            if text.strip():
                return [(text, bt)]
    return []


def blocks_to_markdown(blocks):
    """Convert Feishu blocks to Markdown text."""
    if not blocks:
        return ""

    # Build children map: parent_id -> [child blocks in document order]
    children_map = {}
    root_id = None
    for b in blocks:
        pid = b.get("parent_id", "")
        children_map.setdefault(pid, []).append(b)
        if b.get("block_type") == 1 and root_id is None:
            root_id = b.get("block_id", "")

    if root_id is None:
        return ""

    items = _render_children(root_id, children_map)
    if not items:
        return ""

    # Join: consecutive list blocks use single newline (tight list), others use double
    parts = [items[0][0]]
    for i in range(1, len(items)):
        prev_type, curr_type = items[i - 1][1], items[i][1]
        sep = "\n" if (prev_type in _LIST_BLOCK_TYPES and curr_type in _LIST_BLOCK_TYPES) else "\n\n"
        parts.append(sep + items[i][0])
    return "".join(parts)


def fetch_feishu_doc(url_or_id):
    """Main entry: fetch a Feishu document and convert it to Markdown."""
    # Parse URL to extract doc_id and type
    doc_id, doc_type = parse_feishu_url(url_or_id)
    if not doc_id:
        # Assume a raw doc_token was passed directly
        doc_id = url_or_id
        doc_type = "docx"

    # Obtain API token
    token, err = get_tenant_access_token()
    if err:
        return {"error": err}

    # Wiki pages require resolving the actual document token first
    if doc_type == "wiki":
        real_id, real_type = get_wiki_node(token, doc_id)
        if real_id:
            doc_id = real_id
            doc_type = real_type or "docx"
        else:
            return {"error": f"Failed to resolve wiki node: {doc_id}"}

    # Fetch document metadata
    doc_info = get_document_info(token, doc_id)
    title = doc_info.get("title", "")

    # Fetch all blocks
    blocks, err = get_document_blocks(token, doc_id)
    if err:
        return {"error": err}

    # Convert blocks to Markdown
    content = blocks_to_markdown(blocks)

    return {
        "title": title,
        "document_id": doc_id,
        "url": url_or_id,
        "content": content,
    }


def format_as_markdown(result):
    """Format the result dict as a Markdown document with YAML frontmatter."""
    if "error" in result:
        return f"Error: {result['error']}"

    parts = ["---"]
    if result.get("title"):
        parts.append(f'title: "{result["title"]}"')
    parts.append(f'document_id: "{result["document_id"]}"')
    if result.get("url"):
        parts.append(f'url: "{result["url"]}"')
    parts.append("---")
    parts.append("")
    if result.get("title"):
        parts.append(f"# {result['title']}")
        parts.append("")
    parts.append(result.get("content", ""))
    return "\n".join(parts)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: fetch_feishu.py <feishu_url_or_doc_token> [--json]", file=sys.stderr)
        print("  Requires env vars: FEISHU_APP_ID, FEISHU_APP_SECRET", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    use_json = "--json" in sys.argv

    result = fetch_feishu_doc(url)

    if use_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_as_markdown(result))
