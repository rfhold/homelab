# Contributing to Homelab

## Documentation Maintenance

When making changes to the codebase, ensure documentation stays current:

### README File Updates
- **Main README.md**: Update project structure when adding/removing directories or major files
- **Directory READMEs**: Update component/adapter/module lists when adding new implementations
- **Documentation Examples**: Update usage examples when interfaces change
- **File Lists**: Keep file listings in sync with actual directory contents

### Component Documentation
- Update component tables when adding new components
- Document new configuration patterns in component README
- Update available components section with new additions
- Maintain consistency between AGENTS.md patterns and README examples

### Module Documentation
- Update module examples in README.md when adding new implementation options
- Add new modules to the module documentation with proper categorization
- Update usage examples if module interfaces change
- Ensure new modules follow the documented abstraction patterns
- Update implementation enum documentation when adding new options

### Adapter Documentation
- Update the "Current Adapters" section in README.md
- Add the new adapter with interface description and utilities
- Update usage examples if adapter patterns change
- Ensure new adapters follow the documented patterns in README
- Update interface documentation when adding new configuration options

### Deployment Script Documentation
- Update the "Available Scripts" section in README.md
- Add new scripts with proper categorization and description
- Update usage examples if script interfaces change
- Ensure new scripts follow the documented patterns in README
- Update configuration examples when adding new inventory requirements

### Helm Chart Documentation
- Update helm-charts.ts documentation when adding new chart references
- Ensure chart configurations follow documented patterns
- Update component documentation when chart integrations change

## Code Review Guidelines

### Before Submitting
- Verify all documentation is updated
- Check that new code follows existing patterns
- Ensure AGENTS.md guidelines are followed
- Test changes in development environment

### Review Checklist
- [ ] Documentation updated for new/changed functionality
- [ ] Code follows established patterns and conventions
- [ ] No secrets or sensitive data committed
- [ ] README files reflect actual codebase structure
- [ ] Examples in documentation are accurate and working