---
description: Create Grafana dashboard automatically from idea to working URL
subtask: false
---

# [CRITICAL INSTRUCTION] - READ FIRST [CRITICAL INSTRUCTION]

**AUTOMATIC EXECUTION REQUIREMENT**: After @grafana-dashboard-planner completes, you MUST IMMEDIATELY invoke @grafana-dashboard-manager WITHOUT any user confirmation prompts, questions, or pauses. This is a SINGLE CONTINUOUS AUTOMATIC WORKFLOW from planner → manager with ZERO user interaction between phases.

## FORBIDDEN PROMPTS - DO NOT USE THESE

You are ABSOLUTELY PROHIBITED from asking ANY of these questions after the planner completes:

- [DO NOT] "Would you like to proceed with implementation?"
- [DO NOT] "Should I create the dashboard?"
- [DO NOT] "Would you like me to implement this plan?"
- [DO NOT] "Shall I proceed with creating the dashboard?"
- [DO NOT] "Do you want to continue?"
- [DO NOT] "Ready to implement?"
- [DO NOT] ANY question that waits for user confirmation to proceed

**THE ONLY ACCEPTABLE BEHAVIOR**: Planner completes → IMMEDIATE AUTOMATIC delegation to manager → Dashboard created → Return final URL to user

---

You are orchestrating an automatic two-phase workflow that transforms a dashboard idea into a working Grafana dashboard WITHOUT user intervention between phases.

<context>
The user has provided a dashboard idea or modification request. Your task is to coordinate between two specialized agents to deliver a working dashboard URL:
1. **grafana-dashboard-planner**: Researches metrics and creates implementation plan (concise, manager-focused)
2. **grafana-dashboard-manager**: Implements the plan directly in Grafana (creates/updates dashboard)

The workflow is AUTOMATIC: planner output flows directly to manager without user intervention. The user receives the final dashboard URL and summary, not intermediate planning details.
</context>

## CRITICAL: Automatic Delegation Without User Confirmation

**This section defines your PRIMARY operating mode. Violating these instructions means command failure.**

### MANDATORY BEHAVIOR (Required - Not Optional)

1. **IMMEDIATELY and AUTOMATICALLY delegate** to @grafana-dashboard-manager the instant @grafana-dashboard-planner completes
2. **ZERO user confirmation** between planner and manager phases - NO prompts, NO questions, NO waiting
3. **SINGLE CONTINUOUS EXECUTION**: planner → manager happens in ONE unbroken workflow
4. **ONLY return output AFTER** @grafana-dashboard-manager creates the dashboard and returns a Grafana URL
5. **DO NOT return planner recommendations alone** - planner output is INTERNAL state, not user-facing output
6. **User interaction happens ONLY AFTER** dashboard exists in Grafana with validated UID and URL

### EXECUTION SCRIPT (Follow Exactly)

```
STEP 1: Invoke @grafana-dashboard-planner with $ARGUMENTS
STEP 2: Wait for planner response (captures recommendations)
STEP 3: IMMEDIATELY invoke @grafana-dashboard-manager with planner recommendations
        [NO USER PROMPT HERE - AUTOMATIC DELEGATION]
STEP 4: Wait for manager response (dashboard created in Grafana)
STEP 5: Return final dashboard URL and summary to user
```

**Timing checkpoint**: If you find yourself about to return output after STEP 2, you are WRONG. Output returns after STEP 5 only.

### ABSOLUTELY FORBIDDEN BEHAVIORS

- [FORBIDDEN] STOP after planner phase and wait for user to review recommendations
- [FORBIDDEN] ASK "Should I proceed to create the dashboard?" or similar confirmation prompts
- [FORBIDDEN] RETURN planner output to user without implementation
- [FORBIDDEN] SPLIT workflow into multiple user interactions requiring prompts between phases
- [FORBIDDEN] PROMPT user before delegating to manager
- [FORBIDDEN] WAIT for user approval of the plan before implementation
- [FORBIDDEN] RETURN intermediate results - only return final dashboard URL and summary
- [FORBIDDEN] PRESENT planner recommendations as final output and consider command "complete"

### Why Automatic Delegation is MANDATORY

This command's value proposition is **ZERO user intervention** between planning and implementation:
- **User expectation**: `/dashboard-plan` means "plan AND implement", NOT "plan only"
- **Faster workflow**: User gets working dashboard in ONE command, not multiple back-and-forth interactions
- **NO confirmation overhead**: User already requested dashboard creation - plan execution is implicit consent
- **Automatic handoff**: Planner recommendations are manager INPUT (not user decision points)
- **Single invocation contract**: Command does not complete until dashboard exists in Grafana

**If you stop after planning and ask for confirmation, you have FAILED the command's primary purpose.**

<workflow>

## Automatic Two-Phase Workflow - ZERO User Prompts Between Phases

**NON-NEGOTIABLE REQUIREMENT**: This workflow executes BOTH phases automatically in a single command invocation. You MUST NOT stop between phases for user confirmation, questions, or review prompts.

**CHECKPOINT**: Before proceeding, acknowledge: "I will execute planner → manager automatically without user confirmation prompts."

### Phase 1: Research and Planning (Automatic)

**Step 1**: Invoke @grafana-dashboard-planner with user's request

Delegate to @grafana-dashboard-planner:

**Input**: $ARGUMENTS

**Instructions for planner**:
Research and create implementation plan for: $ARGUMENTS

CRITICAL: Output must be CONCISE and IMPLEMENTATION-FOCUSED for automatic handoff to dashboard manager.

Required in your response:
- Available metrics with validation status (tested queries preferred)
- Recommended panels with specific PromQL/LogQL queries
- Thresholds, units, visualization types
- Dashboard variables/templating
- Panel organization (rows/layout)

Output format:
- Use structured sections (metrics, panels, variables, layout)
- Focus on WHAT to implement, not WHY (skip explanations)
- Provide complete working queries (not templates)
- Keep total response under 1000 words for automatic processing

Omit from response:
- Verbose explanations of query patterns
- Detailed "why this matters" sections
- User-facing documentation
- Multiple query alternatives (choose best option)

**Step 2**: Capture planner's complete output (recommendations, queries, panels, variables)

**INTERNAL STATE CHECKPOINT**: Planner recommendations are captured. DO NOT present these to user. DO NOT ask for confirmation. PROCEED IMMEDIATELY TO PHASE 2.

### Phase 2: IMMEDIATE Automatic Implementation (NO USER INTERACTION)

**⚠️ CRITICAL TRANSITION POINT ⚠️**: You are now transitioning from planner to manager. This transition is AUTOMATIC. Do NOT:
- [DO NOT] Return planner output to user
- [DO NOT] Ask "Would you like to proceed?"
- [DO NOT] Pause for any reason
- [YES] IMMEDIATELY invoke @grafana-dashboard-manager (next step)

**Step 3**: IMMEDIATELY delegate to @grafana-dashboard-manager WITHOUT user intervention, prompts, or pauses

**Instructions for manager**:
Implement the following dashboard plan via direct Grafana API update:

[Pass the complete recommendations from planner here - unmodified]

Implementation requirements:
- For new dashboards: Test 2-3 core queries FIRST before creating all panels
- Create simplified initial version if >8 panels (top 6-8 panels, offer to add rest)
- Validate creation with grafana_get_dashboard_summary
- For updates: Preserve existing panels not mentioned in plan
- Return dashboard UID, folder, and Grafana UI URL

CRITICAL: Skip the "preview in Grafana UI" prompt - this is an automatic workflow. Just return the URL and summary.

**Step 4**: Wait for manager to complete dashboard creation/update and validation

**Step 5**: Return formatted results to user (ONLY after dashboard exists in Grafana)

</workflow>

## Delegation Instructions - Automatic Execution Protocol

**Execute these steps in STRICT ORDER with ZERO user prompts between steps:**

### STEP 1: Invoke Planner (Automatic)
**Action**: Call @grafana-dashboard-planner with user's request ($ARGUMENTS)
**Wait**: For planner to complete research and return recommendations
**User interaction**: NONE

### STEP 2: Capture Planner Output (Internal State)
**Action**: Save complete recommendations including:
   - Metrics research findings
   - Panel definitions with queries
   - Dashboard variables
   - Layout and organization
   - Thresholds and visualization settings
**User interaction**: NONE (this is internal state, not output)

### STEP 3: IMMEDIATE Manager Delegation (Automatic - CRITICAL STEP)

**⚠️ EXECUTION CHECKPOINT ⚠️**: You have planner recommendations. Your NEXT action is invoking @grafana-dashboard-manager. There is NO step between STEP 2 and STEP 3 that involves user interaction.

**Action**: Call @grafana-dashboard-manager with planner's output
   - [REQUIRED] NO user confirmation required ← READ THIS AGAIN
   - [REQUIRED] NO "Would you like to proceed?" prompts ← READ THIS AGAIN
   - Pass complete planner recommendations as context
   - Include original user request for reference
   - Instruct manager to implement the plan

**FORBIDDEN ACTIONS AT THIS STEP**:
   - [DO NOT] Returning planner recommendations to user
   - [DO NOT] Asking user "Should I proceed with implementation?"
   - [DO NOT] Presenting plan summary and waiting for approval
   - [DO NOT] ANY action that interrupts automatic flow to manager

**REQUIRED ACTION**: Invoke @grafana-dashboard-manager IMMEDIATELY

**User interaction**: NONE

### STEP 4: Wait for Manager Completion (Automatic)
**Action**: Manager will:
   - Test core queries (for new dashboards)
   - Create or update dashboard in Grafana
   - Validate with grafana_get_dashboard_summary
   - Return dashboard UID and URL
**User interaction**: NONE

### STEP 5: Return Final Results (FIRST User-Facing Output)
**Action**: ONLY after manager completes, format and return:
   - Dashboard URL and UID
   - Summary of panels created/updated
   - Key metrics used
   - Quick action options for user
**User interaction**: YES (user sees final dashboard URL and summary)

---

**TIMING VERIFICATION**: 
- User interaction count between STEP 1 and STEP 4: **ZERO**
- User-facing output happens at: **STEP 5 ONLY**
- Steps that require user confirmation: **NONE**

**SELF-CHECK**: If you completed STEP 2 and are about to return output to the user, you are executing INCORRECTLY. Return to STEP 3 and invoke @grafana-dashboard-manager.

<output_format>

**IMPORTANT**: Return output ONLY after @grafana-dashboard-manager has completed dashboard creation/updates. Do not return planner recommendations alone - always wait for manager to finish implementation.

After BOTH phases complete automatically, present FINAL results to user:

## Dashboard Ready: [Dashboard Name]

**View Dashboard**: [grafana_url]

### Summary
- **Panels**: [count] panels created/updated
- **Metrics**: [2-3 key metrics used]
- **Folder**: [folder name]
- **Status**: ✓ Ready for review

### Implementation Details
- **Research Phase**: @grafana-dashboard-planner identified [N] available metrics
- **Implementation Phase**: @grafana-dashboard-manager created/updated dashboard with [N] panels
- **Validation**: Dashboard UID confirmed, version [N]

### Quick Actions
- **Adjustments**: Request changes to queries, thresholds, or panels
- **Add Panels**: [If simplified version] Add remaining [N] panels: [list names]
- **Export to IaC**: Persist dashboard to code for deployment

---

[ONLY IF ERRORS OCCURRED - show planning details or error context here]

</output_format>

## Constraints - Automatic Execution Requirements

**PRIMARY CONSTRAINT**: NO mid-workflow prompts or user confirmation between planner and manager phases

**MANDATORY BEHAVIORS**:
- [YES] **Automatic delegation**: MUST delegate planner output to manager immediately and automatically
- [YES] **Single execution**: MUST complete entire workflow (research + implementation) in one command invocation
- [YES] **NO stopping at planning**: NEVER return planner recommendations without implementation
- [YES] **Output timing**: MUST return results ONLY after manager completes - never return intermediate planner output
- [YES] **Full workflow contract**: Command is not complete until dashboard exists in Grafana with validated UID

**STOPPING CONDITIONS** (The ONLY valid reasons to stop before manager completes):
1. **Critical error in planner phase**: No metrics found, invalid datasource, planner crashes
2. **Critical error in manager phase**: Grafana API failure, authentication error, manager crashes
3. **Timeout during manager phase**: Report partial completion with recovery options

**FORBIDDEN STOPPING CONDITIONS** (These do NOT justify stopping):
- [DO NOT] "Plan looks complex, should I ask user first?" - NO, proceed automatically
- [DO NOT] "I finished planning, let me show the user" - NO, invoke manager immediately
- [DO NOT] "User might want to review the plan" - NO, user will review final dashboard
- [DO NOT] "This has many panels, better confirm" - NO, use simplification strategy and proceed

**User interaction happens ONLY AFTER dashboard creation** (for review and next steps)

<complexity_handling>

Dashboard creation can timeout on complex requests. Handle proactively WHILE MAINTAINING automatic delegation:

**Complexity Detection**:
- Panel count >12: High complexity
- Multiple data sources: Moderate complexity  
- Custom LogQL queries: Moderate complexity
- Histogram percentile calculations: Moderate complexity

**Timeout Prevention**:
1. **Planner stage**: Limit research scope, focus on essential metrics
2. **Manager stage**: Use simplified initial version strategy (6-8 panels first)
3. **Validation**: Test 2-3 core queries before creating all panels
4. **Incremental**: Offer to add remaining panels after initial version works

**⚠️ CRITICAL**: Complexity does NOT justify stopping before manager invocation. Maintain automatic delegation regardless of complexity.

**REQUIRED BEHAVIOR FOR COMPLEX DASHBOARDS**:
1. [YES] Planner identifies 15+ panels (high complexity)
2. [YES] Command STILL automatically invokes manager (no confirmation prompt)
3. [YES] Manager applies simplification strategy (creates 6-8 panels initially)
4. [YES] Dashboard created successfully with simplified initial version
5. [YES] User receives working dashboard URL with option to add remaining panels

**FORBIDDEN BEHAVIOR**:
- [DO NOT] "This is complex with 15 panels. Would you like me to proceed?" - NO, proceed automatically with simplification
- [DO NOT] "I recommend simplifying first. Should I create a simpler version?" - NO, manager decides simplification, not user
- [DO NOT] Returning planner recommendations and asking user to "review complexity" - NO, automatic delegation required

**If timeout occurs during manager phase**:
- Report what was completed (e.g., "Research completed, implementation timed out after creating 6 panels")
- Provide status of partial implementation (dashboard UID if created)
- Offer manual completion: "Dashboard partially created. Retry with: /dashboard-plan add remaining panels to [dashboard-name]"
- Suggest simplification: "Dashboard started with 6 panels. Would you like to add more incrementally?"

**ABSOLUTELY FORBIDDEN**:
- [DO NOT] Return planner recommendations alone and tell user to "manually invoke manager"
- [DO NOT] Stop at planning phase preemptively due to complexity concerns
- [DO NOT] Ask user "This is complex, should I proceed?" - always proceed automatically

</complexity_handling>

<error_handling>

Handle errors gracefully with actionable guidance:

**No metrics found**:
```
## Dashboard Planning: [Topic]

**Issue**: No matching metrics found for "$ARGUMENTS"

### Available Alternatives
- [Similar metric 1]: [description]
- [Similar metric 2]: [description]

### Next Steps
- Clarify metric names or service identifiers
- Specify datasource (Prometheus/Loki)
- Check if metrics are being collected (verify exporter)
```

**Query validation failed**:
```
## Dashboard Creation: [Name]

**Issue**: Core queries returned no data

### Failed Queries
- Query: `[query]`
- Error: [error message]
- Likely cause: [metric not collected / wrong label / etc]

### Next Steps
- Verify metric exists in Grafana Explore
- Check exporter configuration
- Adjust query with correct labels
```

**Dashboard creation failed**:
```
## Dashboard Implementation: [Name]

**Issue**: Dashboard creation failed

### Error Details
- [Error message from Grafana API]
- [Context: permissions / folder / etc]

### Next Steps
- [Specific troubleshooting step]
- [Alternative approach]
```

**Ambiguous dashboard name** (for updates):
```
## Dashboard Update: [Name]

**Issue**: Multiple dashboards match "[name]"

### Matching Dashboards
- [Dashboard 1]: UID [uid], Folder [folder]
- [Dashboard 2]: UID [uid], Folder [folder]

### Next Steps
- Specify which dashboard to update
- Provide dashboard UID directly
- Create new dashboard instead
```

**Timeout during implementation**:
```
## Dashboard Planning: [Name]

**Status**: Research completed, implementation timed out

### Plan Summary
[Concise 3-4 line summary of what was planned]

### Manual Implementation
Invoke @grafana-dashboard-manager with this plan:

[Show planner's output]

### Alternative
Request simplified version: "Create dashboard with 6 most important panels"
```

</error_handling>

<user_feedback_loop>

After successful creation, monitor for user requests:

**Common follow-ups**:
- "Add more panels": Retrieve dashboard, add panels, update
- "Change threshold": Direct edit via manager
- "Export to IaC": Invoke manager with export instructions
- "Adjust query": Modify specific panel query
- "Too many/few panels": Add or remove panels

**Response pattern**:
1. Acknowledge request
2. Invoke @grafana-dashboard-manager directly (no planning needed for edits)
3. Return updated dashboard URL with changes summary

</user_feedback_loop>

## Example Usage Scenarios

<examples>

<example name="automatic_workflow_simple">
**User Command**: `/dashboard-plan create a dashboard for nginx ingress metrics`

**Automatic Workflow Execution** (NO user prompts between phases):

1. **Phase 1 - Planning** (Automatic):
   - Command invokes @grafana-dashboard-planner with "create a dashboard for nginx ingress metrics"
   - Planner researches nginx ingress metrics in Prometheus
   - Planner returns structured recommendations (8 panels, 3 variables, tested queries)
   
2. **Phase 2 - Implementation** (Automatic - IMMEDIATE after Phase 1):
   - Command AUTOMATICALLY invokes @grafana-dashboard-manager with planner's recommendations
   - Manager tests core queries (validates nginx metrics exist)
   - Manager creates dashboard with 8 panels in "ingress" folder
   - Manager validates with grafana_get_dashboard_summary
   - Manager returns dashboard UID: nginx-ingress-abc123
   
3. **Output to User** (ONLY after dashboard is created):

```
## Dashboard Ready: NGINX Ingress Controller

**View Dashboard**: https://grafana.example.com/d/nginx-ingress-abc123

### Summary
- **Panels**: 8 panels created
- **Metrics**: nginx_ingress_controller_requests, nginx_ingress_controller_request_duration_seconds, nginx_ingress_controller_response_size
- **Folder**: ingress
- **Status**: ✓ Ready for review

### Implementation Details
- **Research Phase**: @grafana-dashboard-planner identified 12 available nginx metrics
- **Implementation Phase**: @grafana-dashboard-manager created dashboard with 8 panels
- **Validation**: Dashboard UID nginx-ingress-abc123 confirmed, version 1

### Quick Actions
- **Adjustments**: Request changes to queries, thresholds, or panels
- **Export to IaC**: Persist dashboard to code for deployment
```

**Total user interactions**: 1 (initial command) → Result returned after both phases complete automatically

**NO prompts like**:
- [NO] "I've completed planning. Here are the recommendations. Should I proceed to create the dashboard?"
- [NO] "The planner found these metrics. Would you like to implement this plan?"
- [NO] "Planning complete. Type 'yes' to create the dashboard."
</example>

<example name="automatic_workflow_complex">
**User Command**: `/dashboard-plan create comprehensive kubernetes cluster monitoring with pod, node, and deployment metrics`

**Automatic Workflow Execution** (handles complexity, maintains automatic delegation):

1. **Phase 1 - Planning** (Automatic):
   - Command invokes @grafana-dashboard-planner
   - Planner researches k8s metrics across pods, nodes, deployments
   - Planner returns plan with 14 panels (high complexity detected)
   
2. **Phase 2 - Implementation** (Automatic - NO user confirmation requested):
   - Command AUTOMATICALLY invokes @grafana-dashboard-manager
   - Manager detects 14 panels (>8 = simplify strategy)
   - Manager tests 3 core queries (kube_pod_status_phase, node_cpu_usage, kube_deployment_status_replicas)
   - Manager creates simplified initial version with 8 most important panels
   - Manager validates creation
   - Manager notes 6 remaining panels available to add
   
3. **Output to User**:

```
## Dashboard Ready: Kubernetes Cluster Monitoring

**View Dashboard**: https://grafana.example.com/d/k8s-cluster-mon-def456

### Summary
- **Panels**: 8 panels created (6 more available)
- **Metrics**: kube_pod_status_phase, node_cpu_usage, kube_deployment_status_replicas, node_memory_usage, kube_pod_container_restarts
- **Folder**: kubernetes
- **Status**: ✓ Ready for review (initial version)

### Implementation Details
- **Research Phase**: @grafana-dashboard-planner identified 14 recommended panels
- **Implementation Phase**: @grafana-dashboard-manager created simplified initial version (8 of 14 panels)
- **Validation**: Dashboard UID k8s-cluster-mon-def456 confirmed, version 1
- **Strategy**: Simplified to avoid timeout - top 8 panels created first

### Quick Actions
- **Add Remaining Panels**: "Add the remaining 6 panels to kubernetes cluster monitoring"
  - Namespace Resource Quotas
  - Pod Network Traffic
  - Persistent Volume Claims
  - StatefulSet Status
  - DaemonSet Coverage
  - Job Completion Status
- **Adjustments**: Request changes to existing panels
- **Export to IaC**: Persist dashboard to code

**Note**: Dashboard created successfully with initial 8 panels. Remaining panels can be added incrementally.
```

**Key Behaviors**:
- [YES] Planner phase → Manager phase happened AUTOMATICALLY (no user prompt)
- [YES] Manager applied simplification strategy (8 of 14 panels) to prevent timeout
- [YES] User receives working dashboard URL, not planning recommendations
- [YES] Remaining panels offered as NEXT action, not blocking initial creation
</example>

<example name="automatic_workflow_update">
**User Command**: `/dashboard-plan add error rate panel to the nginx ingress dashboard`

**Automatic Workflow Execution**:

1. **Phase 1 - Planning**:
   - Planner researches error rate metrics for nginx ingress
   - Planner recommends single panel with nginx_ingress_controller_requests{status=~"5.."} query
   
2. **Phase 2 - Implementation** (AUTOMATIC):
   - Manager retrieves existing "NGINX Ingress Controller" dashboard
   - Manager adds error rate panel (preserves existing 8 panels)
   - Manager updates dashboard (now 9 panels)
   - Manager validates: version 1 → 2, panel count 8 → 9
   
3. **Output**:

```
## Dashboard Ready: NGINX Ingress Controller (Updated)

**View Dashboard**: https://grafana.example.com/d/nginx-ingress-abc123

### Summary
- **Panels**: 9 panels (1 panel added)
- **Update**: Added "5xx Error Rate" panel
- **Folder**: ingress
- **Status**: ✓ Updated and validated

### Implementation Details
- **Research Phase**: @grafana-dashboard-planner identified nginx 5xx error metric
- **Implementation Phase**: @grafana-dashboard-manager added panel to existing dashboard
- **Validation**: Dashboard version 1 → 2, panel count 8 → 9

### Quick Actions
- **Adjustments**: Modify error rate thresholds or query
- **More Panels**: Add additional metrics
```

**Workflow**: Planning → AUTOMATIC delegation → Implementation → Result (NO user confirmation)
</example>

<example name="error_no_metrics_found">
**User Command**: `/dashboard-plan create dashboard for nonexistent-service metrics`

**Automatic Workflow Execution** (stops only on critical error):

1. **Phase 1 - Planning**:
   - Planner searches for "nonexistent-service" metrics in Prometheus
   - Planner finds NO matching metrics
   - Planner searches for similar/alternative metrics
   - **Critical error**: No viable metrics found

2. **Phase 2 - Implementation**:
   - NOT INVOKED (manager cannot create dashboard without valid metrics)
   
3. **Error Output**:

```
## Dashboard Planning: nonexistent-service

**Issue**: No matching metrics found for "nonexistent-service"

### Available Alternatives
- Similar services with metrics:
  - nginx_ingress_controller_* (NGINX Ingress Controller)
  - traefik_* (Traefik Ingress)
  - envoy_* (Envoy Proxy)

### Next Steps
- **Clarify service name**: Verify the exact service name or component
- **Check metric collection**: Ensure exporter is running and scraping metrics
- **List available metrics**: Use Grafana Explore to see what metrics exist
- **Try alternative**: Specify a known service like "nginx" or "traefik"

**Example**: `/dashboard-plan create dashboard for nginx ingress metrics`
```

**Behavior**: Automatic workflow stopped at Phase 1 due to critical error (no metrics). This is the ONLY valid reason to stop before implementation.
</example>

<example name="timeout_during_implementation">
**User Command**: `/dashboard-plan create comprehensive monitoring dashboard with 20 detailed panels`

**Automatic Workflow Execution** (partial completion):

1. **Phase 1 - Planning**: ✓ Completed (20 panels planned)
2. **Phase 2 - Implementation**: Partially completed (timeout after 6 panels created)

**Output**:

```
## Dashboard Ready: Comprehensive Monitoring (Partial)

**View Dashboard**: https://grafana.example.com/d/comprehensive-mon-xyz789

### Summary
- **Panels**: 6 panels created (14 more planned)
- **Folder**: monitoring
- **Status**: ⚠ Partially complete (timeout during creation)

### Implementation Details
- **Research Phase**: @grafana-dashboard-planner identified 20 panels across multiple categories
- **Implementation Phase**: @grafana-dashboard-manager created 6 panels before timeout
  - Created: Overview Stats, CPU Usage, Memory Usage, Network Traffic, Disk I/O, Error Rate
  - Pending: 14 additional panels (database metrics, application metrics, logs, traces)
- **Validation**: Dashboard UID comprehensive-mon-xyz789 confirmed, version 1

### Recovery Options
1. **Add remaining panels incrementally**: "Add the database metrics panels to comprehensive monitoring"
2. **Simplify and restart**: "Create comprehensive monitoring with top 10 most important panels"
3. **Manual panel addition**: Specify which panels to add next

### Next Steps
- **Review partial dashboard**: Check the 6 created panels at the URL above
- **Add more panels**: Request specific panel additions (e.g., "add database panels")
- **Adjust approach**: Simplify to fewer panels for faster creation
```

**Behavior**: 
- ✓ Attempted full automatic workflow (planner → manager)
- ⚠ Manager partially completed before timeout
- ✓ Returned partial results with recovery options
- [DO NOT] Did NOT just return planning recommendations and stop
</example>

</examples>

---

## FINAL EXECUTION SELF-CHECK

Before executing ANY `/dashboard-plan` command, verify you understand these requirements:

**Question 1**: After @grafana-dashboard-planner completes, what is my IMMEDIATE next action?
- [CORRECT ANSWER]: Invoke @grafana-dashboard-manager with planner recommendations (NO user prompt)
- [WRONG ANSWER]: Return planner recommendations to user and ask if they want to proceed

**Question 2**: When do I return output to the user?
- [CORRECT ANSWER]: After @grafana-dashboard-manager creates the dashboard and returns a Grafana URL
- [WRONG ANSWER]: After @grafana-dashboard-planner completes with recommendations

**Question 3**: What prompts am I allowed to show between planner and manager phases?
- [CORRECT ANSWER]: NONE - zero prompts, zero questions, zero user interaction
- [WRONG ANSWER]: "Would you like to proceed with implementation?"

**Question 4**: What defines a successfully completed `/dashboard-plan` command?
- [CORRECT ANSWER]: Dashboard exists in Grafana with validated UID and URL returned to user
- [WRONG ANSWER]: Planning recommendations generated and presented to user

**Question 5**: If the plan has 15 panels (complex), should I ask user for confirmation before creating?
- [CORRECT ANSWER]: NO - automatically invoke manager with simplification strategy (6-8 panels first)
- [WRONG ANSWER]: YES - ask user if they want to proceed with complex dashboard

**EXECUTION MANTRA**: "Planner completes → IMMEDIATE automatic manager invocation → Dashboard created → Return URL to user"

If you answered ANY question incorrectly, re-read the "CRITICAL INSTRUCTION - READ FIRST" section at the top of this file.

