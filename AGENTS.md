## Global Coding Standards
- NO comments unless explicitly requested
- Follow existing patterns in neighboring files
- Check imports before using libraries
- Never commit secrets or expose sensitive data
- Always specify return types for public functions
- Avoid refactoring language in code. ie. New, Simplified, ect

## Tools
- Use Yarn instead of Bun/NPM/Node
- Package manager is Yarn 4 with `nodeLinker: node-modules` (required for Pulumi dynamic providers)
- After cloning or when SDK is missing, run `pulumi install` in `packages/authentik-provider/` to regenerate the Authentik SDK (`sdks/authentik/config/` is gitignored)
