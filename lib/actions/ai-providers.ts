"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  saveAiProviderSchema,
  testAiProviderSchema,
  deleteAiProviderSchema,
  saveMcpServerSchema,
  testMcpServerSchema,
  toggleMcpServerSchema,
  deleteMcpServerSchema,
  type SaveAiProviderInput,
  type TestAiProviderInput,
  type SaveMcpServerInput,
  type TestMcpServerInput,
  type AiModelProviderType,
} from "@/lib/validations/ai-providers";
import type {
  AiModelProvider,
  AiMcpServer,
  McpToolDefinition,
} from "@/types/database";

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

function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export type ActionResponse<T = any> =
  | { status: "success"; data: T }
  | { status: "error"; error: string };

// ============================================================
// 1. AI Model Providers Actions
// ============================================================

export async function getAiProviders(): Promise<AiModelProvider[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return [];
  if (!hasPermission("ai.view", userContext.permissions)) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ai_model_providers")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as AiModelProvider[]).map((p) => ({
    ...p,
    api_key_encrypted: maskKey(p.api_key_encrypted),
  }));
}

export async function saveAiProvider(
  input: SaveAiProviderInput
): Promise<ActionResponse<AiModelProvider>> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.manage", userContext.permissions)) {
    return { status: "error", error: "Permission denied (ai.manage required)" };
  }

  const parsed = saveAiProviderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid provider data",
    };
  }

  const orgId = userContext.organization.id;
  const { provider, apiKey, defaultModel, baseUrl, isActive } = parsed.data;
  const supabase = await createServerClient();

  let finalApiKey = apiKey;
  if (apiKey.includes("•••")) {
    const { data: existing } = await supabase
      .from("ai_model_providers")
      .select("api_key_encrypted")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .maybeSingle();

    if (existing?.api_key_encrypted) {
      finalApiKey = existing.api_key_encrypted;
    }
  }

  const { data, error } = await supabase
    .from("ai_model_providers")
    .upsert(
      {
        organization_id: orgId,
        provider,
        api_key_encrypted: finalApiKey,
        base_url: baseUrl || null,
        default_model: defaultModel,
        is_active: isActive ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" }
    )
    .select()
    .single();

  if (error || !data) {
    return {
      status: "error",
      error: error?.message || "Failed to save AI model provider.",
    };
  }

  revalidatePath("/ai");
  return {
    status: "success",
    data: {
      ...data,
      api_key_encrypted: maskKey(data.api_key_encrypted),
    } as AiModelProvider,
  };
}

export async function testAiProviderConnection(
  input: TestAiProviderInput
): Promise<ActionResponse<{ latencyMs: number; message: string }>> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.view", userContext.permissions)) {
    return { status: "error", error: "Permission denied" };
  }

  const parsed = testAiProviderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid test input",
    };
  }

  const { provider, baseUrl } = parsed.data;
  let apiKey = parsed.data.apiKey;

  if (apiKey.includes("•••")) {
    const supabase = await createServerClient();
    const { data: existing } = await supabase
      .from("ai_model_providers")
      .select("api_key_encrypted")
      .eq("organization_id", userContext.organization.id)
      .eq("provider", provider)
      .maybeSingle();

    if (existing?.api_key_encrypted) {
      apiKey = existing.api_key_encrypted;
    } else {
      return { status: "error", error: "No stored API key found to test." };
    }
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    let testUrl = "";
    const headers: Record<string, string> = {};

    switch (provider) {
      case "openai": {
        testUrl = `${baseUrl?.trim().replace(/\/+$/, "") || "https://api.openai.com/v1"}/models`;
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
      }
      case "anthropic": {
        testUrl = "https://api.anthropic.com/v1/models";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        break;
      }
      case "gemini": {
        testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        break;
      }
      case "openrouter": {
        testUrl = "https://openrouter.ai/api/v1/models";
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
      }
      case "custom_openai": {
        if (!baseUrl) {
          return { status: "error", error: "Base URL is required for custom OpenAI provider." };
        }
        testUrl = `${baseUrl.trim().replace(/\/+$/, "")}/models`;
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
      }
    }

    const response = await fetch(testUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      if (provider === "anthropic" && response.status === 404) {
        const altResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
        });
        if (altResponse.ok || altResponse.status === 400) {
          return {
            status: "success",
            data: {
              latencyMs: Date.now() - startTime,
              message: `Connected successfully to Anthropic (${Date.now() - startTime}ms)`,
            },
          };
        }
      }

      let errorMsg = `Provider returned HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error?.message) {
          errorMsg = errorJson.error.message;
        } else if (errorJson.message) {
          errorMsg = errorJson.message;
        }
      } catch {
        // ignore
      }
      return { status: "error", error: errorMsg };
    }

    return {
      status: "success",
      data: {
        latencyMs,
        message: `Connected successfully to ${provider.toUpperCase()} (${latencyMs}ms)`,
      },
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return { status: "error", error: "Connection timed out after 10 seconds." };
    }
    return {
      status: "error",
      error: err.message || "Failed to establish connection to provider.",
    };
  }
}

export async function deleteAiProvider(id: string): Promise<ActionResponse> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.manage", userContext.permissions)) {
    return { status: "error", error: "Permission denied" };
  }

  const parsed = deleteAiProviderSchema.safeParse({ id });
  if (!parsed.success) {
    return { status: "error", error: "Invalid provider ID" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("ai_model_providers")
    .delete()
    .eq("id", id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/ai");
  return { status: "success", data: null };
}


// ============================================================
// 2. MCP (Model Context Protocol) Registry Actions
// ============================================================

export async function getMcpServers(): Promise<AiMcpServer[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return [];
  if (!hasPermission("ai.view", userContext.permissions)) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ai_mcp_servers")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as AiMcpServer[]).map((srv) => {
    const maskedHeaders: Record<string, string> = {};
    if (srv.headers_encrypted && typeof srv.headers_encrypted === "object") {
      for (const [k, v] of Object.entries(srv.headers_encrypted)) {
        maskedHeaders[k] = maskKey(String(v));
      }
    }
    return {
      ...srv,
      headers_encrypted: maskedHeaders,
    };
  });
}

export async function testMcpServerConnection(
  input: TestMcpServerInput
): Promise<ActionResponse<{ tools: McpToolDefinition[]; latencyMs: number }>> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.view", userContext.permissions)) {
    return { status: "error", error: "Permission denied" };
  }

  const parsed = testMcpServerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid MCP test data",
    };
  }

  const { endpointUrl, headers } = parsed.data;
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    };

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp-probe-" + Date.now(),
        method: "tools/list",
        params: {},
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: "error",
        error: `MCP endpoint returned HTTP ${response.status} ${response.statusText}`,
      };
    }

    const json = await response.json().catch(() => null);
    let tools: McpToolDefinition[] = [];

    if (json?.result?.tools && Array.isArray(json.result.tools)) {
      tools = json.result.tools.map((t: any) => ({
        name: t.name ?? "unnamed_tool",
        description: t.description ?? "",
        inputSchema: t.inputSchema ?? {},
      }));
    } else if (json?.tools && Array.isArray(json.tools)) {
      tools = json.tools.map((t: any) => ({
        name: t.name ?? "unnamed_tool",
        description: t.description ?? "",
        inputSchema: t.inputSchema ?? {},
      }));
    }

    return {
      status: "success",
      data: {
        tools,
        latencyMs,
      },
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return { status: "error", error: "MCP server connection timed out after 10 seconds." };
    }
    return {
      status: "error",
      error: err.message || "Failed to reach MCP server endpoint.",
    };
  }
}


export async function saveMcpServer(
  input: SaveMcpServerInput
): Promise<ActionResponse<AiMcpServer>> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.manage", userContext.permissions)) {
    return { status: "error", error: "Permission denied (ai.manage required)" };
  }

  const parsed = saveMcpServerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid MCP server data",
    };
  }

  const orgId = userContext.organization.id;
  const { id, name, transportType, endpointUrl, headers, isActive } = parsed.data;
  const supabase = await createServerClient();

  let finalHeaders = { ...(headers || {}) };
  if (id) {
    const { data: existing } = await supabase
      .from("ai_mcp_servers")
      .select("headers_encrypted")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existing?.headers_encrypted) {
      for (const [key, val] of Object.entries(finalHeaders)) {
        if (typeof val === "string" && val.includes("•••")) {
          finalHeaders[key] = existing.headers_encrypted[key] || val;
        }
      }
    }
  }

  let discoveredTools: McpToolDefinition[] = [];
  try {
    const testRes = await testMcpServerConnection({
      endpointUrl,
      transportType,
      headers: finalHeaders,
    });
    if (testRes.status === "success" && testRes.data.tools.length > 0) {
      discoveredTools = testRes.data.tools;
    }
  } catch {
    // Tool discovery failure does not prevent saving server config
  }

  const payload: any = {
    organization_id: orgId,
    name,
    transport_type: transportType,
    endpoint_url: endpointUrl,
    headers_encrypted: finalHeaders,
    discovered_tools: discoveredTools,
    is_active: isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from("ai_mcp_servers");
  let result;

  if (id) {
    result = await query
      .update(payload)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();
  } else {
    result = await query.insert(payload).select().single();
  }

  if (result.error || !result.data) {
    return {
      status: "error",
      error: result.error?.message || "Failed to save MCP server.",
    };
  }

  revalidatePath("/ai");
  return {
    status: "success",
    data: result.data as AiMcpServer,
  };
}

export async function toggleMcpServer(
  id: string,
  isActive: boolean
): Promise<ActionResponse> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.manage", userContext.permissions)) {
    return { status: "error", error: "Permission denied" };
  }

  const parsed = toggleMcpServerSchema.safeParse({ id, isActive });
  if (!parsed.success) {
    return { status: "error", error: "Invalid server parameters" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("ai_mcp_servers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/ai");
  return { status: "success", data: null };
}

export async function deleteMcpServer(id: string): Promise<ActionResponse> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error", error: "Not authenticated" };
  }
  if (!hasPermission("ai.manage", userContext.permissions)) {
    return { status: "error", error: "Permission denied" };
  }

  const parsed = deleteMcpServerSchema.safeParse({ id });
  if (!parsed.success) {
    return { status: "error", error: "Invalid server ID" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("ai_mcp_servers")
    .delete()
    .eq("id", id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/ai");
  return { status: "success", data: null };
}

