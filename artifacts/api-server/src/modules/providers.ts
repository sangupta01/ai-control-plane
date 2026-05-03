import { logger } from "../lib/logger.js";

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

const OPENAI_MODEL_MAP: Record<string, string> = {
  "mock-gpt-4": "gpt-4o-mini",
  "mock-gpt-3.5": "gpt-3.5-turbo",
};

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "mock-claude-3-opus": "claude-3-opus-20240229",
  "mock-claude-3-haiku": "claude-3-haiku-20240307",
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

function getProviderMode(): "mock" | "real" | "hybrid" {
  const mode = process.env["PROVIDER_MODE"];
  if (mode === "real" || mode === "hybrid") return mode;
  return "mock";
}

async function callOpenAI(
  realModel: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; prompt_tokens: number; completion_tokens: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: realModel,
      messages,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices[0]?.message?.content ?? "";
  return {
    content,
    prompt_tokens: data.usage.prompt_tokens,
    completion_tokens: data.usage.completion_tokens,
  };
}

async function callAnthropic(
  realModel: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; prompt_tokens: number; completion_tokens: number }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const systemMsg = messages.find(m => m.role === "system")?.content;
  const userMessages = messages.filter(m => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: realModel,
      max_tokens: 512,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMessages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content.filter(c => c.type === "text").map(c => c.text).join("");
  return {
    content,
    prompt_tokens: data.usage.input_tokens,
    completion_tokens: data.usage.output_tokens,
  };
}

async function callMockProvider(
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; prompt_tokens: number; completion_tokens: number }> {
  const cfg = MODEL_CATALOG[model] ?? MODEL_CATALOG["mock-gpt-4"]!;
  await new Promise(resolve => setTimeout(resolve, cfg.avg_latency_ms * (0.8 + Math.random() * 0.4)));
  const content = selectMockResponse(messages);
  return {
    content,
    prompt_tokens: messages.reduce((acc, m) => acc + estimateTokens(m.content), 0),
    completion_tokens: estimateTokens(content),
  };
}

async function callRealProvider(
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; prompt_tokens: number; completion_tokens: number } | null> {
  const openaiModel = OPENAI_MODEL_MAP[model];
  if (openaiModel && process.env["OPENAI_API_KEY"]) {
    return callOpenAI(openaiModel, messages);
  }

  const anthropicModel = ANTHROPIC_MODEL_MAP[model];
  if (anthropicModel && process.env["ANTHROPIC_API_KEY"]) {
    return callAnthropic(anthropicModel, messages);
  }

  return null;
}

export async function callProvider(req: ProviderRequest): Promise<ProviderResponse> {
  const startMs = Date.now();
  const mode = getProviderMode();
  const defaultModel = process.env["DEFAULT_MODEL"];
  const model = (defaultModel && !MODEL_CATALOG[req.model]) ? defaultModel : req.model;

  if (mode === "mock") {
    const result = await callMockProvider(model, req.messages);
    return {
      ...result,
      total_tokens: result.prompt_tokens + result.completion_tokens,
      latency_ms: Date.now() - startMs,
      model,
    };
  }

  try {
    const realResult = await callRealProvider(model, req.messages);
    if (realResult) {
      logger.info({ model, mode, provider: "real" }, "Real provider call succeeded");
      return {
        ...realResult,
        total_tokens: realResult.prompt_tokens + realResult.completion_tokens,
        latency_ms: Date.now() - startMs,
        model,
      };
    }

    if (mode === "real") {
      logger.warn({ model }, "No real provider configured for model; falling back to mock");
    }
  } catch (err) {
    logger.warn({ err, model, mode }, "Real provider call failed; falling back to mock");
  }

  const mockResult = await callMockProvider(model, req.messages);
  return {
    ...mockResult,
    total_tokens: mockResult.prompt_tokens + mockResult.completion_tokens,
    latency_ms: Date.now() - startMs,
    model,
  };
}

export function calculateCost(model: string, prompt_tokens: number, completion_tokens: number): number {
  const cfg = MODEL_CATALOG[model] ?? MODEL_CATALOG["mock-gpt-4"]!;
  return (prompt_tokens / 1000) * cfg.cost_per_1k_input + (completion_tokens / 1000) * cfg.cost_per_1k_output;
}
