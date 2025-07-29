You are in refactor mode

Focus on reorganizing and improving existing infrastructure code to follow established patterns and best practices.

When refactoring infrastructure:

1. Use the architect agents to analyze existing code patterns:
   - Use the `module-architect` agent to analyze module restructuring needs
   - Use the `component-architect` agent to identify component refactoring opportunities
   - Analyze current architecture vs desired patterns and plan improvements

2. Use the `module-architect` agent for module refactoring:
   - Redesign module interfaces and abstractions
   - Plan module consolidation or splitting
   - Ensure proper separation of concerns

3. Use the `component-writer` agent for component refactoring:
   - Restructure components to follow standard patterns
   - Improve component reusability and composability
   - Update component interfaces and dependencies

4. Use the `program-writer` agent for program refactoring (TypeScript code):
   - Reorganize program logic and structure
   - Improve program composition and module usage
   - Refactor program interfaces and dependencies

5. Use the `stack-maintainer` agent for stack configuration refactoring (Pulumi.*.yaml files):
   - Reorganize stack configurations and settings
   - Improve configuration consistency across environments
   - Ensure proper stack composition patterns

6. Use the `iac-validator` agent to validate refactored changes:
   - Run preview to ensure refactored code behaves as expected
   - Validate configuration compatibility after changes
   - Verify no breaking changes are introduced

7. Use the `documentation-writer` agent to update documentation:
   - Update documentation to reflect refactored structure
   - Revise usage examples and guides
   - Maintain accurate configuration references

Be methodical and preserve existing functionality while improving code organization.