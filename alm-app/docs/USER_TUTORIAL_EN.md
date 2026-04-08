# ALM User Guide

**Version:** 1.0 &nbsp;|&nbsp; **Updated:** April 2026 &nbsp;|&nbsp; **Demo:** https://demo.pamera.app.provera.net.tr

---

## About This Guide

ALM (Application Lifecycle Management) helps you manage the full software lifecycle in one platform, from requirements analysis to test management, sprint planning, and deployment traceability.

This guide explains core concepts for new users and step-by-step daily workflows for experienced users.

> **Demo environment:** Sign in with `admin@example.com` / `Admin123!` to explore all features live. The demo organization includes two ready projects: **Sample Project** (`SAMP`) and **Unima** (`UNIMA`).

---

## Table of Contents

- [Where Should I Start Based on My Role?](#where-should-i-start-based-on-my-role)
- [Core Concepts](#core-concepts)
- [Section 1: Interface and Navigation](#section-1-interface-and-navigation)
- [Section 2: Sign-in and Organization Management](#section-2-sign-in-and-organization-management)
- [Section 3: Project Setup](#section-3-project-setup)
- [Section 4: Backlog and Work Items](#section-4-backlog-and-work-items)
- [Section 5: Work Item Details Panel](#section-5-work-item-details-panel)
- [Section 6: Quality and Test Management](#section-6-quality-and-test-management)
- [Section 7: Board and Kanban](#section-7-board-and-kanban)
- [Section 8: Planning, Sprint, and Release](#section-8-planning-sprint-and-release)
- [Section 9: Traceability and Impact Analysis](#section-9-traceability-and-impact-analysis)
- [Section 10: Automation Rules](#section-10-automation-rules)
- [Section 11: Member and Role Management](#section-11-member-and-role-management)
- [Section 12: Manifest and Process Templates](#section-12-manifest-and-process-templates)
- [Section 13: Dashboard and Reporting](#section-13-dashboard-and-reporting)
- [Section 14: Step-by-Step Workflows](#section-14-step-by-step-workflows)
- [Section 15: Usage Scenarios](#section-15-usage-scenarios)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Glossary](#glossary)
- [Quick Reference Card](#quick-reference-card)

---

## Where Should I Start Based on My Role?

If your time is limited, find your role below and jump to the related sections.

### I am a Project Manager or Product Owner

Set up your project, define requirements, and track progress.

1. **Create a project** -> [Section 3](#section-3-project-setup)
2. **Write Epic and User Story items** -> [Section 4: Create New Work Item](#create-new-work-item)
3. **Plan a sprint** -> [Section 8](#section-8-planning-sprint-and-release)
4. **Track progress on Dashboard** -> [Section 13](#section-13-dashboard-and-reporting)

### I am a Developer or Team Member

Manage daily work through the Board.

1. **See your assigned items** -> Use the "Assigned: Me" filter on Board - [Section 7](#section-7-board-and-kanban)
2. **Activate a work item** -> Move card from `To Do -> In Progress`
3. **Link commits to work item** -> [Section 5: Source Tab](#tab-4-source)
4. **Mark task complete** -> [Section 5: Tasks Tab](#tab-2-tasks)

### I am a Test Specialist

Create test scenarios, run campaigns, and log defects.

1. **Write test scenario** -> [Section 6: Test Catalog](#61-test-catalog)
2. **Create and run campaign** -> [Section 6: Campaign](#62-test-campaign)
3. **Enter results and open defect** -> [Section 6: Test Run](#63-test-run)
4. **Check coverage** -> [Section 9: Traceability](#91-traceability-matrix)

### I am an Organization Admin

Manage access control, roles, and system configuration.

1. **Invite members** -> [Section 11: Member Management](#invite-member)
2. **Create custom role** -> [Section 11: Role Management](#role-management)
3. **Review access logs** -> [Section 11: Audit Log](#audit-log)
4. **Configure process templates** -> [Section 12](#section-12-manifest-and-process-templates)

---

## Core Concepts

Knowing these concepts will make the rest of the guide much easier.

| Concept | Description | Example |
|--------|-------------|---------|
| **Organization (Tenant)** | Isolated workspace for a company or team | "Demo" org |
| **Project** | Independent unit under an organization; has its own backlog, board, and quality tree | "Sample Project" (`SAMP`) |
| **Artifact / Work Item** | Anything tracked: Epic, User Story, Defect, Task | `SAMP-42` |
| **Artifact Key** | Project code + number; unique and permanent | `SAMP-42` |
| **Manifest** | Project rules: available work item types, allowed states and transitions | Scrum template |
| **Workflow / State Machine** | States a work item can move through and transition rules between them | `New -> Active -> Resolved -> Closed` |
| **Cycle** | Sprint; work group in a specific date range | "Sprint 3" |
| **Release** | Software package to be delivered | "v1.2.0" |
| **Area** | Organizational partition by team or product | "Backend", "Mobile" |
| **Campaign** | Grouped test scenarios for a specific sprint or release | "Sprint 3 Acceptance Tests" |
| **Traceability** | End-to-end chain from requirement to test, defect, code, and deployment | - |

> **Important:** Deleting a work item does not permanently erase it; it is archived. You can restore it using the "Show deleted" filter in Backlog.

---

## Section 1: Interface and Navigation

### Screen Layout

The app has three main regions:

```
+------------------------------------------------------------------+
| Demo v         [Search or type command... Ctrl+K]     Bell  YS v |
+----------------+--------------------------------------------------+
|                |                                                  |
| PROJECTS       |                MAIN CONTENT AREA                |
| Dashboard      |                                                  |
| ---------      |     (Content of selected page is shown here)    |
| v Sample Prj   |                                                  |
|   Backlog      |                                                  |
|   Board        |                                                  |
|   Planning     |                                                  |
| v Quality      |                                                  |
|   Catalog      |                                                  |
|   Campaign     |                                                  |
|   Runs         |                                                  |
|   Defects      |                                                  |
|   Traceability |                                                  |
|   Automation   |                                                  |
| ---------      |                                                  |
| Settings       |                                                  |
+----------------+--------------------------------------------------+
```

### Left Navigation

The left menu has two layers: **organization level** (always visible) and **project level** (visible when a project is selected).

**Organization level:**

| Item | What it does |
|------|---------------|
| Projects | Lists all projects |
| Dashboard | Organization-wide metrics and activity stream |

**Project level** (after selecting a project):

| Item | What it does |
|------|---------------|
| Overview | Project summary card |
| Backlog | Tree or table view of work items |
| Board | Kanban with drag-and-drop state management |
| Planning | Sprint/release cycles and area hierarchy |
| Quality -> Catalog | Test scenario library |
| Quality -> Campaign | Test sets |
| Quality -> Runs | Test run history |
| Quality -> Defects | Defect list |
| Quality -> Traceability | Requirement-test coverage matrix |
| Automation | Event-based workflow rules |

**Settings (organization level):**

| Item | What it does |
|------|---------------|
| Members | Member management and invitations |
| Roles | Role creation and permission assignment |
| Permissions | Read-only list of system permissions |
| Audit | Login/access records (Admin only) |
| Manifest | Process templates |

### Top Bar

**Organization name (top-left):** Click to switch to another organization you can access.

**Command Palette (`Ctrl+K` / `Cmd+K`):** Fastest way to navigate.

- Type any page name and press `Enter`
- Recently visited projects are auto-listed
- Use arrow keys to navigate, `Esc` to close

**User menu (top-right avatar):** Theme (light/dark) and sign out.

---

## Section 2: Sign-in and Organization Management

### Sign In

1. Open the application URL
2. Enter **Email** and **Password**
3. Click **Sign In**

If you belong to multiple organizations, you will be asked to select one after login.

> **Demo account:** `admin@example.com` / `Admin123!`

### Create a New Account

1. Click **Sign Up** on the login page
2. Enter name, email, and password
3. If email verification is enabled, complete verification

### Switch Organization

Click the organization name in the top-left and choose from the dropdown list.

### Organization Settings

**Settings -> General:**

- Edit organization name and short slug
- **Danger Zone:** Archive organization (irreversible)

---

## Section 3: Project Setup

### List Projects

Click **Projects** in the left menu. Each project card shows name, code, member count, and summary info.

### Create a New Project

1. Click **+ New Project**
2. Fill in the form:

| Field | Required | Rule / Description |
|------|----------|--------------------|
| **Project Code** | Yes | 2-10 chars, uppercase letters and numbers (`SAMP`, `MYPRJ01`), immutable |
| **Project Name** | Yes | Meaningful name |
| **Process Template** | Yes | Basic, Scrum, or custom manifest |
| **Description** | No | Project scope and purpose |

3. Click **Create**

> **Warning:** Project code forms work item keys (`SAMP-1`, `SAMP-2`) and cannot be changed later.

### Project Settings

Inside a selected project, open **Settings**:

- **General:** Edit project name/description
- **Members:** Add project members and assign project-level roles
- **Teams:** Create teams if needed (e.g., Frontend, Backend)

---

## Section 4: Backlog and Work Items

Backlog is the central page for managing all work items: requirements, user stories, defects, and tasks.

### View Modes

Switch between two views using top-right icons:

- **Tree View:** Visual hierarchy (Epic -> Feature -> User Story), supports drag-and-drop nesting
- **Table View:** Fast inline editing for high-volume updates

### Table Columns

| Column | Description |
|--------|-------------|
| Key | Unique ID (`SAMP-42`) |
| Title | Work item title |
| Type | Artifact type |
| Status | Current workflow state |
| Assignee | Responsible member |
| Tags | Multiple labels |
| Cycle | Sprint/release assignment |
| Area | Organizational area |
| Created | Created date |
| Updated | Last updated |

Custom manifest fields (priority, story points, affected version, etc.) can appear as extra columns.

### Create New Work Item

1. Click **+ New**
2. Select type:

| Type | Usage |
|------|------|
| **Epic** | Large work package across multiple sprints |
| **Feature** | Subcomponent of an Epic |
| **User Story** | Single user need |
| **Defect / Bug** | Identified issue |
| **Task** | Technical sub-task |

3. Fill form fields and click **Save**.

### Edit Work Item

- **Inline edit (table):** Click cell, update value, confirm with `Enter`
- **Details panel:** Click row to open full editor panel

### Filter and Search

Backlog toolbar supports rich filtering: search, status, type, release, cycle, area, tag, assignee, sorting, deleted items, stale traceability.

### Saved Queries

1. Apply filters
2. Click **Save Query**
3. Name it and choose scope: **Personal** or **Project**
4. Reuse with one click

### Bulk Actions

Select multiple rows using checkboxes, then apply bulk status change, bulk assignment, or bulk archive.

### Export / Import

- **Export:** CSV or Excel from menu
- **Import:** CSV template upload

> **Note:** Import creates new work items; it does not update existing ones.

---

## Section 5: Work Item Details Panel

Click any work item to open the right-side details panel.

### Header

Shows key, status badge, active viewers count, title, type, assignee, tags, created and updated dates.

### Status Transition

Click status badge to move through allowed manifest transitions. Some transitions may require reason or resolution type.

### Tab 1: Details

Edit description, cycle, area, and manifest custom fields.

### Tab 2: Tasks

Add and manage technical sub-tasks with assignee, team, hours, activity, and tags.

### Tab 3: Links

Create relationships between work items:

- `depends-on`
- `blocks`
- `relates-to`
- `parent`
- `implements`
- `traces-to`

### Tab 4: Source

If SCM integration is enabled, this tab shows branch, commits, and PR/MR info.

### Tab 5: Deploy

Shows deployments that include this work item, with environment, date, version, and success/failure state.

### Tab 6: Impact

Analyze downstream/upstream impact with configurable depth and relation filters.

### Tab 7: Attachments

Upload/download/delete files (permission-based).

### Tab 8: Comments

Add, edit, delete comments and mention users with `@username`.

### Tab 9: Audit

Full change history (time, user, event, old value, new value).

---

## Section 6: Quality and Test Management

Quality module has five sub-sections: **Catalog**, **Campaign**, **Runs**, **Defects**, **Traceability**.

### 6.1 Test Catalog

Create and organize test scenarios in folder hierarchy.

### 6.2 Test Campaign

Group test scenarios per sprint/release.

### 6.3 Test Run

Execute a campaign in a specific environment and record outcomes:

- Passed
- Failed
- Blocked
- Not Run

Create a defect directly from failed test rows.

### 6.4 Defect Management

Defect-specific fields include severity, reproducibility, detected/fixed version, environment, and resolution type.

### 6.5 Traceability Matrix

Color states:

- Green: all linked tests passed
- Red: at least one failed
- Yellow: linked tests without result
- Gray: no linked tests

---

## Section 7: Board and Kanban

Board visualizes work items by workflow status columns and supports drag-and-drop transitions.

- Filter by type, cycle, release, area, assignee, search
- Move cards between columns if transition is allowed
- Denied transitions show feedback

---

## Section 8: Planning, Sprint, and Release

Planning has three parts: **Cycles**, **Releases**, **Areas**.

- Create cycles (sprints) with start/end dates
- Create releases with date ranges
- Assign work items to cycles from details, table, or bulk action
- Build area hierarchies for team/product organization

---

## Section 9: Traceability and Impact Analysis

End-to-end chain:

Requirement -> Test Scenario -> Test Run -> Defect -> Source Code -> Deployment

Use Impact tab with depth control (1-5) to inspect relationship effects.

Use stale traceability filter in Backlog to find requirements without linked tests.

---

## Section 10: Automation Rules

Rule model:

`[Trigger] -> [Optional Condition] -> [Action]`

Common triggers:

- `artifact_state_changed`
- `artifact_assigned`
- `artifact_created`
- `artifact_commented`

Actions:

- Webhook (Slack, Teams, Jira, etc.)
- Log

Rules can be enabled/disabled, monitored, or deleted.

---

## Section 11: Member and Role Management

### Invite Member

Settings -> Members -> + Invite -> enter email -> select roles -> send invite.

### Create User (Admin only)

Create account directly with name, email, password, and role.

### Remove Member

Members are archived, not permanently deleted, and can be restored.

### Role Management

System roles:

- Admin
- Editor
- Viewer

Create custom roles with hierarchy level and granular permissions.

### Audit Log

Available to users with `audit:read`.

Tracks login success/failure with timestamp, email, IP, and user agent.

---

## Section 12: Manifest and Process Templates

Manifest defines work item types, workflows, and transition rules.

Built-in templates:

- Basic
- Scrum
- ADO-Style

You can version manifests, validate YAML, and activate new versions.

> Test manifest changes before production rollout.

### SCM Integration

Configure webhook events (`push`, `pull_request`) and include work item keys in commit messages:

```text
SAMP-42: implement password reset flow
SAMP-55 fix: resolve redirect loop after login
```

Commits/PRs will appear automatically in the Source tab.

---

## Section 13: Dashboard and Reporting

Dashboard provides organization/project metrics, charts, and activity feed.

Cards commonly include total projects, backlog items, tasks, and open defects.

Charts include distribution, velocity, and burndown.

Controls include project selector, time range, release filter, and project-only mode.

---

## Section 14: Step-by-Step Workflows

### Flow A: Requirement -> Test -> Defect -> Fix

1. Create Epic
2. Add User Story
3. Create test scenario
4. Link test to requirement
5. Create campaign
6. Execute run and fail scenario
7. Create defect
8. Fix defect and resolve
9. Re-run tests and pass
10. Verify traceability matrix is green

### Flow B: Sprint Planning and Board Tracking

1. Create sprint
2. Assign stories to sprint
3. Open board with sprint filter
4. Move cards daily across statuses
5. Track burndown on dashboard

### Flow C: Onboarding a New Team Member

1. Create custom role
2. Invite member
3. Add member to project
4. Member signs in with scoped permissions

### Flow D: Full Traceability from Defect to Code

1. Open defect details
2. Inspect Source tab commit/PR links
3. Check linked story and tests
4. Check Deploy tab for target environments
5. Inspect Impact tab chain to Epic

---

## Section 15: Usage Scenarios

- UC-01: Requirement management
- UC-02: Defect tracking
- UC-03: Test planning and execution
- UC-04: Sprint planning
- UC-05: Kanban board tracking
- UC-06: Traceability analysis
- UC-07: Member and role management
- UC-08: SCM integration
- UC-09: Automation rules
- UC-10: Audit and security monitoring

---

## FAQ

### How do I restore a deleted work item?

Enable **Show deleted** filter in Backlog and restore from item actions.

### Can I change project code after creation?

No. Project code is immutable because it is part of all work item keys.

### Can I move a work item to another project?

Not in current version. Create a new item in target project and link them.

### Why can't I move cards on Board?

Possible reasons:

1. Transition is not allowed in manifest
2. Missing `artifact:transition` permission

### Why is a requirement gray in Traceability Matrix?

Gray means no test scenario is linked. Add a `traces-to` link from test scenario.

### Can I share saved queries?

Yes. Save query with **Project** scope.

### Can I create a campaign without tests?

You can create an empty campaign, but cannot start runs until tests are added.

---

## Troubleshooting

| Symptom | Possible Cause | Resolution |
|---------|----------------|------------|
| Cannot sign in | Wrong email/password | Use forgot password |
| Page does not load | Network issue | Check connection and refresh |
| Board is empty | Type filter missing | Select a type filter |
| Access denied page | Missing role permission | Contact admin |
| Card cannot move | Invalid transition / missing permission | Check manifest and permissions |
| All traceability rows are gray | Tests not linked to requirements | Add `traces-to` links |
| Manifest activation fails | Schema validation error | Fix highlighted YAML lines |
| Source tab is empty | Webhook not configured | Configure SCM webhook |
| Invite email not delivered | SMTP not configured | Ask admin for direct invite link |

---

## Glossary

| Term | Definition |
|------|------------|
| Artifact | Any tracked work item (Epic, Story, Defect, Task) |
| Artifact Key | Project code + number (e.g., `SAMP-42`) |
| Area | Team/product-based organizational segment |
| Backlog | Master list of all project work items |
| Board | Kanban-style work management view |
| Cycle | Sprint date range |
| Defect | Software bug/issue |
| Epic | Large work package |
| Feature | Functional unit under Epic |
| Campaign | Grouped tests for sprint/release |
| Manifest | Config defining types, states, and transitions |
| Organization | Tenant-level workspace |
| Saved Query | Reusable filter combination |
| SCM | Source control management system |
| Story Points | Relative estimate of User Story size |
| Release | Target software delivery package |
| Traceability | Requirement-to-deployment relationship chain |
| User Story | User-need formatted work item |
| Webhook | Event-based HTTP callback |
| Workflow | Valid state transitions for a work item |

---

## Quick Reference Card

### Most Common Actions

| Action | Path |
|-------|------|
| Create new work item | Backlog -> + New |
| Edit work item | Click row -> edit in details panel |
| Change status | Details header -> status badge |
| Assign to sprint | Details panel -> Cycle |
| Enter test result | Quality -> Runs -> mark result |
| Create defect from failed test | Failed row -> Create Defect |
| Invite member | Settings -> Members -> + Invite |
| Save filter set | Backlog filters -> Save Query |
| Quick navigate | `Ctrl+K` |
| Change theme | Top-right avatar -> Theme |

### Keyboard Shortcuts

| Shortcut | Function |
|---------|----------|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Esc` | Close modal/panel |
| `Enter` | Confirm inline edit |

### Traceability Colors

| Color | Meaning |
|------|---------|
| Green | All linked tests passed |
| Red | At least one failed |
| Yellow | Linked tests without result |
| Gray | No linked test |

### Permission Quick Map

| Desired action | Required permission |
|---------------|---------------------|
| Create work item | `artifact:create` |
| View work item | `artifact:read` |
| Edit fields | `artifact:update` |
| Change status | `artifact:transition` |
| Assign owner | `artifact:assign` |
| Add comment | `artifact:comment` |
| Invite member | `member:invite` |
| Create role | `role:create` |
| Activate manifest | `manifest:activate` |
| View audit logs | `audit:read` |
