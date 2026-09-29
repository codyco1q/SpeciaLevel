import { z } from "zod";

export const AI_MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "custom_openai",
] as const;

export type AiModelProviderType = (typeof AI_MODEL_PROVIDERS)[number];

export interface ProviderCatalogItem {
  id: AiModelProviderType;
  name: string;
  description: string;
  defaultModels: string[];
  requiresBaseUrl: boolean;
  docUrl: string;
}

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Connect GPT-4o, GPT-4o-mini, o1, and embeddings with your OpenAI API Key.",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "gpt-4-turbo"],
    requiresBaseUrl: false,
    docUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet, Claude 3.5 Haiku, and Opus models for high-reasoning tasks.",
    defaultModels: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    requiresBaseUrl: false,
    docUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 1.5 Pro, 1.5 Flash, and multimodal models via Google AI Studio.",
    defaultModels: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    requiresBaseUrl: false,
    docUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified gateway to hundreds of open & proprietary models with a single key.",
    defaultModels: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
      "google/gemini-pro-1.5",
    ],
    requiresBaseUrl: false,
    docUrl: "https://openrouter.ai/keys",
  },
  {
    id: "custom_openai",
    name: "Custom OpenAI-Compatible",
    description: "Self-hosted vLLM, Ollama, LocalAI, LM Studio, or custom proxy gateways.",
    defaultModels: ["llama3", "mistral", "qwen2.5", "default-model"],
    requiresBaseUrl: true,
    docUrl: "https://ollama.ai",
  },
];

export const MCP_TRANSPORT_TYPES = ["sse", "http_stream", "stdio"] as const;
export type McpTransportType = (typeof MCP_TRANSPORT_TYPES)[number];

export const DEFAULT_PROVIDER_MODELS: Record<AiModelProviderType, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "gpt-4-turbo"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  gemini: [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
  ],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat",
    "google/gemini-pro-1.5",
  ],
  custom_openai: ["default-model", "llama3", "mistral", "qwen2.5"],
};

export const saveAiProviderSchema = z
  .object({
    id: z.string().uuid().optional(),
    provider: z.enum(AI_MODEL_PROVIDERS, {
      message: "Please select a valid provider.",
    }),
    apiKey: z.string().trim().min(1, "API Key is required."),
    defaultModel: z.string().trim().min(1, "Default model is required."),
    baseUrl: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.provider === "custom_openai") {
        return !!data.baseUrl && data.baseUrl.length > 0;
      }
      return true;
    },
    {
      message: "Base URL is required for Custom OpenAI-compatible endpoints.",
      path: ["baseUrl"],
    }
  );

export type SaveAiProviderInput = z.infer<typeof saveAiProviderSchema>;

export const testAiProviderSchema = z.object({
  provider: z.enum(AI_MODEL_PROVIDERS),
  apiKey: z.string().trim().min(1, "API Key is required."),
  baseUrl: z.string().trim().optional().nullable(),
  defaultModel: z.string().trim().optional().nullable(),
});

export type TestAiProviderInput = z.infer<typeof testAiProviderSchema>;

export const deleteAiProviderSchema = z.object({
  id: z.string().uuid("Invalid provider ID."),
});

export const saveMcpServerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Server name is required.").max(100, "Name must be under 100 characters."),
  transportType: z.enum(MCP_TRANSPORT_TYPES, {
    message: "Invalid transport type.",
  }),
  endpointUrl: z.string().trim().min(1, "Endpoint URL is required."),
  headers: z.record(z.string(), z.string()).optional().default({}),
  isActive: z.boolean().default(true),
});

export type SaveMcpServerInput = z.infer<typeof saveMcpServerSchema>;

export const testMcpServerSchema = z.object({
  endpointUrl: z.string().trim().min(1, "Endpoint URL is required."),
  transportType: z.enum(MCP_TRANSPORT_TYPES),
  headers: z.record(z.string(), z.string()).optional().default({}),
});

export type TestMcpServerInput = z.infer<typeof testMcpServerSchema>;

export const toggleMcpServerSchema = z.object({
  id: z.string().uuid("Invalid server ID."),
  isActive: z.boolean(),
});

export const deleteMcpServerSchema = z.object({
  id: z.string().uuid("Invalid server ID."),
});
