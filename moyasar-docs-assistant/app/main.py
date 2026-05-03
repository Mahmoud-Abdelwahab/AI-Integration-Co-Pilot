"""
FastAPI application entrypoint.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="Moyasar Docs Assistant",
    description="Local RAG chatbot for Moyasar SDK documentation. No cloud APIs.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="")


@app.on_event("startup")
async def on_startup():
    logger.info("Moyasar Docs Assistant starting up...")
    logger.info("Run POST /reindex to index your documentation before querying.")
