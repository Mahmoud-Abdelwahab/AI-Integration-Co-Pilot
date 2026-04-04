const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api';

// ============================================================
// Configuration
// ============================================================
const EMBEDDING_MODEL = 'nomic-embed-text'; // Dedicated embedding model (much better than llama3 for embeddings)
const LLM_MODEL = 'qwen2.5:14b';            // LLM for generation (better instruction following + code generation)
const TOP_K_RESULTS = 8;                     // Number of top results to retrieve
const MIN_CHUNK_LENGTH = 30;                 // Minimum chunk length to index
const EMBEDDING_DIMENSION = 768;             // nomic-embed-text dimension

let vectorDB = []; // In-memory vector DB: [{embedding: [...], text: 'chunk', source: 'file', category: 'docs|example|sdk', feature: 'credit-card|apple-pay|stc-pay|general'}]

// ============================================================
// HTTP Helper
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
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve(body); }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(JSON.stringify(data));
    req.end();
  });
}

// ============================================================
// Embedding Generation (using dedicated embedding model)
// ============================================================
async function generateEmbedding(text) {
  try {
    const response = await makeHttpPost(`${OLLAMA_URL}/embeddings`, {
      model: EMBEDDING_MODEL,
      prompt: text
    });
    if (response && response.embedding && Array.isArray(response.embedding)) {
      return response.embedding;
    }
    console.error('Invalid embedding response:', JSON.stringify(response).substring(0, 200));
    return null;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    return null;
  }
}

// ============================================================
// Cosine Similarity
// ============================================================
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// ============================================================
// Feature Classification
// ============================================================
function classifyFeature(text, filePath) {
  const lower = text.toLowerCase();
  const pathLower = filePath.toLowerCase();

  if (pathLower.includes('applepay') || pathLower.includes('apple-pay') || pathLower.includes('apple_pay') ||
      lower.includes('apple pay') || lower.includes('pkpayment') || lower.includes('passkit') ||
      lower.includes('applepayservice') || lower.includes('applepaysource') || lower.includes('merchantidentifier')) {
    return 'apple-pay';
  }
  if (pathLower.includes('stcpay') || pathLower.includes('stc-pay') || pathLower.includes('stc_pay') ||
      lower.includes('stc pay') || lower.includes('stcpayview') || lower.includes('stcpayviewmodel') ||
      lower.includes('stcvalidator') || lower.includes('otp')) {
    return 'stc-pay';
  }
  if (pathLower.includes('creditcard') || pathLower.includes('credit-card') || pathLower.includes('credit_card') ||
      lower.includes('credit card') || lower.includes('creditcardview') || lower.includes('creditcardviewmodel') ||
      lower.includes('cardnumber') || lower.includes('cvc') || lower.includes('expiry') ||
      lower.includes('3ds') || lower.includes('mada')) {
    return 'credit-card';
  }
  if (pathLower.includes('custom') || lower.includes('custom ui') || lower.includes('customview')) {
    return 'custom-ui';
  }
  if (pathLower.includes('install') || lower.includes('cocoapods') || lower.includes('swift package') || lower.includes('pod ')) {
    return 'installation';
  }
  if (pathLower.includes('test') || lower.includes('test card') || lower.includes('sandbox') || lower.includes('pk_test')) {
    return 'testing';
  }
  return 'general';
}

// ============================================================
// Source Category Classification
// ============================================================
function classifySource(filePath) {
  if (filePath.includes('docs/') || filePath.includes('docs\\')) return 'docs';
  if (filePath.includes('examples/') || filePath.includes('examples\\')) return 'example';
  if (filePath.includes('iOS-Sdk-Files/') || filePath.includes('iOS-Sdk-Files\\')) return 'sdk';
  return 'other';
}

// ============================================================
// Platform Detection
// ============================================================
function detectPlatform(text, filePath) {
  const lower = text.toLowerCase();
  const pathLower = filePath.toLowerCase();

  if (pathLower.includes('swift ui example') || pathLower.includes('swiftui')) return 'SwiftUI';
  if (pathLower.includes('uikit example') || pathLower.includes('uikit')) return 'UIKit';
  if (lower.includes('uihostingcontroller') || lower.includes('uiviewcontroller')) return 'UIKit';
  if (lower.includes('struct') && lower.includes(': view')) return 'SwiftUI';
  return 'both';
}

// ============================================================
// Smart Chunking Strategy
// ============================================================
function smartChunk(content, filePath) {
  const chunks = [];
  const ext = path.extname(filePath);

  if (ext === '.swift') {
    // For Swift files: chunk by functions/classes/structs
    const lines = content.split('\n');
    let currentChunk = [];
    let braceCount = 0;
    let chunkStarted = false;

    // Add file header as context
    const fileName = path.basename(filePath);
    const fileHeader = `// File: ${fileName}\n// Source: ${classifySource(filePath)} (${detectPlatform(content, filePath)})\n`;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect function/class/struct/enum starts
      if (!chunkStarted && (
        trimmed.startsWith('func ') || trimmed.startsWith('public func ') || trimmed.startsWith('private func ') ||
        trimmed.startsWith('class ') || trimmed.startsWith('public class ') ||
        trimmed.startsWith('struct ') || trimmed.startsWith('public struct ') ||
        trimmed.startsWith('enum ') || trimmed.startsWith('public enum ') ||
        trimmed.startsWith('extension ') || trimmed.startsWith('public extension ') ||
        trimmed.startsWith('init(') || trimmed.startsWith('public init(') ||
        trimmed.startsWith('/// ') // doc comments
      )) {
        if (currentChunk.length > 0) {
          const chunkText = fileHeader + currentChunk.join('\n');
          if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
            chunks.push(chunkText);
          }
          currentChunk = [];
        }
        chunkStarted = true;
      }

      currentChunk.push(line);

      // Track braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // End of a top-level block
      if (chunkStarted && braceCount <= 0 && currentChunk.length > 2) {
        const chunkText = fileHeader + currentChunk.join('\n');
        if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
          chunks.push(chunkText);
        }
        currentChunk = [];
        chunkStarted = false;
        braceCount = 0;
      }
    }

    // Remaining lines
    if (currentChunk.length > 0) {
      const chunkText = fileHeader + currentChunk.join('\n');
      if (chunkText.trim().length > MIN_CHUNK_LENGTH) {
        chunks.push(chunkText);
      }
    }

    // Also add the FULL file as one chunk for holistic retrieval (if not too large)
    if (content.length < 5000) {
      chunks.push(fileHeader + content);
    }

  } else if (ext === '.md' || ext === '.mdx') {
    // For Markdown: chunk by sections (## headers)
    const fileName = path.basename(filePath);
    const fileHeader = `<!-- File: ${fileName} | Source: docs -->\n`;

    const sections = content.split(/(?=^#{1,3}\s)/m);
    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length > MIN_CHUNK_LENGTH) {
        chunks.push(fileHeader + trimmed);
      }
    }

    // Also add full doc if not too large
    if (content.length < 8000) {
      chunks.push(fileHeader + content);
    }
  }

  return chunks;
}

// ============================================================
// Indexing Function
// ============================================================
async function indexDocs() {
  vectorDB = [];

  const docsPath = path.join(__dirname, 'docs');
  const swiftUIExamplesPath = path.join(__dirname, 'examples', 'Swift UI Example');
  const uikitExamplesPath = path.join(__dirname, 'examples', 'UIKit Example');
  const sdkFilesPath = path.join(__dirname, 'iOS-Sdk-Files');

  const allFiles = [];

  // Collect all files from all directories
  const dirs = [
    { path: docsPath, label: 'docs' },
    { path: swiftUIExamplesPath, label: 'SwiftUI examples' },
    { path: uikitExamplesPath, label: 'UIKit examples' },
    { path: sdkFilesPath, label: 'SDK source' }
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir.path)) {
      const files = fs.readdirSync(dir.path)
        .filter(f => {
          const fullPath = path.join(dir.path, f);
          return fs.statSync(fullPath).isFile() &&
            (f.endsWith('.md') || f.endsWith('.mdx') || f.endsWith('.swift'));
        })
        .map(f => path.join(dir.path, f));
      allFiles.push(...files);
      console.log(`Found ${files.length} files in ${dir.label}`);
    } else {
      console.warn(`Directory not found: ${dir.path}`);
    }
  }

  console.log(`Total files to index: ${allFiles.length}`);

  // First, verify embedding model is available
  console.log(`Testing embedding model: ${EMBEDDING_MODEL}...`);
  const testEmbedding = await generateEmbedding('test');
  if (!testEmbedding) {
    console.error(`\n❌ ERROR: Embedding model '${EMBEDDING_MODEL}' is not available!`);
    console.error(`Please run: ollama pull ${EMBEDDING_MODEL}`);
    console.error(`Then restart the server.\n`);
    return;
  }
  console.log(`✅ Embedding model working. Dimension: ${testEmbedding.length}`);

  let indexed = 0;
  let totalChunks = 0;

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const chunks = smartChunk(content, file);

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        if (embedding) {
          vectorDB.push({
            embedding,
            text: chunk,
            source: file,
            category: classifySource(file),
            feature: classifyFeature(chunk, file),
            platform: detectPlatform(chunk, file),
            fileName: path.basename(file)
          });
          totalChunks++;
        }
      }
      indexed++;
      console.log(`✅ Indexed: ${path.basename(file)} (${chunks.length} chunks)`);
    } catch (error) {
      console.error(`❌ Error indexing ${file}:`, error.message);
    }
  }

  console.log(`\n🎉 Indexing complete!`);
  console.log(`   Files indexed: ${indexed}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Vector DB size: ${vectorDB.length}`);
}

// ============================================================
// Question Classification
// ============================================================
function classifyQuestion(question) {
  const lower = question.toLowerCase();

  let feature = 'general';
  if (lower.includes('apple pay') || lower.includes('applepay') || lower.includes('ابل باي') || lower.includes('pkpayment')) {
    feature = 'apple-pay';
  } else if (lower.includes('stc') || lower.includes('اس تي سي')) {
    feature = 'stc-pay';
  } else if (lower.includes('credit card') || lower.includes('بطاقة') || lower.includes('card') || lower.includes('visa') ||
             lower.includes('mastercard') || lower.includes('mada') || lower.includes('3ds') || lower.includes('كريدت')) {
    feature = 'credit-card';
  } else if (lower.includes('custom') || lower.includes('customize')) {
    feature = 'custom-ui';
  } else if (lower.includes('install') || lower.includes('setup') || lower.includes('cocoapods') || lower.includes('spm') || lower.includes('تثبيت')) {
    feature = 'installation';
  } else if (lower.includes('test') || lower.includes('sandbox') || lower.includes('اختبار')) {
    feature = 'testing';
  }

  let platform = 'both';
  if (lower.includes('swiftui') || lower.includes('swift ui')) {
    platform = 'SwiftUI';
  } else if (lower.includes('uikit') || lower.includes('uiviewcontroller') || lower.includes('storyboard')) {
    platform = 'UIKit';
  }

  let questionType = 'how-to';
  if (lower.includes('why') || lower.includes('ليه') || lower.includes('لماذا')) {
    questionType = 'why';
  } else if (lower.includes('what is') || lower.includes('ايه') || lower.includes('ما هو')) {
    questionType = 'what';
  } else if (lower.includes('error') || lower.includes('issue') || lower.includes('problem') || lower.includes('مشكل')) {
    questionType = 'troubleshoot';
  }

  return { feature, platform, questionType };
}

// ============================================================
// Hybrid Search (Embedding + Keyword Boosting + Feature Matching)
// ============================================================
async function hybridSearch(question, topK = TOP_K_RESULTS) {
  const classification = classifyQuestion(question);
  console.log('Question classification:', classification);

  // Generate embedding for the question
  const questionEmbedding = await generateEmbedding(question);
  if (!questionEmbedding) {
    console.error('Failed to generate question embedding');
    return { results: [], classification };
  }

  // Score each chunk
  const scored = vectorDB.map(item => {
    // 1. Embedding similarity (primary signal)
    let embeddingScore = cosineSimilarity(questionEmbedding, item.embedding);

    // 2. Feature match boost
    let featureBoost = 0;
    if (classification.feature !== 'general' && item.feature === classification.feature) {
      featureBoost = 0.15; // Significant boost for matching feature
    }

    // 3. Source priority boost (examples > docs > sdk)
    let sourceBoost = 0;
    if (item.category === 'example') sourceBoost = 0.05;
    else if (item.category === 'docs') sourceBoost = 0.03;

    // 4. Platform match boost
    let platformBoost = 0;
    if (classification.platform !== 'both' && item.platform === classification.platform) {
      platformBoost = 0.05;
    }

    // 5. Keyword matching boost
    let keywordBoost = 0;
    const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const chunkLower = item.text.toLowerCase();
    for (const word of questionWords) {
      if (chunkLower.includes(word)) {
        keywordBoost += 0.02;
      }
    }
    keywordBoost = Math.min(keywordBoost, 0.1); // Cap keyword boost

    const totalScore = embeddingScore + featureBoost + sourceBoost + platformBoost + keywordBoost;

    return { ...item, embeddingScore, totalScore };
  });

  // Sort by total score
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Deduplicate and filter: avoid returning chunks from the same file that are too similar
  // Also filter out custom-ui chunks when user is asking about basic integration
  const seen = new Set();
  const results = [];
  const isBasicQuestion = !question.toLowerCase().includes('custom');
  
  for (const item of scored) {
    const key = item.text.substring(0, 100);
    
    // Skip custom UI chunks for basic integration questions
    if (isBasicQuestion && item.feature === 'custom-ui') continue;
    // Skip CustomViewModel chunks for basic credit card questions
    if (isBasicQuestion && classification.feature === 'credit-card' && 
        item.fileName && (item.fileName.includes('Custom') || item.fileName.includes('custom'))) continue;
    
    if (!seen.has(key) && results.length < topK) {
      seen.add(key);
      results.push(item);
    }
  }

  console.log(`Top ${results.length} results:`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.feature}] [${r.category}] ${r.fileName} (score: ${r.totalScore.toFixed(4)})`);
  });

  return { results, classification };
}

// ============================================================
// LLM Call
// ============================================================
async function callLLM(prompt) {
  try {
    console.log('Calling LLM with prompt length:', prompt.length);
    const response = await makeHttpPost(`${OLLAMA_URL}/generate`, {
      model: LLM_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,      // Low temperature for factual answers
        top_p: 0.9,
        num_predict: 2048,     // Allow longer responses
      }
    });

    if (response && typeof response === 'object') {
      let answer = response.response || response.text || response.content || JSON.stringify(response);
      // Clean HTML entities
      answer = answer.replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&amp;/g, '&')
                     .replace(/&quot;/g, '"')
                     .replace(/&#39;/g, "'")
                     .replace(/&nbsp;/g, ' ');
      return answer;
    }
    return response || 'No response from LLM';
  } catch (error) {
    console.error('Error calling LLM:', error);
    return 'I am sorry, I cannot answer this question at the moment. Please make sure Ollama is running.';
  }
}

// ============================================================
// System Prompt Builder
// ============================================================
function buildPrompt(question, relevantDocs, classification) {
  const featureLabel = classification.feature.replace('-', ' ').toUpperCase();
  const platformLabel = classification.platform;

  return `You are a senior iOS SDK expert specialized in Moyasar payment SDK.

ANSWER STRICTLY based on the provided context. DO NOT GUESS. DO NOT HALLUCINATE.

Question classified as: Feature: ${featureLabel} | Platform: ${platformLabel} | Type: ${classification.questionType}

-----------------------------------
CRITICAL RULES
-----------------------------------

1. DO NOT GUESS OR HALLUCINATE. If the answer is not in the context → Say: "This is not covered in the current Moyasar SDK docs/examples."

2. DO NOT MIX different integration approaches:
   - "Basic Integration" = uses the SDK's built-in CreditCardView (recommended for most developers)
   - "Custom UI" = uses PaymentService directly with your own UI (advanced)
   - Unless the user explicitly asks for "custom UI", ALWAYS show the Basic Integration approach.

3. PRIORITIZE SOURCES: Examples (real usage) > Docs > SDK source code

4. For BASIC Credit Card integration in SwiftUI (DEFAULT approach):
   Step 1: Install SDK via CocoaPods or Swift Package Manager
   Step 2: import MoyasarSdk
   Step 3: Create PaymentRequest using try PaymentRequest(apiKey:amount:currency:description:)
   Step 4: Add CreditCardView(request: paymentRequest, callback: handlePaymentResult) to your SwiftUI view
   Step 5: Handle PaymentResult in callback: .completed(payment), .failed(error), .canceled
   Step 6: Check payment.status (.paid, .failed, etc.)
   
   IMPORTANT: CreditCardView is a ready-made SwiftUI view from the SDK. The developer does NOT need to build their own card form.

5. For BASIC Credit Card integration in UIKit:
   - Wrap CreditCardView in UIHostingController
   - Same PaymentRequest and callback pattern

6. For Apple Pay: Always include full flow (config → button → sheet → token → ApplePayService.authorizePayment → result)

7. ALWAYS show complete, working code examples from the context.

8. ALWAYS mention source reference at the end (e.g., "Source: SwiftUI example - ContentView.swift")

9. Use \`\`\`swift for code blocks.

-----------------------------------
CONTEXT
-----------------------------------

${relevantDocs}

-----------------------------------
QUESTION: ${question}
-----------------------------------

Provide a clear, step-by-step answer with working Swift code. Use ONLY information from the context above.`;
}

// ============================================================
// API Endpoint
// ============================================================
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  console.log('\n========================================');
  console.log('Received question:', question);
  console.log('========================================');

  if (vectorDB.length === 0) {
    return res.json({ answer: 'Database not indexed yet. Please wait for indexing to complete, or check that the embedding model is available (run: ollama pull nomic-embed-text).' });
  }

  try {
    // Hybrid search
    const { results, classification } = await hybridSearch(question);

    if (results.length === 0) {
      return res.json({ answer: 'No relevant documentation found for your question.' });
    }

    // Build context from results with source labels
    const relevantDocs = results.map((r, i) => {
      const sourceLabel = `[Source: ${r.category} | ${r.fileName} | Feature: ${r.feature} | Platform: ${r.platform}]`;
      return `--- Context ${i + 1} ${sourceLabel} ---\n${r.text}`;
    }).join('\n\n');

    // Build and send prompt
    const prompt = buildPrompt(question, relevantDocs, classification);
    console.log('Prompt length:', prompt.length);

    const answer = await callLLM(prompt);
    console.log('Answer preview:', answer.substring(0, 150) + '...');

    res.json({ answer });
  } catch (error) {
    console.error('Error in /ask:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Debug endpoint to check indexing status
// ============================================================
app.get('/status', (req, res) => {
  const featureCounts = {};
  const categoryCounts = {};
  vectorDB.forEach(item => {
    featureCounts[item.feature] = (featureCounts[item.feature] || 0) + 1;
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  res.json({
    totalChunks: vectorDB.length,
    embeddingModel: EMBEDDING_MODEL,
    llmModel: LLM_MODEL,
    featureCounts,
    categoryCounts
  });
});

// ============================================================
// Serve HTML
// ============================================================
app.get('/', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.send('<h1>Moyasar AI Co-Pilot</h1><p>HTML file not found</p>');
  }
});

// ============================================================
// Start Server
// ============================================================
app.listen(3000, async () => {
  console.log('🚀 Server running on http://localhost:3000');
  console.log(`📦 Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`🤖 LLM model: ${LLM_MODEL}`);
  console.log('📚 Starting indexing...\n');
  await indexDocs();
});
