## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- NEVER execute `pulumi up` or any Pulumi deployment commands
- NEVER execute `pyinfra` deployment commands

## Global Coding Standards
- NO comments unless explicitly requested
- Follow existing patterns in neighboring files
- Check imports before using libraries
- Never commit secrets or expose sensitive data
- Always specify return types for public functions

## Reference Documentation
- **Pulumi**: See @docs/dependencies/PULUMI.md for detailed Pulumi coding patterns
- **PyInfra**: See @docs/dependencies/PYINFRA.md for PyInfra operation patterns
