"""
Smart markdown chunker: splits by headings, enforces token size constraints,
preserves section hierarchy in metadata.
"""
import re
from dataclasses import dataclass, field

from app.rag.ingestor import RawDocument
from app.utils.logger import get_logger
from app.utils.text_utils import count_tokens
from app.config.settings import settings

logger = get_logger(__name__)


@dataclass
class Chunk:
    chunk_id: str
    content: str
    file_path: str
    filename: str
    platform: str
    heading: str
    section: str
    token_count: int
    metadata: dict = field(default_factory=dict)


def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """
    Split markdown text into (heading, body) pairs at every heading boundary.
    Returns list of (heading_text, section_content) tuples.
    """
    pattern = re.compile(r'^(#{1,6}\s+.+)$', re.MULTILINE)
    parts: list[tuple[str, str]] = []
    positions = [(m.start(), m.group()) for m in pattern.finditer(text)]

    if not positions:
        return [("", text)]

    # Text before first heading
    if positions[0][0] > 0:
        preamble = text[:positions[0][0]].strip()
        if preamble:
            parts.append(("", preamble))

    for i, (pos, heading) in enumerate(positions):
        end = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        body = text[pos + len(heading):end].strip()
        heading_text = heading.lstrip('#').strip()
        parts.append((heading_text, heading + ("\n" + body if body else "")))

    return parts


def _merge_small_chunks(
    parts: list[tuple[str, str]],
    min_tokens: int,
    max_tokens: int,
    overlap_tokens: int,
) -> list[tuple[str, str]]:
    """
    Merge tiny sections together until min_tokens reached,
    split oversized sections with overlap.
    """
    merged: list[tuple[str, str]] = []
    buffer_heading = ""
    buffer_text = ""
    buffer_tokens = 0

    def flush():
        nonlocal buffer_heading, buffer_text, buffer_tokens
        if buffer_text.strip():
            merged.append((buffer_heading, buffer_text.strip()))
        buffer_heading, buffer_text, buffer_tokens = "", "", 0

    for heading, content in parts:
        tokens = count_tokens(content)

        if tokens > max_tokens:
            # Flush current buffer first
            flush()
            # Split large chunk by paragraphs with overlap
            paragraphs = content.split("\n\n")
            chunk_buf = ""
            chunk_tokens = 0
            for para in paragraphs:
                p_tokens = count_tokens(para)
                if chunk_tokens + p_tokens > max_tokens and chunk_buf:
                    merged.append((heading, chunk_buf.strip()))
                    # Overlap: keep last overlap_tokens worth of text
                    words = chunk_buf.split()
                    overlap_words = words[-overlap_tokens:] if len(words) > overlap_tokens else words
                    chunk_buf = " ".join(overlap_words) + "\n\n" + para
                    chunk_tokens = count_tokens(chunk_buf)
                else:
                    chunk_buf += "\n\n" + para
                    chunk_tokens += p_tokens
            if chunk_buf.strip():
                merged.append((heading, chunk_buf.strip()))
            continue

        if buffer_tokens + tokens > max_tokens:
            flush()

        if not buffer_heading and heading:
            buffer_heading = heading
        buffer_text += "\n\n" + content if buffer_text else content
        buffer_tokens += tokens

        if buffer_tokens >= min_tokens:
            flush()

    flush()
    return merged


def chunk_document(doc: RawDocument, doc_index: int) -> list[Chunk]:
    """Chunk a single RawDocument into sized, metadata-rich Chunks."""
    parts = _split_by_headings(doc.content)
    merged = _merge_small_chunks(
        parts,
        min_tokens=settings.chunk_min_tokens,
        max_tokens=settings.chunk_max_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )

    chunks: list[Chunk] = []
    for i, (heading, content) in enumerate(merged):
        token_count = count_tokens(content)
        chunk_id = f"{doc.filename}_{doc_index}_{i}"
        # Derive top-level section from first heading line if present
        section_match = re.match(r'^#{1,2}\s+(.+)$', content, re.MULTILINE)
        section = section_match.group(1) if section_match else heading or doc.filename

        chunks.append(Chunk(
            chunk_id=chunk_id,
            content=content,
            file_path=doc.file_path,
            filename=doc.filename,
            platform=doc.platform,
            heading=heading,
            section=section,
            token_count=token_count,
            metadata={
                "file_path": doc.file_path,
                "filename": doc.filename,
                "platform": doc.platform,
                "heading": heading,
                "section": section,
                "token_count": token_count,
            },
        ))

    logger.debug(f"{doc.filename} → {len(chunks)} chunk(s)")
    return chunks


def chunk_documents(docs: list[RawDocument]) -> list[Chunk]:
    """Chunk all documents."""
    all_chunks: list[Chunk] = []
    for i, doc in enumerate(docs):
        all_chunks.extend(chunk_document(doc, i))
    logger.info(f"Total chunks created: {len(all_chunks)}")
    return all_chunks
