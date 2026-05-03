"""
Indexing service: run full ingestion pipeline and store in ChromaDB.
Uses enhanced processing for chunking and metadata.
"""
from __future__ import annotations
from typing import Optional
from app.config.settings import settings
from app.rag.ingestor import ingest_docs
# from app.rag.chunker import chunk_documents # No longer used directly
from app.rag.vector_store import upsert_enhanced_chunks, reset_collection, collection_count
from app.utils.logger import get_logger

logger = get_logger(__name__)


def run_indexing(docs_dir: Optional[str] = None, reset: bool = True) -> dict:
    """
    Full ingestion pipeline:
    1. Ingest docs (with enhanced processing)
    2. Embed + store enhanced chunks in ChromaDB
    Returns stats dict.
    """
    dir_to_use = docs_dir or settings.docs_dir

    if reset:
        logger.info("Resetting ChromaDB collection...")
        reset_collection()

    # ingest_docs now returns a list of dicts, each containing 'processed_chunks'
    processed_docs_data = ingest_docs(dir_to_use)
    if not processed_docs_data:
        return {"docs_indexed": 0, "chunks_stored": 0, "status": "no_docs_found"}

    # Extract all chunks from all processed documents
    all_enhanced_chunks = []
    for doc_data in processed_docs_data:
        if "processed_chunks" in doc_data:
            all_enhanced_chunks.extend(doc_data["processed_chunks"])
    
    if not all_enhanced_chunks:
        return {"docs_indexed": len(processed_docs_data), "chunks_stored": 0, "status": "no_chunks"}

    # Use the new upsert function for enhanced chunks
    stored = upsert_enhanced_chunks(all_enhanced_chunks)
    total = collection_count()

    logger.info(
        f"Indexing complete: {len(processed_docs_data)} doc(s), {stored} chunk(s) stored, "
        f"{total} total in DB"
    )

    return {
        "docs_indexed": len(processed_docs_data),
        "chunks_stored": stored,
        "total_in_db": total,
        "status": "success",
    }