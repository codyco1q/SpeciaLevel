UpLevel — Project Context & Conversation Handoff
1. Who I Am / What I'm Trying to Build

I am building a business with a friend.

We want to start as a services + SaaS company, eventually evolving into a large business software platform.

The long-term vision is something inspired by GoHighLevel, but significantly broader, faster, cleaner, more customizable, and designed around the actual structure of a business.

The idea is NOT to immediately build a GoHighLevel competitor with every feature.

Instead:

Start with services.
Build a small useful internal SaaS.
Get real businesses using it.
Gradually replace third-party tools with our own software.
Add modules over time.
Eventually turn the platform into a complete business operating system.

The project is intended to be long-term.

2. Core Vision

The ultimate product is essentially:

A business operating system where an entire company can run its daily operations from one platform.

A business signs up.

The business creates its organization.

Then it can add employees.

Employees belong to departments.

Employees have roles.

Roles determine permissions.

Permissions determine what each employee can see and do.

The platform should be modular.

For example:

CEO / Owner

Could see:

Entire organization
Employees
Departments
CRM
Marketing
Sales
Telecommunications
Automations
AI
Analytics
Billing
Calendar
Time tracking
Internal communication
etc.
Marketing Employee

Should primarily see:

Dashboard
Their calendar
Their tasks
Time tracking
Marketing tools
Social planner
Content tools
Campaigns
etc.
Sales Employee

Should primarily see:

Dashboard
Calendar
Time tracking
Leads
CRM
Pipeline
Sales tools
etc.

The important concept is:

Employees should not be overwhelmed by tools they don't need.

The interface should adapt to their role, department and permissions.

3. Long-Term Feature Vision

Eventually the platform could include:

Organization / Company Management
Organizations
Departments
Employees
Teams
Roles
Permissions
Custom roles
Employee profiles
Employee onboarding
Module access
Organization settings
HR / Employee Operations
Clock in / clock out
Attendance
Working hours
Breaks
Overtime
Employee schedules
Time-off requests
Leave management
Employee performance
Possibly payroll integrations later
Calendar / Scheduling
Internal calendar
Employee calendars
Team calendars
Meetings
Scheduling
Client appointments
Google Calendar integration
Outlook integration
Booking pages
Internal Communication

We want to eventually replace or reduce the need for things like:

Slack
Discord
Microsoft Teams

with an internal communication system.

Potential features:

Direct messages
Group chats
Department channels
Organization channels
File sharing
Notifications
Mentions
Threads
Presence/status

This is NOT part of the first MVP.

4. CRM

Eventually:

Contacts
Companies
Leads
Opportunities
Deals
Pipelines
Pipeline stages
Tasks
Notes
Activities
Conversations
Custom fields
Tags
Lead assignment
Sales reporting

Essentially the CRM capabilities expected from a serious SaaS platform.

5. Marketing

Eventually:

Social media management
Social planner
Content calendar
Content creation
AI content generation
Campaign management
Ad campaign management
Media buying workflows
Lead generation
Forms
Landing pages
Funnels
Email marketing
SMS marketing
Analytics
6. Telecommunications / Telemarketing

This is one of the initial services we can sell, even before our own telecom software exists.

We can provide businesses with:

Cold calling
Customer service
Telemarketing
Call center services
Virtual agents
Phone numbers
Calling seats
Dialers
CRM systems
Pipelines
Call management systems

Eventually we may build our own telecommunications module.

If this side becomes large enough, we may create a separate company/brand under the parent company.

Example idea:

CallVister

But that is only an example and has NOT been finalized.

7. Systems / CRM / Automation Services

We can already provide businesses with complete systems.

This includes:

CRM setup
Pipelines
Funnels
Websites
Landing pages
Forms
Calendars
Automations
Chatbots
AI agents
Lead capture
CRM integrations
Business workflows
WhatsApp integrations
GoHighLevel systems
Other business software integrations

The founder/developer already has practical experience building these kinds of systems.

Portfolio:

https://codys-new-portfolio.vercel.app/

Use the portfolio as context for the type of technical/business systems we are capable of delivering.

8. Virtual Assistant Services

Another service we can sell immediately.

Businesses can hire VAs through us.

Potential services:

Administrative VA
Marketing VA
Content creation VA
Customer service VA
Sales VA
Lead generation VA
Social media VA
CRM VA
Specialized VAs

The number of agents can scale according to client requirements.

Again, these services can be sold before the SaaS platform itself is fully built.

9. Business Model

The important strategy is:

Phase 1 — Services

Sell:

Telecommunications
Cold calling
Customer service
Marketing
Content creation
Media buying
CRM setup
Automation
Websites
Funnels
AI systems
VAs

We don't need to have every software feature ourselves.

We can use existing third-party tools when necessary.

Phase 2 — SaaS MVP

Start building our own platform.

Initial platform:

Organizations
Departments
Employees
Roles
Permissions
Dashboard
Calendar
Clock in / clock out

This becomes the foundation.

Phase 3 — Product Expansion

Add:

CRM
Pipelines
Tasks
Internal chat
Marketing
Social planner
Automations
AI
Forms
Funnels
Analytics
Phase 4 — Replace Third-Party Tools

Whenever we identify something we're paying another company for, we can eventually build our own version.

For example:

Instead of:

GoHighLevel CRM → UpLevel CRM

Instead of:

Slack → UpLevel Chat

Instead of:

Calendly → UpLevel Scheduling

Instead of:

Separate time tracking → UpLevel Time

Instead of:

Separate employee tools → UpLevel Organization

etc.

10. The Most Important Architectural Concept

The system should NOT be designed around CRM first.

It should be designed around:

Organization → Users → Departments → Roles → Permissions → Modules

Everything else should plug into that.

Conceptually:

UpLevel
│
├── Organizations
│
├── Users
│
├── Departments
│
├── Roles
│
├── Permissions
│
├── Modules
│
├── Calendar
│
├── Time Tracking
│
├── CRM
│
├── Marketing
│
├── Telecommunications
│
├── Automations
│
├── AI
│
├── Chat
│
├── Tasks
│
└── Analytics

This allows the product to become much bigger without rebuilding its foundation.

11. Modular Architecture

The platform should eventually treat features as modules.

Potential modules:

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

An organization can have modules enabled or disabled.

Then employee access can be controlled by:

Organization → Department → Role → Permissions → Module

This should be designed into the architecture from the beginning.

12. Initial MVP

The first version should be deliberately small.

Build:

Authentication
Sign up
Login
Logout
Protected routes
Session persistence
Organizations
Create organization
Organization profile
Organization settings
Employees
Employee list
Employee profiles
Add employees
Department assignment
Role assignment
Employee status
Departments
Create department
Edit department
Delete department
View members
Assign employees
Roles

Initial roles:

Owner
Admin
Manager
Employee

But the architecture should support custom roles later.

Permissions

Examples:

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
Time Tracking

Basic:

Clock in
Clock out
Current working status
Today's working time
Previous time entries
Calendar

Basic:

Month view
Week view
Day view
Create event
Edit event
Delete event
Event details
Assign event to user
Dashboard

Show:

Organization
Current user
Department
Role
Today's date
Clock-in status
Clock in/out button
Today's working time
Upcoming events

Admins can additionally see:

Total employees
Total departments
Currently clocked-in employees
Upcoming events
13. Security

This is extremely important.

This is a multi-tenant SaaS.

Organization A must NEVER be able to access Organization B's data.

We want:

Supabase Auth
PostgreSQL
Row Level Security
Organization-level isolation
Server-side authorization
Permission checks
Input validation

Do NOT rely only on frontend permissions.

Changing something like:

/organization/123

to:

/organization/456

must NOT expose another organization's data.

14. Initial Database

Expected tables:

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

Potential future tables:

contacts
companies
leads
deals
pipelines
pipeline_stages
tasks
conversations
messages
campaigns
social_accounts
automations
ai_agents
notifications
subscriptions
invoices
etc.

Don't build the future tables unless necessary for the architecture.

15. Initial Technology Direction

The recommendation was:

Frontend / Application

Next.js + TypeScript

UI

Tailwind CSS + shadcn/ui

Database

PostgreSQL through Supabase

Authentication

Supabase Auth

Validation

Zod

Forms

React Hook Form

Icons

Lucide React

Hosting

Vercel

Backend

For the initial version:

No separate FastAPI backend.

Use Next.js server functionality + Supabase.

The reason is simplicity.

We don't need to introduce:

FastAPI
Express
NestJS
Redis
Docker
Kubernetes
microservices

at this stage.

If the platform becomes sufficiently complex later, we can split services out.

16. AI Coding Strategy

We want to build this using free AI coding models whenever possible.

The user is considering coding agents such as:

OpenCode
free coding models
Big Pickle
Qwen coding models
DeepSeek coding models
similar free models

The important principle:

The AI should execute our architecture, not invent the architecture every time.

We want incremental development.

Do NOT tell the AI:

"Build me a GoHighLevel competitor."

That will produce a huge amount of messy, incomplete code.

Instead:

Establish architecture.
Build authentication.
Build organizations.
Build RBAC.
Build departments.
Build employees.
Build time tracking.
Build calendar.
Test everything.
Then add modules one at a time.
17. AI Coding Rules

The coding agent should:

Inspect the repository first.
Never blindly delete existing work.
Reuse existing components.
Use strict TypeScript.
Avoid any.
Keep business logic separate from UI.
Use reusable components.
Avoid unnecessary abstractions.
Run lint.
Run TypeScript checks.
Fix errors before finishing.
Never invent credentials.
Never commit secrets.
Use .env.example.
Create proper database migrations.
Properly implement RLS.
Keep the project runnable.
18. Branding

Current working name:

UpLevel

The meaning is:

Helping businesses level up.

The name should eventually be suitable as the parent company, not just the SaaS product.

The parent company could eventually own multiple businesses.

For example:

UPLEVEL
│
├── UpLevel Platform
│
├── CallVister
│   └── Telecommunications / Call Center
│
├── UpLevel Marketing
│
├── UpLevel Systems
│
└── Other future companies

These names are examples, not final decisions.

The important requirement is:

The parent brand must be broad enough that we're not trapped inside CRM, marketing, telecommunications, or any other single service.

We want a name associated with:

Growth
Progress
Scaling
Business transformation
Taking companies to the next level
Technology
Operations

Possible naming directions can be explored later.

19. Website Strategy

The public website will initially be a services + SaaS website.

Potential sections:

Home

Explain what UpLevel does.

Services

Possible categories:

Telecommunications
Cold calling
Customer service
Telemarketing
Dialers
Phone numbers
Call center systems
Marketing
Content creation
Social media
Media buying
Advertising
Marketing VAs
Business Systems
CRM
Pipelines
Funnels
Websites
Automations
AI agents
Chatbots
Integrations
Virtual Assistance
Administrative
Marketing
Customer service
Sales
Specialized VAs
Platform

Explain the SaaS.

At first, some platform features may be marked:

Coming Soon

because we're building the product gradually.

20. Payments

The company is based in Egypt.

The initial payment gateway being considered is:

PayTabs

We also discussed looking at Egyptian/international alternatives such as Paymob, but payment-provider capabilities and current availability should be verified before making a final decision.

Long-term, the platform needs:

Recurring subscriptions
Monthly billing
Possibly annual billing
US customers
European customers
Egyptian/Middle Eastern customers

Stripe would be desirable internationally if/when the business structure allows access to it.

Do NOT hard-code payment architecture around one provider.

Design billing as an abstraction/module so providers can be changed later.

21. Very Important Product Philosophy

This should not become:

"100 features thrown into one dashboard."

The product should feel like:

One operating system for the business, personalized for each employee.

The CEO sees the business.

The manager sees their team.

The marketing employee sees marketing.

The sales employee sees sales.

The VA sees their work.

The platform adapts around them.

The goal is:

Employees log into UpLevel and start working immediately instead of opening 10 different applications.

That is one of the biggest differentiators we're aiming for.

22. Current Development Goal

Right now, DO NOT build:

Full CRM
Advanced automation engine
AI agent platform
Telephony
Social media integrations
Slack replacement
Payment system
Advanced HR
Payroll
Advanced analytics
Complex workflows

The immediate goal is:

AUTH
 ↓
ORGANIZATION
 ↓
EMPLOYEES
 ↓
DEPARTMENTS
 ↓
ROLES
 ↓
PERMISSIONS
 ↓
MODULES
 ↓
DASHBOARD
 ↓
TIME TRACKING
 ↓
CALENDAR

Once that foundation is stable, we expand.

23. Development Mindset

This is a long-term product, not a quick weekend project.

We care about:

Architecture
Security
Scalability
Maintainability
UX
Performance
Modularity

But we should NOT overengineer the first version.

The rule is:

Simple now, scalable later.

Build only what we need today, but structure it so tomorrow's features don't force us to rewrite everything.

24. What I Want From the AI Going Forward

Act as a senior CTO + full-stack engineer, not just a code generator.

When making architectural decisions:

Think about the long-term SaaS.
But don't overengineer.
Explain important decisions.
Warn me when an idea is technically bad.
Don't blindly agree with me.
Prioritize security.
Prioritize performance.
Prioritize clean architecture.
Build incrementally.

When I ask you to implement something:

Inspect the existing project.
Understand the current architecture.
Plan the change.
Implement it.
Test it.
Fix errors.
Tell me what changed.
Tell me what I need to configure manually.

Do not rebuild unrelated parts of the application.

25. Current Starting Point

The GitHub repository has been created with the name:

UpLevel

The project is currently at the beginning of development.

The next step is to initialize/build the foundation using the architecture described in the accompanying:

PROJECT_ARCHITECTURE.md

That file contains the detailed first implementation prompt.

The first coding milestone should be the multi-tenant organizational foundation + authentication + RBAC + basic calendar + clock in/out system.

The Big Picture

The business starts as:

Services company + SaaS

Then evolves into:

SaaS platform

Then potentially:

Business Operating System

Long term:

                    UPLEVEL
                       │
          ┌────────────┴────────────┐
          │                         │
      SERVICES                    PLATFORM
          │                         │
   ┌──────┼──────┐          ┌───────┼────────┐
   │      │      │          │       │        │
 Telecom Marketing VAs     CRM    AI     Automation
   │      │      │          │       │        │
   └──────┴──────┘          └───────┼────────┘
                                    │
                              Business OS
                                    │
                         ┌──────────┼──────────┐
                         │          │          │
                       HR       Operations   Sales
                         │          │          │
                      Employees  Departments CRM

The immediate objective is not to build all of this.

The objective is to build the foundation that makes all of this possible later.