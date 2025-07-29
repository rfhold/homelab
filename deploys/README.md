# Deployment Scripts

PyInfra deployment scripts for managing homelab infrastructure. Scripts provide server configuration and management capabilities with idempotent, inventory-driven operations.

## Purpose & Responsibility

Deployment scripts are responsible for:
- Server provisioning and base system configuration
- Container runtime and Kubernetes cluster setup
- Hardware-specific configurations (NVIDIA, Raspberry Pi)
- Environment-specific settings (development, production)
- Service deployment and configuration management

## Available Scripts

| Script | File | Purpose | Target Systems |
|--------|------|---------|----------------|
| `dev-mode.py` | `dev-mode.py` | Development environment configuration with debug settings | Development clusters |
| `prod-mode.py` | `prod-mode.py` | Production environment configuration with security hardening | Production clusters |
| `k3s-node.py` | `k3s-node.py` | K3s lightweight Kubernetes distribution setup and configuration | All Kubernetes nodes |
| `nvidia-container-host.py` | `nvidia-container-host.py` | NVIDIA container runtime setup for GPU workloads | GPU-enabled hosts |
| `raspberry.py` | `raspberry.py` | Base Raspberry Pi system configuration and optimization | Raspberry Pi devices |
| `raspberry-nvme-boot.py` | `raspberry-nvme-boot.py` | Raspberry Pi NVMe boot configuration with advanced storage setup | Raspberry Pi with NVMe |
| `raspberry-sd-boot.py` | `raspberry-sd-boot.py` | Raspberry Pi SD card boot configuration | Raspberry Pi with SD cards |

## Support Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `secret.py` | `util/secret.py` | Secret management utilities for secure credential handling |
| `k3s.service.j2` | `k3s/templates/k3s.service.j2` | K3s systemd service template with configuration options |

## Standard Structure

All deployment scripts must follow this structure:

### Function-Based Organization
- Break functionality into focused, single-purpose functions
- Use descriptive function names that clearly indicate the operation
- Keep main execution logic simple and clear
- Organize related operations into logical function groups

### Host Data Configuration
- Access configuration via `host.data.get("key", {})` pattern
- Support per-host customization through inventory configuration
- Gracefully handle missing configuration with sensible defaults
- Return early from functions if required configuration is missing

### Idempotent Operations
- Use PyInfra facts to check current system state before making changes
- Only perform operations when changes are actually needed
- Track operation results to trigger dependent operations
- Ensure scripts can be run multiple times safely

### Operation Naming
- Always provide descriptive `name` parameter for all PyInfra operations
- Use clear, action-oriented descriptions (e.g., "Install Docker packages")
- Include context about what the operation accomplishes
- Follow consistent naming patterns across scripts

## Guidelines

### PyInfra Operation Patterns
- Always use `_sudo=True` for operations requiring elevated privileges
- Check system facts before making changes to ensure idempotency
- Use appropriate PyInfra operations for each task type
- Handle operation failures gracefully with proper error messages

### Configuration Management
- All configuration must come from `inventory.py` at the project root
- Support different configurations per host through inventory data
- Use configuration keys that clearly indicate their purpose
- Provide fallback defaults for optional configuration parameters

### Template Usage
- Store configuration templates in appropriate subdirectories
- Use Jinja2 syntax for variable substitution in templates
- Keep templates focused on single configuration concerns
- Validate template variables before rendering

### Secret Management
- Use `deploys.util.secret.get_secret()` for retrieving sensitive data
- Never hardcode secrets or credentials in deployment scripts
- Handle missing secrets gracefully with clear error messages
- Ensure secrets are properly secured in the target environment

### Service Management
- Use systemd operations for service lifecycle management
- Ensure services are both enabled and started when required
- Check service status after configuration changes
- Handle service dependencies and startup ordering

### Package Management
- Use distribution-appropriate package managers (apt for Ubuntu/Debian)
- Install packages in logical groups with descriptive names
- Update package indexes when necessary
- Handle package installation failures appropriately

### File Operations
- Use appropriate file operations for different file types
- Set proper permissions and ownership for configuration files
- Backup important files before making changes
- Validate file contents after creation or modification

### Error Handling
- Provide clear error messages for common failure scenarios
- Log important operations and their results
- Handle network timeouts and connectivity issues
- Fail fast when critical operations cannot be completed

### Safety Practices
- Always use `--limit` flag to target specific hosts during deployment
- Test changes in development environments before production deployment
- Use `--check` flag for dry-run verification of changes
- Monitor deployment output for errors and warnings
- Verify service functionality after deployment completion