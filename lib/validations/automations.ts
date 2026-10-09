import { z } from "zod";
import type {
  WorkflowTriggerType,
  WorkflowStepType,
  WorkflowActionType,
  WorkflowStep,
} from "@/types/database";

export type {
  WorkflowTriggerType,
  WorkflowStepType,
  WorkflowActionType,
  WorkflowStep,
};

export const WORKFLOW_TRIGGER_TYPES = [
  "form_submitted",
  "appointment_booked",
  "deal_stage_changed",
  "contact_tag_added",
  "inbound_sms",
  "invoice_paid",
] as const;

export const WORKFLOW_STEP_TYPES = ["action", "condition", "delay"] as const;

export const WORKFLOW_ACTION_TYPES = [
  "send_sms",
  "send_notification",
  "send_email",
  "add_tag",
  "update_deal_stage",
  "webhook",
  "delay",
] as const;

export interface WorkflowTriggerDefinition {
  type: WorkflowTriggerType;
  name: string;
  title?: string;
  description: string;
  icon: string;
  badge: string;
  configFields: {
    name: string;
    label: string;
    type: "select" | "text";
    optionsSource?: "forms" | "pipelines" | "stages" | "tags" | "phone_numbers";
    placeholder?: string;
  }[];
}

export const WORKFLOW_TRIGGER_DEFINITIONS: WorkflowTriggerDefinition[] = [
  {
    type: "form_submitted",
    name: "Form Submitted",
    title: "Form Submitted",
    description: "Triggers when a lead or contact submits a public or internal form.",
    icon: "FileText",
    badge: "Lead Gen",
    configFields: [
      {
        name: "form_id",
        label: "Form",
        type: "select",
        optionsSource: "forms",
        placeholder: "Any Form (or select specific form)",
      },
    ],
  },
  {
    type: "appointment_booked",
    name: "Appointment Booked",
    title: "Appointment Booked",
    description: "Triggers when a client or lead schedules a calendar appointment.",
    icon: "Calendar",
    badge: "Scheduling",
    configFields: [],
  },
  {
    type: "deal_stage_changed",
    name: "Deal Stage Changed",
    title: "Deal Stage Changed",
    description: "Triggers when a CRM deal is moved to a target pipeline stage.",
    icon: "TrendingUp",
    badge: "CRM Pipeline",
    configFields: [
      {
        name: "stage_id",
        label: "Target Stage",
        type: "select",
        optionsSource: "stages",
        placeholder: "Any Stage (or select target stage)",
      },
    ],
  },
  {
    type: "contact_tag_added",
    name: "Contact Tag Added",
    title: "Contact Tag Added",
    description: "Triggers when a specific tag is applied to a contact profile.",
    icon: "Tag",
    badge: "CRM Contacts",
    configFields: [
      {
        name: "tag",
        label: "Target Tag",
        type: "select",
        optionsSource: "tags",
        placeholder: "Any Tag (or select tag)",
      },
    ],
  },
  {
    type: "inbound_sms",
    name: "Inbound SMS Received",
    title: "Inbound SMS Received",
    description: "Triggers when an incoming text message arrives on a telephony number.",
    icon: "MessageSquare",
    badge: "Telecom",
    configFields: [
      {
        name: "phone_number",
        label: "Phone Number",
        type: "select",
        optionsSource: "phone_numbers",
        placeholder: "Any Number (or select number)",
      },
    ],
  },
  {
    type: "invoice_paid",
    name: "Invoice Paid",
    title: "Invoice Paid",
    description: "Triggers when an invoice is fully paid via online gateway or manual receipt.",
    icon: "CreditCard",
    badge: "Billing",
    configFields: [],
  },
];

export interface WorkflowActionDefinition {
  type: WorkflowActionType;
  name: string;
  title?: string;
  description: string;
  icon: string;
  badge: string;
  defaultConfig: Record<string, any>;
}

export const WORKFLOW_ACTION_DEFINITIONS: WorkflowActionDefinition[] = [
  {
    type: "send_sms",
    name: "Send SMS Message",
    description: "Dispatches an automated SMS text message to the contact or custom number.",
    icon: "MessageCircle",
    badge: "Telecom",
    defaultConfig: {
      recipient: "contact",
      custom_number: "",
      body: "Hi {{contact.name}}, thanks for reaching out! We received your request.",
    },
  },
  {
    type: "send_notification",
    name: "Send In-App Notification",
    description: "Sends real-time internal notification to team members or admins.",
    icon: "Bell",
    badge: "Internal",
    defaultConfig: {
      target: "admins",
      title: "New Workflow Alert: {{contact.name}}",
      message: "Automated event triggered for {{contact.name}} ({{contact.email}}).",
    },
  },
  {
    type: "send_email",
    name: "Send Marketing Email",
    description: "Dispatches a styled marketing email template or custom message to the contact.",
    icon: "Mail",
    badge: "Marketing",
    defaultConfig: {
      recipient_type: "contact",
      custom_email: "",
      template_id: "",
      subject: "Important update from {{organization.name}}",
      body: "Hi {{contact.name}},\n\nWe wanted to follow up regarding your recent request.",
    },
  },
  {
    type: "add_tag",
    name: "Add Contact Tag",
    description: "Appends one or more tags to the contact profile in the CRM.",
    icon: "Tag",
    badge: "CRM",
    defaultConfig: {
      tag: "VIP Lead",
    },
  },
  {
    type: "update_deal_stage",
    name: "Move Deal Stage",
    description: "Automatically advances the associated deal to a designated stage.",
    icon: "ArrowRightCircle",
    badge: "CRM",
    defaultConfig: {
      stage_id: "",
    },
  },
  {
    type: "webhook",
    name: "Outbound Webhook",
    description: "Sends an HTTP POST payload to an external endpoint or Zapier/Make.",
    icon: "Webhook",
    badge: "API / Webhook",
    defaultConfig: {
      url: "https://api.example.com/webhook",
      method: "POST",
    },
  },
  {
    type: "delay",
    name: "Delay / Wait",
    description: "Pauses execution for a specified duration before the next step.",
    icon: "Clock",
    badge: "Logic",
    defaultConfig: {
      duration_minutes: 5,
    },
  },
];

export const WORKFLOW_TEMPLATE_VARIABLES = [
  { key: "{{contact.name}}", label: "Contact Full Name" },
  { key: "{{contact.first_name}}", label: "Contact First Name" },
  { key: "{{contact.email}}", label: "Contact Email" },
  { key: "{{contact.phone}}", label: "Contact Phone" },
  { key: "{{contact.company}}", label: "Contact Company" },
  { key: "{{deal.title}}", label: "Deal Title" },
  { key: "{{deal.value}}", label: "Deal Value" },
  { key: "{{form.title}}", label: "Form Title" },
  { key: "{{appointment.time}}", label: "Appointment Time" },
  { key: "{{invoice.amount}}", label: "Invoice Amount" },
  { key: "{{organization.name}}", label: "Organization Name" },
];

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WORKFLOW_STEP_TYPES).optional(),
  action_type: z.enum(WORKFLOW_ACTION_TYPES).optional(),
  name: z.string().optional(),
  config: z.record(z.string(), z.any()).optional().default({}),
  action_config: z.record(z.string(), z.any()).optional().default({}),
});

export const saveWorkflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Workflow name is required.").max(120, "Name must be 120 characters or fewer."),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer.").optional().nullable(),
  isActive: z.boolean().optional(),
  is_active: z.boolean().optional(),
  triggerType: z.enum(WORKFLOW_TRIGGER_TYPES).optional(),
  trigger_type: z.enum(WORKFLOW_TRIGGER_TYPES).optional(),
  triggerConfig: z.record(z.string(), z.any()).optional(),
  trigger_config: z.record(z.string(), z.any()).optional(),
  steps: z.array(z.any()).default([]),
});

export type SaveWorkflowInput = z.infer<typeof saveWorkflowSchema>;

export const toggleWorkflowSchema = z.object({
  id: z.string().uuid("Invalid workflow ID."),
  isActive: z.boolean(),
});

export const testWorkflowSchema = z.object({
  workflowId: z.string().uuid("Invalid workflow ID."),
  mockPayload: z.record(z.string(), z.any()).optional().default({}),
});
