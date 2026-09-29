-- ============================================================
-- Migration 00037: AI Model Providers (BYOK) and MCP Server Registry
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create ai_model_providers table
-- ------------------------------------------------------------
create table if not exists public.ai_model_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'openrouter', 'custom_openai')),
  api_key_encrypted text not null,
  base_url text,
  default_model text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ai_model_providers_org_provider unique (organization_id, provider)
);

create index if not exists idx_ai_model_providers_org
  on public.ai_model_providers(organization_id);

create index if not exists idx_ai_model_providers_active
  on public.ai_model_providers(organization_id, provider)
  where is_active = true;

-- ------------------------------------------------------------
-- 2. Create ai_mcp_servers table
-- ------------------------------------------------------------
create table if not exists public.ai_mcp_servers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  transport_type text not null check (transport_type in ('sse', 'http_stream', 'stdio')),
  endpoint_url text not null,
  headers_encrypted jsonb not null default '{}'::jsonb,
  discovered_tools jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_mcp_servers_org
  on public.ai_mcp_servers(organization_id);

create index if not exists idx_ai_mcp_servers_active
  on public.ai_mcp_servers(organization_id, is_active);

-- ------------------------------------------------------------
-- 3. Row Level Security Policies
-- ------------------------------------------------------------
alter table public.ai_model_providers enable row level security;
alter table public.ai_mcp_servers enable row level security;

-- ai_model_providers policies
drop policy if exists "ai_model_providers_select_policy" on public.ai_model_providers;
create policy "ai_model_providers_select_policy"
  on public.ai_model_providers for select
  using (organization_id = public.current_organization_id());

drop policy if exists "ai_model_providers_insert_policy" on public.ai_model_providers;
create policy "ai_model_providers_insert_policy"
  on public.ai_model_providers for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "ai_model_providers_update_policy" on public.ai_model_providers;
create policy "ai_model_providers_update_policy"
  on public.ai_model_providers for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "ai_model_providers_delete_policy" on public.ai_model_providers;
create policy "ai_model_providers_delete_policy"
  on public.ai_model_providers for delete
  using (organization_id = public.current_organization_id());

-- ai_mcp_servers policies
drop policy if exists "ai_mcp_servers_select_policy" on public.ai_mcp_servers;
create policy "ai_mcp_servers_select_policy"
  on public.ai_mcp_servers for select
  using (organization_id = public.current_organization_id());

drop policy if exists "ai_mcp_servers_insert_policy" on public.ai_mcp_servers;
create policy "ai_mcp_servers_insert_policy"
  on public.ai_mcp_servers for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "ai_mcp_servers_update_policy" on public.ai_mcp_servers;
create policy "ai_mcp_servers_update_policy"
  on public.ai_mcp_servers for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "ai_mcp_servers_delete_policy" on public.ai_mcp_servers;
create policy "ai_mcp_servers_delete_policy"
  on public.ai_mcp_servers for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Automatic updated_at Triggers
-- ------------------------------------------------------------
drop trigger if exists trigger_set_updated_at_ai_model_providers on public.ai_model_providers;
create trigger trigger_set_updated_at_ai_model_providers
  before update on public.ai_model_providers
  for each row execute procedure public.set_updated_at();

drop trigger if exists trigger_set_updated_at_ai_mcp_servers on public.ai_mcp_servers;
create trigger trigger_set_updated_at_ai_mcp_servers
  before update on public.ai_mcp_servers
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 5. Expand ai_prompts model_provider check constraint
-- ------------------------------------------------------------
alter table public.ai_prompts drop constraint if exists chk_ai_prompts_model_provider;
alter table public.ai_prompts add constraint chk_ai_prompts_model_provider
  check (model_provider in ('openai', 'anthropic', 'gemini', 'openrouter', 'custom', 'custom_openai'));

