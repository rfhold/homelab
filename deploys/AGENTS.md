# Agent Instructions for Deploys (PyInfra)

## DEPLOYMENT RESTRICTIONS
**CRITICAL: DO NOT RUN ANY DEPLOYMENT COMMANDS**
- NEVER execute `pyinfra` commands against real hosts
- NEVER run deployment scripts that could modify server configurations
- This directory contains sensitive production deployment scripts - code review only

## Build/Lint/Test Commands
- **Install deps**: `uv sync` from project root
- **Run deployment**: `uv run pyinfra inventory.py --limit <host> <script>`
- **Debug inventory**: `uv run pyinfra inventory.py debug-inventory`
- **Get facts**: `uv run pyinfra inventory.py --limit <host> fact <fact_name>`
- **No linter/formatter** - Follow existing code patterns

## PyInfra Patterns
- Import operations explicitly: `from pyinfra.operations import apt, files, systemd`
- Import facts: `from pyinfra.facts import SystemdStatus, Which`
- Access host data: `from pyinfra.context import host`
- Always use `_sudo=True` for privileged operations
- Always provide `name` parameter describing the operation

## Code Style Guidelines
- **Function-based organization**: Break scripts into focused functions
- **Inventory-driven config**: Access config via `host.data.get("key", {})`
- **Graceful degradation**: Return early if required config is missing
- **Change tracking**: Track operation results to trigger dependent operations
- **Idempotent operations**: Check facts before making changes
- Use `python.call()` to wrap complex logic in functions
- Template files go in `templates/` subdirectory

## Script Structure Pattern
```python
from pyinfra.context import host
from pyinfra.operations import files, systemd, server

def configure_component() -> None:
    """Configure the main component."""
    config = host.data.get("component_config", {})
    
    if not config:
        return
    
    # Implementation here

def verify_component() -> None:
    """Verify component is working correctly."""
    # Verification logic

# Main execution - check config first
config = host.data.get("component_config")

if config:
    configure_component()
    verify_component()
```

## Common Operations
```python
# Package installation
apt.packages(
    name="Install packages",
    packages=["package1", "package2"],
    _sudo=True,
)

# File operations
files.template(
    name="Create config file",
    src="deploys/service/templates/config.j2",
    dest="/etc/service/config.conf",
    user="root",
    group="root",
    mode="644",
    _sudo=True,
    # Template variables
    var1=value1,
)

# Service management
systemd.service(
    name="Enable and start service",
    service="service-name",
    running=True,
    enabled=True,
    _sudo=True,
)
```

## Secret Management
```python
from deploys.util.secret import get_secret

token = get_secret("service-token")
```