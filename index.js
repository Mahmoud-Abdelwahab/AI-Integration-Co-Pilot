const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api';

let vectorDB = []; // In-memory vector DB: [{embedding: [...], text: 'chunk', source: 'file'}]

// Function to make HTTP POST request
function makeHttpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Function to generate embeddings using Ollama
async function generateEmbedding(text) {
  try {
    const response = await makeHttpPost(`${OLLAMA_URL}/embeddings`, {
      model: 'llama3',
      prompt: text
    });
    return response.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return new Array(4096).fill(0); // Default embedding size
  }
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

// Indexing function
async function indexDocs() {
  vectorDB = []; // Reset DB

  const docsPath = path.join(__dirname, 'docs');
  const examplesPath = path.join(__dirname, 'examples');

  const files = [
    ...fs.readdirSync(docsPath).map(f => path.join(docsPath, f)),
    ...fs.readdirSync(examplesPath).map(f => path.join(examplesPath, f))
  ];

  let indexed = 0;
  for (const file of files) {
    if (fs.statSync(file).isFile() && (file.endsWith('.md') || file.endsWith('.swift'))) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const chunks = content.split('\n\n').filter(c => c.trim().length > 50);

        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk);
          vectorDB.push({ embedding, text: chunk, source: file });
        }
        indexed++;
        console.log(`Indexed ${file}`);
      } catch (error) {
        console.error(`Error indexing ${file}:`, error);
      }
    }
  }

  console.log(`Indexing complete. Total files indexed: ${indexed}. Total chunks: ${vectorDB.length}`);
}

// Function to call Ollama LLM
async function callLLM(prompt) {
  try {
    console.log('Calling LLM with prompt length:', prompt.length);
    const response = await makeHttpPost(`${OLLAMA_URL}/generate`, {
      model: 'llama3',
      prompt: prompt,
      stream: false
    });
    console.log('Raw LLM response:', response);
    if (response && typeof response === 'object') {
      let answer = response.response || response.text || response.content || JSON.stringify(response);
      // Clean HTML entities from the AI response
      answer = answer.replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&amp;/g, '&')
                     .replace(/&quot;/g, '"')
                     .replace(/&#39;/g, "'")
                     .replace(/&nbsp;/g, ' ')
                     .replace(/&apos;/g, "'")
                     .replace(/&lsquo;/g, "'")
                     .replace(/&rsquo;/g, "'")
                     .replace(/&ldquo;/g, '"')
                     .replace(/&rdquo;/g, '"');
      return answer;
    }
    return response || 'No response from LLM';
  } catch (error) {
    console.error('Error calling LLM:', error);
    return 'I am sorry, I cannot answer this question at the moment.';
  }
}

// Simple text similarity function with Arabic support and keyword boosting
function textSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  // Keyword boosting for payment methods
  const keywords = ['apple pay', 'ابل باي', 'applepay', 'stc pay', 'stc', 'credit card', 'card', 'بطاقة ائتمان'];
  let score = 0;

  for (const keyword of keywords) {
    const hasKeyword1 = text1.toLowerCase().includes(keyword);
    const hasKeyword2 = text2.toLowerCase().includes(keyword);
    if (hasKeyword1 && hasKeyword2) {
      score += 0.5; // Boost score for matching keywords
    }
  }

  const intersection = words1.filter(word => words2.includes(word));
  const union = new Set([...words1, ...words2]);
  const jaccardScore = intersection.length / union.size;

  return score + jaccardScore; // Combine keyword boost with Jaccard similarity
}

// API endpoint for querying
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  console.log('Received question:', question);

  if (vectorDB.length === 0) {
    return res.json({ answer: 'Database not indexed yet. Please wait for indexing to complete.' });
  }

  try {
    console.log('VectorDB length:', vectorDB.length);

    // Simple text-based similarity search (no embeddings needed)
    const similarities = vectorDB.map(item => ({
      ...item,
      score: textSimilarity(question, item.text)
    }));

    similarities.sort((a, b) => b.score - a.score);
    const topResults = similarities.slice(0, 5);
    console.log('Top results count:', topResults.length);

    const relevantDocs = topResults.map(r => r.text).join('\n\n');

    const prompt = `
You are a senior payment SDK engineer specializing in Moyasar iOS SDK integration.

Your task is to provide clear, accurate, and well-formatted answers using ONLY the provided documentation.

CRITICAL: The user is asking about APPLE PAY integration, NOT STC Pay. Make sure to provide Apple Pay specific information and code examples.

FORMATTING REQUIREMENTS:
- Use **bold** for emphasis and headings
- Use *italics* for variable names and important terms
- Use numbered steps for multi-step processes
- Wrap all code in proper code blocks with language specification (\`\`\`swift for Swift code)
- Keep code examples simple and functional
- Use proper line breaks for readability

CONTENT GUIDELINES:
- Only answer using the provided docs - if information is not in docs, say "I don't have information about that in the current documentation"
- Provide working code examples when relevant
- Reference specific files or sections when possible
- Keep answers concise but complete

SDK SPECIFIC INFORMATION:
- Payment methods: Credit Card (Visa, Mastercard, American Express, Mada), STC Pay, Apple Pay
- Examples are in two folders: UIKitDemo (UIViewController-based) and SwiftUiDemo (SwiftUI-based)
- Apple Pay integration uses PKPaymentButton for UIKit and PaymentButton for SwiftUI
- PaymentRequest is created by client and passed to the view, then handles result callbacks
- Apple Pay uses tokenization: encrypted data from PassKit, processed securely by Moyasar

APPLE PAY SPECIFIC:
- SwiftUI example: ApplePayButton.swift, ApplePayPaymentHandler.swift
  Code: ApplePayButton(action: UIAction(handler: applePayPressed)).frame(height: 50).cornerRadius(10).padding(.horizontal, 15)
  Handler: let applePayHandler = ApplePayPaymentHandler(paymentRequest: createPaymentRequest())
  func applePayPressed(action: UIAction) { applePayHandler.present() }

- UIKit example: ApplePayPaymentHandler.swift, PaymentViewController.swift  
  Code: let applePayButton = PKPaymentButton(paymentButtonType: .checkout, paymentButtonStyle: .black)
  applePayButton.addAction(UIAction(handler: handleApplePayPressed), for: .touchUpInside)

IMPORTANT: When the user asks about "ابل باي" or "Apple Pay", focus ONLY on Apple Pay examples and ignore STC Pay or other payment methods.

Docs:
${relevantDocs}

Question: ${question}

Provide Apple Pay specific examples from the SwiftUiDemo folder when the user mentions SwiftUI.

Format your response with:
1. Clear steps when explaining processes
2. Properly formatted code blocks
3. Specific file references
4. Testing information when applicable`;

    console.log('Prompt length:', prompt.length);
    const answer = await callLLM(prompt);
    console.log('Final answer:', answer.substring(0, 100) + '...');

    res.json({ answer });
  } catch (error) {
    console.error('Error in /ask:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  console.log('Looking for HTML file at:', htmlPath);
  console.log('File exists:', fs.existsSync(htmlPath));
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.send('<h1>Moyasar AI Co-Pilot</h1><p>HTML file not found at: ' + htmlPath + '</p>');
  }
});

app.listen(3000, async () => {
  console.log('Server running on http://localhost:3000');
  await indexDocs();
});
