# Moyasar AI Intelligence: Dynamic Architecture Rules (v2.0)

## 1. DYNAMIC PLATFORM INDEXING
- **Path-Based Metadata:** Every document chunk MUST be tagged with a `platform` metadata field (e.g., `ios`, `flutter`, `android`) extracted directly from its parent directory name in `/docs/`.
- **Zero Static Logic:** Strictly avoid hardcoding lists of class names or keywords (e.g., no mapping 'PaymentConfig' to Flutter in JS). Rely 100% on Vector Embeddings and Semantic similarity.

## 2. ADVANCED RAG PIPELINE
- **Step 1 (Dynamic Intent):** Before searching, use the LLM to analyze the user's prompt and extract the target `platform` and `intent` (e.g., `{ "platform": "flutter", "action": "setup" }`).
- **Step 2 (Metadata Filter):** Use the extracted platform as a **strict metadata filter** in the Vector DB query to eliminate cross-platform noise.
- **Step 3 (Cross-Platform Context):** If no platform is specified, search all docs but highlight the platform in the source citation.

## 3. RESPONSE ARCHITECTURE
- **Term Adaptation:** Use the exact nomenclature found in the retrieved documentation (e.g., if the docs say `PaymentConfig`, do not use `PaymentRequest`).
- **Source Verification:** Every response MUST include the source file path (e.g., `Source: docs/ios-docs/apple-pay.mdx`) to ensure transparency.
- **Support Fallback:** If the semantic match score is below 70%, suggest checking the official Moyasar website or contacting support.

## 4. FUTURE-PROOFING & EXPANSION
- **Unified Schema:** All indexing and retrieval logic must support `source_type` metadata (e.g., `docs` vs `freshdesk_tickets`) to prepare for support-ticket integration.
- **Code Cleanliness:** Write modular, async/await Node.js code that can handle new directories in `/docs/` without needing manual code updates.