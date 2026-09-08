You are the lead software architect and senior full-stack engineer for a new SaaS platform called "UpLevel".

IMPORTANT:
Do not try to build the entire product at once.
We are building the foundation correctly first so the application can scale into a large multi-tenant business operating system later.

PROJECT VISION

UpLevel will eventually become an all-in-one business operating system similar to GoHighLevel, but broader and more modular.

The long-term platform may include:

- CRM
- Sales pipelines
- Marketing
- Social media management
- Content creation workflows
- Telemarketing / cold calling
- Customer service
- Phone systems
- Calendars
- Scheduling
- Automations
- AI agents
- Internal company chat
- Employee management
- Departments
- Roles and permissions
- Time tracking / clock in and clock out
- Tasks
- HR-related functionality
- Analytics
- Dashboards
- Forms
- Funnels
- Websites
- Integrations
- Billing
- And other business tools

However, NONE of those advanced features should be built yet.

The first version must focus on creating a strong multi-tenant organizational foundation.

--------------------------------------------------
CORE BUSINESS MODEL
--------------------------------------------------

UpLevel is a SaaS platform.

A customer is a BUSINESS / ORGANIZATION.

Each organization can have:

Organization
    ├── Departments
    │      ├── Marketing
    │      ├── Sales
    │      ├── Customer Service
    │      ├── Operations
    │      ├── Technology
    │      └── custom departments
    │
    ├── Employees
    │
    ├── Roles
    │
    ├── Permissions
    │
    ├── Modules
    │
    ├── Calendar
    │
    └── Time Tracking

The architecture MUST support multiple organizations from day one.

Users must NEVER be able to access data belonging to another organization.

Design the database and authorization system around organization_id / tenant isolation.

Use Supabase Row Level Security properly.

--------------------------------------------------
TECH STACK
--------------------------------------------------

Use:

- Next.js latest stable version
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL
- Supabase Auth
- Zod
- React Hook Form
- Lucide React icons

Do NOT introduce:

- FastAPI
- Express
- NestJS
- Redis
- Docker
- Microservices
- Kubernetes
- unnecessary backend infrastructure

We want a simple monolithic Next.js application with Supabase that can later be split into services if necessary.

Use Server Components by default.

Use Client Components only when interactivity requires them.

Use Server Actions / Route Handlers where appropriate.

--------------------------------------------------
DESIGN PRINCIPLES
--------------------------------------------------

The application must be:

- Fast
- Clean
- Modern
- Professional
- Extremely responsive
- Modular
- Accessible
- Mobile responsive
- Easy to maintain
- Easy for another developer or AI coding agent to understand

Avoid overengineering.

Do not create abstractions unless they solve a real problem.

Keep business logic separated from UI.

Use reusable components.

Use clear naming conventions.

Use strict TypeScript.

Avoid "any" unless absolutely unavoidable.

--------------------------------------------------
BRAND / UI DIRECTION
--------------------------------------------------

Brand name:

UpLevel

The brand represents helping businesses "level up".

The UI should feel like a serious modern B2B SaaS product.

Think:

- Linear
- Vercel
- Stripe
- Notion
- modern enterprise SaaS

Do NOT copy any company's UI.

Create our own design language.

The interface should prioritize:

- speed
- clarity
- minimalism
- information density
- easy navigation
- beautiful dashboards
- excellent spacing
- responsive layouts

Use a professional dark/light capable design system.

The application should have a consistent sidebar navigation.

--------------------------------------------------
INITIAL APPLICATION STRUCTURE
--------------------------------------------------

Create the following major areas:

/login

/dashboard

/organization

/organization/departments

/organization/employees

/organization/roles

/organization/permissions

/calendar

/time-tracking

/settings

Do NOT build advanced CRM, marketing, AI, chat, automation or telecommunication features yet.

Instead, create them as future modules in the architecture.

--------------------------------------------------
DASHBOARD
--------------------------------------------------

Create an initial dashboard showing:

- Organization name
- Current user
- Current user's department
- Current user's role
- Today's date
- Clock-in status
- Clock-in / Clock-out button
- Today's working time
- Upcoming calendar events
- Quick actions

Also show basic organization statistics for authorized administrators:

- Total employees
- Total departments
- Employees currently clocked in
- Upcoming events

The dashboard must change depending on the user's permissions.

--------------------------------------------------
AUTHENTICATION
--------------------------------------------------

Implement Supabase authentication.

Support:

- Sign up
- Login
- Logout
- Protected routes
- Session persistence

After registration, a user should belong to an organization.

The first user creating an organization becomes the organization owner / super admin.

Design the system so users can later be invited into organizations.

Do not implement email invitation workflows yet unless necessary for the architecture.

--------------------------------------------------
DATABASE MODEL
--------------------------------------------------

Create a proper Supabase PostgreSQL schema.

At minimum create:

organizations

profiles

departments

roles

permissions

role_permissions

user_roles

organization_modules

time_entries

calendar_events

Create appropriate relationships and foreign keys.

Important:

profiles should connect to Supabase auth.users.

Users should belong to an organization.

Departments belong to an organization.

Roles belong to an organization.

Permissions should be reusable.

Time entries belong to a user and organization.

Calendar events belong to an organization and optionally a user.

--------------------------------------------------
ROLES
--------------------------------------------------

Create initial system roles:

- Owner
- Admin
- Manager
- Employee

But design the system so organizations can create custom roles later.

Do NOT hard-code authorization logic everywhere.

Create a centralized permission system.

Example permissions:

organization.view

organization.manage

employees.view

employees.create

employees.update

employees.delete

departments.view

departments.manage

roles.view

roles.manage

calendar.view

calendar.manage

time_tracking.view_self

time_tracking.manage_self

time_tracking.view_team

time_tracking.manage_team

settings.manage

Future permissions should be easy to add.

--------------------------------------------------
DEPARTMENT SYSTEM
--------------------------------------------------

Administrators should be able to:

- Create department
- Edit department
- Delete department
- Assign employees
- Remove employees
- View department members

Each employee should have:

- name
- email
- avatar
- job title
- department
- status
- role
- organization
- timezone
- created_at

--------------------------------------------------
EMPLOYEE MANAGEMENT
--------------------------------------------------

Create an employee management interface.

Features:

- Employee list
- Search
- Filter by department
- Filter by role
- Employee profile
- Employee status
- Department assignment
- Role assignment

Use reusable tables and dialogs.

--------------------------------------------------
CLOCK IN / CLOCK OUT
--------------------------------------------------

Implement a basic working time tracking system.

An employee can:

CLOCK IN

CLOCK OUT

The system records:

- user_id
- organization_id
- clock_in
- clock_out
- duration
- date
- status

Prevent invalid states.

For example:

A user cannot clock in twice without clocking out.

Show:

- Current status
- Current session duration
- Today's total time
- Recent time entries

Keep this simple for now.

Later we will add:

- breaks
- overtime
- attendance reports
- payroll integrations
- schedules
- employee locations
- manager approval

Do NOT build those yet.

--------------------------------------------------
CALENDAR
--------------------------------------------------

Create a simple internal calendar.

Users should be able to:

- View calendar
- Create event
- Edit event
- Delete event
- View event details

Event fields:

- title
- description
- start time
- end time
- location
- created_by
- assigned user
- organization_id

Support:

- month view
- week view
- day view

Keep the calendar internal to UpLevel.

Do not integrate Google Calendar or Outlook yet.

--------------------------------------------------
MODULE SYSTEM
--------------------------------------------------

VERY IMPORTANT:

Create the architecture for a modular platform.

Organizations should eventually be able to enable/disable modules.

Create a basic organization_modules table.

Example future modules:

CRM
MARKETING
TELECOMMUNICATION
AUTOMATIONS
AI
CALENDAR
TIME_TRACKING
CHAT
TASKS
FORMS
FUNNELS
ANALYTICS

For now only activate:

- Calendar
- Time Tracking
- Organization Management

The other modules should appear as "Coming Soon" where appropriate.

Administrators should eventually be able to control which modules employees can access.

--------------------------------------------------
ROLE-BASED SIDEBAR
--------------------------------------------------

The sidebar is VERY important.

Users should only see navigation items for features they have permission to access.

For example:

OWNER / ADMIN:

Dashboard
Organization
Employees
Departments
Roles
Calendar
Time Tracking
Settings

MARKETING EMPLOYEE:

Dashboard
My Calendar
My Time
Marketing

SALES EMPLOYEE:

Dashboard
My Calendar
My Time
Sales

The exact departmental module system can be expanded later.

Build the navigation system so it is permission-driven rather than hard-coded.

--------------------------------------------------
FUTURE ARCHITECTURE
--------------------------------------------------

Design the project so these can later become modules:

/modules/crm

/modules/marketing

/modules/telecommunications

/modules/automations

/modules/ai

/modules/chat

/modules/tasks

/modules/analytics

Do not build these modules now.

Create clean boundaries so adding them later does not require rewriting the entire application.

--------------------------------------------------
SECURITY
--------------------------------------------------

Security is extremely important.

Implement:

- Supabase Auth
- Row Level Security
- Organization-level data isolation
- Permission checks
- Server-side authorization
- Input validation
- Protected routes

Never rely solely on frontend permission checks.

A user must not be able to access another organization's data simply by changing an ID in the URL or request.

--------------------------------------------------
DATABASE MIGRATIONS
--------------------------------------------------

Create proper Supabase migration files.

Do not rely on manually creating tables through random application code.

All database structure should be reproducible.

Include:

- tables
- indexes
- foreign keys
- constraints
- RLS policies
- useful seed data

--------------------------------------------------
PROJECT STRUCTURE
--------------------------------------------------

Create a clean structure similar to:

app/
components/
features/
lib/
types/
supabase/
public/

Organize code by feature where appropriate.

Avoid creating one giant components folder containing everything.

--------------------------------------------------
DEVELOPMENT EXPERIENCE
--------------------------------------------------

Create:

.env.example

README.md

Clear setup instructions.

The project must run with:

npm install

npm run dev

No paid service should be required for local development.

Use environment variables correctly.

Never commit secrets.

--------------------------------------------------
IMPORTANT AI CODING RULES
--------------------------------------------------

You are working inside an existing Git repository.

Before making major changes:

1. Inspect the existing repository.
2. Understand what already exists.
3. Do not unnecessarily delete existing work.
4. Reuse useful code.
5. Explain important architectural decisions briefly.
6. Make changes incrementally.
7. After implementation, run lint/type checks.
8. Fix errors before finishing.
9. Do not leave broken imports.
10. Do not create fake functionality that looks implemented but does nothing.

If something requires credentials or an external service that has not been configured, create the correct integration structure and clearly tell me what environment variables I need.

Do not invent API keys.

--------------------------------------------------
FIRST MILESTONE
--------------------------------------------------

For this first milestone, DO NOT attempt to build the entire SaaS.

Build ONLY:

1. Project foundation
2. Supabase integration
3. Authentication
4. Organization creation
5. Multi-tenant database structure
6. User profiles
7. Departments
8. Employees
9. Roles
10. Permissions
11. Permission-based navigation
12. Dashboard
13. Clock in / Clock out
14. Basic internal calendar
15. Module architecture
16. Responsive professional UI
17. Database migrations
18. RLS policies
19. README setup instructions

At the end:

- Run the project
- Run TypeScript checks
- Run lint
- Fix all errors
- Summarize what was created
- List any environment variables I need
- Tell me exactly how to run the project locally

Do NOT move on to CRM, AI, chat, telecommunication, marketing automation, billing, or advanced integrations yet.

The goal of this milestone is to create the foundation that we can safely build the entire UpLevel platform on top of later.