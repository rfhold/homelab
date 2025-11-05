---
description: Create documentation by analyzing tasks and orchestrating research-specialist and documentation-writer agents, then save to appropriate file
subtask: false
---

You are orchestrating documentation creation by analyzing the task and delegating to appropriate specialists, then saving the output to a file.

<context>
The user wants to create documentation for something. Your job is to:
1. Analyze the documentation request to determine if it needs external research or codebase analysis
2. Gather information using the appropriate approach
3. Determine the appropriate output filename and location
4. Format the information using @documentation-writer with explicit file writing instructions
5. Confirm the file was created successfully

This command handles both research-heavy tasks (APIs, external processes) and codebase-heavy tasks (internal functions, architecture).
</context>

<workflow>

## Step 1: Analyze Documentation Request

Determine the type of documentation needed:

**Research-Heavy Tasks** (delegate to @research-specialist):
- External APIs or services
- Setup processes for external tools
- Architecture overviews requiring external information
- Technology comparisons
- Best practices documentation

**Codebase-Heavy Tasks** (analyze directly):
- Internal functions and modules
- Project-specific setup instructions
- Code architecture documentation
- Internal API documentation
- Configuration file documentation

**Hybrid Tasks** (both approaches):
- Complex topics requiring both external research and codebase analysis

## Step 2: Gather Information

### For Research-Heavy Tasks

Invoke @research-specialist:

```
Research and gather information about: $1

Focus on:
- Key concepts and terminology
- Setup/installation steps
- Configuration options
- Common usage patterns
- Best practices and recommendations
```

### For Codebase-Heavy Tasks

Analyze the codebase directly:

1. **Read relevant files** to understand the structure
2. **Use grep** to find relevant functions, classes, or configurations
3. **Extract key information** about how things work
4. **Document the findings** in a structured format

### For Hybrid Tasks

1. First invoke @research-specialist for external information
2. Then analyze codebase for internal implementation details
3. Combine both sources of information

## Step 3: Determine Output Filename

Generate an appropriate filename based on the documentation topic:

**Filename Generation Rules**:
- Convert topic to lowercase and replace spaces with hyphens
- Use .md extension
- For technology-specific topics, place in appropriate subdirectory:
  - External services/tools → `docs/dependencies/`
  - Deployment configurations → `docs/deployments/`
  - Infrastructure setup → `docs/environment/`
  - Monitoring/observability → `docs/grafana/`
  - Library/framework usage → `docs/libraries/`
  - Research/analysis → `docs/research/`
  - General/uncategorized → `docs/`

**Examples**:
- "dependencies and use of cloudflare" → `docs/dependencies/cloudflare-dependencies.md`
- "k3s deployment process" → `docs/deployments/k3s-deployment-process.md`
- "cluster networking setup" → `docs/environment/cluster-networking-setup.md`
- "grafana alerts configuration" → `docs/grafana/grafana-alerts-configuration.md`

## Step 4: Format Documentation and Write to File

Invoke @documentation-writer with explicit file writing instructions:

```
Create simple, clean documentation based on this information and write it to [OUTPUT_FILE_PATH]:

[Raw information from research or codebase analysis]

Requirements:
- Use clear headings and structure
- Include code examples in proper ```shell, ```json, etc. blocks
- Keep it simple without diagrams, emojis, or tables
- Focus on essential information only
- Make it actionable and easy to follow
- **IMPORTANT**: Write the complete documentation to the file [OUTPUT_FILE_PATH]
- Ensure the file is created with proper markdown formatting
```

</workflow>

<output_format>

## Documentation: [Topic]

[Formatted documentation from @documentation-writer]

---

**Documentation created successfully**
- **Source**: [Research / Codebase / Both]
- **Agent used**: @documentation-writer
- **Format**: Simple text with code blocks
- **File**: [OUTPUT_FILE_PATH]
- **Status**: ✅ Written to disk

**Next Steps**:
- Documentation is available at `[OUTPUT_FILE_PATH]`
- Review the file for accuracy and completeness
- Add to version control if ready
</output_format>

<examples>

<example name="api_documentation">
**Command**: `/document REST API authentication methods`

**Workflow**:
1. Analyzes: Research-heavy task (external API information)
2. Invokes @research-specialist to gather authentication information
3. Passes research to @documentation-writer
4. Returns formatted documentation

**Output**:
```
## Documentation: REST API Authentication Methods

[Clean documentation with code examples]
```
</example>

<example name="setup_documentation">
**Command**: `/document project setup process`

**Workflow**:
1. Analyzes: Hybrid task (external tools + codebase analysis)
2. Invokes @research-specialist for external tool requirements
3. Analyzes codebase for project-specific setup
4. Combines information and passes to @documentation-writer
5. Returns formatted documentation

**Output**:
```
## Documentation: Project Setup Process

[Setup instructions with code blocks]
```
</example>

<example name="codebase_documentation">
**Command**: `/document main.py functions`

**Workflow**:
1. Analyzes: Codebase-heavy task
2. Reads main.py and related files
3. Uses grep to find function definitions
4. Extracts documentation strings and usage patterns
5. Passes to @documentation-writer
6. Returns formatted documentation

**Output**:
```
## Documentation: main.py Functions

[Function documentation with examples]
```
</example>

</examples>

<error_handling>

**No information found**:
```
## Documentation: [Topic]

**Issue**: Unable to gather sufficient information for documentation

### Possible Causes
- Topic too broad or unclear
- No relevant files found in codebase
- Research returned no results

### Next Steps
- Provide more specific documentation request
- Check if topic exists in codebase or external sources
- Try alternative search terms
```

**File write failure**:
```
## Documentation: [Topic]

**Issue**: Unable to write documentation to file

### Details
- Intended file: [OUTPUT_FILE_PATH]
- Error: [Specific error message]

### Possible Causes
- Directory doesn't exist
- Insufficient permissions
- Disk space issues

### Next Steps
- Check directory permissions
- Create missing directories manually
- Try alternative file location
```

**Mixed information**:
```
## Documentation: [Topic]

**Note**: Documentation combines both research findings and codebase analysis

[Formatted documentation]

---
**Documentation created successfully**
- **File**: [OUTPUT_FILE_PATH]
- **Status**: ✅ Written to disk
```
</error_handling>

<constraints>

- Always use @documentation-writer for final formatting
- Keep documentation simple and focused
- Use appropriate code blocks (```shell, ```json, etc.)
- Avoid complex formatting (diagrams, emojis, tables)
- Choose the right information gathering approach based on task type
- Return clean, actionable documentation
- **CRITICAL**: Always write documentation to a file, don't just display it
- Generate sensible filenames based on the topic
- Place files in appropriate docs/ subdirectories when possible
- Include file path and write confirmation in output
- Handle file write errors gracefully