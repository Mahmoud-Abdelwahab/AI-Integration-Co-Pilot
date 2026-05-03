"""
Tests for markdown ingestion and chunking logic.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))

from app.utils.text_utils import strip_mdx, detect_platform, count_tokens
from app.rag.ingestor import RawDocument
from app.rag.chunker import chunk_document, _split_by_headings


# ── strip_mdx tests ──────────────────────────────────────────────────────────

def test_strip_mdx_removes_imports():
    text = "import React from 'react'\nimport { Foo } from './foo'\n# Hello\nContent"
    result = strip_mdx(text)
    assert "import" not in result
    assert "# Hello" in result
    assert "Content" in result


def test_strip_mdx_removes_jsx_components():
    text = "# Title\n<MyComponent prop='val' />\nSome text\n<Block>inner</Block>"
    result = strip_mdx(text)
    assert "MyComponent" not in result
    assert "Block" not in result
    assert "# Title" in result
    assert "Some text" in result


def test_strip_mdx_removes_frontmatter():
    text = "---\ntitle: Test\nplatform: ios\n---\n# Content\nBody text"
    result = strip_mdx(text)
    assert "title:" not in result
    assert "# Content" in result


def test_strip_mdx_preserves_code_blocks():
    text = "# Setup\n```swift\nlet payment = Payment()\n```\nDone."
    result = strip_mdx(text)
    assert "```swift" in result
    assert "let payment" in result


# ── detect_platform tests ────────────────────────────────────────────────────

def test_detect_platform_ios():
    assert detect_platform("/docs/ios-docs/apple-pay.mdx") == "ios"


def test_detect_platform_flutter():
    assert detect_platform("/docs/flutter/integration.md") == "flutter"


def test_detect_platform_general():
    assert detect_platform("/docs/getting-started.md") == "general"


# ── chunker tests ────────────────────────────────────────────────────────────

SAMPLE_MD = """# Apple Pay Integration

To integrate Apple Pay, configure the payment request.

## Prerequisites

You need an Apple Developer account.

## Setup

Add the framework to your project.

```swift
import MoyasarSDK
```

## Callback Handling

Handle the payment result in the delegate method.
"""


def test_split_by_headings():
    parts = _split_by_headings(SAMPLE_MD)
    headings = [h for h, _ in parts]
    assert "Apple Pay Integration" in headings
    assert "Prerequisites" in headings
    assert "Setup" in headings
    assert "Callback Handling" in headings


def test_chunk_document_creates_chunks():
    doc = RawDocument(
        file_path="/docs/ios-docs/apple-pay.mdx",
        content=SAMPLE_MD * 3,  # repeat to get enough tokens
        platform="ios",
        filename="apple-pay.mdx",
    )
    chunks = chunk_document(doc, doc_index=0)
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk.file_path == "/docs/ios-docs/apple-pay.mdx"
        assert chunk.platform == "ios"
        assert chunk.content.strip()


def test_chunk_metadata_fields():
    doc = RawDocument(
        file_path="/docs/ios-docs/stc-pay.md",
        content=SAMPLE_MD,
        platform="ios",
        filename="stc-pay.md",
    )
    chunks = chunk_document(doc, doc_index=0)
    for chunk in chunks:
        assert "file_path" in chunk.metadata
        assert "platform" in chunk.metadata
        assert "heading" in chunk.metadata
        assert "section" in chunk.metadata


if __name__ == "__main__":
    # Run tests manually without pytest
    import traceback
    tests = [
        test_strip_mdx_removes_imports,
        test_strip_mdx_removes_jsx_components,
        test_strip_mdx_removes_frontmatter,
        test_strip_mdx_preserves_code_blocks,
        test_detect_platform_ios,
        test_detect_platform_flutter,
        test_detect_platform_general,
        test_split_by_headings,
        test_chunk_document_creates_chunks,
        test_chunk_metadata_fields,
    ]
    passed = 0
    for test in tests:
        try:
            test()
            print(f"  ✓ {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: {e}")
            traceback.print_exc()
    print(f"\n{passed}/{len(tests)} tests passed")
