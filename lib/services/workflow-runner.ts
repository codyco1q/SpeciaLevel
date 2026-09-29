import { createServiceRoleClient } from "@/lib/supabase/admin";
import { dispatchNotificationToOrgAdmins } from "@/lib/services/notifications";
import type {
  WorkflowTriggerType,
  AutomationWorkflow,
  WorkflowStep,
  AutomationStepExecutionResult,
} from "@/types/database";

export interface WorkflowEvent {
  type: WorkflowTriggerType;
  orgId: string;
  payload: Record<string, any>;
}

/**
 * Replace template placeholders like `{{contact.name}}` with actual values from payload context.
 */
export function interpolateVariables(template: string, payload: Record<string, any>): string {
  if (!template || typeof template !== "string") return "";

  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
    const keys = path.split(".");
    let current: any = payload;
    for (const key of keys) {
      if (current === null || current === undefined) {
        return "";
      }
      current = current[key];
    }
    if (current === null || current === undefined) {
      return "";
    }
    return String(current);
  });
}

/**
 * Evaluates whether a workflow's trigger_config matches the incoming event payload.
 */
function matchesTriggerConfig(
  triggerType: WorkflowTriggerType,
  triggerConfig: Record<string, any>,
  payload: Record<string, any>
): boolean {
  if (!triggerConfig || Object.keys(triggerConfig).length === 0) {
    return true;
  }

  switch (triggerType) {
    case "form_submitted": {
      if (triggerConfig.form_id && triggerConfig.form_id !== "all") {
        const payloadFormId = payload.form_id || payload.form?.id || payload.formId;
        if (payloadFormId && payloadFormId !== triggerConfig.form_id) {
          return false;
        }
      }
      return true;
    }

    case "deal_stage_changed": {
      if (triggerConfig.stage_id && triggerConfig.stage_id !== "all") {
        const payloadStageId = payload.stage_id || payload.deal?.stage_id || payload.stageId;
        if (payloadStageId && payloadStageId !== triggerConfig.stage_id) {
          return false;
        }
      }
      return true;
    }

    case "contact_tag_added": {
      if (triggerConfig.tag && triggerConfig.tag !== "all") {
        const payloadTag = payload.tag || payload.new_tag;
        if (payloadTag && payloadTag !== triggerConfig.tag) {
          return false;
        }
      }
      return true;
    }

    case "inbound_sms": {
      if (triggerConfig.phone_number && triggerConfig.phone_number !== "all") {
        const payloadNumber = payload.to_number || payload.phone_number || payload.toNumber;
        if (payloadNumber && payloadNumber !== triggerConfig.phone_number) {
          return false;
        }
      }
      return true;
    }

    case "appointment_booked":
    case "invoice_paid":
    default:
      return true;
  }
}

/**
 * Main dispatcher: finds all active workflows in an organization matching the trigger event,
 * executes their steps sequentially, and logs full execution history.
 */
export async function dispatchWorkflowTrigger(event: WorkflowEvent): Promise<{
  matchedWorkflows: number;
  results: { workflowId: string; status: "completed" | "failed"; error?: string }[];
}> {
  const { type, orgId, payload } = event;
  const results: { workflowId: string; status: "completed" | "failed"; error?: string }[] = [];

  try {
    const supabase = createServiceRoleClient();

    const { data: workflows, error: wfError } = await supabase
      .from("automation_workflows")
      .select("*")
      .eq("organization_id", orgId)
      .eq("trigger_type", type)
      .eq("is_active", true);

    if (wfError || !workflows || workflows.length === 0) {
      return { matchedWorkflows: 0, results: [] };
    }

    const matchingWorkflows = (workflows as AutomationWorkflow[]).filter((wf) =>
      matchesTriggerConfig(type, wf.trigger_config, payload)
    );

    for (const workflow of matchingWorkflows) {
      const result = await executeSingleWorkflow(workflow, payload, supabase);
      results.push({
        workflowId: workflow.id,
        status: result.status,
        error: result.error,
      });
    }

    return {
      matchedWorkflows: matchingWorkflows.length,
      results,
    };
  } catch (err: any) {
    console.error("[workflow-runner] Unexpected error dispatching trigger:", err?.message || err);
    return { matchedWorkflows: 0, results };
  }
}

/**
 * Executes a single workflow instance and updates the execution log.
 */
export async function executeSingleWorkflow(
  workflow: AutomationWorkflow,
  payload: Record<string, any>,
  supabaseClient?: any
): Promise<{ status: "completed" | "failed"; error?: string }> {
  const supabase = supabaseClient || createServiceRoleClient();
  const startedAt = new Date().toISOString();

  // Create initial running log
  const { data: logRow } = await supabase
    .from("automation_execution_logs")
    .insert({
      workflow_id: workflow.id,
      organization_id: workflow.organization_id,
      status: "running",
      trigger_payload: payload,
      steps_executed: [],
      started_at: startedAt,
    })
    .select("id")
    .single();

  const logId = logRow?.id;
  const stepsExecuted: AutomationStepExecutionResult[] = [];
  let overallFailed = false;
  let overallError: string | undefined;

  const steps = (workflow.steps || []) as WorkflowStep[];

  for (const step of steps) {
    const stepExecutedAt = new Date().toISOString();
    const config = step.config || {};

    try {
      let stepOutput: Record<string, any> = {};

      switch (step.action_type) {
        case "send_sms": {
          const recipientType = config.recipient || "contact";
          let toNumber =
            recipientType === "custom"
              ? config.custom_number
              : payload.contact?.phone || payload.phone || payload.contact_phone || payload.to_number;

          toNumber = interpolateVariables(toNumber || "", payload).trim();

          if (!toNumber) {
            stepsExecuted.push({
              step_id: step.id,
              type: step.type,
              action_type: step.action_type,
              name: step.name || "Send SMS Message",
              status: "skipped",
              output: { reason: "No recipient phone number found in payload or step config." },
              executed_at: stepExecutedAt,
            });
            break;
          }

          const bodyText = interpolateVariables(
            config.body || "Hello! We received your request.",
            payload
          );

          const { data: smsRow, error: smsError } = await supabase
            .from("telecom_sms")
            .insert({
              organization_id: workflow.organization_id,
              contact_id: payload.contact_id || payload.contact?.id || null,
              direction: "outbound",
              from_number: config.from_number || "System",
              to_number: toNumber,
              body: bodyText,
              status: "sent",
            })
            .select("id")
            .single();

          if (smsError) {
            throw new Error(`SMS insert failed: ${smsError.message}`);
          }

          stepOutput = { sms_id: smsRow?.id, to: toNumber, body: bodyText };
          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Send SMS Message",
            status: "success",
            output: stepOutput,
            executed_at: stepExecutedAt,
          });
          break;
        }

        case "send_notification": {
          const title = interpolateVariables(
            config.title || "Automated Workflow Alert",
            payload
          );
          const message = interpolateVariables(
            config.message || "A workflow action was executed.",
            payload
          );

          await dispatchNotificationToOrgAdmins({
            orgId: workflow.organization_id,
            title,
            message,
            type: "info",
            link: payload.deal_id ? `/crm?deal=${payload.deal_id}` : "/automations",
          });

          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Send In-App Notification",
            status: "success",
            output: { title, message },
            executed_at: stepExecutedAt,
          });
          break;
        }

        case "add_tag": {
          const contactId =
            payload.contact_id || payload.contact?.id || (payload.type === "contact" ? payload.id : null);
          const tagToAdd = interpolateVariables(config.tag || "Automated", payload).trim();

          if (!contactId || !tagToAdd) {
            stepsExecuted.push({
              step_id: step.id,
              type: step.type,
              action_type: step.action_type,
              name: step.name || "Add Contact Tag",
              status: "skipped",
              output: { reason: "Missing contact ID or tag." },
              executed_at: stepExecutedAt,
            });
            break;
          }

          const { data: contactRow } = await supabase
            .from("crm_contacts")
            .select("id, tags")
            .eq("id", contactId)
            .single();

          if (contactRow) {
            const currentTags = Array.isArray(contactRow.tags) ? contactRow.tags : [];
            if (!currentTags.includes(tagToAdd)) {
              await supabase
                .from("crm_contacts")
                .update({ tags: [...currentTags, tagToAdd] })
                .eq("id", contactId);
            }
          }

          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Add Contact Tag",
            status: "success",
            output: { contact_id: contactId, tag: tagToAdd },
            executed_at: stepExecutedAt,
          });
          break;
        }

        case "update_deal_stage": {
          const dealId = payload.deal_id || payload.deal?.id;
          const targetStageId = config.stage_id;

          if (!dealId || !targetStageId) {
            stepsExecuted.push({
              step_id: step.id,
              type: step.type,
              action_type: step.action_type,
              name: step.name || "Move Deal Stage",
              status: "skipped",
              output: { reason: "Missing deal ID or target stage ID." },
              executed_at: stepExecutedAt,
            });
            break;
          }

          const { error: dealUpdateError } = await supabase
            .from("crm_deals")
            .update({ stage_id: targetStageId })
            .eq("id", dealId);

          if (dealUpdateError) {
            throw new Error(`Failed to update deal stage: ${dealUpdateError.message}`);
          }

          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Move Deal Stage",
            status: "success",
            output: { deal_id: dealId, stage_id: targetStageId },
            executed_at: stepExecutedAt,
          });
          break;
        }

        case "webhook": {
          const rawUrl = config.url || "";
          const targetUrl = interpolateVariables(rawUrl, payload).trim();

          if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
            throw new Error(`Invalid webhook URL: "${rawUrl}"`);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            const response = await fetch(targetUrl, {
              method: config.method || "POST",
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "SpeciaLevel-Automation-Runner/1.0",
              },
              body: JSON.stringify({
                event: workflow.trigger_type,
                workflow: {
                  id: workflow.id,
                  name: workflow.name,
                },
                payload,
                timestamp: new Date().toISOString(),
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            stepsExecuted.push({
              step_id: step.id,
              type: step.type,
              action_type: step.action_type,
              name: step.name || "Outbound Webhook",
              status: response.ok ? "success" : "failed",
              output: {
                url: targetUrl,
                status_code: response.status,
                status_text: response.statusText,
              },
              error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
              executed_at: stepExecutedAt,
            });

            if (!response.ok) {
              overallFailed = true;
              overallError = `Webhook returned HTTP ${response.status}`;
            }
          } catch (webhookErr: any) {
            clearTimeout(timeoutId);
            throw new Error(`Webhook dispatch failed: ${webhookErr?.message || webhookErr}`);
          }
          break;
        }

        case "delay": {
          const durationMinutes = Number(config.duration_minutes) || 1;
          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Delay / Wait",
            status: "success",
            output: {
              duration_minutes: durationMinutes,
              simulated_resume_at: new Date(Date.now() + durationMinutes * 60000).toISOString(),
            },
            executed_at: stepExecutedAt,
          });
          break;
        }

        default: {
          stepsExecuted.push({
            step_id: step.id,
            type: step.type,
            action_type: step.action_type,
            name: step.name || "Unknown Step",
            status: "skipped",
            output: { reason: `Unknown action type: ${step.action_type}` },
            executed_at: stepExecutedAt,
          });
        }
      }
    } catch (stepErr: any) {
      overallFailed = true;
      overallError = stepErr?.message || String(stepErr);
      stepsExecuted.push({
        step_id: step.id,
        type: step.type,
        action_type: step.action_type,
        name: step.name || "Step Error",
        status: "failed",
        error: overallError,
        executed_at: stepExecutedAt,
      });
      break;
    }
  }

  const finalStatus = overallFailed ? "failed" : "completed";
  const completedAt = new Date().toISOString();

  if (logId) {
    await supabase
      .from("automation_execution_logs")
      .update({
        status: finalStatus,
        steps_executed: stepsExecuted,
        error_message: overallError || null,
        completed_at: completedAt,
      })
      .eq("id", logId);
  }

  return {
    status: finalStatus,
    error: overallError,
  };
}

