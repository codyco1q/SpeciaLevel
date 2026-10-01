"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type {
  RichTextBlock,
  TaskStage,
  WhiteboardElement,
  WhiteboardViewport,
  WorkspaceDoc,
  WorkspaceWhiteboard,
} from "@/types/database";

export interface PowerhouseActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  id?: string;
}

type AuthResult =
  | { ok: true; organizationId: string; userId: string; permissions: string[] }
  | { ok: false; error: PowerhouseActionState };

async function requirePermission(
  permission: "tasks.view" | "tasks.manage"
): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: err.signedIn },
    };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error: { status: "error", error: err.noPermission },
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      ok: false,
      error: { status: "error", error: err.noOrg },
    };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
    permissions: userContext.permissions,
  };
}

// ==========================================
// 1. Task Stages Management
// ==========================================

export async function getTaskStages(): Promise<TaskStage[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("task_stages")
    .select("id, organization_id, name, color, order_index, is_done_stage, created_at")
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("[tasks-powerhouse] getTaskStages failed:", error.message);
    return [];
  }

  if (data && data.length > 0) {
    return data as TaskStage[];
  }

  // Auto-seed default stages if none exist
  const defaultStages = [
    { organization_id: auth.organizationId, name: "To Do", color: "#64748b", order_index: 0, is_done_stage: false },
    { organization_id: auth.organizationId, name: "In Progress", color: "#3b82f6", order_index: 1, is_done_stage: false },
    { organization_id: auth.organizationId, name: "In Review", color: "#eab308", order_index: 2, is_done_stage: false },
    { organization_id: auth.organizationId, name: "Blocked", color: "#ef4444", order_index: 3, is_done_stage: false },
    { organization_id: auth.organizationId, name: "Done", color: "#22c55e", order_index: 4, is_done_stage: true },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("task_stages")
    .insert(defaultStages)
    .select("id, organization_id, name, color, order_index, is_done_stage, created_at")
    .order("order_index", { ascending: true });

  if (insertError || !inserted) {
    console.error("[tasks-powerhouse] auto-seed stages failed:", insertError?.message);
    return [];
  }

  return inserted as TaskStage[];
}

export async function createTaskStage(
  name: string,
  color = "#3b82f6",
  isDoneStage = false
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { status: "error", error: "Stage name is required" };
  }

  const supabase = await createServerClient();

  const { data: highest } = await supabase
    .from("task_stages")
    .select("order_index")
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (highest?.order_index ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("task_stages")
    .insert({
      organization_id: auth.organizationId,
      name: trimmedName,
      color: color || "#3b82f6",
      order_index: nextIndex,
      is_done_stage: isDoneStage,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { status: "error", error: error?.message ?? "Failed to create stage" };
  }

  revalidatePath("/tasks");
  return { status: "success", id: inserted.id };
}

export async function updateTaskStages(
  stages: { id: string; name: string; color: string; orderIndex: number; isDoneStage: boolean }[]
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  for (const s of stages) {
    const { error } = await supabase
      .from("task_stages")
      .update({
        name: s.name.trim(),
        color: s.color,
        order_index: s.orderIndex,
        is_done_stage: s.isDoneStage,
      })
      .eq("id", s.id)
      .eq("organization_id", auth.organizationId);

    if (error) {
      console.error("[tasks-powerhouse] updateTaskStages failed:", s.id, error.message);
    }
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

export async function deleteTaskStage(
  stageId: string,
  fallbackStageId?: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  if (fallbackStageId && fallbackStageId !== stageId) {
    await supabase
      .from("tasks")
      .update({ stage_id: fallbackStageId })
      .eq("stage_id", stageId)
      .eq("organization_id", auth.organizationId);
  } else {
    const { data: otherStage } = await supabase
      .from("task_stages")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .neq("id", stageId)
      .limit(1)
      .maybeSingle();

    if (otherStage) {
      await supabase
        .from("tasks")
        .update({ stage_id: otherStage.id })
        .eq("stage_id", stageId)
        .eq("organization_id", auth.organizationId);
    }
  }

  const { error } = await supabase
    .from("task_stages")
    .delete()
    .eq("id", stageId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

export async function updateTaskStage(
  taskId: string,
  stageId: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  const { data: stage } = await supabase
    .from("task_stages")
    .select("id, is_done_stage")
    .eq("id", stageId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (!stage) {
    return { status: "error", error: "Stage not found" };
  }

  const updates: Record<string, unknown> = {
    stage_id: stage.id,
    updated_at: new Date().toISOString(),
  };

  if (stage.is_done_stage) {
    updates.status = "done";
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

// ==========================================
// 2. Workspace Docs Management (Notion-style)
// ==========================================

export async function getWorkspaceDocs(): Promise<WorkspaceDoc[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("workspace_docs")
    .select("id, organization_id, title, icon, blocks_json, plain_text, parent_id, order_index, created_by, updated_at")
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[tasks-powerhouse] getWorkspaceDocs failed:", error.message);
    return [];
  }

  const rows: WorkspaceDoc[] = (data ?? []).map((d) => ({
    id: d.id,
    organization_id: d.organization_id,
    title: d.title || "Untitled",
    icon: d.icon || "📄",
    blocks_json: Array.isArray(d.blocks_json) ? (d.blocks_json as RichTextBlock[]) : [],
    plain_text: d.plain_text || "",
    parent_id: d.parent_id || null,
    order_index: d.order_index ?? 0,
    created_by: d.created_by || null,
    updated_at: d.updated_at,
    children: [],
  }));

  const docMap = new Map<string, WorkspaceDoc>();
  const rootDocs: WorkspaceDoc[] = [];

  for (const doc of rows) {
    doc.children = [];
    docMap.set(doc.id, doc);
  }

  for (const doc of rows) {
    if (doc.parent_id && docMap.has(doc.parent_id)) {
      docMap.get(doc.parent_id)!.children!.push(doc);
    } else {
      rootDocs.push(doc);
    }
  }

  return rootDocs;
}

export async function createDoc(
  title = "Untitled Document",
  parentId: string | null = null,
  icon = "📄"
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const initialBlocks: RichTextBlock[] = [
    { id: "b_" + Math.random().toString(36).substring(2, 8), type: "heading1", content: title },
    { id: "b_" + Math.random().toString(36).substring(2, 8), type: "paragraph", content: "" },
  ];

  const { data: inserted, error } = await supabase
    .from("workspace_docs")
    .insert({
      organization_id: auth.organizationId,
      title: title.trim() || "Untitled Document",
      icon: icon || "📄",
      blocks_json: initialBlocks,
      plain_text: title,
      parent_id: parentId || null,
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { status: "error", error: error?.message ?? "Failed to create document" };
  }

  revalidatePath("/tasks");
  return { status: "success", id: inserted.id };
}

export async function updateDoc(
  id: string,
  data: {
    title?: string;
    icon?: string;
    blocksJson?: RichTextBlock[];
    plainText?: string;
    parentId?: string | null;
    orderIndex?: number;
  }
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) payload.title = data.title;
  if (data.icon !== undefined) payload.icon = data.icon;
  if (data.blocksJson !== undefined) payload.blocks_json = data.blocksJson;
  if (data.plainText !== undefined) payload.plain_text = data.plainText;
  if (data.parentId !== undefined) payload.parent_id = data.parentId;
  if (data.orderIndex !== undefined) payload.order_index = data.orderIndex;

  const { error } = await supabase
    .from("workspace_docs")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success", id };
}

export async function deleteDoc(id: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("workspace_docs")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}


// ==========================================
// 3. Workspace Whiteboards Management
// ==========================================

export async function getWhiteboards(): Promise<WorkspaceWhiteboard[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("workspace_whiteboards")
    .select("id, organization_id, name, elements_json, viewport, created_by, updated_at")
    .eq("organization_id", auth.organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[tasks-powerhouse] getWhiteboards failed:", error.message);
    return [];
  }

  if (data && data.length > 0) {
    return data.map((w) => ({
      id: w.id,
      organization_id: w.organization_id,
      name: w.name || "Untitled Whiteboard",
      elements_json: Array.isArray(w.elements_json) ? (w.elements_json as WhiteboardElement[]) : [],
      viewport: (w.viewport as WhiteboardViewport) || { x: 0, y: 0, zoom: 1 },
      created_by: w.created_by || null,
      updated_at: w.updated_at,
    }));
  }

  const starterElements: WhiteboardElement[] = [
    {
      id: "el_start_1",
      type: "sticky",
      x: 120,
      y: 120,
      width: 220,
      height: 180,
      text: "💡 Brainstorming Ideas\n- Dynamic Stage Workflows\n- Unified Notion Notes",
      color: "#fef08a",
    },
    {
      id: "el_start_2",
      type: "sticky",
      x: 380,
      y: 120,
      width: 220,
      height: 180,
      text: "🚀 Next Steps\n- Visual Whiteboards\n- Real-time save & collaborate",
      color: "#bae6fd",
    },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("workspace_whiteboards")
    .insert({
      organization_id: auth.organizationId,
      name: "Brainstorming Canvas",
      elements_json: starterElements,
      viewport: { x: 0, y: 0, zoom: 1 },
      created_by: auth.userId,
    })
    .select("id, organization_id, name, elements_json, viewport, created_by, updated_at")
    .single();

  if (insertError || !inserted) {
    return [];
  }

  return [
    {
      id: inserted.id,
      organization_id: inserted.organization_id,
      name: inserted.name,
      elements_json: Array.isArray(inserted.elements_json) ? (inserted.elements_json as WhiteboardElement[]) : [],
      viewport: (inserted.viewport as WhiteboardViewport) || { x: 0, y: 0, zoom: 1 },
      created_by: inserted.created_by || null,
      updated_at: inserted.updated_at,
    },
  ];
}

export async function createWhiteboard(name = "New Whiteboard"): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { data: inserted, error } = await supabase
    .from("workspace_whiteboards")
    .insert({
      organization_id: auth.organizationId,
      name: name.trim() || "New Whiteboard",
      elements_json: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { status: "error", error: error?.message ?? "Failed to create whiteboard" };
  }

  revalidatePath("/tasks");
  return { status: "success", id: inserted.id };
}

export async function saveWhiteboard(
  id: string,
  elements: WhiteboardElement[],
  viewport: WhiteboardViewport,
  name?: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const payload: Record<string, unknown> = {
    elements_json: elements,
    viewport,
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    payload.name = name.trim() || "Untitled Whiteboard";
  }

  const { error } = await supabase
    .from("workspace_whiteboards")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  return { status: "success", id };
}

export async function deleteWhiteboard(id: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("workspace_whiteboards")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

