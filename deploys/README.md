# Deployment Scripts

This directory contains PyInfra deployment scripts for managing homelab infrastructure. Each script provides server configuration and management capabilities.

## Available Scripts

### **Environment Configuration**
- **`dev-mode.py`** - Development environment configuration
- **`prod-mode.py`** - Production environment configuration

### **K3s Cluster Management**
- **`k3s-node.py`** - K3s node deployment and configuration
- **`k3s/`** - K3s cluster deployment utilities and templates

### **Hardware-Specific Configuration**
- **`nvidia-container-host.py`** - NVIDIA container runtime setup for GPU workloads
- **`raspberry.py`** - Base Raspberry Pi configuration
- **`raspberry-nvme-boot.py`** - Raspberry Pi NVMe boot configuration with advanced storage setup
- **`raspberry-sd-boot.py`** - Raspberry Pi SD card boot configuration

### **Utilities**
- **`util/`** - Shared utility functions and helpers
  - `secret.py` - Secret management utilities

## Script Categories

### **Base System Configuration**
Scripts that handle fundamental system setup:
- `raspberry.py` - Base Raspberry Pi system configuration
- `raspberry-nvme-boot.py` - Advanced boot configuration for NVMe storage
- `raspberry-sd-boot.py` - SD card boot configuration

### **Container Runtime Setup**
Scripts that configure container and Kubernetes environments:
- `k3s-node.py` - K3s lightweight Kubernetes distribution setup
- `nvidia-container-host.py` - NVIDIA container toolkit for GPU acceleration

### **Environment Management**
Scripts that handle environment-specific configurations:
- `dev-mode.py` - Development environment settings
- `prod-mode.py` - Production environment settings

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

## Usage Examples

### **Basic Deployment**
```bash
# Deploy K3s to specific host
uv run pyinfra inventory.py --limit k3s-master k3s-node.py

# Configure NVIDIA runtime on GPU hosts
uv run pyinfra inventory.py --limit gpu-nodes nvidia-container-host.py

# Setup Raspberry Pi with NVMe boot
uv run pyinfra inventory.py --limit rpi-nodes raspberry-nvme-boot.py
```

### **Environment-Specific Deployment**
```bash
# Apply development configuration
uv run pyinfra inventory.py --limit dev-cluster dev-mode.py

# Apply production configuration  
uv run pyinfra inventory.py --limit prod-cluster prod-mode.py
```

### **Debug and Verification**
```bash
# Check inventory configuration
uv run pyinfra inventory.py debug-inventory

# Get system facts
uv run pyinfra inventory.py --limit hostname fact SystemdStatus
```

## Configuration Pattern

Configuration is managed through `inventory.py` at the root level:

```python
# Example inventory configuration
inventory = [
    ("k3s-master", {
        "k3s_config": {
            "cluster_init": True,
            "node_token": "secret-token",
        },
        "nvidia_config": {
            "install_driver": True,
            "runtime": "nvidia",
        },
    }),
    ("rpi-worker", {
        "raspberry_config": {
            "boot_device": "nvme",
            "gpu_memory": 128,
        },
    }),
]
```

## Script Development Guidelines

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

### **Common PyInfra Operations**
```python
# Package installation
apt.packages(
    name="Install required packages",
    packages=["docker.io", "kubernetes"],
    _sudo=True,
)

# Service management
systemd.service(
    name="Enable and start service",
    service="k3s",
    running=True,
    enabled=True,
    _sudo=True,
)

# File operations
files.template(
    name="Create configuration file",
    src="deploys/templates/config.j2",
    dest="/etc/service/config.conf",
    _sudo=True,
)
```

## Deployment Safety

### **Critical Safety Rules**
- **NEVER** run deployment commands against production without review
- Always use `--limit` to target specific hosts
- Test changes in development environment first
- Use `--check` flag for dry-run verification

### **Best Practices**
- Review inventory configuration before deployment
- Monitor deployment output for errors
- Verify service status after deployment
- Keep deployment scripts idempotent

## Templates and Configuration

### **Template Files**
Configuration templates are stored in subdirectories:
- `k3s/templates/` - K3s service templates
- Template files use Jinja2 syntax for variable substitution

### **Secret Management**
```python
from deploys.util.secret import get_secret

# Retrieve secrets safely
api_token = get_secret("k3s-token")
```

For detailed patterns and implementation examples, see the `AGENTS.md` file in this directory. 