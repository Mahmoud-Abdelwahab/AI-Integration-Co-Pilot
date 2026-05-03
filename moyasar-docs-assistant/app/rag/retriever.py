"""
Retrieval: semantic search (top-k) with optional keyword fallback.
"""
from __future__ import annotations
import re
from typing import Optional
from dataclasses import dataclass

from app.config.settings import settings
from app.rag.embedder import embed_text
from app.rag.vector_store import _get_collection
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RetrievedChunk:
    chunk_id: str
    content: str
    file_path: str
    filename: str
    platform: str
    heading: str
    section: str
    score: float  # lower = more similar (cosine distance)


def retrieve(query: str, top_k: Optional[int] = None) -> list[RetrievedChunk]:
    """
    Semantic retrieval: embed query, query ChromaDB for top_k nearest chunks.
    Falls back to keyword search if semantic yields nothing useful.
    """
    k = top_k or settings.top_k
    col = _get_collection()
    total = col.count()

    if total == 0:
        logger.warning("ChromaDB collection is empty. Run /reindex first.")
        return []

    query_embedding = embed_text(query)
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=min(k, total),
        include=["documents", "metadatas", "distances"],
    )

    chunks: list[RetrievedChunk] = []
    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i]
        meta = results["metadatas"][0][i]

        # Filter by similarity threshold (cosine distance: lower = better)
        if distance > (1.0 - settings.similarity_threshold):
            continue

        chunks.append(RetrievedChunk(
            chunk_id=results["ids"][0][i],
            content=results["documents"][0][i],
            file_path=meta.get("file_path", ""),
            filename=meta.get("filename", ""),
            platform=meta.get("platform", ""),
            heading=meta.get("heading", ""),
            section=meta.get("section", ""),
            score=distance,
        ))

    logger.info(
        f"Semantic search: {len(chunks)} chunk(s) above threshold "
        f"for query: '{query[:60]}...'"
    )

    # Keyword fallback: if semantic returns nothing, search by keywords
    if not chunks:
        chunks = _keyword_fallback(query, col, k)

    return chunks


def _keyword_fallback(query: str, col, k: int) -> list[RetrievedChunk]:
    """Simple keyword search using ChromaDB's where_document filter."""
    keywords = [w for w in re.findall(r'\b\w{4,}\b', query.lower()) if w]
    if not keywords:
        return []

    # Try each keyword, collect unique hits
    seen_ids = set()
    chunks: list[RetrievedChunk] = []

    for kw in keywords[:3]:  # limit to top 3 keywords
        try:
            results = col.query(
                query_texts=[kw],
                n_results=min(k, col.count()),
                include=["documents", "metadatas", "distances"],
            )
            for i in range(len(results["ids"][0])):
                cid = results["ids"][0][i]
                if cid in seen_ids:
                    continue
                seen_ids.add(cid)
                meta = results["metadatas"][0][i]
                chunks.append(RetrievedChunk(
                    chunk_id=cid,
                    content=results["documents"][0][i],
                    file_path=meta.get("file_path", ""),
                    filename=meta.get("filename", ""),
                    platform=meta.get("platform", ""),
                    heading=meta.get("heading", ""),
                    section=meta.get("section", ""),
                    score=results["distances"][0][i],
                ))
        except Exception as e:
            logger.debug(f"Keyword fallback error for '{kw}': {e}")

    logger.info(f"Keyword fallback returned {len(chunks)} chunk(s)")
    return chunks[:k]
