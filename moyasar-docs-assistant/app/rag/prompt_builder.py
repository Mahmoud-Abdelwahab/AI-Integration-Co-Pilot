"""
Prompt builder: strict no-hallucination system prompt + context assembly.
"""
from app.rag.retriever import RetrievedChunk

SYSTEM_PROMPT = """You are the Moyasar Documentation Assistant.

STRICT RULES:
1. Answer ONLY using the provided documentation context below.
2. Do NOT use any prior knowledge or make assumptions beyond the context.
3. If the answer is not found in the context, respond EXACTLY:
   "I couldn't find this in Moyasar docs."
4. Always cite the source: mention the file name and heading where you found the answer.
5. Keep answers concise and practical — developers reading this are busy.
6. If code examples exist in the context, include them EXACTLY as shown.
7. Never hallucinate API parameters, method names, or configuration values.
8. For integration steps, list them clearly and include ALL relevant code snippets.
9. Include ALL handler functions and callbacks mentioned in the context.
10. Do not add introductory phrases like "Here's how to integrate STC Pay".
11. Go directly to the answer based on the provided context.
12. If the context shows multiple implementations (e.g., SwiftUI and UIKit), include all relevant ones.
13. Pay special attention to result handlers, callbacks, and error handling code.
"""


def build_context_block(chunks: list[RetrievedChunk]) -> str:
    """Format retrieved chunks into a readable context block."""
    if not chunks:
        return "No relevant documentation found."

    parts = []
    for i, chunk in enumerate(chunks, 1):
        source_label = f"[Source {i}: {chunk.filename}"
        if chunk.heading:
            source_label += f" — {chunk.heading}"
        source_label += "]"
        parts.append(f"{source_label}\n{chunk.content}")

    return "\n\n---\n\n".join(parts)


def build_prompt(query: str, chunks: list[RetrievedChunk]) -> list[dict]:
    """
    Build the full messages array for the Ollama chat API.
    Returns list of {role, content} dicts.
    """
    context = build_context_block(chunks)
    user_message = (
        f"DOCUMENTATION CONTEXT:\n\n{context}\n\n"
        f"---\n\nDEVELOPER QUESTION: {query}\n\n"
        f"Provide a direct answer using only the context above. "
        f"Include ALL code snippets exactly as shown in the context. "
        f"Include ALL handler functions, callbacks, and error handling. "
        f"If multiple implementations are shown (SwiftUI/UIKit), include all relevant ones. "
        f"Cite your sources by mentioning the filename and heading."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]


def format_sources(chunks: list[RetrievedChunk]) -> list[dict]:
    """Return source citations for API response metadata."""
    seen = set()
    sources = []
    for chunk in chunks:
        key = (chunk.filename, chunk.heading)
        if key not in seen:
            seen.add(key)
            sources.append({
                "file": chunk.filename,
                "path": chunk.file_path,
                "heading": chunk.heading,
                "platform": chunk.platform,
                "relevance_score": round(1.0 - chunk.score, 3),
            })
    return sources