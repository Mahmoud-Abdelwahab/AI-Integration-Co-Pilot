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
const LLM_MODEL = 'qwen2.5:14b';
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
// MDX CLEANER — Strip JSX/MDX syntax before chunking
// ============================================================

/**
 * Converts MDX content to clean Markdown that the chunker can handle.
 *
 * What it removes/unwraps:
 * - import statements (import Tabs from '...')
 * - JSX component tags: <Tabs>, </Tabs>, <TabItem ...>, </TabItem>
 * - Frontmatter (--- ... ---)
 * - HTML-style JSX attributes tags like <span className=...>
 *
 * What it KEEPS (critical):
 * - All markdown headers (# ## ###)
 * - All fenced code blocks (``` ... ```)
 * - All markdown tables
 * - All text content inside TabItem blocks
 */
function cleanMdxContent(content) {
  let cleaned = content;

  // 1. Remove frontmatter (--- ... ---)
  cleaned = cleaned.replace(/^---[\s\S]*?---\n/m, '');

  // 2. Remove import statements
  cleaned = cleaned.replace(/^import\s+.*from\s+['"].*['"]\s*;?\s*\n/gm, '');

  // 3. Remove JSX span/badge tags (single-line JSX elements)
  cleaned = cleaned.replace(/<span[^>]*>.*?<\/span>\s*\n?/g, '');

  // 4. Unwrap <TabItem> blocks — extract the label as a heading + keep content
  // Handles both self-contained and multi-line TabItem blocks
  cleaned = cleaned.replace(
    /<TabItem\s+[^>]*label="([^"]+)"[^>]*>([\s\S]*?)<\/TabItem>/g,
    (match, label, innerContent) => {
      // Add label as bold marker so context is preserved, then the content
      return `\n**${label}:**\n${innerContent.trim()}\n`;
    }
  );

  // 5. Remove remaining <Tabs> and </Tabs> wrapper tags
  cleaned = cleaned.replace(/<\/?Tabs[^>]*>\s*\n?/g, '');

  // 6. Remove any remaining JSX-style opening/closing tags (catch-all)
  // But do NOT remove markdown code block content
  cleaned = cleaned.replace(/^<[A-Z][^>]*\/>\s*\n?/gm, '');  // self-closing JSX
  cleaned = cleaned.replace(/^<\/[A-Z][^>]*>\s*\n?/gm, '');  // closing JSX tags
  cleaned = cleaned.replace(/^<[A-Z][^>]*>\s*\n?/gm, '');    // opening JSX tags

  // 7. Collapse excessive blank lines (max 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

// ============================================================
// 1. DYNAMIC INDEXING — No Hardcoded Platforms
// ============================================================

function extractPlatformFromPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/docs\/([^/]+)-docs\//);
  if (match) return match[1].toLowerCase();
  const match2 = normalized.match(/docs\/([^/]+)\//);
  if (match2 && !match2[1].startsWith('.')) return match2[1].toLowerCase();
  return 'general';
}

function smartChunk(content, filePath) {
  const chunks = [];
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);
  const platform = extractPlatformFromPath(filePath);
  const fileHeader = `<!-- Source: ${fileName} | Platform: ${platform} -->\n`;

  if (ext === '.md' || ext === '.mdx') {
    // ✅ FIX: Clean MDX/JSX syntax BEFORE chunking
    const cleanedContent = (ext === '.mdx') ? cleanMdxContent(content) : content;

    // Split by markdown headers (h1-h3)
    const sections = cleanedContent.split(/(?=^#{1,3}\s)/m);

    // ✅ FIX: Merge small chunks with the next chunk to prevent orphan headers
    const MERGE_THRESHOLD = 300; // chars
    const filteredSections = [];
    for (let i = 0; i < sections.length; i++) {
      const trimmed = sections[i].trim();
      if (trimmed.length <= MIN_CHUNK_LENGTH) continue;

      // If this section is too small, merge with the next section
      if (trimmed.length < MERGE_THRESHOLD && i + 1 < sections.length) {
        const nextTrimmed = sections[i + 1].trim();
        if (nextTrimmed.length > MIN_CHUNK_LENGTH) {
          filteredSections.push(trimmed + '\n\n' + nextTrimmed);
          i++; // skip next section since we merged it
          continue;
        }
      }
      filteredSections.push(trimmed);
    }

    for (const section of filteredSections) {
      if (section.length > MIN_CHUNK_LENGTH) {
        chunks.push({ text: fileHeader + section, platform });
      }
    }

  } else if (['.swift', '.kt', '.dart', '.js', '.ts'].includes(ext)) {
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
  }

  return chunks;
}

async function indexDocs() {
  vectorDB = [];
  const docsRoot = path.join(__dirname, 'docs');

  if (!fs.existsSync(docsRoot)) {
    console.error('❌ docs/ directory not found!');
    return;
  }

  const platformDirs = fs.readdirSync(docsRoot)
    .filter(d => {
      const fullPath = path.join(docsRoot, d);
      return fs.statSync(fullPath).isDirectory() && !d.startsWith('.');
    })
    .map(d => ({ path: path.join(docsRoot, d), name: d }));

  console.log(`📂 Discovered ${platformDirs.length} platform folder(s): ${platformDirs.map(d => d.name).join(', ')}`);

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
// 2. LLM INTENT ROUTER
// ============================================================

function quickPlatformDetect(query) {
  const lower = query.toLowerCase();

  const unsupportedKeywords = ['react native', 'reactnative', 'stripe', 'razorpay', 'paypal'];
  if (unsupportedKeywords.some(kw => lower.includes(kw))) {
    return 'general';
  }

  const platformKeywords = {
    ios: ['ios', 'swift', 'swiftui', 'uikit', 'xcode', 'cocoapods', 'iphone', 'ipad', 'xcframework', 'cocoapod'],
    flutter: ['flutter', 'dart', 'pubspec', 'flutter sdk', 'dartlang'],
    android: ['android', 'kotlin', 'java', 'gradle', 'jetpack compose', 'android studio', 'aar', 'jetpack']
  };

  for (const [platform, keywords] of Object.entries(platformKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return platform;
    }
  }
  return 'general';
}

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
- "general" if the query is platform-agnostic

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

    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const platform = (parsed.platform || 'general').toLowerCase();

      const validPlatforms = ['ios', 'flutter', 'android', 'general'];
      let detectedPlatform = validPlatforms.includes(platform) ? platform : 'general';

      const keywordResult = quickPlatformDetect(userQuery);
      if (keywordResult === 'general' && detectedPlatform !== 'general') {
        console.log(`🧠 LLM detected "${detectedPlatform}" but keyword check suggests unsupported platform — overriding to 'general'`);
        detectedPlatform = 'general';
      }

      console.log(`🧠 LLM Intent Router detected platform: "${detectedPlatform}"`);
      return { platform: detectedPlatform };
    }
  } catch (error) {
    console.warn('⚠️ LLM Intent Router failed, falling back to keyword detection:', error.message);
  }

  const keywordPlatform = quickPlatformDetect(userQuery);
  if (keywordPlatform !== 'general') {
    console.log(`🔍 Keyword fallback detected platform: "${keywordPlatform}"`);
    return { platform: keywordPlatform };
  }

  return { platform: 'general' };
}

// ============================================================
// 3. FILTERED RETRIEVAL
// ============================================================

async function searchVectorDB(userQuery, intent, topK = TOP_K_RESULTS) {
  const questionEmbedding = await generateEmbedding(userQuery);
  if (!questionEmbedding) {
    console.error('Failed to generate question embedding');
    return [];
  }

  const targetPlatform = intent.platform;

  if (targetPlatform === 'general') {
    console.log(`⛔ Platform is 'general' — asking user for clarification.`);
    return null;
  }

  const candidates = vectorDB.filter(item => item.metadata.platform === targetPlatform);

  if (candidates.length === 0) {
    console.log(`⚠️ No chunks found for platform "${targetPlatform}".`);
    return [];
  }

  const scored = candidates.map(item => {
    const score = cosineSimilarity(questionEmbedding, item.embedding);
    return { ...item, score };
  });

  const thresholdFiltered = scored.filter(item => item.score >= 0.35);

  if (thresholdFiltered.length === 0) {
    console.log(`⚠️ No chunks meet the similarity threshold (0.35). Highest score: ${scored[0]?.score.toFixed(4) || 'N/A'}`);
    return [];
  }

  thresholdFiltered.sort((a, b) => b.score - a.score);
  const results = thresholdFiltered.slice(0, topK);

  console.log(`📊 Retrieved ${results.length} results (platform filter: "${targetPlatform}", threshold: 0.35)`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.metadata.platform}] ${r.fileName} (score: ${r.score.toFixed(4)})`);
  });

  return results;
}

// ============================================================
// 4. DYNAMIC GENERATION
// ============================================================

function buildGenerationPrompt(userQuery, retrievedChunks, intent) {
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEGATIVE CONSTRAINTS (CRITICAL — NO EXCEPTIONS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. If the retrieved documentation chunks do NOT contain the specific method, class, or property name that the user is asking about, you MUST explicitly state: "The retrieved documentation does not contain information about [specific thing requested]."
2. DO NOT guess or invent API names, method signatures, or code patterns that are not present in the retrieved context.
3. NEVER use your internal training data to generate code syntax. Only use code that appears in the retrieved documentation.
4. NEVER mix terminology from different platforms (e.g., do not combine iOS class names with Flutter concepts).
5. If you cannot answer the question using ONLY the retrieved chunks, say so clearly instead of providing a potentially incorrect answer.
6. DO NOT use code patterns like "paymentCompletionHandler", ".success/.failure", or "CreditCardView(paymentRequest:)" — these are NOT in the documentation. The correct pattern is: CreditCardView(request: callback:) with PaymentResult cases: .completed, .failed, .canceled, .saveOnlyToken.
7. For UIKit integration, you MUST use UIHostingController to wrap the SwiftUI CreditCardView — do NOT add it directly as a subview.

${platformInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DYNAMIC TERMINOLOGY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST answer using ONLY the terminology, class names, method names, and naming conventions found in the retrieved documentation chunks below.

- If the docs use "PaymentConfig", use "PaymentConfig".
- If the docs use "PaymentRequest", use "PaymentRequest".
- If the docs use "MoyasarSdk", use "MoyasarSdk".
- NEVER substitute terminology from other platforms.
- NEVER invent API names, class names, or method names not present in the context.
- Adapt your answer to match the exact naming conventions used in the retrieved chunks.
- The CreditCardView initializer is: CreditCardView(request: createPaymentRequest()) { result in handlePaymentResult(result) }
- PaymentResult cases are: .completed(ApiPayment), .failed(MoyasarError), .canceled, .saveOnlyToken(ApiToken)

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
// MAIN PIPELINE
// ============================================================
async function answerQuestion(question) {
  console.log(`\n⚡ Dynamic RAG Pipeline starting...`);
  console.log(`📝 Question: ${question}`);

  const intent = await analyzeIntent(question);
  const retrievedChunks = await searchVectorDB(question, intent);

  if (retrievedChunks === null) {
    return {
      answer: `I need to know which platform you're asking about to provide an accurate answer. Please specify one of: **iOS** (Swift/SwiftUI), **Flutter** (Dart), or **Android** (Kotlin/Java).`,
      metadata: { intent, needsClarification: true },
    };
  }

  if (retrievedChunks.length === 0) {
    return {
      answer: 'No relevant documentation found for your question. The retrieved documentation does not contain information matching your query with sufficient confidence. Please try rephrasing your question or check if the topic is covered in the SDK documentation.',
      metadata: { intent, resultsCount: 0 },
    };
  }

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
const CACHE_TTL = 30 * 60 * 1000;
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

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  console.log('\n========================================');
  console.log(`📨 Question: ${question}`);
  console.log('========================================');

  if (vectorDB.length === 0) {
    return res.json({ answer: 'Database not indexed yet. Please wait for indexing to complete.' });
  }

  try {
    const cached = getCachedAnswer(question);
    if (cached) {
      console.log(`⚡ Cache HIT! (${cached.hitCount} hits)`);
      return res.json({ answer: cached.answer, metadata: { cached: true, hitCount: cached.hitCount } });
    }

    console.log('🔄 Cache MISS - processing...');
    const result = await answerQuestion(question);

    if (!result.metadata?.needsClarification) {
      setCachedAnswer(question, result.answer);
    }

    res.json({ answer: result.answer, metadata: { ...result.metadata, cached: false } });
  } catch (error) {
    console.error('❌ Error in /ask:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    const cached = getCachedAnswer(question);
    if (cached) {
      sendEvent('cached', { hitCount: cached.hitCount });
      sendEvent('chunk', { text: cached.answer });
      sendEvent('done', { metadata: { cached: true } });
      return res.end();
    }

    sendEvent('status', { message: '🔍 Analyzing intent...' });

    const intent = await analyzeIntent(question);

    sendEvent('status', { message: '📚 Searching documentation...' });

    const results = await searchVectorDB(question, intent);

    if (results === null) {
      sendEvent('chunk', { text: 'Please specify your platform: iOS (Swift/SwiftUI), Flutter (Dart), or Android (Kotlin/Java).' });
      sendEvent('done', {});
      return res.end();
    }

    if (results.length === 0) {
      sendEvent('chunk', { text: 'No relevant documentation found. Please try rephrasing your question.' });
      sendEvent('done', {});
      return res.end();
    }

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

app.get('/cache/stats', (req, res) => res.json(getCacheStats()));
app.delete('/cache/clear', (req, res) => {
  responseCache.clear();
  res.json({ message: 'Cache cleared' });
});

app.post('/reindex', async (req, res) => {
  console.log('🔄 Re-indexing triggered...');
  await indexDocs();
  res.json({ message: 'Re-indexing complete', totalChunks: vectorDB.length });
});

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