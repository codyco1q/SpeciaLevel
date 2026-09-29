import { z } from "zod";

export const AI_MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "custom_openai",
] as const;

export type AiModelProviderType = (typeof AI_MODEL_PROVIDERS)[number];

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
