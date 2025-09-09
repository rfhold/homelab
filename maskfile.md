# Maskfile

## init

Initialize the project environment (uses uv by default)

```bash
mask uv-init
mask bun-init
```

## uv-init

Initialize the project using uv package manager

```bash
# Create virtual environment and install dependencies
uv sync
```

## bun-init

Initialize the project using bun package manager

```bash
# Install dependencies using bun
bun install
```

## pyinfra

Run PyInfra commands using uv

### debug

Debug the inventory to see hosts, groups and data

```bash
uv run pyinfra inventory.py debug-inventory
```

### exec

Execute a command on all nodes in the romulus group

**OPTIONS**
* command
  * flags: --command -c
  * type: string
  * desc: Command to execute on remote hosts

```bash
uv run pyinfra inventory.py --limit romulus exec -- ${command:-"echo 'Hello from $(hostname)'"}
```

### exec-node

Execute a command on a specific node

**OPTIONS**
* node
  * flags: --node -n
  * type: string
  * desc: Node name (sol, luna, aurora)
* command
  * flags: --command -c
  * type: string
  * desc: Command to execute on remote host

```bash
uv run pyinfra inventory.py --limit ${node} exec -- ${command:-"echo 'Hello from $(hostname)'"}
```

### deploy

Run a deployment script on all nodes

**OPTIONS**
* script
  * flags: --script -s
  * type: string
  * desc: Deployment script to run

```bash
uv run pyinfra inventory.py --limit romulus ${script}
```

### deploy-node

Run a deployment script on a specific node

**OPTIONS**
* node
  * flags: --node -n
  * type: string
  * desc: Node name (sol, luna, aurora)
* script
  * flags: --script -s
  * type: string
  * desc: Deployment script to run

```bash
uv run pyinfra inventory.py --limit ${node} ${script}
```

### facts

Get facts from all nodes

**OPTIONS**
* fact
  * flags: --fact -f
  * type: string
  * desc: Fact to retrieve (e.g., server.Hostname, server.Date, files.File)

```bash
uv run pyinfra inventory.py --limit romulus fact ${fact:-"server.Hostname server.Date"}
``` 
