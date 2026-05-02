export interface ProviderRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

export interface ProviderResponse {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  model: string;
}

export interface ModelConfig {
  name: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  avg_latency_ms: number;
  quality_tier: number;
}

export const MODEL_CATALOG: Record<string, ModelConfig> = {
  "mock-gpt-4": {
    name: "mock-gpt-4",
    cost_per_1k_input: 0.03,
    cost_per_1k_output: 0.06,
    avg_latency_ms: 800,
    quality_tier: 4,
  },
  "mock-gpt-3.5": {
    name: "mock-gpt-3.5",
    cost_per_1k_input: 0.001,
    cost_per_1k_output: 0.002,
    avg_latency_ms: 300,
    quality_tier: 3,
  },
  "mock-claude-3-opus": {
    name: "mock-claude-3-opus",
    cost_per_1k_input: 0.015,
    cost_per_1k_output: 0.075,
    avg_latency_ms: 1200,
    quality_tier: 5,
  },
  "mock-claude-3-haiku": {
    name: "mock-claude-3-haiku",
    cost_per_1k_input: 0.00025,
    cost_per_1k_output: 0.00125,
    avg_latency_ms: 200,
    quality_tier: 2,
  },
  "mock-gemini-pro": {
    name: "mock-gemini-pro",
    cost_per_1k_input: 0.0005,
    cost_per_1k_output: 0.0015,
    avg_latency_ms: 500,
    quality_tier: 3,
  },
};

const MOCK_RESPONSES = [
  "I understand your request. Based on the context provided, here is a detailed and thoughtful response that addresses the key points raised.",
  "That's an interesting question. Let me break this down systematically: First, we need to consider the core principles at play here. The solution involves several interconnected components.",
  "Great question! The answer depends on several factors. In general terms, the approach I'd recommend involves careful analysis of the requirements followed by iterative refinement.",
  "I can help with that. Here's a comprehensive explanation: The fundamental concept here relates to how systems interact at multiple levels, each requiring its own consideration.",
  "Based on my analysis, the optimal approach would be to start with a solid foundation, then build incrementally while validating at each stage to ensure correctness.",
  "This is a nuanced topic. Let me address the different dimensions: technical feasibility, practical implementation, and long-term maintainability all play important roles.",
  "Absolutely! Here's what I recommend: begin by establishing clear objectives, then work backwards from the desired outcome to define the necessary steps.",
  "The key insight here is that this problem can be decomposed into smaller, more manageable parts. Each sub-problem has a well-known solution that we can leverage.",
];

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

function selectMockResponse(messages: Array<{ role: string; content: string }>): string {
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  const hash = lastMsg.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return MOCK_RESPONSES[hash % MOCK_RESPONSES.length]!;
}

export async function callProvider(req: ProviderRequest): Promise<ProviderResponse> {
  const model = MODEL_CATALOG[req.model] ?? MODEL_CATALOG["mock-gpt-4"]!;
  const startMs = Date.now();

  await new Promise(resolve => setTimeout(resolve, model.avg_latency_ms * (0.8 + Math.random() * 0.4)));

  const content = selectMockResponse(req.messages);
  const prompt_tokens = req.messages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
  const completion_tokens = estimateTokens(content);

  return {
    content,
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
    latency_ms: Date.now() - startMs,
    model: req.model,
  };
}

export function calculateCost(model: string, prompt_tokens: number, completion_tokens: number): number {
  const cfg = MODEL_CATALOG[model] ?? MODEL_CATALOG["mock-gpt-4"]!;
  return (prompt_tokens / 1000) * cfg.cost_per_1k_input + (completion_tokens / 1000) * cfg.cost_per_1k_output;
}
