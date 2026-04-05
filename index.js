const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ============================================================
// CORS & Middleware
// ============================================================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ============================================================
// Configuration
// ============================================================
const OLLAMA_URL = 'http://localhost:11434/api';
const EMBEDDING_MODEL = 'nomic-embed-text';
const LLM_MODEL = 'qwen2.5:3b';
const TOP_K_RESULTS = 12;
const MIN_CHUNK_LENGTH = 30;

// ============================================================
// Vector DB (in-memory)
// ============================================================
let vectorDB = [];

// ============================================================
// HTTP Helpers
// ============================================================
function makeHttpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

function makeHttpStream(url, data, onChunk) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) {
            try { onChunk(JSON.parse(line)); } catch (e) { /* skip malformed */ }
          }
        }
      });
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

// ============================================================
// Embedding & Similarity
// ============================================================
async function generateEmbedding(text) {
  try {
    const response = await makeHttpPost(`${OLLAMA_URL}/embeddings`, {
      model: EMBEDDING_MODEL,
      prompt: text,
    });
    if (response?.embedding && Array.isArray(response.embedding)) {
      return response.embedding;
    }
    console.error('Invalid embedding response:', JSON.stringify(response).substring(0, 200));
    return null;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    return null;
  }
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// ============================================================
// 1. DYNAMIC INDEXING — No Hardcoded Platforms
// ============================================================

/**
 * Extract platform from a file path under docs/.
 * Convention: docs/<platform>-docs/  →  platform = "ios"
 * Also handles: docs/<platform>/      →  platform = "flutter"
 * Falls back to "general" if no platform folder is detected.
 */
function extractPlatformFromPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // Match docs/<name>-docs/
  const match = normalized.match(/docs\/([^/]+)-docs\//);
  if (match) return match[1].toLowerCase();
  // Match docs/<name>/
  const match2 = normalized.match(/docs\/([^/]+)\//);
  if (match2 && !match2[1].startsWith('.')) return match2[1].toLowerCase();
  return 'general';
}

/**
 * Smart content chunking — splits docs/code into retrievable segments.
 * Attaches dynamically extracted platform as metadata.
 */
function smartChunk(content, filePath) {
  const chunks = [];
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);
  const platform = extractPlatformFromPath(filePath);
  const fileHeader = `<!-- Source: ${fileName} | Platform: ${platform} -->\n`;

  if (ext === '.md' || ext === '.mdx') {
    // Split by markdown headers (h1-h3)
    const sections = content.split(/(?=^#{1,3}\s)/m);
    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length > MIN_CHUNK_LENGTH) {
        chunks.push({ text: fileHeader + trimmed, platform });
      }
    }
    // Also index full file if small enough for broader context
    if (content.length < 15000) {
      chunks.push({ text: fileHeader + content, platform });
    }
  } else if (['.swift', '.kt', '.dart', '.js', '.ts'].includes(ext)) {
    // Code files: split by top-level declarations
    const lines = content.split('\n');
    let currentChunk = [];
    let braceCount = 0;
    let chunkStarted = false;
    const codeHeader = `// Source: ${fileName} | Platform: ${platform}\n`;

    for (const line of lines) {
      const trimmed = line.trim();
      const isDeclaration =
        trimmed.startsWith('func ') || trimmed.startsWith('public func ') || trimmed.startsWith('private func ') ||
        trimmed.startsWith('class ') || trimmed.startsWith('public class ') ||
        trimmed.startsWith('struct ') || trimmed.startsWith('public struct ') ||
        trimmed.startsWith('enum ') || trimmed.startsWith('public enum ') ||
        trimmed.startsWith('extension ') || trimmed.startsWith('init(') ||
        trimmed.startsWith('fun ') || trimmed.startsWith('data class ') ||
        trimmed.startsWith('Widget ') || trimmed.startsWith('void ') ||
        trimmed.startsWith('export ') || trimmed.startsWith('const ') || trimmed.startsWith('function ');

      if (!chunkStarted && isDeclaration) {
        if (currentChunk.length > 0) {
          const chunkText = codeHeader + currentChunk.join('\n');
          if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
            chunks.push({ text: chunkText, platform });
          }
          currentChunk = [];
        }
        chunkStarted = true;
      }

      currentChunk.push(line);
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (chunkStarted && braceCount <= 0 && currentChunk.length > 2) {
        const chunkText = codeHeader + currentChunk.join('\n');
        if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
          chunks.push({ text: chunkText, platform });
        }
        currentChunk = [];
        chunkStarted = false;
        braceCount = 0;
      }
    }

    if (currentChunk.length > 0) {
      const chunkText = codeHeader + currentChunk.join('\n');
      if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
        chunks.push({ text: chunkText, platform });
      }
    }

    if (content.length < 5000) {
      chunks.push({ text: codeHeader + content, platform });
    }
  }

  return chunks;
}

/**
 * Discover all platform folders under docs/ and index every file.
 * Platform is dynamically extracted — nothing is hardcoded.
 */
async function indexDocs() {
  vectorDB = [];
  const docsRoot = path.join(__dirname, 'docs');

  if (!fs.existsSync(docsRoot)) {
    console.error('❌ docs/ directory not found!');
    return;
  }

  // Auto-discover platform folders
  const platformDirs = fs.readdirSync(docsRoot)
    .filter(d => {
      const fullPath = path.join(docsRoot, d);
      return fs.statSync(fullPath).isDirectory() && !d.startsWith('.');
    })
    .map(d => ({ path: path.join(docsRoot, d), name: d }));

  console.log(`📂 Discovered ${platformDirs.length} platform folder(s): ${platformDirs.map(d => d.name).join(', ')}`);

  // Collect all indexable files recursively
  const allFiles = [];
  function collectFiles(dirPath) {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath);
      } else if (stat.isFile() && /\.(md|mdx|swift|kt|dart|js|ts)$/.test(entry)) {
        allFiles.push(fullPath);
      }
    }
  }

  for (const dir of platformDirs) {
    collectFiles(dir.path);
  }

  console.log(`📄 Total files to index: ${allFiles.length}`);

  // Verify embedding model is available
  console.log(`Testing embedding model: ${EMBEDDING_MODEL}...`);
  const testEmbedding = await generateEmbedding('test');
  if (!testEmbedding) {
    console.error(`\n❌ ERROR: Embedding model '${EMBEDDING_MODEL}' is not available!`);
    console.error(`Please run: ollama pull ${EMBEDDING_MODEL}\n`);
    return;
  }
  console.log(`✅ Embedding model working. Dimension: ${testEmbedding.length}`);

  let indexed = 0;
  let totalChunks = 0;

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const chunks = smartChunk(content, file);
      const platform = extractPlatformFromPath(file);
      const fileName = path.basename(file);

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        if (embedding) {
          vectorDB.push({
            embedding,
            text: chunk.text,
            source: file,
            fileName,
            metadata: { platform: chunk.platform },
          });
          totalChunks++;
        }
      }
      indexed++;
      console.log(`  ✅ [${platform}] ${fileName} (${chunks.length} chunks)`);
    } catch (error) {
      console.error(`  ❌ Error indexing ${file}:`, error.message);
    }
  }

  // Summary
  const platformSummary = {};
  vectorDB.forEach(item => {
    const p = item.metadata.platform;
    if (!platformSummary[p]) platformSummary[p] = 0;
    platformSummary[p]++;
  });

  console.log(`\n🎉 Indexing complete!`);
  console.log(`   Files indexed: ${indexed}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Platforms:`);
  for (const [plat, count] of Object.entries(platformSummary)) {
    console.log(`     ${plat}: ${count} chunks`);
  }
}

// ============================================================
// 2. LLM INTENT ROUTER — Semantic Extraction (No Regex)
// ============================================================

/**
 * Uses the LLM to analyze the user's query and extract structured intent.
 * Returns: { platform: "ios" | "flutter" | "android" | "general" }
 *
 * This replaces ALL hardcoded regex/platform-detection functions.
 */
async function analyzeIntent(userQuery) {
  const prompt = `You are an intent router for the Moyasar payment SDK documentation system.

Analyze the following user query and determine which platform they are asking about.

USER QUERY: "${userQuery}"

Return ONLY a JSON object with no markdown, no explanation, no code blocks:
{
  "platform": "ios" | "flutter" | "android" | "general"
}

Rules:
- "ios" if the query mentions iOS, Swift, SwiftUI, UIKit, Xcode, CocoaPods, iPhone, iPad, or Apple-specific concepts
- "flutter" if the query mentions Flutter, Dart, widgets, pubspec, or Flutter-specific concepts
- "android" if the query mentions Android, Kotlin, Java, Gradle, Jetpack Compose, or Android-specific concepts
- "general" if the query is platform-agnostic (e.g., about API endpoints, payment flows, authentication, or general concepts that apply to all platforms)

Return ONLY the JSON object.`;

  try {
    const response = await makeHttpPost(`${OLLAMA_URL}/generate`, {
      model: LLM_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.0, top_p: 0.9, num_predict: 128 },
    });

    let rawText = '';
    if (response && typeof response === 'object') {
      rawText = response.response || response.text || response.content || '';
    } else if (typeof response === 'string') {
      rawText = response;
    }

    // Extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const platform = (parsed.platform || 'general').toLowerCase();

      // Validate platform is one of the allowed values
      const validPlatforms = ['ios', 'flutter', 'android', 'general'];
      const detectedPlatform = validPlatforms.includes(platform) ? platform : 'general';

      console.log(`🧠 LLM Intent Router detected platform: "${detectedPlatform}"`);
      return { platform: detectedPlatform };
    }
  } catch (error) {
    console.warn('⚠️ LLM Intent Router failed, falling back to "general":', error.message);
  }

  // Safe fallback
  return { platform: 'general' };
}

// ============================================================
// 3. FILTERED RETRIEVAL — Platform Metadata Filter
// ============================================================

/**
 * Search the Vector DB using the platform from the Intent Router
 as a strict metadata filter.
 *
 * If platform is "general", search across ALL platforms.
 * Otherwise, ONLY return chunks where metadata.platform matches.
 */
async function searchVectorDB(userQuery, intent, topK = TOP_K_RESULTS) {
  const questionEmbedding = await generateEmbedding(userQuery);
  if (!questionEmbedding) {
    console.error('Failed to generate question embedding');
    return [];
  }

  const targetPlatform = intent.platform;

  // Step 1: Filter by platform metadata (strict filter)
  const candidates = targetPlatform === 'general'
    ? vectorDB
    : vectorDB.filter(item => item.metadata.platform === targetPlatform);

  if (candidates.length === 0) {
    console.log(`⚠️ No chunks found for platform "${targetPlatform}". Expanding to all platforms.`);
    // Fallback: search all platforms if the target platform has no results
    return searchAllPlatforms(userQuery, questionEmbedding, topK);
  }

  // Step 2: Score filtered candidates by cosine similarity
  const scored = candidates.map(item => {
    const score = cosineSimilarity(questionEmbedding, item.embedding);
    return { ...item, score };
  });

  // Step 3: Sort and return top-K
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  console.log(`📊 Retrieved ${results.length} results (platform filter: "${targetPlatform}")`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.metadata.platform}] ${r.fileName} (score: ${r.score.toFixed(4)})`);
  });

  return results;
}

/**
 * Fallback: search across ALL platforms when target platform has no chunks.
 */
function searchAllPlatforms(userQuery, questionEmbedding, topK) {
  const scored = vectorDB.map(item => {
    const score = cosineSimilarity(questionEmbedding, item.embedding);
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  console.log(`📊 Retrieved ${results.length} results (all platforms fallback)`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.metadata.platform}] ${r.fileName} (score: ${r.score.toFixed(4)})`);
  });

  return results;
}

// ============================================================
// 4. DYNAMIC GENERATION — Terminology-Aware Prompt
// ============================================================

/**
 * Build the final LLM prompt that instructs the model to answer
 * using ONLY the terminology and naming conventions found in
 * the retrieved chunks.
 */
function buildGenerationPrompt(userQuery, retrievedChunks, intent) {
  // Build context from retrieved chunks
  let context = '';
  for (let i = 0; i < retrievedChunks.length; i++) {
    const chunk = retrievedChunks[i];
    context += `--- DOCUMENT CHUNK ${i + 1} ---\n`;
    context += `Source: ${chunk.fileName} | Platform: ${chunk.metadata.platform}\n`;
    context += `${chunk.text}\n\n`;
  }

  const platformInstruction = intent.platform === 'general'
    ? 'The user query is platform-agnostic. Answer using the terminology found in the retrieved documentation.'
    : `The user is asking about the ${intent.platform.toUpperCase()} platform. Use ONLY the terminology, class names, and API conventions found in the retrieved ${intent.platform} documentation.`;

  return `You are the Moyasar AI Co-Pilot — an expert technical assistant for the Moyasar payment SDK.

${platformInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DYNAMIC TERMINOLOGY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST answer using ONLY the terminology, class names, method names, and naming conventions found in the retrieved documentation chunks below.

- If the docs use "PaymentConfig", use "PaymentConfig".
- If the docs use "PaymentRequest", use "PaymentRequest".
- If the docs use "MoyasarSDK", use "MoyasarSDK".
- NEVER substitute terminology from other platforms.
- NEVER invent API names, class names, or method names not present in the context.
- Adapt your answer to match the exact naming conventions used in the retrieved chunks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETRIEVED DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userQuery}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provide a comprehensive, well-structured answer using ONLY the terminology from the documentation above. If the documentation does not contain enough information to answer, clearly state what is missing.

Use clean code blocks with the appropriate language tag. Use tables for field descriptions when applicable. Reference source files at the end of your answer.`;
}

// ============================================================
// LLM Answer Generation
// ============================================================
async function callLLM(prompt, maxTokens = 2048, temperature = 0.1) {
  try {
    const response = await makeHttpPost(`${OLLAMA_URL}/generate`, {
      model: LLM_MODEL,
      prompt,
      stream: false,
      options: { temperature, top_p: 0.9, num_predict: maxTokens },
    });
    if (response && typeof response === 'object') {
      let answer = response.response || response.text || response.content || JSON.stringify(response);
      answer = answer
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
      return answer;
    }
    return response || 'No response from LLM';
  } catch (error) {
    console.error('❌ Error calling Ollama LLM:', error.message);
    return null;
  }
}

// ============================================================
// MAIN PIPELINE — Dynamic RAG
// ============================================================
async function answerQuestion(question) {
  console.log(`\n⚡ Dynamic RAG Pipeline starting...`);
  console.log(`📝 Question: ${question}`);

  // Step 1: LLM Intent Router (semantic extraction)
  const intent = await analyzeIntent(question);

  // Step 2: Filtered Retrieval (platform metadata filter)
  const retrievedChunks = await searchVectorDB(question, intent);

  if (retrievedChunks.length === 0) {
    return {
      answer: 'No relevant documentation found for your question. Please ensure the documentation covers the requested topic.',
      metadata: { intent, resultsCount: 0 },
    };
  }

  // Step 3: Dynamic Generation (terminology-aware prompt)
  const prompt = buildGenerationPrompt(question, retrievedChunks, intent);
  console.log(`🤖 Calling LLM (prompt: ${prompt.length} chars)...`);
  const answer = await callLLM(prompt, 3072, 0.15);

  if (!answer) {
    return {
      answer: 'Error processing your question. Please try again.',
      metadata: { intent, resultsCount: retrievedChunks.length },
    };
  }

  console.log(`✅ Pipeline complete! (${answer.length} chars)`);

  return {
    answer,
    metadata: {
      intent,
      resultsCount: retrievedChunks.length,
      platforms: [...new Set(retrievedChunks.map(r => r.metadata.platform))],
    },
  };
}

// ============================================================
// Response Cache
// ============================================================
const responseCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX_SIZE = 500;

function hashQuestion(question) {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function getCachedAnswer(question) {
  const hash = hashQuestion(question);
  const cached = responseCache.get(hash);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    responseCache.delete(hash);
    return null;
  }
  cached.hitCount++;
  return cached;
}

function setCachedAnswer(question, answer) {
  const hash = hashQuestion(question);
  if (responseCache.size >= CACHE_MAX_SIZE) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.floor(CACHE_MAX_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) responseCache.delete(entries[i][0]);
  }
  responseCache.set(hash, { answer, timestamp: Date.now(), hitCount: 1 });
}

function getCacheStats() {
  let totalHits = 0;
  responseCache.forEach(entry => { totalHits += entry.hitCount; });
  return { size: responseCache.size, totalHits, maxSize: CACHE_MAX_SIZE, ttl: `${CACHE_TTL / 60000} minutes` };
}

// ============================================================
// API ENDPOINTS
// ============================================================

// Main ask endpoint
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  console.log('\n========================================');
  console.log(`📨 Question: ${question}`);
  console.log('========================================');

  if (vectorDB.length === 0) {
    return res.json({ answer: 'Database not indexed yet. Please wait for indexing to complete.' });
  }

  try {
    // Check cache
    const cached = getCachedAnswer(question);
    if (cached) {
      console.log(`⚡ Cache HIT! (${cached.hitCount} hits)`);
      return res.json({ answer: cached.answer, metadata: { cached: true, hitCount: cached.hitCount } });
    }

    console.log('🔄 Cache MISS - processing...');
    const result = await answerQuestion(question);

    // Cache the result
    setCachedAnswer(question, result.answer);

    res.json({ answer: result.answer, metadata: { ...result.metadata, cached: false } });
  } catch (error) {
    console.error('❌ Error in /ask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming endpoint
app.post('/ask/stream', async (req, res) => {
  const { question } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Check cache
    const cached = getCachedAnswer(question);
    if (cached) {
      sendEvent('cached', { hitCount: cached.hitCount });
      sendEvent('chunk', { text: cached.answer });
      sendEvent('done', { metadata: { cached: true } });
      return res.end();
    }

    sendEvent('status', { message: '🔍 Analyzing intent...' });

    // Step 1: LLM Intent Router
    const intent = await analyzeIntent(question);

    sendEvent('status', { message: '📚 Searching documentation...' });

    // Step 2: Filtered Retrieval
    const results = await searchVectorDB(question, intent);
    if (results.length === 0) {
      sendEvent('chunk', { text: 'No relevant documentation found.' });
      sendEvent('done', {});
      return res.end();
    }

    // Step 3: Build prompt & stream
    const prompt = buildGenerationPrompt(question, results, intent);

    sendEvent('status', { message: '🤖 Generating answer...' });

    let fullAnswer = '';
    await makeHttpStream(`${OLLAMA_URL}/generate`, {
      model: LLM_MODEL,
      prompt,
      stream: true,
      options: { temperature: 0.15, top_p: 0.9, num_predict: 3072 },
    }, (chunk) => {
      if (chunk.response) {
        fullAnswer += chunk.response;
        sendEvent('chunk', { text: chunk.response });
      }
      if (chunk.done) {
        fullAnswer = fullAnswer
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/&/g, '&');
        setCachedAnswer(question, fullAnswer);
        sendEvent('done', {
          metadata: {
            intent,
            resultsCount: results.length,
            platforms: [...new Set(results.map(r => r.metadata.platform))],
          },
        });
      }
    });

    res.end();
  } catch (error) {
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  const platformCounts = {};
  vectorDB.forEach(item => {
    const p = item.metadata.platform;
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });

  res.json({
    totalChunks: vectorDB.length,
    embeddingModel: EMBEDDING_MODEL,
    llmModel: LLM_MODEL,
    platforms: platformCounts,
    cache: getCacheStats(),
  });
});

// Cache endpoints
app.get('/cache/stats', (req, res) => res.json(getCacheStats()));
app.delete('/cache/clear', (req, res) => {
  responseCache.clear();
  res.json({ message: 'Cache cleared' });
});

// Re-index endpoint
app.post('/reindex', async (req, res) => {
  console.log('🔄 Re-indexing triggered...');
  await indexDocs();
  res.json({ message: 'Re-indexing complete', totalChunks: vectorDB.length });
});

// Serve HTML
app.get('/', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(htmlPath)) res.sendFile(htmlPath);
  else res.send('<h1>Moyasar AI Co-Pilot</h1><p>Dynamic RAG Engine</p>');
});

// ============================================================
// Start Server
// ============================================================
app.listen(3001, async () => {
  console.log('🚀 Server running on http://localhost:3001');
  console.log(`📦 Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`🤖 LLM model: ${LLM_MODEL}`);
  console.log('🧠 Engine: Dynamic RAG (LLM Intent Router + Metadata Filtering)');
  console.log('📚 Starting indexing...\n');
  await indexDocs();
});