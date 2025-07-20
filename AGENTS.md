# Agent Instructions for Homelab Repository

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- NEVER execute `pulumi up` or any Pulumi deployment commands
- NEVER execute `pyinfra` deployment commands against real hosts
- NEVER run any commands that could modify infrastructure or deploy services
- This is a sensitive production homelab environment - code review and manual deployment only

## Build/Lint/Test Commands
- **Install deps**: `bun install` (TypeScript) or `uv sync` (Python)
- **Run Pulumi**: `pulumi preview` in stack directories (stacks/*)
- **PyInfra**: `uv run pyinfra inventory.py --limit <host> <script>`
- **No test runner configured** - Add tests as needed

## Directory-Specific Guidelines
For detailed coding standards, patterns, and examples, consult the AGENTS.md file in each directory:

- **Components**: `src/components/AGENTS.md` - Pulumi component patterns and architecture
- **Modules**: `src/modules/AGENTS.md` - Module composition and reusable patterns  
- **Adapters**: `src/adapters/AGENTS.md` - Service adapter patterns and configurations
- **Deployments**: `deploys/AGENTS.md` - PyInfra deployment scripts and server management

## Global Coding Standards

### General Principles
- NO comments unless explicitly requested
- Follow existing patterns in neighboring files
- Check imports before using libraries
- Never commit secrets or expose sensitive data
- Always specify return types for public functions

### Import Organization
- Node built-ins → npm packages → @pulumi/* → relative imports (TypeScript)
- Explicit operation imports for PyInfra: `from pyinfra.operations import apt, files`

### Naming Conventions
- Interface naming: `ComponentNameArgs` for components, `ServiceNameConfig` for adapters
- File naming: kebab-case (e.g., bitnami-postgres.ts)
- Use descriptive names for all operations (especially PyInfra `name` parameter)

## Reference Documentation
- **Pulumi Patterns**: See `docs/dependencies/PULUMI.md` for detailed Pulumi coding patterns
- **PyInfra Patterns**: See `docs/dependencies/PYINFRA.md` for PyInfra operation patterns
- **Contributing**: See `CONTRIBUTING.md` for documentation maintenance guidelines
