# Agent Instructions for Homelab Repository

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- NEVER execute `pulumi up`, `pulumi preview`, or any Pulumi deployment commands
- NEVER execute `pyinfra` deployment commands against real hosts
- NEVER run any commands that could modify infrastructure or deploy services
- This is a sensitive production homelab environment - code review and manual deployment only

## Build/Lint/Test Commands
- **Install deps**: `bun install` (TypeScript) or `uv sync` (Python)
- **Run Pulumi**: `pulumi up` in stack directories (stacks/*)
- **PyInfra**: `uv run pyinfra inventory.py --limit <host> <script>`
- **No test runner configured** - Add tests as needed

## Code Style Guidelines

### TypeScript (src/*, stacks/*)
- Use strict TypeScript with explicit types (avoid `any`)
- Import order: Node built-ins → npm packages → @pulumi/* → relative imports
- Use `pulumi.Input<T>` for config interfaces, `pulumi.Output<T>` for derived values
- Interface naming: `ComponentNameArgs` for components, `ServiceNameConfig` for adapters
- Always specify return types for public functions
- Use JSDoc comments for all public APIs
- One main export per file, no barrel exports (index.ts)

### Python (deploys/*)
- Import PyInfra operations explicitly: `from pyinfra.operations import apt, files`
- Use `_sudo=True` for privileged operations
- Access host config via `host.data.get("key", default)`
- Use `from deploys.util.secret import get_secret` for secrets
- Always provide `name` parameter for operations

### General
- NO comments unless explicitly requested
- Follow existing patterns in neighboring files
- Check imports before using libraries
- Never commit secrets or expose sensitive data