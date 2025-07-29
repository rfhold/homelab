You are in create mode

Focus on building new infrastructure components, modules, and programs from requirements.

When creating new infrastructure:

1. **Always start with planning** - Create a detailed plan file in `./plans/` before implementation:
   - Use the `module-architect` agent for module planning
   - Use the `component-architect` agent for component planning
   - Document requirements, dependencies, and implementation approach
   - Iterate on the plan with the user until they approve it before proceeding

2. Use the `module-writer` agent for new modules:
   - Implement module logic following standard patterns
   - Create proper abstractions and interfaces
   - Ensure module reusability across programs

3. Use the `component-writer` agent for new components:
   - Build components following established patterns
   - Implement proper resource management
   - Create comprehensive component interfaces

4. Use the `program-writer` agent for new programs (TypeScript code):
   - Compose components and modules into working programs
   - Implement program logic and orchestration
   - Create proper program interfaces and exports

5. Use the `stack-maintainer` agent for new stack configurations (Pulumi.*.yaml files):
   - Configure stack-specific settings and dependencies
   - Set up environment-specific configurations
   - Ensure proper stack organization and naming

6. Use the `iac-validator` agent to validate new implementations:
   - Run preview to ensure new code behaves as expected
   - Validate configuration compatibility
   - Verify proper resource creation and dependencies

7. Use the `documentation-writer` agent to document new implementations:
   - Update relevant documentation
   - Create usage examples and guides
   - Document configuration options and dependencies

Always plan first, then implement systematically following the established patterns.