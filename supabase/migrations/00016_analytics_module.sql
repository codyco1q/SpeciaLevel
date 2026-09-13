-- ============================================================
-- UpLevel — 00016 Analytics & Business Intelligence module
--
-- 1) public.get_organization_analytics(p_range_days, p_offset_days)
--    — a SECURITY DEFINER RPC returning a single jsonb bundle with
--      revenue/invoicing, CRM velocity, team operations, a daily or
--      weekly historical series for chart rendering, a pipeline
--      stage breakdown, and a per-member productivity list.
--      It is ALWAYS scoped to public.current_organization_id() and
--      re-checks analytics.view on every call (defense in depth —
--      the same gate as the page and server actions).
--
-- 2) Catalog permissions analytics.view / analytics.manage, an
--    enabled `analytics` row in organization_modules, and the role
--    grant matrix (Owner/Admin = view+manage, Manager/Employee =
--    view, Client = none) baked into the seed function AND
--    backfilled for organizations created before this migration.
--
-- Metric semantics (documented so charts and KPIs stay explainable):
--   * Revenue numbers use created_at inside the period window — one
--     consistent "invoiced during this period" basis for KPIs and the
--     historical series. outstanding_balance is a live snapshot of
--     currently open invoices (sent + overdue).
--   * Marketing leads are the global inbound lead bridge (00011), so
--     new_leads counts leads captured inside the window across the
--     whole pool — the same view CRM managers already have.
--   * Deals won/lost use updated_at as the stage-change timestamp.
--   * Task completion uses updated_at as the completion timestamp
--     (there is no dedicated completed_at column).
-- ============================================================

-- ------------------------------------------------------------
-- 1. get_organization_analytics()
-- ------------------------------------------------------------
create or replace function public.get_organization_analytics(
  p_range_days integer default 30,
  p_offset_days integer default 0
)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_organization_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_step interval;
  v_total_invoiced numeric;
  v_collected_revenue numeric;
  v_outstanding_balance numeric;
  v_paid_invoice_count bigint;
  v_new_leads bigint;
  v_deals_won bigint;
  v_deals_lost bigint;
  v_open_deals bigint;
  v_pipeline_value numeric;
  v_conversion_rate numeric;
  v_tasks_completed bigint;
  v_tasks_overdue bigint;
  v_hours_tracked numeric;
  v_avg_completion_hours numeric;
  v_pipeline jsonb;
  v_team jsonb;
  v_series jsonb;
begin
  -- Tenant scope: the caller's organization comes from the auth
  -- session, never from user input. Unauthenticated / unassigned
  -- callers get NULL (identical to an RLS-denied table read).
  v_organization_id := public.current_organization_id();
  if v_organization_id is null then
    return null;
  end if;

  -- Permission gate: mirror the app-level analytics.view check so the
  -- RPC stays a safe primitive even if a future caller forgets one.
  if not public.user_has_organization_permission(
    v_organization_id, 'analytics.view'
  ) then
    return null;
  end if;

  -- Period window: [v_start, v_end). v_end is the truncated "today";
  -- p_offset_days shifts the whole window back (used by
  -- getAnalyticsSummary to compare against the previous period).
  v_end := date_trunc('day', now());
  v_start := v_end
    - make_interval(days => p_range_days + p_offset_days);
  v_end := v_end - make_interval(days => p_offset_days);

  -- Long ranges bucket by week so the series stays readable.
  v_step := case when p_range_days > 45 then interval '7 days'
                 else interval '1 day' end;

  -- ---- Revenue & invoicing (created_at = "issued in period") ----
  v_total_invoiced := coalesce((
    select round(sum(i.total), 2)
    from public.invoices i
    where i.organization_id = v_organization_id
      and i.status in ('sent', 'paid', 'overdue')
      and i.created_at >= v_start
      and i.created_at < v_end
  ), 0);

  v_collected_revenue := coalesce((
    select round(sum(i.total), 2)
    from public.invoices i
    where i.organization_id = v_organization_id
      and i.status = 'paid'
      and i.created_at >= v_start
      and i.created_at < v_end
  ), 0);

  -- Live snapshot of money owed right now (any issue date).
  v_outstanding_balance := coalesce((
    select round(sum(i.total), 2)
    from public.invoices i
    where i.organization_id = v_organization_id
      and i.status in ('sent', 'overdue')
  ), 0);

  v_paid_invoice_count := (
    select count(*)
    from public.invoices i
    where i.organization_id = v_organization_id
      and i.status = 'paid'
      and i.created_at >= v_start
      and i.created_at < v_end
  );

  -- ---- CRM velocity ----
  v_new_leads := (
    select count(*)
    from public.marketing_leads ml
    where ml.created_at >= v_start
      and ml.created_at < v_end
  );

  v_deals_won := (
    select count(*)
    from public.crm_deals d
    where d.organization_id = v_organization_id
      and d.stage = 'won'
      and d.updated_at >= v_start
      and d.updated_at < v_end
  );

  v_deals_lost := (
    select count(*)
    from public.crm_deals d
    where d.organization_id = v_organization_id
      and d.stage = 'lost'
      and d.updated_at >= v_start
      and d.updated_at < v_end
  );

  -- Open pipeline: live snapshot of the three pre-close stages.
  v_open_deals := (
    select count(*)
    from public.crm_deals d
    where d.organization_id = v_organization_id
      and d.stage in ('lead', 'contacted', 'proposal')
  );

  v_pipeline_value := coalesce((
    select round(sum(d.value), 2)
    from public.crm_deals d
    where d.organization_id = v_organization_id
      and d.stage in ('lead', 'contacted', 'proposal')
  ), 0);

  v_conversion_rate := case
    when v_new_leads > 0
      then round(100.0 * v_deals_won / v_new_leads, 1)
    else 0
  end;

  -- ---- Team operations ----
  v_tasks_completed := (
    select count(*)
    from public.tasks t
    where t.organization_id = v_organization_id
      and t.status = 'done'
      and t.updated_at >= v_start
      and t.updated_at < v_end
  );

  -- Overdue = open tasks past due_right now (snapshot, any period).
  v_tasks_overdue := (
    select count(*)
    from public.tasks t
    where t.organization_id = v_organization_id
      and t.status <> 'done'
      and t.due_date is not null
      and t.due_date < now()
  );

  v_hours_tracked := coalesce(round((
    select coalesce(sum(te.duration_seconds), 0)
    from public.time_entries te
    where te.organization_id = v_organization_id
      and te.status = 'completed'
      and te.clocked_out_at >= v_start
      and te.clocked_out_at < v_end
  ) / 3600.0, 1), 0);

  v_avg_completion_hours := coalesce(round((
    select avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0)
    from public.tasks t
    where t.organization_id = v_organization_id
      and t.status = 'done'
      and t.updated_at >= v_start
      and t.updated_at < v_end
  ), 1), 0);

  -- ---- Pipeline stage breakdown (count + value per stage) ----
  v_pipeline := coalesce((
    select jsonb_agg(row_to_json(st))
    from (
      select d.stage::text as stage,
             count(*)::int as count,
             round(coalesce(sum(d.value), 0), 2) as value
      from public.crm_deals d
      where d.organization_id = v_organization_id
        and d.stage in ('lead', 'contacted', 'proposal', 'won', 'lost')
      group by d.stage
      order by case d.stage
        when 'lead' then 1
        when 'contacted' then 2
        when 'proposal' then 3
        when 'won' then 4
        else 5
      end
    ) st
  ), '[]'::jsonb);

  -- ---- Team productivity (done tasks + logged hours per member) ----
  v_team := coalesce((
    select jsonb_agg(row_to_json(m))
    from (
      with members as (
        select id, coalesce(full_name, '') as full_name
        from public.profiles
        where organization_id = v_organization_id
          and is_active = true
      ),
      done as (
        select assigned_to, count(*) as c
        from public.tasks
        where organization_id = v_organization_id
          and status = 'done'
          and updated_at >= v_start
          and updated_at < v_end
        group by assigned_to
      ),
      logged as (
        select user_id, coalesce(sum(duration_seconds), 0) as s
        from public.time_entries
        where organization_id = v_organization_id
          and status = 'completed'
          and clocked_out_at >= v_start
          and clocked_out_at < v_end
        group by user_id
      )
      select m.id::text as profile_id,
             m.full_name,
             coalesce(d.c, 0)::int as tasks_completed,
             round(coalesce(h.s, 0) / 3600.0, 1) as hours_logged
      from members m
      left join done d on d.assigned_to = m.id
      left join logged h on h.user_id = m.id
      where coalesce(d.c, 0) > 0
         or coalesce(h.s, 0) > 0
      order by tasks_completed desc, hours_logged desc
    ) m
  ), '[]'::jsonb);

  -- ---- Historical series (daily; weekly for ranges > 45 days) ----
  v_series := coalesce((
    select jsonb_agg(row_to_json(b))
    from (
      select to_char(bucket, 'YYYY-MM-DD') as date,
             (
               select count(*)
               from public.marketing_leads ml
               where ml.created_at >= bucket
                 and ml.created_at < bucket + v_step
             )::int as new_leads,
             (
               select count(*)
               from public.crm_deals d
               where d.organization_id = v_organization_id
                 and d.stage = 'won'
                 and d.updated_at >= bucket
                 and d.updated_at < bucket + v_step
             )::int as deals_closed,
             coalesce(round((
               select sum(i.total)
               from public.invoices i
               where i.organization_id = v_organization_id
                 and i.status in ('sent', 'paid', 'overdue')
                 and i.created_at >= bucket
                 and i.created_at < bucket + v_step
             ), 2), 0) as revenue_billed
      from generate_series(v_start, v_end - v_step, v_step) as bucket
    ) b
  ), '[]'::jsonb);

  return jsonb_build_object(
    'period', jsonb_build_object(
      'days', p_range_days,
      'offset_days', p_offset_days,
      'start', (v_start)::date,
      'end', (v_end - interval '1 day')::date
    ),
    'revenue', jsonb_build_object(
      'total_invoiced', v_total_invoiced,
      'collected_revenue', v_collected_revenue,
      'outstanding_balance', v_outstanding_balance,
      'paid_invoice_count', v_paid_invoice_count
    ),
    'crm', jsonb_build_object(
      'new_leads', v_new_leads,
      'deals_won', v_deals_won,
      'deals_lost', v_deals_lost,
      'open_deals', v_open_deals,
      'pipeline_value', v_pipeline_value,
      'conversion_rate', v_conversion_rate
    ),
    'operations', jsonb_build_object(
      'tasks_completed', v_tasks_completed,
      'tasks_overdue', v_tasks_overdue,
      'hours_tracked', v_hours_tracked,
      'avg_completion_hours', v_avg_completion_hours
    ),
    'pipeline', v_pipeline,
    'team', v_team,
    'series', v_series
  );
end;
$$;

-- PostgREST calls RPCs as `authenticated` — grant execute explicitly
-- (the function itself re-checks scoping + analytics.view).
grant execute on function public.get_organization_analytics(integer, integer)
  to authenticated;

-- ------------------------------------------------------------
-- 2. Replace seed_organization() so NEW organizations get the
--    Analytics module, its permissions, and role grants on
--    creation. (Full superset of the 00015 version + the
--    analytics.view / analytics.manage additions.)
-- ------------------------------------------------------------
create or replace function public.seed_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Base roles
  insert into public.roles (organization_id, name, key, description, is_system) values
    (new.id, 'Owner', 'owner', 'Full control over the organization.', true),
    (new.id, 'Admin', 'admin', 'Administrative access to most features.', true),
    (new.id, 'Manager', 'manager', 'Manages a team or department.', true),
    (new.id, 'Employee', 'employee', 'Standard employee access.', true),
    (new.id, 'Client', 'client', 'Client portal access with scoped project views.', true);

  -- Default modules
  insert into public.organization_modules (organization_id, module_key, module_name, is_enabled) values
    (new.id, 'dashboard', 'Dashboard', true),
    (new.id, 'calendar', 'Calendar', true),
    (new.id, 'time', 'Time Tracking', true),
    (new.id, 'employees', 'Employees', true),
    (new.id, 'departments', 'Departments', true),
    (new.id, 'roles', 'Roles & Permissions', true),
    (new.id, 'tasks', 'Tasks', true),
    (new.id, 'chat', 'Chat', true),
    (new.id, 'crm', 'CRM', true),
    (new.id, 'invoicing', 'Invoicing & Billing', true),
    (new.id, 'automations', 'Automations', true),
    (new.id, 'analytics', 'Analytics & BI', true);

  -- Default permissions
  insert into public.permissions (organization_id, key, name, description, module) values
    (new.id, 'dashboard.view', 'View Dashboard', 'View the main dashboard.', 'dashboard'),

    (new.id, 'calendar.view', 'View Calendar', 'View calendar events.', 'calendar'),
    (new.id, 'calendar.create', 'Create Calendar Events', 'Create calendar events.', 'calendar'),
    (new.id, 'calendar.edit', 'Edit Calendar Events', 'Edit calendar events.', 'calendar'),
    (new.id, 'calendar.delete', 'Delete Calendar Events', 'Delete calendar events.', 'calendar'),

    (new.id, 'time.view', 'View Time Entries', 'View time entries.', 'time'),
    (new.id, 'time.clock_in', 'Clock In', 'Start a time entry.', 'time'),
    (new.id, 'time.clock_out', 'Clock Out', 'Stop a time entry.', 'time'),

    (new.id, 'employees.view', 'View Employees', 'View employees.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Add, edit, or remove employees.', 'employees'),

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, or delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, or delete roles.', 'roles'),

    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings'),

    (new.id, 'tasks.view', 'View Tasks', 'View tasks.', 'tasks'),
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, or delete tasks.', 'tasks'),

    (new.id, 'chat.view', 'View Chat', 'View channels and messages.', 'chat'),
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and manage chat.', 'chat'),

    (new.id, 'crm.view', 'View CRM', 'View deals, contacts, and inbound leads.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create and edit deals and convert inbound leads.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoicing', 'View invoices and billing.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoicing', 'Create, send, and update invoices.', 'invoicing'),

    (new.id, 'automations.view', 'View Automations', 'View automations and their execution history.', 'automations'),
    (new.id, 'automations.manage', 'Manage Automations', 'Create, edit, and delete automations.', 'automations'),

    (new.id, 'analytics.view', 'View Analytics', 'View analytics dashboards and reports.', 'analytics'),
    (new.id, 'analytics.manage', 'Manage Analytics', 'Export and manage analytics reports.', 'analytics'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal views.', 'portal');

  -- Role > permissions matrix
  -- Owner: every permission in the catalog
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'owner';

  -- Admin: everything except role management and settings management
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'admin'
    and p.key not in ('roles.manage', 'settings.manage');

  -- Manager: operational day-to-day access (analytics = view only)
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'manager'
    and p.key in (
      'dashboard.view',
      'calendar.view', 'calendar.create',
      'time.view', 'time.clock_in', 'time.clock_out',
      'employees.view', 'employees.manage',
      'departments.view',
      'tasks.view', 'tasks.manage',
      'chat.view', 'chat.manage',
      'crm.view', 'crm.manage',
      'invoicing.view', 'invoicing.manage',
      'automations.view', 'automations.manage',
      'analytics.view'
    );

  -- Employee: self-service access (analytics = view only)
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'employee'
    and p.key in (
      'dashboard.view',
      'calendar.view',
      'time.view', 'time.clock_in', 'time.clock_out',
      'tasks.view',
      'chat.view',
      'crm.view',
      'invoicing.view',
      'automations.view',
      'analytics.view'
    );

  -- Client: scoped portal access ONLY - no analytics, no automations,
  -- no CRM, no settings, no roles, no departments, no time permissions.
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'client'
    and p.key in (
      'portal.client',
      'tasks.view',
      'chat.view',
      'invoicing.view'
    );

  -- Default #general + #client-project channels. chat_channels.created_by
  -- is NOT NULL and no profiles exist for a brand-new organization yet, so
  -- this only fires when members already exist (e.g. re-seeding). New
  -- organizations get their #general channel from the app
  -- (lib/actions/onboarding.ts).
  if exists (select 1 from public.profiles where organization_id = new.id) then
    insert into public.chat_channels (organization_id, name, description, created_by)
    select new.id, 'general', 'General discussion for your team.', id
    from public.profiles
    where organization_id = new.id
    order by created_at
    limit 1
    on conflict (organization_id, name) do nothing;

    insert into public.chat_channels (organization_id, name, description, created_by)
    select new.id, 'client-project', 'Client project updates and support.', id
    from public.profiles
    where organization_id = new.id
    order by created_at
    limit 1
    on conflict (organization_id, name) do nothing;
  end if;

  return new;
end;
$$;
-- ------------------------------------------------------------
-- 3. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Catalog permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'analytics.view', 'View Analytics', 'View analytics dashboards and reports.', 'analytics'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'analytics.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'analytics.manage', 'Manage Analytics', 'Export and manage analytics reports.', 'analytics'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'analytics.manage'
);

-- Module row — force-enabled so the Analytics module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'analytics', 'Analytics & BI', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
-- Owner / Admin: view + manage (owner is every catalog permission; admin
-- grants everything except roles.manage / settings.manage).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin')
  and p.key in ('analytics.view', 'analytics.manage')
on conflict (role_id, permission_id) do nothing;

-- Manager / Employee: view only.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('manager', 'employee')
  and p.key = 'analytics.view'
on conflict (role_id, permission_id) do nothing;

-- Client: none (no analytics permissions granted by design).