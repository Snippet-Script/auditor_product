// Token estimation using gpt-tokenizer (tiktoken-like). Fallback to heuristic if lib issues.
import { encode } from 'gpt-tokenizer';

export function estimateTokens(text = '') {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    const cleaned = text.trim();
    if (!cleaned) return 0;
    return Math.max(1, Math.round(cleaned.length / 4));
  }
}

// Pricing constants (example) USD per 1K tokens
export const PRICE_INPUT_PER_1K = 0.00015; // adjust to real model pricing
export const PRICE_OUTPUT_PER_1K = 0.00060;

export function costForTokens(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1000) * PRICE_INPUT_PER_1K;
  const outputCost = (outputTokens / 1000) * PRICE_OUTPUT_PER_1K;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
