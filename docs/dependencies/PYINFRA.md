# PyInfra

PyInfra turns Python code into shell commands and runs them on servers. It provides declarative operations for infrastructure management with idempotent execution.

## Writing Operations

### Basic Structure
```python
from pyinfra import host
from pyinfra.operations import apt, files, systemd

# Package installation
apt.packages(
    name="Install packages",
    packages=["nginx", "docker"],
    _sudo=True,
)

# File operations
files.template(
    name="Create config file",
    src="templates/config.j2",
    dest="/etc/app/config.conf",
    user="root",
    group="root",
    mode="644",
    _sudo=True,
)

# Service management
systemd.service(
    name="Start service",
    service="nginx",
    running=True,
    enabled=True,
    _sudo=True,
)
```

### Using Facts
```python
from pyinfra import host
from pyinfra.facts.server import LinuxName

# Conditional execution based on OS
if host.get_fact(LinuxName) == "Ubuntu":
    apt.packages(
        name="Install Ubuntu packages",
        packages=["ubuntu-specific-package"],
        _sudo=True,
    )
```

### Host Data Access
```python
from pyinfra import host

# Access inventory data
config = host.data.get("app_config", {})
if config:
    files.template(
        name="Create app config",
        src="app.conf.j2",
        dest="/etc/app.conf",
        app_port=config.get("port", 8080),
        _sudo=True,
    )
```

## Inventory Files

### Simple Inventory
```python
# inventory.py
hosts = [
    "web1.example.com",
    "web2.example.com",
]
```

### Inventory with Data
```python
# inventory.py
web_servers = [
    ("web1.example.com", {
        "app_port": 8080,
        "workers": 4,
    }),
    ("web2.example.com", {
        "app_port": 8081,
        "workers": 2,
    }),
]
```

### Group Data
```python
# group_data/web_servers.py
app_user = "webapp"
app_dir = "/opt/webapp"
```

## Common Patterns

### Conditional Operations
```python
from pyinfra import host

if "web_servers" in host.groups:
    apt.packages(
        name="Install web server",
        packages=["nginx"],
        _sudo=True,
    )
```

### Function Organization
```python
def install_dependencies():
    apt.packages(
        name="Install base packages",
        packages=["git", "curl"],
        _sudo=True,
    )

def configure_service():
    files.template(
        name="Create service config",
        src="service.conf.j2",
        dest="/etc/service.conf",
        _sudo=True,
    )

# Execute functions
install_dependencies()
configure_service()
```

### Error Handling
```python
from pyinfra import host

config = host.data.get("service_config")
if not config:
    print("No service config found, skipping")
    # Early return if no config
else:
    # Configure service
    pass
```

## Global Arguments

All operations accept global arguments:

- `_sudo=True` - Run with sudo
- `_sudo_user="user"` - Run sudo as specific user  
- `name="Description"` - Operation description
- `_ignore_errors=True` - Continue on errors

## Key Operations

### Package Management
```python
from pyinfra.operations import apt, yum

apt.packages(packages=["package1", "package2"], _sudo=True)
yum.packages(packages=["package1", "package2"], _sudo=True)
```

### Files
```python
from pyinfra.operations import files

files.file(path="/path/to/file", present=True, _sudo=True)
files.directory(path="/path/to/dir", present=True, _sudo=True)
files.template(src="template.j2", dest="/path/to/dest", _sudo=True)
```

### Services
```python
from pyinfra.operations import systemd

systemd.service(service="nginx", running=True, enabled=True, _sudo=True)
```

### Shell Commands
```python
from pyinfra.operations import server

server.shell(commands=["echo hello"], _sudo=True)
```
