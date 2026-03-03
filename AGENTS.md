## Global Coding Standards
- NO comments unless explicitly requested
- Follow existing patterns in neighboring files
- Check imports before using libraries
- Never commit secrets or expose sensitive data
- Always specify return types for public functions
- Avoid refactoring language in code. ie. New, Simplified, ect

## Tools
- Use Bun instead of Yarn/NPM/Node
- Package manager is Bun
- After cloning or when SDK is missing, run `pulumi install` in `packages/authentik-provider/` to regenerate the Authentik SDK (`sdks/authentik/config/` is gitignored)
