from __future__ import annotations
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:14b"
    embedding_model: str = "nomic-embed-text"

    # ChromaDB
    chroma_persist_dir: str = str(Path(__file__).parents[3] / "chroma_db")
    chroma_collection_name: str = "moyasar_docs"

    # Docs
    docs_dir: str = str(Path(__file__).parents[3] / "docs")

    # Chunking
    chunk_min_tokens: int = 400
    chunk_max_tokens: int = 700
    chunk_overlap_tokens: int = 100

    # Retrieval
    top_k: int = 10  # Increased from 5 to get more chunks
    similarity_threshold: float = 0.1  # Lowered from 0.3 to be less strict

    # API
    host: str = "0.0.0.0"
    port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()