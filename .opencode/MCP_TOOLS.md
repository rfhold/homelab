# MCP Tools Reference

Complete reference for all MCP server tools available in the homelab environment.

## Grafana MCP Server

### Alert Management

#### grafana_list_alert_rules
List alert rules with filtering and pagination.

**Parameters:**
- `label_selectors` (optional): Array of label matchers `[{filters: [{name, type, value}]}]`
  - `type`: `=`, `!=`, `=~`, `!~`
- `limit` (optional): Max results (default: 100)
- `page` (optional): Page number

**Returns:** Array of alert rules with UID, title, state (pending/firing/inactive), labels

**Use Cases:**
- Find all firing alerts
- Filter alerts by severity/service
- Audit alert configuration

#### grafana_get_alert_rule_by_uid
Get complete alert rule configuration.

**Parameters:**
- `uid`: Alert rule UID

**Returns:** Full rule config including title, condition, queries, folder, evaluation interval, annotations, labels

**Use Cases:**
- Understand alert logic
- Debug alert conditions
- Extract alert metadata

#### grafana_list_alert_groups
List alert groups with comprehensive filtering.

**Parameters:**
- `id` (optional): Specific alert group ID
- `integrationId` (optional): Filter by integration
- `routeId` (optional): Filter by route
- `state` (optional): `new`, `acknowledged`, `resolved`, `silenced`
- `teamId` (optional): Filter by team
- `startedAt` (optional): Time range `YYYY-MM-DDTHH:mm:ss_YYYY-MM-DDTHH:mm:ss`
- `labels` (optional): Array of `key:value` (e.g., `['env:prod']`)
- `name` (optional): Filter by name
- `page` (optional): Page number

**Returns:** List of alert groups with details

**Use Cases:**
- Find active incidents
- Track alert lifecycle
- Correlate related alerts

#### grafana_get_alert_group
Get full details for specific alert group.

**Parameters:**
- `alertGroupId`: Alert group ID

**Returns:** Complete alert group details

**Use Cases:**
- Deep-dive on specific alert
- Get alert timeline

#### grafana_list_contact_points
List notification contact points.

**Parameters:**
- `name` (optional): Filter by exact name
- `limit` (optional): Max results (default: 100)

**Returns:** Array with UID, name, type

**Use Cases:**
- Audit notification config
- Find contact point UIDs

### Incident Management

#### grafana_list_incidents
List Grafana Incident entries.

**Parameters:**
- `status` (optional): `active`, `resolved`
- `drill` (optional): Include drill incidents
- `limit` (optional): Max results

**Returns:** List of incidents with basic details

**Use Cases:**
- Track ongoing incidents
- Review incident history

#### grafana_get_incident
Get full incident details.

**Parameters:**
- `id`: Incident ID

**Returns:** Complete incident including title, status, severity, labels, timestamps, metadata

**Use Cases:**
- Review incident details
- Extract incident context

#### grafana_create_incident
Create new incident (USE SPARINGLY - requires user confirmation).

**Parameters:**
- `title`: Incident title
- `severity`: Severity level
- `roomPrefix`: Room prefix
- `status` (optional): Initial status
- `labels` (optional): Array of label objects
- `isDrill` (optional): Mark as drill
- `attachUrl` (optional): Attachment URL
- `attachCaption` (optional): Attachment caption

**Returns:** Created incident

**Use Cases:**
- Automated incident creation from critical alerts
- Test incident workflows

#### grafana_add_activity_to_incident
Add note to incident timeline.

**Parameters:**
- `incidentId`: Incident ID
- `body`: Note content (URLs will be parsed)
- `eventTime` (optional): Timestamp (defaults to now)

**Returns:** Created activity

**Use Cases:**
- Document investigation steps
- Add context from logs/metrics

### OnCall Management

#### grafana_list_oncall_schedules
List OnCall schedules.

**Parameters:**
- `scheduleId` (optional): Get specific schedule
- `teamId` (optional): Filter by team
- `page` (optional): Page number

**Returns:** Schedules with ID, name, team ID, timezone, shift IDs

**Use Cases:**
- Find who's on call
- Audit schedule configuration

#### grafana_get_current_oncall_users
Get users currently on-call for schedule.

**Parameters:**
- `scheduleId`: Schedule ID

**Returns:** Schedule ID, name, list of on-call users

**Use Cases:**
- Determine escalation path
- Tag users in issues

#### grafana_list_oncall_teams
List OnCall teams.

**Parameters:**
- `page` (optional): Page number

**Returns:** List of teams

**Use Cases:**
- Find team IDs
- Audit team structure

#### grafana_list_oncall_users
List/search OnCall users.

**Parameters:**
- `userId` (optional): Get specific user
- `username` (optional): Filter by username
- `page` (optional): Page number

**Returns:** List of users with details

**Use Cases:**
- Find user IDs
- Search for users

#### grafana_get_oncall_shift
Get shift details.

**Parameters:**
- `shiftId`: Shift ID

**Returns:** Complete shift details

**Use Cases:**
- Understand schedule structure
- Debug schedule issues

### Dashboard Operations

#### grafana_search_dashboards
Search dashboards by query.

**Parameters:**
- `query`: Search string

**Returns:** List with title, UID, folder, tags, URL

**Use Cases:**
- Find relevant dashboards
- Discover dashboard UIDs

#### grafana_get_dashboard_by_uid
Get complete dashboard JSON (WARNING: Large output).

**Parameters:**
- `uid`: Dashboard UID

**Returns:** Full dashboard model

**Use Cases:**
- Export dashboard
- Deep analysis (prefer get_dashboard_property for specific data)

#### grafana_get_dashboard_summary
Get compact dashboard overview.

**Parameters:**
- `uid`: Dashboard UID

**Returns:** Title, panel count, panel types, variables, metadata

**Use Cases:**
- Understand dashboard structure
- Plan dashboard modifications

#### grafana_get_dashboard_property
Extract specific dashboard data via JSONPath.

**Parameters:**
- `uid`: Dashboard UID
- `jsonPath`: JSONPath expression (e.g., `$.panels[0].title`, `$.templating.list`)

**Returns:** Extracted data

**Use Cases:**
- Get panel queries without full dashboard
- Extract specific configuration
- Minimize context usage

**Common Paths:**
- `$.title` - Dashboard title
- `$.panels[*].title` - All panel titles
- `$.panels[0]` - First panel
- `$.templating.list` - Variables
- `$.tags` - Tags
- `$.panels[*].targets[*].expr` - All queries

#### grafana_get_dashboard_panel_queries
Get all panel queries and datasources.

**Parameters:**
- `uid`: Dashboard UID

**Returns:** Array of `{title, query, datasource: {uid, type}}`

**Use Cases:**
- Understand what dashboard queries
- Find datasource dependencies
- Audit query patterns

#### grafana_update_dashboard
Create or update dashboard.

**Parameters:**
- `dashboard` (optional): Full dashboard JSON (for new dashboards)
- `uid` (optional): Dashboard UID (for updates)
- `operations` (optional): Array of patch operations `[{op, path, value}]`
  - `op`: `replace`, `add`, `remove`
  - `path`: JSONPath (e.g., `$.panels[0].title`, `$.panels/- ` for append)
- `folderUid` (optional): Folder UID
- `message` (optional): Commit message
- `overwrite` (optional): Overwrite if exists
- `userId` (optional): User ID

**Returns:** Updated dashboard

**Use Cases:**
- Update panel queries
- Add panels
- Modify dashboard config

#### grafana_search_folders
Search folders.

**Parameters:**
- `query`: Search string

**Returns:** Folders with title, UID, URL

**Use Cases:**
- Find folder UIDs
- Organize dashboards

#### grafana_create_folder
Create folder.

**Parameters:**
- `title`: Folder title
- `uid` (optional): Folder UID
- `parentUid` (optional): Parent folder UID

**Returns:** Created folder

**Use Cases:**
- Organize dashboards
- Create folder structure

### Observability Queries - Prometheus

#### grafana_query_prometheus
Execute PromQL query.

**Parameters:**
- `datasourceUid`: Datasource UID
- `expr`: PromQL expression
- `startTime`: Start time (RFC3339 or relative like `now-1h`)
- `queryType`: `instant` or `range`
- `endTime` (optional): End time (required for range queries)
- `stepSeconds` (optional): Step size (required for range queries)

**Returns:** Query results with timestamps and values

**Use Cases:**
- Get current metric values
- Analyze metric trends
- Correlate metrics with alerts

**Time Formats:**
- RFC3339: `2024-01-15T10:30:00Z`
- Relative: `now`, `now-1h`, `now-30m`, `now-2h45m`
- Units: `ns`, `us`, `ms`, `s`, `m`, `h`, `d`

#### grafana_list_prometheus_metric_names
List available metrics with optional regex filtering.

**Parameters:**
- `datasourceUid`: Datasource UID
- `regex` (optional): Filter regex
- `limit` (optional): Max results
- `page` (optional): Page number

**Returns:** Array of metric names

**Use Cases:**
- Discover available metrics
- Find metrics by pattern

#### grafana_list_prometheus_label_names
List label names (keys).

**Parameters:**
- `datasourceUid`: Datasource UID
- `matches` (optional): Array of label matchers `[{filters: [{name, type, value}]}]`
- `startRfc3339` (optional): Start time
- `endRfc3339` (optional): End time
- `limit` (optional): Max results

**Returns:** Array of label names

**Use Cases:**
- Discover available labels
- Build query filters

#### grafana_list_prometheus_label_values
Get values for specific label.

**Parameters:**
- `datasourceUid`: Datasource UID
- `labelName`: Label name (e.g., `job`, `instance`)
- `matches` (optional): Array of label matchers
- `startRfc3339` (optional): Start time
- `endRfc3339` (optional): End time
- `limit` (optional): Max results

**Returns:** Array of label values

**Use Cases:**
- Get available services
- Build dynamic filters
- Discover label cardinality

#### grafana_list_prometheus_metric_metadata
Get metric metadata (experimental).

**Parameters:**
- `datasourceUid`: Datasource UID
- `metric` (optional): Specific metric
- `limit` (optional): Max metrics
- `limitPerMetric` (optional): Max metadata per metric

**Returns:** Metric metadata including type, help text

**Use Cases:**
- Understand metric types
- Get metric documentation

### Observability Queries - Loki

#### grafana_query_loki_logs
Execute LogQL query.

**Parameters:**
- `datasourceUid`: Datasource UID
- `logql`: LogQL query (label matchers, filters, parsers, aggregations)
- `startRfc3339` (optional): Start time (defaults to 1h ago)
- `endRfc3339` (optional): End time (defaults to now)
- `limit` (optional): Max log lines (default: 10, max: 100)
- `direction` (optional): `forward` (oldest first) or `backward` (newest first, default)

**Returns:** Array of `{timestamp, labels, line}` or `{timestamp, labels, value}` for metrics

**Use Cases:**
- Get error logs
- Analyze log patterns
- Extract structured data from logs

**LogQL Examples:**
- `{app="nginx"}` - All nginx logs
- `{app="nginx"} |= "error"` - Nginx logs containing "error"
- `{app="nginx"} | json | status >= 500` - Nginx 5xx errors
- `rate({app="nginx"}[5m])` - Log rate metric

#### grafana_query_loki_stats
Get stream statistics.

**Parameters:**
- `datasourceUid`: Datasource UID
- `logql`: Label selector ONLY (no filters/parsers)
- `startRfc3339` (optional): Start time (defaults to 1h ago)
- `endRfc3339` (optional): End time (defaults to now)

**Returns:** `{streams, chunks, entries, bytes}`

**Use Cases:**
- Check log volume before querying
- Estimate query cost
- Monitor log ingestion

**Important:** Only accepts label selectors like `{app="nginx"}`, not full LogQL queries.

#### grafana_list_loki_label_names
List available log label names.

**Parameters:**
- `datasourceUid`: Datasource UID
- `startRfc3339` (optional): Start time (defaults to 1h ago)
- `endRfc3339` (optional): End time (defaults to now)

**Returns:** Array of label names (e.g., `["app", "env", "pod"]`)

**Use Cases:**
- Discover log labels
- Build LogQL queries

#### grafana_list_loki_label_values
Get values for specific log label.

**Parameters:**
- `datasourceUid`: Datasource UID
- `labelName`: Label name (e.g., `app`, `env`)
- `startRfc3339` (optional): Start time (defaults to 1h ago)
- `endRfc3339` (optional): End time (defaults to now)

**Returns:** Array of label values

**Use Cases:**
- Get available apps/services
- Build dynamic filters
- Discover label values

### Observability Queries - Pyroscope

#### grafana_fetch_pyroscope_profile
Fetch profiling data.

**Parameters:**
- `data_source_uid`: Datasource UID
- `profile_type`: Profile type (use list_pyroscope_profile_types to discover)
- `matchers` (optional): Label matchers (e.g., `{service_name="foo"}`)
- `start_rfc_3339` (optional): Start time (defaults to 1h ago)
- `end_rfc_3339` (optional): End time (defaults to now)
- `max_node_depth` (optional): Max depth (default: 100, -1 for unlimited)

**Returns:** Profile in DOT format

**Use Cases:**
- Analyze CPU/memory profiles
- Identify performance bottlenecks
- Compare profiles over time

**Profile Type Format:** `<name>:<sample type>:<sample unit>:<period type>:<period unit>`

#### grafana_list_pyroscope_profile_types
List available profile types.

**Parameters:**
- `data_source_uid`: Datasource UID
- `start_rfc_3339` (optional): Start time (defaults to 1h ago)
- `end_rfc_3339` (optional): End time (defaults to now)

**Returns:** Array of profile types

**Use Cases:**
- Discover available profiles
- Determine what profiling data exists

#### grafana_list_pyroscope_label_names
List profile label names.

**Parameters:**
- `data_source_uid`: Datasource UID
- `matchers` (optional): Label matchers
- `start_rfc_3339` (optional): Start time (defaults to 1h ago)
- `end_rfc_3339` (optional): End time (defaults to now)

**Returns:** Array of label names (excludes internal `__*` labels)

**Use Cases:**
- Discover profile labels
- Build profile queries

#### grafana_list_pyroscope_label_values
Get values for specific profile label.

**Parameters:**
- `data_source_uid`: Datasource UID
- `name`: Label name
- `matchers` (optional): Label matchers
- `start_rfc_3339` (optional): Start time (defaults to 1h ago)
- `end_rfc_3339` (optional): End time (defaults to now)

**Returns:** Array of label values

**Use Cases:**
- Get available services
- Filter profiles by label

### Sift Investigations (AI-Powered Analysis)

#### grafana_list_sift_investigations
List existing investigations.

**Parameters:**
- `limit` (optional): Max results (default: 10)

**Returns:** List of investigations with IDs

**Use Cases:**
- Review past investigations
- Track investigation history

#### grafana_get_sift_investigation
Get investigation details.

**Parameters:**
- `id`: Investigation UUID

**Returns:** Complete investigation data

**Use Cases:**
- Review investigation results
- Extract findings

#### grafana_get_sift_analysis
Get specific analysis from investigation.

**Parameters:**
- `investigationId`: Investigation UUID
- `analysisId`: Analysis UUID

**Returns:** Analysis results

**Use Cases:**
- Get detailed analysis results
- Extract specific findings

#### grafana_find_slow_requests
AI-powered slow trace detection (waits for completion).

**Parameters:**
- `name`: Investigation name
- `labels`: Label object (e.g., `{service_name: "api"}`)
- `start` (optional): Start time (defaults to 30m ago)
- `end` (optional): End time (defaults to now)

**Returns:** Investigation results with slow traces identified

**Use Cases:**
- Auto-detect performance regressions
- Find slow endpoints
- Analyze latency spikes

#### grafana_find_error_pattern_logs
AI-powered error pattern detection vs baseline (waits for completion).

**Parameters:**
- `name`: Investigation name
- `labels`: Label object (e.g., `{app: "nginx"}`)
- `start` (optional): Start time (defaults to 30m ago)
- `end` (optional): End time (defaults to now)

**Returns:** Investigation results with elevated error patterns vs last day's baseline

**Use Cases:**
- Detect new error patterns
- Compare error rates
- Find anomalous logs

#### grafana_get_assertions
Get assertion summary for entities.

**Parameters:**
- `entityType` (optional): Entity type (Service, Node, Pod, etc.)
- `entityName` (optional): Entity name
- `env` (optional): Environment
- `site` (optional): Site
- `namespace` (optional): Namespace
- `startTime`: Start time (RFC3339)
- `endTime`: End time (RFC3339)

**Returns:** Assertion summary for entity

**Use Cases:**
- Check service health
- Validate deployments
- Monitor SLOs

### Datasources & Administration

#### grafana_list_datasources
List available datasources.

**Parameters:**
- `type` (optional): Filter by type (`prometheus`, `loki`, `tempo`, etc.)

**Returns:** Array with ID, UID, name, type, default status

**Use Cases:**
- Discover datasources
- Get datasource UIDs
- Audit datasource config

#### grafana_get_datasource_by_uid
Get datasource details by UID.

**Parameters:**
- `uid`: Datasource UID

**Returns:** Full datasource model

**Use Cases:**
- Get datasource configuration
- Verify datasource settings

#### grafana_get_datasource_by_name
Get datasource details by name.

**Parameters:**
- `name`: Datasource name

**Returns:** Full datasource model

**Use Cases:**
- Get datasource UID from name
- Verify datasource exists

#### grafana_list_teams
Search teams.

**Parameters:**
- `query` (optional): Search query (empty for all teams)

**Returns:** List with name, ID, URL

**Use Cases:**
- Find team IDs
- Audit team structure

#### grafana_list_users_by_org
List organization users.

**Returns:** Users with userid, email, role

**Use Cases:**
- Find user IDs
- Audit user access

### Utilities

#### grafana_generate_deeplink
Generate Grafana deeplinks.

**Parameters:**
- `resourceType`: `dashboard`, `panel`, or `explore`
- `dashboardUid` (optional): Dashboard UID (required for dashboard/panel)
- `panelId` (optional): Panel ID (required for panel)
- `datasourceUid` (optional): Datasource UID (required for explore)
- `timeRange` (optional): `{from, to}` (e.g., `{from: "now-1h", to: "now"}`)
- `queryParams` (optional): Additional query parameters

**Returns:** Grafana URL

**Use Cases:**
- Link to dashboards in issues
- Share specific panels
- Generate Explore links

---

## Gitea MCP Server

### Repository Management

#### gitea_list_my_repos
List user's repositories.

**Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Results per page (default: 100)

**Returns:** List of repositories

**Use Cases:**
- Discover repositories
- Audit repo ownership

#### gitea_create_repo
Create repository.

**Parameters:**
- `name`: Repository name
- `organization` (optional): Org name (defaults to personal)
- `description` (optional): Description
- `private` (optional): Private repo
- `auto_init` (optional): Initialize repo
- `gitignores` (optional): Gitignore template
- `license` (optional): License
- `readme` (optional): Readme content
- `default_branch` (optional): Default branch
- `issue_labels` (optional): Issue label set
- `template` (optional): Template repo

**Returns:** Created repository

**Use Cases:**
- Create new repos
- Initialize from templates

#### gitea_fork_repo
Fork repository.

**Parameters:**
- `user`: Owner username
- `repo`: Repository name
- `name` (optional): Fork name
- `organization` (optional): Fork to org

**Returns:** Forked repository

**Use Cases:**
- Fork for contributions
- Create personal copies

#### gitea_search_repos
Search repositories.

**Parameters:**
- `keyword` (optional): Search keyword
- `keywordInDescription` (optional): Search in description
- `keywordIsTopic` (optional): Search topics
- `isPrivate` (optional): Filter private repos
- `isArchived` (optional): Filter archived repos
- `ownerID` (optional): Filter by owner
- `sort` (optional): Sort order
- `order` (optional): Order direction
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** List of repositories

**Use Cases:**
- Find repos by keyword
- Discover public repos

### Branch Operations

#### gitea_list_branches
List repository branches.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name

**Returns:** Array of branches

**Use Cases:**
- Discover branches
- Check branch existence

#### gitea_create_branch
Create branch.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `branch`: New branch name
- `old_branch`: Source branch name

**Returns:** Created branch

**Use Cases:**
- Create feature branches
- Branch for fixes

#### gitea_delete_branch
Delete branch.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `branch`: Branch name

**Returns:** Success/failure

**Use Cases:**
- Clean up merged branches
- Remove stale branches

### Tag Operations

#### gitea_list_tags
List repository tags.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 20)

**Returns:** Array of tags

**Use Cases:**
- List releases
- Check version tags

#### gitea_create_tag
Create tag.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `tag_name`: Tag name
- `target` (optional): Target commit (defaults to HEAD)
- `message` (optional): Tag message

**Returns:** Created tag

**Use Cases:**
- Mark releases
- Create version tags

#### gitea_delete_tag
Delete tag.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `tag_name`: Tag name

**Returns:** Success/failure

**Use Cases:**
- Remove incorrect tags
- Clean up tags

#### gitea_get_tag
Get tag details.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `tag_name`: Tag name

**Returns:** Tag details

**Use Cases:**
- Get tag metadata
- Verify tag exists

### File Operations

#### gitea_get_file_content
Get file content.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `ref`: Branch/tag/commit
- `filePath`: File path
- `withLines` (optional): Include line numbers

**Returns:** File content with metadata (SHA, size, etc.)

**Use Cases:**
- Read source files
- Get configuration
- Verify file content

#### gitea_get_dir_content
List directory contents.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `ref`: Branch/tag/commit
- `filePath`: Directory path

**Returns:** Array of directory entries

**Use Cases:**
- List files in directory
- Discover file structure

#### gitea_create_file
Create file.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `filePath`: File path
- `content`: File content (base64 or text)
- `message`: Commit message
- `branch_name`: Target branch
- `new_branch_name` (optional): Create new branch

**Returns:** Created file with commit info

**Use Cases:**
- Add new files
- Create configuration

#### gitea_update_file
Update file.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `filePath`: File path
- `sha`: File SHA (from get_file_content)
- `content`: New content
- `message`: Commit message
- `branch_name`: Target branch

**Returns:** Updated file with commit info

**Use Cases:**
- Modify files
- Update configuration
- Apply fixes

#### gitea_delete_file
Delete file.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `filePath`: File path
- `message`: Commit message
- `branch_name`: Target branch

**Returns:** Delete confirmation

**Use Cases:**
- Remove files
- Clean up unused code

### Issue Management

#### gitea_list_repo_issues
List repository issues.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `state` (optional): `open`, `closed`, `all` (default: all)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of issues

**Use Cases:**
- List active issues
- Check for duplicates
- Audit issue status

#### gitea_get_issue_by_index
Get issue details.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number

**Returns:** Complete issue details

**Use Cases:**
- Get issue context
- Read issue description
- Check issue status

#### gitea_create_issue
Create issue.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `title`: Issue title
- `body`: Issue body (supports Markdown)

**Returns:** Created issue

**Use Cases:**
- Create bug reports
- Track incidents
- Document problems

#### gitea_edit_issue
Edit issue.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number
- `title` (optional): New title
- `body` (optional): New body
- `state` (optional): New state (`open`, `closed`)
- `assignees` (optional): Array of usernames
- `milestone` (optional): Milestone number

**Returns:** Updated issue

**Use Cases:**
- Update issue status
- Add details
- Assign issues

#### gitea_get_issue_comments_by_index
Get issue comments.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number

**Returns:** Array of comments

**Use Cases:**
- Read discussion
- Track investigation
- Get context

#### gitea_create_issue_comment
Add issue comment.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number
- `body`: Comment body (supports Markdown)

**Returns:** Created comment

**Use Cases:**
- Add investigation notes
- Update status
- Provide context

#### gitea_edit_issue_comment
Edit comment.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `commentID`: Comment ID
- `body`: New comment body

**Returns:** Updated comment

**Use Cases:**
- Fix typos
- Update information
- Clarify comments

### Label Management

#### gitea_list_repo_labels
List repository labels.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of labels with ID, name, color, description

**Use Cases:**
- Get available labels
- Find label IDs
- Audit label config

#### gitea_get_repo_label
Get label details.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `id`: Label ID

**Returns:** Label details

**Use Cases:**
- Verify label exists
- Get label metadata

#### gitea_create_repo_label
Create label.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `name`: Label name
- `color`: Hex color (e.g., `#FF0000`)
- `description` (optional): Label description

**Returns:** Created label

**Use Cases:**
- Create custom labels
- Categorize issues

#### gitea_edit_repo_label
Edit label.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `id`: Label ID
- `name` (optional): New name
- `color` (optional): New color
- `description` (optional): New description

**Returns:** Updated label

**Use Cases:**
- Rename labels
- Change colors
- Update descriptions

#### gitea_delete_repo_label
Delete label.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `id`: Label ID

**Returns:** Success/failure

**Use Cases:**
- Remove unused labels
- Clean up label list

#### gitea_add_issue_labels
Add labels to issue.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number
- `labels`: Array of label IDs

**Returns:** Updated issue labels

**Use Cases:**
- Categorize issues
- Add severity labels
- Tag components

#### gitea_remove_issue_label
Remove single label from issue.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number
- `label_id`: Label ID

**Returns:** Updated issue labels

**Use Cases:**
- Remove incorrect labels
- Update categorization

#### gitea_replace_issue_labels
Replace all issue labels.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number
- `labels`: Array of label IDs

**Returns:** Updated issue labels

**Use Cases:**
- Set exact labels
- Reset label set

#### gitea_clear_issue_labels
Remove all labels from issue.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: Issue number

**Returns:** Updated issue (no labels)

**Use Cases:**
- Clear all labels
- Reset issue

### Pull Request Management

#### gitea_list_repo_pull_requests
List pull requests.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `state` (optional): `open`, `closed`, `all` (default: all)
- `milestone` (optional): Filter by milestone
- `sort` (optional): Sort order (default: recentupdate)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of pull requests

**Use Cases:**
- List active PRs
- Check PR status
- Review pending changes

#### gitea_get_pull_request_by_index
Get PR details.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `index`: PR number

**Returns:** Complete PR details

**Use Cases:**
- Get PR context
- Check PR status
- Review PR details

#### gitea_create_pull_request
Create pull request.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `title`: PR title
- `body`: PR body (supports Markdown)
- `head`: Source branch
- `base`: Target branch

**Returns:** Created PR

**Use Cases:**
- Submit fixes
- Propose changes
- Create automated PRs

### Release Management

#### gitea_list_releases
List releases.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `is_draft` (optional): Filter drafts (default: false)
- `is_pre_release` (optional): Filter pre-releases (default: false)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 20)

**Returns:** Array of releases

**Use Cases:**
- List versions
- Check latest release
- Audit releases

#### gitea_get_release
Get release details.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `id`: Release ID

**Returns:** Complete release details

**Use Cases:**
- Get release notes
- Check release metadata

#### gitea_get_latest_release
Get latest release.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name

**Returns:** Latest release

**Use Cases:**
- Check current version
- Get latest changes

#### gitea_create_release
Create release.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `tag_name`: Tag name
- `target`: Target commit/branch
- `title`: Release title
- `body` (optional): Release notes
- `is_draft` (optional): Mark as draft (default: false)
- `is_pre_release` (optional): Mark as pre-release (default: false)

**Returns:** Created release

**Use Cases:**
- Publish versions
- Document changes
- Mark milestones

#### gitea_delete_release
Delete release.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `id`: Release ID

**Returns:** Success/failure

**Use Cases:**
- Remove incorrect releases
- Clean up drafts

### Commit History

#### gitea_list_repo_commits
List repository commits.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `sha` (optional): Branch/tag/commit to start from
- `path` (optional): Filter by file path
- `page`: Page number (default: 1)
- `page_size`: Results per page (default: 50)

**Returns:** Array of commits

**Use Cases:**
- Get commit history
- Find recent changes
- Track file changes

### User & Organization

#### gitea_get_my_user_info
Get authenticated user info.

**Returns:** User details

**Use Cases:**
- Verify authentication
- Get user ID

#### gitea_get_user_orgs
Get user's organizations.

**Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of organizations

**Use Cases:**
- List orgs
- Get org IDs

#### gitea_search_users
Search users.

**Parameters:**
- `keyword` (optional): Search keyword
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of users

**Use Cases:**
- Find users
- Get user IDs

#### gitea_search_org_teams
Search organization teams.

**Parameters:**
- `org` (optional): Organization name
- `query` (optional): Search query
- `includeDescription` (optional): Include descriptions
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (default: 100)

**Returns:** Array of teams

**Use Cases:**
- Find teams
- Get team IDs

### Gitea Actions (CI/CD)

#### gitea-workflow-summary
Get quick workflow status summary.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `limit` (optional): Max runs

**Returns:** Workflow run status summary

**Use Cases:**
- Check build status
- Monitor CI/CD health

#### gitea-workflow-runs
List workflow runs.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `workflow` (optional): Filter by workflow filename (e.g., `build-vllm-rocm.yml`) - HIGHLY RECOMMENDED to avoid confusion
- `status` (optional): Filter by status (`success`, `failure`, `cancelled`, `running`, `waiting`, `blocked`, `skipped`)
- `limit` (optional): Max results (default: 10, max: 50)
- `page` (optional): Page number

**Returns:** Array of workflow runs with workflow_id, run_number, run_id, status, etc.

**Use Cases:**
- Monitor CI/CD for specific workflow
- Track build history
- Find failed builds for a workflow

**Important:** Always specify `workflow` parameter to filter by specific workflow file. Without it, returns runs from ALL workflows which can cause confusion.

#### gitea-workflow-run-detail
Get detailed workflow run info.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `run_id`: Workflow run ID (NOT run_number)

**Returns:** Complete run details including workflow_id, run_number, jobs, status, etc.

**Use Cases:**
- Debug build failures
- Get job details
- Track run progress
- Verify workflow_id matches expected workflow

**Important:** Use `run_id` (not run_number). Returns include workflow_id for validation.

#### gitea-job-logs
Fetch logs for a workflow run. Automatically finds the correct run and validates the workflow.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `workflow` (REQUIRED): Workflow filename (e.g., `build-vllm-rocm.yml`)
- `run_selector` (optional): Which run to fetch
  - `'latest'` (default): Most recent run
  - `'latest-failure'`: Most recent failed run
  - `'31'`: Specific run number
- `wait` (optional): Wait for job completion (polls every 5 seconds)
- `timeout` (optional): Wait timeout in seconds (default: 300)

**Returns:** Job logs with workflow header and status

**Use Cases:**
- Debug build failures: `workflow="build.yml", run_selector="latest-failure"`
- Check last run: `workflow="deploy.yml"` (uses latest by default)
- Analyze specific run: `workflow="test.yml", run_selector="42"`

**Important:** 
- **Always specify `workflow`** - this is REQUIRED
- Tool automatically finds the correct run for that workflow
- No need to know run_id or run_number beforehand
- For historical runs, do NOT use `wait=true`

#### gitea-workflow-dispatch
Trigger workflow manually.

**Parameters:**
- `owner`: Repository owner
- `repo`: Repository name
- `workflow`: Workflow filename
- `ref` (optional): Branch/tag to run on
- `inputs` (optional): Workflow inputs (key-value pairs)

**Returns:** Workflow run info

**Use Cases:**
- Trigger deployments
- Run manual builds
- Execute workflows

### Version

#### gitea_get_gitea_mcp_server_version
Get MCP server version.

**Returns:** Version string

**Use Cases:**
- Verify server version
- Debug compatibility

---

## Firecrawl MCP Server

### Web Scraping

#### firecrawl_firecrawl_scrape
Scrape single URL with advanced options.

**Parameters:**
- `url`: URL to scrape
- `formats` (optional): Array of formats (`markdown`, `html`, `rawHtml`, `screenshot`, `links`, `summary`)
  - Can include JSON format: `{type: "json", prompt: "...", schema: {...}}`
  - Can include screenshot format: `{type: "screenshot", fullPage: true, quality: 80, viewport: {width: 1920, height: 1080}}`
- `onlyMainContent` (optional): Extract only main content
- `includeTags` (optional): Array of HTML tags to include
- `excludeTags` (optional): Array of HTML tags to exclude
- `waitFor` (optional): Wait time in ms
- `actions` (optional): Array of actions
  - `{type: "wait", milliseconds: 1000}`
  - `{type: "click", selector: "button"}`
  - `{type: "scroll", direction: "down"}`
  - `{type: "write", selector: "input", text: "..."}`
  - `{type: "press", key: "Enter"}`
  - `{type: "screenshot"}`
  - `{type: "executeJavascript", script: "..."}`
- `mobile` (optional): Use mobile user agent
- `skipTlsVerification` (optional): Skip TLS verification
- `removeBase64Images` (optional): Remove base64 images
- `parsers` (optional): Array of parsers
  - `{type: "pdf", maxPages: 10}`
- `location` (optional): `{country: "US", languages: ["en"]}`
- `maxAge` (optional): Cache max age in ms (use for 500% speed boost)
- `storeInCache` (optional): Store in cache

**Returns:** Scraped content in requested formats

**Use Cases:**
- Extract documentation
- Get page content
- Scrape dynamic sites
- Take screenshots
- Extract structured data

#### firecrawl_firecrawl_map
Discover all URLs on a site.

**Parameters:**
- `url`: Site URL
- `search` (optional): Filter URLs by search term
- `limit` (optional): Max URLs
- `includeSubdomains` (optional): Include subdomains
- `ignoreQueryParameters` (optional): Ignore query params
- `sitemap` (optional): `include`, `skip`, `only`

**Returns:** Array of URLs

**Use Cases:**
- Discover site structure
- Find documentation pages
- Build URL list for crawling

#### firecrawl_firecrawl_search
Web search with optional content extraction.

**Parameters:**
- `query`: Search query (supports operators)
- `limit` (optional): Max results
- `sources` (optional): Array of `{type: "web"}`, `{type: "images"}`, `{type: "news"}`
- `location` (optional): Location for search
- `filter` (optional): Additional filters
- `tbs` (optional): Time-based search
- `scrapeOptions` (optional): Same as scrape (only use if absolutely necessary, prefer low limit 5 or lower)

**Returns:** Array of search results (with optional scraped content)

**Use Cases:**
- Find relevant documentation
- Search for solutions
- Discover resources

**Search Operators:**
- `"exact match"` - Non-fuzzy match
- `-exclude` - Exclude keywords
- `site:domain.com` - Limit to site
- `inurl:keyword` - Match in URL
- `intitle:keyword` - Match in title
- `related:domain.com` - Related sites

**Optimal Workflow:** Search without scrapeOptions first, then scrape specific URLs

#### firecrawl_firecrawl_crawl
Crawl multiple pages with content extraction.

**Parameters:**
- `url`: Starting URL (supports wildcards but not recommended)
- `limit` (optional): Max pages
- `maxDiscoveryDepth` (optional): Max depth
- `allowExternalLinks` (optional): Follow external links
- `allowSubdomains` (optional): Follow subdomains
- `crawlEntireDomain` (optional): Crawl entire domain
- `deduplicateSimilarURLs` (optional): Deduplicate similar URLs
- `includePaths` (optional): Array of path patterns to include
- `excludePaths` (optional): Array of path patterns to exclude
- `ignoreQueryParameters` (optional): Ignore query params
- `sitemap` (optional): `skip`, `include`, `only`
- `delay` (optional): Delay between requests (ms)
- `maxConcurrency` (optional): Max concurrent requests
- `scrapeOptions` (optional): Same as scrape
- `webhook` (optional): Webhook URL for completion
- `prompt` (optional): Custom extraction prompt

**Returns:** Operation ID (use check_crawl_status to get results)

**Use Cases:**
- Extract content from multiple pages
- Build documentation corpus
- Comprehensive site scraping

**Warning:** Can produce very large responses. Use limit and depth carefully.

#### firecrawl_firecrawl_check_crawl_status
Check crawl job status.

**Parameters:**
- `id`: Crawl operation ID

**Returns:** Status and results (if complete)

**Use Cases:**
- Poll crawl progress
- Get crawl results

#### firecrawl_firecrawl_extract
Extract structured data using LLM.

**Parameters:**
- `urls`: Array of URLs
- `prompt` (optional): Custom extraction prompt
- `schema` (optional): JSON schema for extraction
- `allowExternalLinks` (optional): Allow external links
- `enableWebSearch` (optional): Enable web search for context
- `includeSubdomains` (optional): Include subdomains

**Returns:** Extracted structured data

**Use Cases:**
- Extract product info
- Parse documentation
- Structured data extraction

---

## SearXNG MCP Server

### Search

#### searxng_searxng_web_search
General web search.

**Parameters:**
- `query`: Search query
- `language` (optional): Language code (default: all)
- `safesearch` (optional): `0` (none), `1` (moderate), `2` (strict)
- `time_range` (optional): `day`, `month`, `year`
- `pageno` (optional): Page number (default: 1)

**Returns:** Array of search results with title, URL, content

**Use Cases:**
- General web search
- Find documentation
- Search for solutions

#### searxng_web_url_read
Read content from URL.

**Parameters:**
- `url`: URL to read
- `section` (optional): Extract content under specific heading
- `paragraphRange` (optional): Extract paragraph range (e.g., `1-5`, `3`, `10-`)
- `startChar` (optional): Start character position
- `maxLength` (optional): Max characters
- `readHeadings` (optional): Return only headings

**Returns:** Extracted content

**Use Cases:**
- Read documentation
- Extract specific sections
- Get page headings

---

## Tool Selection Guide

### When to use Grafana tools:
- **Alerts**: Use `list_alert_rules`, `list_alert_groups` to find active alerts
- **Logs**: Use `query_loki_logs` for error analysis, `query_loki_stats` to check volume first
- **Metrics**: Use `query_prometheus` for current values and trends
- **Investigation**: Use `find_error_pattern_logs` and `find_slow_requests` for AI-powered analysis
- **Dashboards**: Use `search_dashboards` to find relevant dashboards, `get_dashboard_panel_queries` to understand queries
- **OnCall**: Use `list_oncall_schedules` and `get_current_oncall_users` to find who's on call

### When to use Gitea tools:
- **Issues**: Use `list_repo_issues` to check for duplicates, `create_issue` to track problems
- **Files**: Use `get_file_content` to read source, `update_file` to apply fixes
- **PRs**: Use `create_pull_request` to submit changes
- **CI/CD**: Use `workflow-dispatch` to trigger builds, `workflow-runs` to monitor, `job-logs` to debug
- **History**: Use `list_repo_commits` to track changes

### When to use Firecrawl tools:
- **Documentation**: Use `firecrawl_search` to find docs, `firecrawl_scrape` to extract content
- **Discovery**: Use `firecrawl_map` to find URLs on a site
- **Structured data**: Use `firecrawl_extract` for structured extraction

### When to use SearXNG tools:
- **General search**: Use `searxng_web_search` for broad searches
- **Content extraction**: Use `searxng_web_url_read` for simple page reading

## Best Practices

1. **Check before creating**: Always check for existing issues/PRs before creating new ones
2. **Start with stats**: Use `query_loki_stats` before `query_loki_logs` to verify log volume
3. **Use AI analysis**: Leverage `find_error_pattern_logs` and `find_slow_requests` for automated investigation
4. **Minimize context**: Use `get_dashboard_summary` or `get_dashboard_property` instead of `get_dashboard_by_uid`
5. **Search then scrape**: For Firecrawl, search without scrapeOptions first, then scrape specific URLs
6. **Cache when possible**: Use `maxAge` in Firecrawl for 500% speed boost on repeated scrapes
7. **Human approval**: Require confirmation for creating incidents, triggering deployments, or making production changes
