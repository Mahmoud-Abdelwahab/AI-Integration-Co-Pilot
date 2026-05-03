# Moyasar Docs Assistant

A local RAG (Retrieval-Augmented Generation) chatbot that answers developer questions strictly from **Moyasar SDK documentation**. No cloud APIs — everything runs locally.

## Stack

| Component | Technology |
|-----------|-----------|
| API server | FastAPI + Uvicorn |
| Vector DB | ChromaDB (persistent, local) |
| LLM | Ollama `qwen2.5:14b` |
| Embeddings | Ollama `nomic-embed-text` |
| Language | Python 3.11+ |

---

## Prerequisites

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Pull required models

```bash
ollama pull qwen2.5:14b
ollama pull nomic-embed-text
```

Verify models are available:

```bash
ollama list
```

### 3. Python 3.11+

```bash
python3 --version  # must be 3.11+
```

---

## Setup

```bash
# Navigate to this directory
cd moyasar-docs-assistant

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## Add Your Docs

Place your Moyasar `.md` / `.mdx` documentation files in the `../docs/` directory.

The ingestor recursively scans all subdirectories. Current structure:
```
docs/
└── ios-docs/
    ├── apple-pay-integration.mdx
    ├── stc-pay-integration.mdx
    ├── credit-card-integration.mdx
    ├── installation.mdx
    └── ...
```

---

## Index Documentation

Before you can chat, you must index the docs:

```bash
# Using the ingest script (from moyasar-docs-assistant/)
python scripts/ingest.py

# Or specify a custom docs directory
python scripts/ingest.py --docs-dir /path/to/your/docs

# Incremental update (no reset)
python scripts/ingest.py --no-reset
```

Output:
```
==================================================
INDEXING RESULTS
==================================================
  Status        : success
  Docs indexed  : 10
  Chunks stored : 47
  Total in DB   : 47
==================================================
```

---

## Run the Server

```bash
# From the moyasar-docs-assistant/ directory
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Server starts at: `http://localhost:8000`

Interactive API docs: `http://localhost:8000/docs`

---

## API Endpoints

### `GET /health`
Check service status and index stats.

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "llm_model": "qwen2.5:14b",
  "embedding_model": "nomic-embed-text",
  "docs_dir": "/path/to/docs",
  "chunks_in_db": 47
}
```

---

### `POST /chat`
Ask a question about Moyasar docs.

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I integrate Apple Pay?"}'
```

```json
{
  "answer": "To integrate Apple Pay with Moyasar iOS SDK:\n\n1. Import the framework...\n\n[Source: apple-pay-integration.mdx — Apple Pay Integration]",
  "sources": [
    {
      "file": "apple-pay-integration.mdx",
      "path": "/docs/ios-docs/apple-pay-integration.mdx",
      "heading": "Apple Pay Integration",
      "platform": "ios",
      "relevance_score": 0.91
    }
  ],
  "chunks_used": 3
}
```

**More example questions:**

```bash
# STC Pay setup
curl -X POST http://localhost:8000/chat \
  -d '{"question": "How do I set up STC Pay on iOS?"}'

# Callback handling
curl -X POST http://localhost:8000/chat \
  -d '{"question": "How do I handle payment callbacks?"}'

# Not in docs
curl -X POST http://localhost:8000/chat \
  -d '{"question": "How do I integrate PayPal?"}'
# Returns: "I couldn't find this in Moyasar docs."
```

---

### `POST /reindex`
Trigger re-indexing of docs (e.g., after updating markdown files).

```bash
curl -X POST http://localhost:8000/reindex \
  -H "Content-Type: application/json" \
  -d '{"reset": true}'
```

---

## Run Tests

```bash
# From moyasar-docs-assistant/
python tests/test_ingestion.py

# Or with pytest if installed
pytest tests/ -v
```

---

## Configuration

Edit `app/config/settings.py` or create a `.env` file:

```env
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:14b
EMBEDDING_MODEL=nomic-embed-text
CHROMA_PERSIST_DIR=./chroma_db
DOCS_DIR=../docs
TOP_K=5
CHUNK_MIN_TOKENS=400
CHUNK_MAX_TOKENS=700
CHUNK_OVERLAP_TOKENS=100
```

---

## Project Structure

```
moyasar-docs-assistant/
├── app/
│   ├── api/
│   │   └── routes.py          # FastAPI endpoints
│   ├── rag/
│   │   ├── ingestor.py        # File scanning + MDX cleaning
│   │   ├── chunker.py         # Heading-based smart chunker
│   │   ├── embedder.py        # Ollama embeddings
│   │   ├── vector_store.py    # ChromaDB operations
│   │   ├── retriever.py       # Semantic + keyword retrieval
│   │   └── prompt_builder.py  # No-hallucination prompt
│   ├── services/
│   │   ├── chat_service.py    # RAG pipeline orchestrator
│   │   └── index_service.py   # Indexing pipeline
│   ├── utils/
│   │   ├── logger.py          # Structured logging
│   │   └── text_utils.py      # MDX stripping, platform detection
│   ├── config/
│   │   └── settings.py        # Pydantic settings
│   └── main.py                # FastAPI app
├── chroma_db/                 # Persistent vector store (auto-created)
├── scripts/
│   └── ingest.py              # CLI ingestion script
├── tests/
│   └── test_ingestion.py      # Unit tests
├── requirements.txt
└── README.md
```

---

## How It Works

1. **Ingestion** — Markdown/MDX files are scanned, JSX/imports stripped, content cleaned
2. **Chunking** — Documents split at heading boundaries (400–700 tokens, 100 token overlap)
3. **Embeddings** — Each chunk embedded with `nomic-embed-text` via Ollama
4. **Storage** — Embeddings stored in local persistent ChromaDB with metadata (file, heading, platform)
5. **Retrieval** — Query embedded, top-5 semantically similar chunks retrieved; keyword fallback if needed
6. **Generation** — `qwen2.5:14b` answers strictly from retrieved context; cites sources; says "I couldn't find this" if not in docs
