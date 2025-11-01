# PyInfra

## What is PyInfra?

[PyInfra](https://pyinfra.com) is a Python-based infrastructure automation tool that turns Python code into shell commands and executes them on remote servers. According to the [official documentation](https://docs.pyinfra.com/en/3.x/), it enables both ad-hoc command execution and declarative infrastructure state management. Think of it as "Ansible but Python instead of YAML, and a lot faster" as described on the [project homepage](https://pyinfra.com).

PyInfra operates agentlessly over SSH, Docker, local execution, and other connectors, making it versatile for various deployment scenarios. The [GitHub repository](https://github.com/pyinfra-dev/pyinfra) has over 4,500 stars and is actively maintained.

## Key Features

PyInfra offers several compelling features that differentiate it from other infrastructure automation tools:

### Performance
[PyInfra is exceptionally fast](https://docs.pyinfra.com/en/3.x/performance.html), with benchmarks showing it can be up to 10x faster than Ansible. The tool achieves predictable performance even when managing thousands of hosts by executing operations in parallel while maintaining proper ordering.

### Python-Native Operations
Instead of YAML, [operations are written in pure Python](https://docs.pyinfra.com/en/3.x/using-operations.html), giving you access to the entire Python package ecosystem. This means you can use standard Python control flow, functions, classes, and any third-party libraries.

### Idempotent Operations
[Operations are declarative and idempotent](https://docs.pyinfra.com/en/3.x/getting-started.html#state-definitions), meaning they only make changes when needed. PyInfra diffs the target state against the current state and only executes commands when changes are required.

### Instant Debugging
[Real-time output from shell commands](https://pyinfra.com) with no abstraction layer makes debugging straightforward. Using the `-vvv` flag provides detailed stdin/stdout/stderr output immediately.

### Agentless Execution
[No agents or dependencies are required on target hosts](https://pyinfra.com). PyInfra works against anything with POSIXish shell access, executing commands over SSH, Docker, or locally.

### Flexible Connectors
[Multiple connector types](https://docs.pyinfra.com/en/3.x/connectors.html) enable targeting different environments:
- `@ssh` - SSH servers
- `@docker` - Docker containers
- `@local` - Local machine
- `@terraform` - Pull inventory from Terraform
- `@vagrant` - Vagrant VMs
- `@podman` - Podman containers
- `@chroot` - Chroot environments

### Retry Functionality
[Built-in retry mechanisms](https://docs.pyinfra.com/en/3.x/arguments.html#retry-behavior) handle unreliable operations or network issues with configurable retry counts, delays, and custom retry conditions.

## How PyInfra Differs from Ansible

While both are agentless infrastructure automation tools, PyInfra and Ansible have fundamental differences:

### Language and Syntax
- **PyInfra**: [Pure Python code](https://docs.pyinfra.com/en/3.x/using-operations.html) with full access to Python's language features and ecosystem
- **Ansible**: YAML-based playbooks with Jinja2 templating

### Performance
[PyInfra is significantly faster than Ansible](https://docs.pyinfra.com/en/3.x/performance.html), with benchmarks showing up to 10x performance improvements. This is achieved through efficient parallel execution and minimal overhead.

### Execution Model
According to the [deploy process documentation](https://docs.pyinfra.com/en/3.x/deploy-process.html):
- **PyInfra**: Two-phase execution - first generates operation order by running code, then executes commands in parallel per operation
- **Ansible**: Sequential task execution with less parallelization

### Debugging
- **PyInfra**: [Real-time stdout/stderr with no abstraction layer](https://pyinfra.com)
- **Ansible**: Output is buffered and formatted, sometimes hiding details

### Learning Curve
- **PyInfra**: Requires Python knowledge but leverages existing programming skills
- **Ansible**: Requires learning YAML syntax and Ansible-specific modules

### Extensibility
- **PyInfra**: [Use any Python package directly](https://docs.pyinfra.com/en/3.x/) in your deploy code
- **Ansible**: Requires writing custom modules in Python, separate from playbooks

## Architecture

### Execution Phases

[PyInfra executes in five distinct stages](https://docs.pyinfra.com/en/3.x/deploy-process.html):

1. **Setup Phase**: Read inventory and data
2. **Connect**: Establish connections to target hosts
3. **Prepare**: Detect changes and determine operation order
4. **Execute**: Apply changes on targets in parallel
5. **Disconnect**: Clean up and close connections

### The Prepare Phase

The prepare phase is critical to PyInfra's architecture. According to the [deploy process documentation](https://docs.pyinfra.com/en/3.x/deploy-process.html#how-pyinfra-detects-changes-orders-operations), PyInfra must execute deploy code before any changes are made to determine the correct operation order.

This two-phase approach enables:
- Operations to run sequentially (ordered)
- Each operation to execute on all hosts in parallel
- Proper dependency handling between operations

### Operations as Generators

[Operations are Python generator functions](https://docs.pyinfra.com/en/3.x/api/operations.html) that yield commands. They can yield:
- Shell commands (strings or `StringCommand` objects)
- File uploads (`FileUploadCommand`)
- File downloads (`FileDownloadCommand`)
- Python functions (`FunctionCommand`)

### Context Objects

PyInfra provides three global context objects accessible in deploy code:

#### `host`
[The `host` object](https://docs.pyinfra.com/en/3.x/using-operations.html#the-host-object) represents the current target host with:
- `host.name` - Host name from inventory
- `host.groups` - Groups the host belongs to
- `host.data` - Host and group data
- `host.get_fact()` - Retrieve facts about the host

#### `inventory`
[The `inventory` object](https://docs.pyinfra.com/en/3.x/using-operations.html#the-inventory-object) provides access to all hosts in the inventory, enabling operations to reference data from other hosts.

#### `config`
[The `config` object](https://docs.pyinfra.com/en/3.x/using-operations.html#the-config-object) sets global defaults for operations and can enforce version requirements.

## Best Practices

### Use Immutable Facts Only

[Only use immutable facts in deploy code](https://docs.pyinfra.com/en/3.x/deploy-process.html#using-host-facts) (OS version, architecture, etc.) unless you are certain they won't change during execution. Since deploy code runs before operations execute, facts are evaluated before any changes are applied.

**Bad practice:**
```python
if host.get_fact(File, path="/etc/nginx/sites-enabled/default"):
    files.file(path="/etc/nginx/sites-enabled/default", present=False)
```

**Good practice:**
```python
files.file(path="/etc/nginx/sites-enabled/default", present=False)
```

### Use `_if` for Conditional Operations

[Always use the `_if` global argument](https://docs.pyinfra.com/en/3.x/deploy-process.html#checking-operation-changes) when checking for operation changes, not Python conditionals. This ensures checks happen at execution time, not preparation time.

**Bad practice:**
```python
remove_default_site = files.file(path="/etc/nginx/sites-enabled/default", present=False)
if remove_default_site.changed:
    server.service(service="nginx", reloaded=True)
```

**Good practice:**
```python
remove_default_site = files.file(path="/etc/nginx/sites-enabled/default", present=False)
server.service(service="nginx", reloaded=True, _if=remove_default_site.did_change)
```

### Leverage Global Arguments

[Global arguments](https://docs.pyinfra.com/en/3.x/arguments.html) control operation execution:
- `_sudo=True` - Execute with sudo
- `_serial=True` - Run operation host by host
- `_env={}` - Set environment variables
- `_chdir="/path"` - Change directory before execution
- `_timeout=60` - Set command timeout

### Structure Deploys with Includes

[Use `local.include()`](https://docs.pyinfra.com/en/3.x/using-operations.html#include-files) to break operations across multiple files and pass data between them:

```python
from pyinfra import local

local.include("tasks/create_user.py", data={"user": "admin", "group": "wheel"})
```

### Handle Output with Callbacks

[Use `python.call()` for accessing operation output](https://docs.pyinfra.com/en/3.x/using-operations.html#output-callbacks) since operations don't execute immediately:

```python
from pyinfra import logger
from pyinfra.operations import python, server

result = server.shell(commands=["echo output"])

def callback():
    logger.info(f"Got result: {result.stdout}")

python.call(function=callback)
```

### Configure Retry for Unreliable Operations

[Use retry arguments](https://docs.pyinfra.com/en/3.x/faq.html#how-do-i-handle-unreliable-operations-or-network-issues) for network operations or flaky commands:

```python
server.shell(
    commands=["wget https://example.com/file.zip"],
    _retries=3,
    _retry_delay=5,
)
```

### Set Ownership and Permissions Declaratively

[Use file/directory operations](https://docs.pyinfra.com/en/3.x/faq.html#how-do-i-chmod-or-chown-a-file-directory-link) to manage permissions rather than explicit chmod/chown commands:

```python
files.file(
    path="/etc/app/config.conf",
    user="appuser",
    group="appgroup",
    mode="644",
)
```

### Use Config for Global Defaults

[Set global defaults with the `config` object](https://docs.pyinfra.com/en/3.x/using-operations.html#the-config-object):

```python
from pyinfra import config

config.SUDO = True
config.REQUIRE_PYINFRA_VERSION = "~=3.0"
```

## Common Patterns

### Package Installation

```python
from pyinfra.operations import apt

apt.packages(
    name="Install base packages",
    packages=["vim", "htop", "curl"],
    update=True,
    _sudo=True,
)
```

### File Management

```python
from pyinfra.operations import files

files.template(
    name="Generate config from template",
    src="templates/app-config.j2",
    dest="/etc/app/config.conf",
    user="appuser",
    mode="644",
    _sudo=True,
)
```

### Service Management

```python
from pyinfra.operations import server

server.service(
    name="Ensure nginx is running",
    service="nginx",
    running=True,
    enabled=True,
    _sudo=True,
)
```

### Conditional Execution Based on OS

```python
from pyinfra import host
from pyinfra.facts.server import LinuxName
from pyinfra.operations import apt, yum

if host.get_fact(LinuxName) == "Ubuntu":
    apt.packages(packages=["nginx"], _sudo=True)
elif host.get_fact(LinuxName) == "CentOS":
    yum.packages(packages=["nginx"], _sudo=True)
```

### Multi-Host Coordination

```python
from pyinfra import inventory
from pyinfra.facts.server import Hostname
from pyinfra.operations import files

db_host = inventory.get_host("postgres-01")
db_hostname = db_host.get_fact(Hostname)

files.template(
    src="templates/app.conf.j2",
    dest="/etc/app/app.conf",
    db_host=db_hostname,
)
```

### Change Detection and Cascading Operations

```python
from pyinfra.operations import files, server
from pyinfra.operations.util import any_changed

nginx_conf = files.template(
    src="templates/nginx.conf.j2",
    dest="/etc/nginx/nginx.conf",
    _sudo=True,
)

ssl_cert = files.file(
    path="/etc/nginx/ssl/cert.pem",
    _sudo=True,
)

server.service(
    service="nginx",
    reloaded=True,
    _if=any_changed(nginx_conf, ssl_cert),
    _sudo=True,
)
```

### Parameterized Tasks

```python
from pyinfra import host
from pyinfra.operations import server

server.user(
    user=host.data.app_user,
    home=host.data.app_home,
    shell="/bin/bash",
    _sudo=True,
)
```

### Docker Container Management

```python
pyinfra @docker/ubuntu:22.04 exec -- apt update
pyinfra @docker/alpine:latest exec -- apk update
```

## Resources

- [Official Documentation](https://docs.pyinfra.com/en/3.x/)
- [GitHub Repository](https://github.com/pyinfra-dev/pyinfra)
- [Examples Repository](https://github.com/pyinfra-dev/pyinfra-examples)
- [Getting Started Guide](https://docs.pyinfra.com/en/3.x/getting-started.html)
- [Operations Index](https://docs.pyinfra.com/en/3.x/operations.html)
- [Facts Index](https://docs.pyinfra.com/en/3.x/facts.html)
- [Matrix Chat](https://matrix.to/#/#pyinfra:matrix.org)
