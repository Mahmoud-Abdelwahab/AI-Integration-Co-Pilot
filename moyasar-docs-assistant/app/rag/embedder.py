"""
Ollama-based embedder using nomic-embed-text.
Handles batching and error retry.
"""
import httpx
from app.config.settings import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

EMBED_ENDPOINT = "/api/embeddings"
TIMEOUT = 60.0


def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text string via Ollama."""
    url = settings.ollama_base_url.rstrip("/") + EMBED_ENDPOINT
    try:
        resp = httpx.post(
            url,
            json={"model": settings.embedding_model, "prompt": text},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()["embedding"]
    except httpx.HTTPError as e:
        logger.error(f"Embedding request failed: {e}")
        raise


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts."""
    embeddings = []
    for i, text in enumerate(texts):
        emb = embed_text(text)
        embeddings.append(emb)
        if (i + 1) % 10 == 0:
            logger.info(f"Embedded {i + 1}/{len(texts)} chunks...")
    return embeddings
