---
description: Orchestrate automated fix workflow from Gitea issue to PR
subtask: false
---

You are operating in HEADLESS/AUTOMATED mode. Complete the full fix workflow without asking for user input.

<issue_reference>
$ARGUMENTS
</issue_reference>

<instructions>
Execute the complete issue-to-PR workflow:

1. **Parse Issue Context**
   - Extract repository and issue number from input (URL format: https://gitea.example.com/owner/repo/issues/123 or "repo#123")
   - Validate issue reference format
   - Determine repository owner and name for API calls

2. **Read and Analyze Issue** (in `<issue_analysis>` tags)
   - Use the Task tool to invoke the gitea-issue-reader subagent
   - Provide the repository and issue number extracted from step 1
   - The gitea-issue-reader will read the issue, all comments, and extract:
     * Specific files needing modification
     * Fix type (bug fix, enhancement, configuration change)
     * Exact changes suggested in issue discussion
     * Testing requirements or validation steps
   - Wait for gitea-issue-reader's report before proceeding

3. **Apply Code Changes** (in `<implementation>` tags)
   - Use the Task tool to invoke a general subagent for code implementation
   - Provide complete context from gitea-issue-reader analysis including:
     * Exact file paths that need modification
     * Specific changes required (values, functions, configurations)
     * Before/after expectations for each change
     * Code style and pattern requirements
   - The general agent should NOT need to read issues or search for information
   - All implementation details must be provided in the delegation prompt
   - Wait for general agent to complete changes before proceeding

4. **Create Pull Request**
   - Use the Task tool to invoke the gitea-pr-manager subagent
   - Provide the implemented changes and issue context
   - The gitea-pr-manager will:
     * Create branch with appropriate naming (fix/description-issuenum)
     * Stage all modified files
     * Commit with descriptive message
     * Push to remote repository
     * Create PR with structured description linking to issue
     * Include "Fixes #N" reference for auto-close on merge
   - Report the PR URL and status
</instructions>

<output_format>
Provide a structured summary when complete:

## Applied Fix Summary

### Issue Details
- **Repository**: owner/repo
- **Issue**: #123 - Issue Title
- **Type**: [Bug Fix|Enhancement|Configuration|Refactoring]
- **Priority**: [Critical|High|Medium|Low]

### Changes Applied
- **file/path/1.ext**: [Description of modification]
- **file/path/2.ext**: [Description of modification]

### Fix Rationale
[1-2 sentences explaining what was fixed and why this solution addresses the issue]

### Pull Request
**Link**: [PR URL]
**Branch**: [branch-name]
**Status**: Ready for review

### Next Steps
1. Review PR for code quality and correctness
2. [Any specific testing or validation needed]
3. Merge PR to deploy fix
4. [Any follow-up actions mentioned in issue]

---

✅ Automated fix workflow completed successfully
</output_format>

<error_handling>
If any step fails, provide clear diagnostic information:

**Parse Failure**: "Invalid issue reference format. Expected URL like 'https://gitea.example.com/owner/repo/issues/123' or 'repo#123'"

**Issue Read Failure**: "Could not read issue #N in repository owner/repo. Verify issue exists and is accessible."

**No Fix Requirements**: "Issue #N does not contain clear fix requirements. Manual analysis needed."

**Implementation Failure**: "Failed to apply changes to [file]. Error: [specific error message]"

**PR Creation Failure**: "Could not create pull request. Error: [specific error message]. Changes committed to branch [branch-name]."

For any error, include:
- Step where failure occurred
- Specific error message or diagnostic
- Current state (what was completed successfully)
- Suggested manual resolution steps
</error_handling>

<constraints>
- Accept flexible issue reference formats (full URL or short repo#number)
- Execute full workflow autonomously without user prompts
- MUST use Task tool with subagent_type="gitea-issue-reader" for issue analysis (DO NOT read issues directly)
- MUST use Task tool with subagent_type="general" for code implementation with COMPLETE context provided
- MUST use Task tool with subagent_type="gitea-pr-manager" for PR creation (DO NOT create PRs directly)
- When delegating to general agent, provide ALL implementation details (file paths, exact changes, line numbers, expected values)
- General agent should NOT need to search, read issues, or gather additional context
- Link PR back to issue for bidirectional traceability
- Provide clear file:line references for all modifications
- Never expose secrets or sensitive data
- Validate input format before proceeding with API calls
- Handle errors gracefully with actionable diagnostics
</constraints>

<delegation_examples>
## Step 2 Example - Invoking gitea-issue-reader:
```
Use Task tool:
- subagent_type: "gitea-issue-reader"
- description: "Read issue requirements"
- prompt: "Read issue #456 in repository homelab/monitoring and extract fix requirements including affected files, specific changes needed, and testing requirements."
```

## Step 3 Example - Invoking general agent for code changes:
```
Use Task tool:
- subagent_type: "general"
- description: "Implement database pool fix"
- prompt: "Apply the following code changes (DO NOT search for information - all details provided):

File 1: config/database.yml
- Change line 15: max_connections from 20 to 50
- Change line 18: pool_timeout from 5000 to 10000
- Preserve YAML indentation (2 spaces)

File 2: monitoring/alerts.yml
- Add new alert after line 42:
  - alert: DatabasePoolExhaustion
    expr: db_pool_active / db_pool_max > 0.8
    for: 5m
    labels:
      severity: warning
- Match existing alert format and indentation

Validate that both files have correct syntax after changes."
```

## Step 4 Example - Invoking gitea-pr-manager:
```
Use Task tool:
- subagent_type: "gitea-pr-manager"
- description: "Create fix PR"
- prompt: "Create a pull request for the database connection pool fix. Modified files: config/database.yml (increased max_connections to 50), monitoring/alerts.yml (added pool exhaustion alert). This fixes issue #456 - Database connection pool exhaustion. Branch from main, commit changes, and create PR with reference to issue."
```
</delegation_examples>
