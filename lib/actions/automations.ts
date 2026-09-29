"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  saveWorkflowSchema,
  toggleWorkflowSchema,
  testWorkflowSchema,
} from "@/lib/validations/automations";
import { executeSingleWorkflow } from "@/lib/services/workflow-runner";
import type {
  AutomationWorkflow,
  AutomationExecutionLog,
} from "@/types/database";

export interface WorkflowWithMeta extends AutomationWorkflow {
  last_run_at?: string | null;
  last_status?: "running" | "completed" | "failed" | null;
  total_runs?: number;
}

export interface AutomationConfigOptions {
  forms: { id: string; title: string }[];
  pipelines: {
    id: string;
    name: string;
    stages: { id: string; name: string; color: string }[];
  }[];
  tags: string[];
  phoneNumbers: { id: string; phoneNumber: string; label: string }[];
}

async function requirePermission(permission: "automations.view" | "automations.manage") {
  const userContext = await getCurrentUserContext();
  if (!userContext) {
    return { ok: false as const, error: "Not signed in." };
  }
  if (!userContext.organization) {
    return { ok: false as const, error: "No active organization." };
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false as const, error: "Insufficient permissions." };
  }
  return {
    ok: true as const,
    userId: userContext.user.id,
    organizationId: userContext.organization.id,
  };
}

export async function getWorkflows(): Promise<WorkflowWithMeta[]> {
  const auth = await requirePermission("automations.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();

  // Fetch workflows
  const { data: workflows, error } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (error || !workflows) {
    console.error("[automations] getWorkflows failed:", error?.message);
    return [];
  }

  // Fetch last execution logs for each workflow
  const { data: logs } = await supabase
    .from("automation_execution_logs")
    .select("workflow_id, status, started_at")
    .eq("organization_id", auth.organizationId)
    .order("started_at", { ascending: false });

  const logsByWorkflow: Record<string, { last_run_at: string; last_status: any; total_runs: number }> = {};
  if (logs) {
    for (const log of logs) {
      if (!logsByWorkflow[log.workflow_id]) {
        logsByWorkflow[log.workflow_id] = {
          last_run_at: log.started_at,
          last_status: log.status,
          total_runs: 0,
        };
      }
      logsByWorkflow[log.workflow_id].total_runs += 1;
    }
  }

  return (workflows as AutomationWorkflow[]).map((wf) => ({
    ...wf,
    last_run_at: logsByWorkflow[wf.id]?.last_run_at ?? null,
    last_status: logsByWorkflow[wf.id]?.last_status ?? null,
    total_runs: logsByWorkflow[wf.id]?.total_runs ?? 0,
  }));
}

export async function getWorkflowById(id: string): Promise<AutomationWorkflow | null> {
  const auth = await requirePermission("automations.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AutomationWorkflow;
}

export async function saveWorkflow(input: unknown): Promise<{
  status: "success" | "error";
  workflow?: AutomationWorkflow;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}> {
  const auth = await requirePermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = saveWorkflowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, name, description, isActive, triggerType, triggerConfig, steps } = parsed.data;
  const supabase = await createServerClient();

  if (id) {
    const { data: updated, error } = await supabase
      .from("automation_workflows")
      .update({
        name,
        description: description || null,
        is_active: isActive,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        steps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .select("*")
      .single();

    if (error || !updated) {
      console.error("[automations] update failed:", error?.message);
      return { status: "error", error: error?.message || "Failed to update workflow." };
    }

    revalidatePath("/automations");
    return { status: "success", workflow: updated as AutomationWorkflow };
  } else {
    const { data: created, error } = await supabase
      .from("automation_workflows")
      .insert({
        organization_id: auth.organizationId,
        name,
        description: description || null,
        is_active: isActive,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        steps,
      })
      .select("*")
      .single();

    if (error || !created) {
      console.error("[automations] create failed:", error?.message);
      return { status: "error", error: error?.message || "Failed to create workflow." };
    }

    revalidatePath("/automations");
    return { status: "success", workflow: created as AutomationWorkflow };
  }
}
export async function toggleWorkflowStatus(
  id: string,
  isActive: boolean
): Promise<{ status: "success" | "error"; error?: string }> {
  const auth = await requirePermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = toggleWorkflowSchema.safeParse({ id, isActive });
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("automation_workflows")
    .update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[automations] toggle status failed:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/automations");
  return { status: "success" };
}

export async function deleteWorkflow(
  id: string
): Promise<{ status: "success" | "error"; error?: string }> {
  const auth = await requirePermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("automation_workflows")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[automations] delete failed:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/automations");
  return { status: "success" };
}

export async function testWorkflowRun(
  workflowId: string,
  mockPayload?: Record<string, any>
): Promise<{
  status: "success" | "error";
  result?: { status: "completed" | "failed"; error?: string };
  error?: string;
}> {
  const auth = await requirePermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = testWorkflowSchema.safeParse({ workflowId, mockPayload });
  if (!parsed.success) {
    return { status: "error", error: "Invalid test input." };
  }

  const supabase = await createServerClient();
  const { data: wf, error: wfError } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (wfError || !wf) {
    return { status: "error", error: "Workflow not found." };
  }

  const defaultMockPayload: Record<string, any> = {
    contact: {
      id: "mock-contact-1",
      name: "Alex Johnson",
      first_name: "Alex",
      email: "alex.johnson@example.com",
      phone: "+15551234567",
      company: "Acme Corp",
    },
    deal: {
      id: "mock-deal-1",
      title: "Website Redesign Deal",
      value: "5,000 USD",
      stage_id: "mock-stage-1",
    },
    form: {
      id: "mock-form-1",
      title: "Contact Us Form",
    },
    appointment: {
      time: new Date().toLocaleString(),
    },
    invoice: {
      id: "mock-invoice-1",
      amount: "$1,250.00",
    },
    ...mockPayload,
  };

  const execResult = await executeSingleWorkflow(wf as AutomationWorkflow, defaultMockPayload);

  revalidatePath("/automations");
  return {
    status: "success",
    result: execResult,
  };
}

export async function getWorkflowLogs(
  workflowId?: string,
  limit = 50
): Promise<AutomationExecutionLog[]> {
  const auth = await requirePermission("automations.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  let query = supabase
    .from("automation_execution_logs")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (workflowId) {
    query = query.eq("workflow_id", workflowId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("[automations] getWorkflowLogs failed:", error?.message);
    return [];
  }

  return data as AutomationExecutionLog[];
}

export async function getAutomationConfigOptions(): Promise<AutomationConfigOptions> {
  const auth = await requirePermission("automations.view");
  if (!auth.ok) {
    return { forms: [], pipelines: [], tags: [], phoneNumbers: [] };
  }

  const supabase = await createServerClient();

  const [formsRes, pipelinesRes, stagesRes, contactsRes, phoneRes] = await Promise.all([
    supabase
      .from("forms")
      .select("id, title")
      .eq("organization_id", auth.organizationId)
      .order("title", { ascending: true }),
    supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", auth.organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("crm_pipeline_stages")
      .select("id, name, color, pipeline_id, position")
      .order("position", { ascending: true }),
    supabase
      .from("crm_contacts")
      .select("tags")
      .eq("organization_id", auth.organizationId),
    supabase
      .from("phone_numbers")
      .select("id, phone_number, friendly_name")
      .eq("organization_id", auth.organizationId),
  ]);

  const stages = stagesRes.data || [];
  const pipelines = (pipelinesRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    stages: stages
      .filter((s) => s.pipeline_id === p.id)
      .map((s) => ({ id: s.id, name: s.name, color: s.color || "#3b82f6" })),
  }));

  const tagSet = new Set<string>();
  if (contactsRes.data) {
    for (const c of contactsRes.data) {
      if (Array.isArray(c.tags)) {
        c.tags.forEach((t: string) => tagSet.add(t));
      }
    }
  }

  const phoneNumbers = (phoneRes.data || []).map((pn) => ({
    id: pn.id,
    phoneNumber: pn.phone_number,
    label: pn.friendly_name ? `${pn.friendly_name} (${pn.phone_number})` : pn.phone_number,
  }));

  return {
    forms: (formsRes.data || []).map((f) => ({ id: f.id, title: f.title })),
    pipelines,
    tags: Array.from(tagSet).sort(),
    phoneNumbers,
  };
}


