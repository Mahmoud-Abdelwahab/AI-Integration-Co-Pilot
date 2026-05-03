"""
Markdown/MDX ingestion: scan docs folder, clean content, yield raw documents.
Uses enhanced processor for better chunking and metadata.
"""
from dataclasses import dataclass
from pathlib import Path
import json

from app.utils.logger import get_logger
from app.utils.text_utils import detect_platform # strip_mdx is now in enhanced_doc_processor
from app.rag.enhanced_doc_processor import process_document_markdown

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".md", ".mdx"}


@dataclass
class RawDocument:
    file_path: str
    content: str # This will be the original raw content for the processor
    platform: str
    filename: str


def ingest_docs(docs_dir: str) -> list[dict]:
    """
    Recursively scan docs_dir, read files, and process them using enhanced_doc_processor.
    Returns a list of processed document data (dicts) ready for vectorization.
    """
    root = Path(docs_dir)
    if not root.exists():
        logger.warning(f"Docs directory not found: {docs_dir}")
        return []

    processed_docs_data = []
    all_files = [
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    logger.info(f"Found {len(all_files)} doc file(s) in {docs_dir}")

    for file_path in sorted(all_files):
        try:
            raw_content = file_path.read_text(encoding="utf-8", errors="replace")
            if not raw_content.strip():
                logger.debug(f"Skipping empty file: {file_path}")
                continue

            # Use the enhanced processor
            logger.info(f"Processing {file_path.name} with enhanced processor...")
            processed_data = process_document_markdown(
                mdx_content=raw_content,
                file_path=str(file_path)
            )
            
            # The processor returns a dict with 'clean_markdown' and 'chunks'
            # We need to adapt this for the next stages.
            # For now, let's assume the 'chunks' list is what we need for vectorization.
            # We'll also keep the original file path for reference if needed.

            # The current RAG pipeline expects a list of 'Chunk' objects.
            # We'll need to adapt the output of enhanced_doc_processor or the
            # consumer of this function to handle the new chunk structure.
            # For now, we'll return the processed data as is.
            # The vector_store.upsert_chunks will need to be updated or a new
            # function will be needed to handle these new chunks.

            # Add platform info to each chunk if not already present (processor should do this)
            # For now, we assume the processor adds 'platform' to each chunk.
            
            processed_docs_data.append({
                "file_path": str(file_path),
                "filename": file_path.name,
                "platform": detect_platform(str(file_path)), # Keep this for overall doc context
                "processed_chunks": processed_data["chunks"] # This is the list of new chunk dicts
            })
            logger.debug(f"Processed and ingested: {file_path.name}")

        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}", exc_info=True)

    logger.info(f"Successfully processed {len(processed_docs_data)} document(s)")
    return processed_docs_data