"""
Chat service: orchestrates retrieval → prompt → LLM → response.
"""
from __future__ import annotations
import httpx
from app.config.settings import settings
from app.rag.retriever import retrieve
from app.rag.prompt_builder import build_prompt, format_sources
from app.utils.logger import get_logger

logger = get_logger(__name__)

CHAT_ENDPOINT = "/api/chat"
TIMEOUT = 120.0
NOT_FOUND_MARKER = "I couldn't find this in Moyasar docs."


async def chat(query: str) -> dict:
    """
    Full RAG pipeline:
    1. Retrieve relevant chunks
    2. Build prompt
    3. Call Ollama LLM
    4. Return answer + sources
    """
    query = query.strip()
    if not query:
        return {"answer": "Please provide a question.", "sources": []}

    # Step 1: Retrieve
    chunks = retrieve(query)
    sources = format_sources(chunks)

    if not chunks:
        logger.info(f"No relevant chunks found for: '{query[:80]}'")
        return {"answer": NOT_FOUND_MARKER, "sources": []}

    # Step 2: Build prompt
    messages = build_prompt(query, chunks)

    # Step 3: Call LLM
    url = settings.ollama_base_url.rstrip("/") + CHAT_ENDPOINT
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.1,   # low temp = factual, minimal creativity
            "num_predict": 1024,
        },
    }

    logger.info(f"Calling LLM ({settings.llm_model}) for query: '{query[:60]}'")

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    answer = data.get("message", {}).get("content", "").strip()

    if not answer:
        answer = NOT_FOUND_MARKER

    logger.info(
        f"Answer generated. Sources cited: {[s['file'] for s in sources]}"
    )

    return {
        "answer": answer,
        "sources": sources,
        "chunks_used": len(chunks),
    }
