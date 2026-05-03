"""
FastAPI routers: /chat, /reindex, /health
"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.chat_service import chat
from app.services.index_service import run_indexing
from app.rag.vector_store import collection_count
from app.config.settings import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── Request / Response schemas ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="Developer question")

class SourceCitation(BaseModel):
    file: str
    path: str
    heading: str
    platform: str
    relevance_score: float

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]
    chunks_used: int = 0

class ReindexRequest(BaseModel):
    docs_dir: Optional[str] = Field(None, description="Override docs directory path")
    reset: bool = Field(True, description="Reset collection before indexing")

class ReindexResponse(BaseModel):
    docs_indexed: int
    chunks_stored: int
    total_in_db: int = 0
    status: str

class HealthResponse(BaseModel):
    status: str
    llm_model: str
    embedding_model: str
    docs_dir: str
    chunks_in_db: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse, summary="Ask a question about Moyasar docs")
async def chat_endpoint(request: ChatRequest):
    """
    Answer a developer question using only Moyasar documentation context.
    Returns the answer and cited sources.
    """
    try:
        result = await chat(request.question)
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reindex", response_model=ReindexResponse, summary="Re-index documentation")
def reindex_endpoint(request: ReindexRequest = ReindexRequest()):
    """
    Trigger a full re-ingestion and re-embedding of all markdown docs.
    This is synchronous and may take a few minutes depending on doc count.
    """
    try:
        logger.info(
            f"Reindex requested. docs_dir={request.docs_dir or settings.docs_dir}, "
            f"reset={request.reset}"
        )
        result = run_indexing(docs_dir=request.docs_dir, reset=request.reset)
        return ReindexResponse(**result)
    except Exception as e:
        logger.error(f"Reindex error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse, summary="Health check")
def health_endpoint():
    """Return service health and current index stats."""
    try:
        count = collection_count()
    except Exception:
        count = -1

    return HealthResponse(
        status="ok",
        llm_model=settings.llm_model,
        embedding_model=settings.embedding_model,
        docs_dir=settings.docs_dir,
        chunks_in_db=count,
    )
