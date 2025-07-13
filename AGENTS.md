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

## Documentation Maintenance

### README File Updates
When making changes to the codebase, ensure README files stay current:
- **Main README.md**: Update project structure when adding/removing directories or major files
- **Directory READMEs**: Update component/adapter/module lists when adding new implementations
- **Documentation Examples**: Update usage examples when interfaces change
- **File Lists**: Keep file listings in sync with actual directory contents

### Component Documentation
- Update component tables when adding new components
- Document new configuration patterns in component README
- Update available components section with new additions
- Maintain consistency between AGENTS.md patterns and README examples