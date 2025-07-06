# Deployment Scripts

This directory contains PyInfra deployment scripts for managing homelab infrastructure. Each script provides server configuration and management capabilities.

## Script Structure

All deployment scripts follow a consistent structure:

### 1. **Function-Based Organization**
- Break functionality into focused functions
- Use descriptive function names (e.g., `configure_vlan_interfaces()`)
- Keep main execution simple and clear

### 2. **Host Data Configuration**
- Access configuration via `host.data.get("key", {})`
- Support per-host customization through inventory
- Gracefully handle missing configuration

### 3. **Idempotent Operations**
- Use PyInfra facts to check current state
- Only make changes when needed
- Track changes to trigger dependent operations

## Naming Conventions

### **File Names**
- kebab-case matching the infrastructure concept
- Examples: `network.py`, `k3s-node.py`, `raspberry.py`

### **Function Names**
- snake_case with descriptive verbs
- Examples: `configure_vlan_interfaces()`, `ensure_vlan_kernel_module()`

## Example Script Structure

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

# Main execution
config = host.data.get("component_config")

if config:
    configure_component()
    verify_component()
```

## Configuration Pattern

Configuration is managed through `inventory.py`:

```python
("hostname", {
    "component_config": {
        "setting1": "value1",
        "setting2": ["item1", "item2"],
    },
})
```

## Script Guidelines

### **Keep Scripts Focused**
- Each script should manage a single infrastructure concern
- Use functions to organize related operations
- Handle missing configuration gracefully

### **Use Proper PyInfra Patterns**
- Always provide descriptive `name` parameters
- Use `_sudo=True` for privileged operations
- Check facts before making changes for idempotency

### **Follow Inventory-Driven Design**
- All configuration comes from `inventory.py`
- Support different configurations per host
- Skip hosts without relevant configuration 