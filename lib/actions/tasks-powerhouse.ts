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
  WorkspaceWhiteboardFolder,
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
// 3. Workspace Whiteboard Folders & Management
// ==========================================

export async function getWhiteboardFolders(): Promise<WorkspaceWhiteboardFolder[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  try {
    const { data, error } = await supabase
      .from("workspace_whiteboard_folders")
      .select("id, organization_id, name, color, order_index, created_at")
      .eq("organization_id", auth.organizationId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return [];
    }

    return (data ?? []).map((f) => ({
      id: f.id,
      organization_id: f.organization_id,
      name: f.name || "Untitled Folder",
      color: f.color || "#64748b",
      order_index: f.order_index ?? 0,
      created_at: f.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createWhiteboardFolder(
  name: string,
  color = "#64748b"
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const folderName = name.trim() || "New Folder";

  try {
    const { data: inserted, error } = await supabase
      .from("workspace_whiteboard_folders")
      .insert({
        organization_id: auth.organizationId,
        name: folderName,
        color: color.trim() || "#64748b",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { status: "error", error: error?.message ?? "Failed to create folder" };
    }

    revalidatePath("/tasks");
    return { status: "success", id: inserted.id };
  } catch (err: any) {
    return { status: "error", error: err?.message ?? "Failed to create folder" };
  }
}

export async function updateWhiteboardFolder(
  id: string,
  name: string,
  color?: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const payload: Record<string, unknown> = {
    name: name.trim() || "Untitled Folder",
  };
  if (color) payload.color = color;

  try {
    const { error } = await supabase
      .from("workspace_whiteboard_folders")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", auth.organizationId);

    if (error) {
      return { status: "error", error: error.message };
    }

    revalidatePath("/tasks");
    return { status: "success", id };
  } catch (err: any) {
    return { status: "error", error: err?.message ?? "Failed to update folder" };
  }
}

export async function deleteWhiteboardFolder(id: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  try {
    await supabase
      .from("workspace_whiteboards")
      .update({ folder_id: null })
      .eq("folder_id", id)
      .eq("organization_id", auth.organizationId);

    const { error } = await supabase
      .from("workspace_whiteboard_folders")
      .delete()
      .eq("id", id)
      .eq("organization_id", auth.organizationId);

    if (error) {
      return { status: "error", error: error.message };
    }

    revalidatePath("/tasks");
    return { status: "success" };
  } catch (err: any) {
    return { status: "error", error: err?.message ?? "Failed to delete folder" };
  }
}

// ==========================================
// 4. Workspace Whiteboards Management
// ==========================================

export async function getWhiteboards(): Promise<WorkspaceWhiteboard[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  let data: any[] | null = null;

  const enhancedQuery = await supabase
    .from("workspace_whiteboards")
    .select("id, organization_id, name, folder_id, task_id, elements_json, viewport, created_by, updated_at")
    .eq("organization_id", auth.organizationId)
    .order("updated_at", { ascending: false });

  if (enhancedQuery.error) {
    const legacyQuery = await supabase
      .from("workspace_whiteboards")
      .select("id, organization_id, name, elements_json, viewport, created_by, updated_at")
      .eq("organization_id", auth.organizationId)
      .order("updated_at", { ascending: false });

    if (legacyQuery.error) {
      console.error("[tasks-powerhouse] getWhiteboards failed:", legacyQuery.error.message);
      return [];
    }
    data = legacyQuery.data;
  } else {
    data = enhancedQuery.data;
  }

  if (data && data.length > 0) {
    return data.map((w) => ({
      id: w.id,
      organization_id: w.organization_id,
      name: w.name || "Untitled Whiteboard",
      folder_id: w.folder_id || null,
      task_id: w.task_id || null,
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
      width: 240,
      height: 180,
      text: "💡 Brainstorming Canvas\n- Drag & drop shapes\n- Resizable sticky notes\n- Smart arrows & connectors",
      color: "#fef08a",
    },
    {
      id: "el_start_2",
      type: "sticky",
      x: 420,
      y: 120,
      width: 240,
      height: 180,
      text: "🚀 Task Whiteboards\n- Attach to tasks & deliverables\n- Live collaboration & export",
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
      folder_id: null,
      task_id: null,
      elements_json: Array.isArray(inserted.elements_json) ? (inserted.elements_json as WhiteboardElement[]) : [],
      viewport: (inserted.viewport as WhiteboardViewport) || { x: 0, y: 0, zoom: 1 },
      created_by: inserted.created_by || null,
      updated_at: inserted.updated_at,
    },
  ];
}

export async function createWhiteboard(
  name = "New Whiteboard",
  folderId?: string | null,
  taskId?: string | null
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const insertPayload: Record<string, unknown> = {
    organization_id: auth.organizationId,
    name: name.trim() || "New Whiteboard",
    elements_json: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_by: auth.userId,
  };

  if (folderId) insertPayload.folder_id = folderId;
  if (taskId) insertPayload.task_id = taskId;

  let { data: inserted, error } = await supabase
    .from("workspace_whiteboards")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && (folderId || taskId)) {
    const fallbackPayload = {
      organization_id: auth.organizationId,
      name: name.trim() || "New Whiteboard",
      elements_json: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_by: auth.userId,
    };
    const res = await supabase
      .from("workspace_whiteboards")
      .insert(fallbackPayload)
      .select("id")
      .single();
    inserted = res.data;
    error = res.error;
  }

  if (error || !inserted) {
    return { status: "error", error: error?.message ?? "Failed to create whiteboard" };
  }

  if (taskId && inserted.id) {
    try {
      await supabase.from("task_whiteboards").insert({
        organization_id: auth.organizationId,
        task_id: taskId,
        whiteboard_id: inserted.id,
      });
    } catch {}
  }

  revalidatePath("/tasks");
  return { status: "success", id: inserted.id };
}

export async function renameWhiteboard(id: string, name: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("workspace_whiteboards")
    .update({
      name: name.trim() || "Untitled Whiteboard",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: error.message };
  }

  revalidatePath("/tasks");
  return { status: "success", id };
}

export async function duplicateWhiteboard(id: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { data: source, error: fetchErr } = await supabase
    .from("workspace_whiteboards")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .single();

  if (fetchErr || !source) {
    return { status: "error", error: "Source whiteboard not found" };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("workspace_whiteboards")
    .insert({
      organization_id: auth.organizationId,
      name: `${source.name || "Whiteboard"} (Copy)`,
      elements_json: source.elements_json || [],
      viewport: source.viewport || { x: 0, y: 0, zoom: 1 },
      folder_id: source.folder_id || null,
      task_id: source.task_id || null,
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { status: "error", error: insertErr?.message ?? "Failed to duplicate whiteboard" };
  }

  revalidatePath("/tasks");
  return { status: "success", id: inserted.id };
}

export async function moveWhiteboardToFolder(
  id: string,
  folderId: string | null
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  try {
    const { error } = await supabase
      .from("workspace_whiteboards")
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", auth.organizationId);

    if (error) {
      return { status: "error", error: error.message };
    }

    revalidatePath("/tasks");
    return { status: "success", id };
  } catch (err: any) {
    return { status: "error", error: err?.message ?? "Failed to move whiteboard" };
  }
}

export async function saveWhiteboard(
  id: string,
  elements: WhiteboardElement[],
  viewport: WhiteboardViewport,
  name?: string,
  folderId?: string | null,
  taskId?: string | null
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
  if (folderId !== undefined) {
    payload.folder_id = folderId;
  }
  if (taskId !== undefined) {
    payload.task_id = taskId;
  }

  let { error } = await supabase
    .from("workspace_whiteboards")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error && (folderId !== undefined || taskId !== undefined)) {
    const fallbackPayload: Record<string, unknown> = {
      elements_json: elements,
      viewport,
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) {
      fallbackPayload.name = name.trim() || "Untitled Whiteboard";
    }
    const fallbackRes = await supabase
      .from("workspace_whiteboards")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("organization_id", auth.organizationId);
    error = fallbackRes.error;
  }

  if (error) {
    return { status: "error", error: error.message };
  }

  return { status: "success", id };
}

export async function deleteWhiteboard(id: string): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  try {
    await supabase
      .from("task_whiteboards")
      .delete()
      .eq("whiteboard_id", id)
      .eq("organization_id", auth.organizationId);
  } catch {}

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

// ==========================================
// 5. Task Whiteboard Attachments
// ==========================================

export async function getTaskWhiteboards(taskId: string): Promise<WorkspaceWhiteboard[]> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const results: WorkspaceWhiteboard[] = [];
  const seenIds = new Set<string>();

  try {
    const { data: junctionData } = await supabase
      .from("task_whiteboards")
      .select("whiteboard_id, workspace_whiteboards(*)")
      .eq("task_id", taskId)
      .eq("organization_id", auth.organizationId);

    if (junctionData && junctionData.length > 0) {
      for (const row of junctionData) {
        const wb = (row as any).workspace_whiteboards;
        if (wb && !seenIds.has(wb.id)) {
          seenIds.add(wb.id);
          results.push({
            id: wb.id,
            organization_id: wb.organization_id,
            name: wb.name || "Untitled Whiteboard",
            folder_id: wb.folder_id || null,
            task_id: wb.task_id || taskId,
            elements_json: Array.isArray(wb.elements_json) ? wb.elements_json : [],
            viewport: wb.viewport || { x: 0, y: 0, zoom: 1 },
            created_by: wb.created_by || null,
            updated_at: wb.updated_at,
          });
        }
      }
    }
  } catch {}

  try {
    const { data: directData } = await supabase
      .from("workspace_whiteboards")
      .select("id, organization_id, name, folder_id, task_id, elements_json, viewport, created_by, updated_at")
      .eq("task_id", taskId)
      .eq("organization_id", auth.organizationId);

    if (directData && directData.length > 0) {
      for (const wb of directData) {
        if (!seenIds.has(wb.id)) {
          seenIds.add(wb.id);
          results.push({
            id: wb.id,
            organization_id: wb.organization_id,
            name: wb.name || "Untitled Whiteboard",
            folder_id: wb.folder_id || null,
            task_id: wb.task_id || taskId,
            elements_json: Array.isArray(wb.elements_json) ? wb.elements_json : [],
            viewport: wb.viewport || { x: 0, y: 0, zoom: 1 },
            created_by: wb.created_by || null,
            updated_at: wb.updated_at,
          });
        }
      }
    }
  } catch {}

  return results;
}

export async function attachWhiteboardToTask(
  taskId: string,
  whiteboardId: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  try {
    const { error: junctionErr } = await supabase
      .from("task_whiteboards")
      .upsert(
        {
          organization_id: auth.organizationId,
          task_id: taskId,
          whiteboard_id: whiteboardId,
        },
        { onConflict: "task_id,whiteboard_id" }
      );

    if (!junctionErr) {
      revalidatePath("/tasks");
      return { status: "success", id: whiteboardId };
    }
  } catch {}

  try {
    const { error: directErr } = await supabase
      .from("workspace_whiteboards")
      .update({ task_id: taskId })
      .eq("id", whiteboardId)
      .eq("organization_id", auth.organizationId);

    if (directErr) {
      return { status: "error", error: directErr.message };
    }

    revalidatePath("/tasks");
    return { status: "success", id: whiteboardId };
  } catch (err: any) {
    return { status: "error", error: err?.message ?? "Failed to attach whiteboard" };
  }
}

export async function detachWhiteboardFromTask(
  taskId: string,
  whiteboardId: string
): Promise<PowerhouseActionState> {
  const auth = await requirePermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  try {
    await supabase
      .from("task_whiteboards")
      .delete()
      .eq("task_id", taskId)
      .eq("whiteboard_id", whiteboardId)
      .eq("organization_id", auth.organizationId);
  } catch {}

  try {
    await supabase
      .from("workspace_whiteboards")
      .update({ task_id: null })
      .eq("id", whiteboardId)
      .eq("task_id", taskId)
      .eq("organization_id", auth.organizationId);
  } catch {}

  revalidatePath("/tasks");
  return { status: "success", id: whiteboardId };
}

