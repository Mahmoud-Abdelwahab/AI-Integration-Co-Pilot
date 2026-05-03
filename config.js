// ============================================================
// Moyasar AI Co-Pilot — Central Configuration
//
// All deployment-specific values read from environment variables
// with sensible defaults.  Magic numbers live here, not in code.
// ============================================================

'use strict';

// ── Server ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3001;

// ── Ollama / LLM ──────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:14b';

// ── Indexing ──────────────────────────────────────────────────
const TOP_K_RESULTS = parseInt(process.env.TOP_K_RESULTS) || 5;
const MIN_CHUNK_LENGTH = 30;
const MERGE_THRESHOLD = 300;
const INDEXED_EXTENSIONS = ['.md', '.mdx', '.swift', '.kt', '.dart', '.js', '.ts'];
const INDEXED_EXTENSIONS_REGEX = /\.(md|mdx|swift|kt|dart|js|ts)$/;

// ── Retrieval / Search ────────────────────────────────────────
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.35;
const HYBRID_SEMANTIC_WEIGHT = 0.7;
const HYBRID_KEYWORD_WEIGHT = 0.3;

// ── Pipeline Routing ─────────────────────────────────────────
const SIMPLE_QUERY_WORD_LIMIT = 6;   // queries at or below this go through fast mode
const TOP_K_FULL_MODE = 10;          // how many chunks to fetch in full mode
const RERANK_INPUT_SIZE = 6;         // max chunks sent to rerank+compress
const RERANK_OUTPUT_SIZE = 5;        // max chunks kept after rerank fails/fallback
const FAST_PATH_THRESHOLD = 0.85;    // skip rerank+compress when topScore exceeds this
const SKIP_VALIDATION_THRESHOLD = 0.9; // skip answer validation when topScore exceeds this
const RERANK_MIN_SCORE = 0.3;        // prompt threshold inside rerankAndCompress

// ── LLM Call Parameters ───────────────────────────────────────
const LLM_PARAMS = {
  intent: {
    maxTokens: 128,
    temperature: 0.0,
    topP: 0.9,
  },
  expansion: {
    maxTokens: 200,
    temperature: 0.2,
  },
  rerank: {
    maxTokens: 600,
    temperature: 0.0,
  },
  validation: {
    maxTokens: 200,
    temperature: 0.0,
  },
  generation: {
    maxTokens: parseInt(process.env.GENERATION_MAX_TOKENS) || 3072,
    temperature: parseFloat(process.env.GENERATION_TEMPERATURE) || 0.15,
    topP: 0.9,
  },
  default: {
    maxTokens: 2048,
    temperature: 0.1,
  },
};

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL = parseInt(process.env.CACHE_TTL_MINUTES) * 60 * 1000 || 30 * 60 * 1000;
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE) || 500;
const CACHE_EVICTION_RATIO = 0.2;
const EMBEDDING_CACHE_MAX = 2000;

// ── Platform Detection Keywords ───────────────────────────────
// Extend these lists as new SDKs / class names are added.
const UNSUPPORTED_KEYWORDS = ['react native', 'reactnative', 'stripe', 'razorpay', 'paypal'];

const PLATFORM_KEYWORDS = {
  ios: [
    // Apple platform identifiers
    'ios', 'swift', 'swiftui', 'uikit', 'xcode', 'cocoapods', 'iphone', 'ipad', 'xcframework', 'cocoapod',
    // Moyasar iOS SDK class names
    'creditcardview', 'stcpayview', 'stcpayviewmodel', 'applepayservice',
    'moyasarsdk', 'moyasarlanguagemanager', 'paymentrequest', 'paymentsplit',
    'paymentresult', 'paymentconfig', 'apipayment', 'apitoken',
    'moyasarerror', 'stcresultcallback', 'stcstep', 'pkpaymentrequest',
    'pkpaymentauthorizationcontroller', 'uihostingcontroller',
  ],
  flutter: [
    'flutter', 'dart', 'pubspec', 'flutter sdk', 'dartlang', 'widget', 'statefulwidget',
  ],
  android: [
    'android', 'kotlin', 'java', 'gradle', 'jetpack compose', 'android studio', 'aar', 'jetpack',
    'composable', 'viewmodel',
  ],
};

const VALID_PLATFORMS = Object.keys(PLATFORM_KEYWORDS).concat(['general']);

// ── Platform API Contracts (injected into generation prompt) ──
// Each entry describes the exact API for that platform so the LLM
// does NOT rely on training-data knowledge.
// Update these when the SDK changes — no code changes required.
const PLATFORM_API_CONTRACTS = {
  ios: `
CreditCardView (built-in credit card form):
  - Import: import MoyasarSdk
  - Initializer: CreditCardView(request: PaymentRequest) { result: PaymentResult in ... }
  - PaymentResult cases: .completed(ApiPayment), .failed(MoyasarError), .canceled, @unknown default

STCPayView (built-in STC Pay form):
  - Initializer: STCPayView(paymentRequest: PaymentRequest) { result: Result<ApiPayment, MoyasarError> in ... }
  - Callback type: Result<ApiPayment, MoyasarError> — uses .success(ApiPayment) and .failure(MoyasarError)

STCPayViewModel (for CUSTOM STC Pay UI only — NOT for presenting built-in STCPayView):
  - Init: STCPayViewModel(paymentRequest: PaymentRequest, resultCallback: STCResultCallback)
  - Result callback type: Result<ApiPayment, MoyasarError>
  - Published properties: mobileNumber, otp, screenStep (STCStep), isLoading, isValidPhoneNumber, isValidOtp
  - Methods: initiatePayment() async, submitOtp() async

PaymentRequest:
  - Init: try PaymentRequest(apiKey:, amount:, currency:, description:, metadata:, manual:, saveCard:, givenID:, splits:)
  - amount is in the smallest currency unit (e.g. 1000 = 10.00 SAR)

PaymentSplit:
  - Fields: recipientId (String, required), amount (Int, required), reference (String?), description (String?), feeSource (Bool?), refundable (Bool?)
  - The sum of all split amounts MUST equal the total payment amount

ApiPayment status values: .paid, .failed, .authorized

UIKit integration rule:
  - ALWAYS wrap SwiftUI views in UIHostingController — do NOT add SwiftUI views directly as subviews.`,

  flutter: '',   // populate when flutter docs are added
  android: '',   // populate when android docs are added
};

// ── Code Declaration Patterns (for smart chunking) ────────────
// Maps file extension to the declaration-start patterns used to
// split source files into logical chunks.
const CODE_DECLARATION_PATTERNS = [
  'func ', 'public func ', 'private func ', 'internal func ', 'fileprivate func ',
  'class ', 'public class ', 'private class ',
  'struct ', 'public struct ', 'private struct ',
  'enum ', 'public enum ', 'private enum ',
  'extension ', 'init(',
  'fun ', 'data class ', 'object ',
  'Widget ', 'void ',
  'export ', 'const ', 'function ',
];

module.exports = {
  PORT,
  OLLAMA_URL,
  EMBEDDING_MODEL,
  LLM_MODEL,
  TOP_K_RESULTS,
  MIN_CHUNK_LENGTH,
  MERGE_THRESHOLD,
  INDEXED_EXTENSIONS,
  INDEXED_EXTENSIONS_REGEX,
  SIMILARITY_THRESHOLD,
  HYBRID_SEMANTIC_WEIGHT,
  HYBRID_KEYWORD_WEIGHT,
  SIMPLE_QUERY_WORD_LIMIT,
  TOP_K_FULL_MODE,
  RERANK_INPUT_SIZE,
  RERANK_OUTPUT_SIZE,
  FAST_PATH_THRESHOLD,
  SKIP_VALIDATION_THRESHOLD,
  RERANK_MIN_SCORE,
  LLM_PARAMS,
  CACHE_TTL,
  CACHE_MAX_SIZE,
  CACHE_EVICTION_RATIO,
  EMBEDDING_CACHE_MAX,
  UNSUPPORTED_KEYWORDS,
  PLATFORM_KEYWORDS,
  VALID_PLATFORMS,
  PLATFORM_API_CONTRACTS,
  CODE_DECLARATION_PATTERNS,
};
