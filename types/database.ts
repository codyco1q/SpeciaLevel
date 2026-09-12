// ============================================================
// Database types for UpLevel
// Mirror the schema defined in supabase/migrations/00001_initial_schema.sql
// ============================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
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

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
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

export interface ChatMessage {
  id: string;
  organization_id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  department_id: string | null;
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
