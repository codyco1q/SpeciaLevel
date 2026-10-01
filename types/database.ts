// ============================================================
// Database types for UpLevel
// Mirror the schema defined in supabase/migrations/00001_initial_schema.sql
// ============================================================

export interface OrganizationAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

export interface OrganizationSecuritySettings {
  allowed_domains: string[];
  session_timeout_minutes: number;
  prevent_member_deletion: boolean;
}

export interface OrganizationBillingDefaults {
  payment_terms: string;
  default_tax_rate: number;
  bank_name: string;
  iban: string;
  swift: string;
  instructions?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  address?: OrganizationAddress;
  default_currency?: string;
  timezone: string;
  date_format?: string;
  security_settings?: OrganizationSecuritySettings;
  billing_defaults?: OrganizationBillingDefaults;
  has_social_planner_addon?: boolean;
  social_planner_subscribed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department_id: string | null;
  /** CRM contact this profile is linked to (client role portal scoping). */
  contact_id: string | null;
  is_active: boolean;
  status: string;
  /** UI locale the user chose ('en' | 'ar'); read by getLocale() when no cookie is set. */
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  key: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
  created_at: string;
}

export interface OrganizationModule {
  id: string;
  organization_id: string;
  module_key: string;
  module_name: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  organization_id: string;
  user_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  status: "active" | "completed";
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  organization_id: string;
  user_id: string;
  assigned_user_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

export type RichTextBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "todoList"
  | "quote"
  | "code"
  | "callout"
  | "divider"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "todo"
  | "bullet";

export interface RichTextBlock {
  id: string;
  type: RichTextBlockType;
  content?: string;
  checked?: boolean;
  language?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  organization_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface TaskStage {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  order_index: number;
  is_done_stage: boolean;
  created_at: string;
}

export interface WorkspaceDoc {
  id: string;
  organization_id: string;
  title: string;
  icon: string;
  blocks_json: RichTextBlock[];
  plain_text: string;
  parent_id: string | null;
  order_index: number;
  created_by: string | null;
  updated_at: string;
  children?: WorkspaceDoc[];
}

export type WhiteboardTool =
  | "select"
  | "sticky"
  | "text"
  | "rectangle"
  | "circle"
  | "arrow"
  | "pen";

export interface WhiteboardElement {
  id: string;
  type: "sticky" | "text" | "rectangle" | "circle" | "arrow" | "pen";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  points?: { x: number; y: number }[];
  endX?: number;
  endY?: number;
}

export interface WhiteboardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkspaceWhiteboard {
  id: string;
  organization_id: string;
  name: string;
  elements_json: WhiteboardElement[];
  viewport: WhiteboardViewport;
  created_by: string | null;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  stage_id?: string | null;
  parent_id?: string | null;
  title: string;
  description_json: RichTextBlock[];
  description_text: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  tags: string[];
  is_doc: boolean;
  order_index: number;
  /** CRM contact this deliverable is for (client portal scoping). */
  contact_id?: string | null;
  /** When true, the linked client (or any client) can see this task. */
  is_client_visible?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatChannel {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
}

export interface ChatChannelMember {
  id: string;
  organization_id: string;
  channel_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  organization_id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Metadata row for one stored object in the private `project_assets` bucket. */
export interface FileAttachment {
  id: string;
  organization_id: string;
  /** Exactly one parent (task XOR message) is set — see chk_attachment_parent. */
  task_id: string | null;
  message_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  /** Scoped path: {organization_id}/tasks/{task_id}/{file_id}-{filename} (or chat/...). */
  storage_path: string;
  /** When true, a Client-role user may download this attachment. */
  is_client_visible: boolean;
  uploaded_by: string;
  created_at: string;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  department_id: string | null;
  /** CRM contact this invite is linked to (client role portal scoping). */
  contact_id: string | null;
  invited_by: string | null;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export interface UserContext {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  organization: Organization | undefined;
  roles: Role[];
  permissions: string[];
}

// ============================================================
// CRM module (00011_crm_module.sql)
// ============================================================

export type CrmStage = "lead" | "contacted" | "proposal" | "won" | "lost" | (string & {});

export interface CrmPipeline {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CrmPipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  order_index: number;
  probability: number;
  stale_days: number;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  /** Job title, e.g. "Operations Director" (00020 contacts enhancement). */
  title: string | null;
  /** Free-form internal context attached to the contact. */
  notes: string | null;
  address: string | null;
  tags: string[];
  /** Profile that added this contact (00020 backfills existing rows). */
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Internal per-contact note (00020 contacts enhancement). */
export interface CrmContactNote {
  id: string;
  organization_id: string;
  contact_id: string;
  content: string;
  author_id: string;
  created_at: string;
}

/** NUMERIC columns arrive from PostgREST as strings by default. */
export interface CrmDeal {
  id: string;
  organization_id: string;
  contact_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  title: string;
  value: string | number;
  currency: string;
  stage: CrmStage;
  notes: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  closed_at: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type MarketingLeadStatus = "new" | "contacted" | "converted" | "archived";

export interface MarketingLead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  bottleneck: string | null;
  package_of_interest: string | null;
  status: MarketingLeadStatus;
  created_at: string;
}

// ============================================================
// Invoicing module (00012_invoicing_module.sql)
// ============================================================

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentProvider = "manual" | "stripe" | "bank_transfer";

/** NUMERIC columns arrive from PostgREST as strings by default. */
export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  contact_id: string | null;
  deal_id: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total: string | number;
  due_date: string | null;
  notes: string | null;
  payment_provider?: PaymentProvider;
  payment_intent_id?: string | null;
  paid_at?: string | null;
  share_token?: string;
  is_shareable?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  created_at: string;
}

// ============================================================
// Notifications module (00029_system_notifications_and_events.sql)
// ============================================================

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "lead"
  | "booking"
  | "invoice";

export interface SystemNotification {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string | null;
  is_read: boolean;
  created_at: string;
}


// ============================================================
// Carrier & Phone Number Management (00033_messaging_and_phone_numbers.sql)
// ============================================================

export type PhoneCarrierProvider = "twilio" | "telnyx" | "custom";

export interface PhoneCarrierSettings {
  id: string;
  organization_id: string;
  provider: PhoneCarrierProvider;
  account_sid: string | null;
  auth_token_encrypted: string | null;
  api_key_sid: string | null;
  api_key_secret_encrypted: string | null;
  twiml_app_sid: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface PhoneNumberCapabilities {
  voice: boolean;
  sms: boolean;
}

export interface PhoneNumber {
  id: string;
  organization_id: string;
  phone_number: string;
  friendly_name: string | null;
  capabilities: PhoneNumberCapabilities;
  status: "active" | "inactive" | "pending";
  assigned_user_id: string | null;
  created_at: string;
}

// ============================================================
// Telephony Voice Tokens & Call Recordings (00034_telephony_voice_tokens.sql)
// ============================================================

export type TelecomCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "missed"
  | "busy"
  | "failed"
  | "no-answer"
  | "voicemail";

export type TelecomCallDirection = "inbound" | "outbound";

export interface TelecomCall {
  id: string;
  organization_id: string;
  contact_id: string | null;
  direction: TelecomCallDirection;
  status: TelecomCallStatus;
  from_number: string;
  to_number: string;
  caller_phone_number_id: string | null;
  duration_seconds: number;
  recording_url: string | null;
  summary: string | null;
  notes: string | null;
  outcome: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallRecording {
  id: string;
  organization_id: string;
  call_id: string | null;
  recording_url: string;
  duration_seconds: number;
  file_size_bytes: number | null;
  mime_type: string;
  created_at: string;
}

// ============================================================
// Integrations Hub (00035_integrations_hub.sql)
// ============================================================

export type IntegrationCategory = "payment" | "social" | "telecom";
export type IntegrationStatus = "connected" | "disconnected" | "error";

export type IntegrationProvider =
  | "stripe"
  | "paypal"
  | "paymob"
  | "paytabs"
  | "fawry"
  | "whatsapp"
  | "meta_messenger"
  | "instagram";

export interface OrganizationIntegration {
  id: string;
  organization_id: string;
  provider: IntegrationProvider | string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  credentials_encrypted: Record<string, any>;
  config: Record<string, any>;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Visual Automations Engine (00036_visual_automations_engine.sql)
// ============================================================

export type WorkflowTriggerType =
  | "form_submitted"
  | "appointment_booked"
  | "deal_stage_changed"
  | "contact_tag_added"
  | "inbound_sms"
  | "invoice_paid";

export type WorkflowStepType = "action" | "condition" | "delay";

export type WorkflowActionType =
  | "send_sms"
  | "send_notification"
  | "send_email"
  | "add_tag"
  | "update_deal_stage"
  | "webhook"
  | "delay";

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  action_type: WorkflowActionType;
  name?: string;
  config: Record<string, any>;
}

export interface AutomationWorkflow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, any>;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export type AutomationExecutionStatus = "running" | "completed" | "failed";

export interface AutomationStepExecutionResult {
  step_id: string;
  type: WorkflowStepType;
  action_type: WorkflowActionType;
  name?: string;
  status: "success" | "failed" | "skipped";
  output?: Record<string, any>;
  error?: string;
  executed_at: string;
}

export interface AutomationExecutionLog {
  id: string;
  workflow_id: string;
  organization_id: string;
  status: AutomationExecutionStatus;
  trigger_payload: Record<string, any>;
  steps_executed: AutomationStepExecutionResult[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================
// AI Model Providers & MCP (00037_ai_providers_and_mcp.sql)
// ============================================================

export type AiModelProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "custom_openai";

export interface AiModelProvider {
  id: string;
  organization_id: string;
  provider: AiModelProviderType;
  api_key_encrypted: string;
  base_url: string | null;
  default_model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type McpTransportType = "sse" | "http_stream" | "stdio";

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface AiMcpServer {
  id: string;
  organization_id: string;
  name: string;
  transport_type: McpTransportType;
  endpoint_url: string;
  headers_encrypted: Record<string, string>;
  discovered_tools: McpToolDefinition[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
// ============================================================
// Marketing Social Planner & Email Templates (00038_marketing_social_and_emails.sql)
// ============================================================

export type MarketingSocialPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin";

export type MarketingSocialPostStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "failed";

export interface MarketingSocialPost {
  id: string;
  organization_id: string;
  content: string;
  media_urls: string[];
  platforms: MarketingSocialPlatform[];
  status: MarketingSocialPostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export type EmailBlockType =
  | "header"
  | "text"
  | "button"
  | "divider"
  | "spacer"
  | "image";

export interface EmailBlockStyle {
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  borderRadius?: number;
  buttonColor?: string;
  buttonTextColor?: string;
  lineHeight?: number;
  fontWeight?: string;
}

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: {
    text?: string;
    level?: 1 | 2 | 3;
    buttonText?: string;
    buttonUrl?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageWidth?: number;
    spacerHeight?: number;
    dividerColor?: string;
  };
  style?: EmailBlockStyle;
}

export interface SocialPlannerStatusResult {
  isSubscribed: boolean;
  subscribedAt: string | null;
}

export interface MarketingEmailTemplate {
  id: string;
  organization_id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  body_json: EmailBlock[];
  body_html: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}







