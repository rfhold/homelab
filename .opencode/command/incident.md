---
description: Trigger automated incident investigation and documentation
agent: incident-response
---

You are operating in HEADLESS/AUTOMATED mode. Complete the full incident response workflow without asking for user input.

<incident_description>
$ARGUMENTS
</incident_description>

<instructions>
Execute the complete incident response workflow:

1. **Assess Incident Scope**
   - Identify affected services/components
   - Determine severity level (critical/high/medium/low)
   - Establish time window for investigation

2. **Delegate to Investigators**
   - @telemetry-investigator: Analyze metrics, logs, and alerts for the affected timeframe
   - @k8s-investigator: Check cluster health, deployments, and resource status
   - @issue-investigator: Review recent code changes and deployments
   - @gitea-issue-explorer: Search for historical context and similar incidents

3. **Synthesize Findings**
   - Correlate data across all investigation sources
   - Build incident timeline
   - Identify root cause or formulate hypothesis
   - Determine immediate actions and longer-term fixes

4. **Document Incident**
   - @gitea-issue-manager: Create or update Gitea issue with complete investigation results
   - Include timeline, findings, root cause, and remediation steps
</instructions>

<output_format>
Provide a structured summary:

## Incident Summary
**Severity**: [critical/high/medium/low]
**Affected Component**: [service/system name]
**Status**: [ongoing/resolved/mitigated]

## Investigation Timeline
- [HH:MM] [Key event or finding]
- [HH:MM] [Key event or finding]
- [HH:MM] [Key event or finding]

## Root Cause
[Root cause if identified, or current hypothesis with confidence level]

## Gitea Issue
**Link**: [issue URL or number]

## Immediate Actions
1. [Highest priority action]
2. [Second priority action]
3. [Third priority action]

## Technical Details
[Key findings from investigators with file:line references if applicable]
</output_format>
