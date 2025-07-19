# Deploys - PyInfra Server Management

## Purpose
PyInfra deployment scripts manage server configurations and application deployments. They are designed to be idempotent and inventory-driven.

## Key Guidelines
- Always use `_sudo=True` for privileged operations
- Always provide `name` parameter describing the operation
- **Function-based organization**: Break scripts into focused functions
- **Inventory-driven config**: Access config via `host.data.get("key", {})`
- **Graceful degradation**: Return early if required config is missing
- **Idempotent operations**: Check facts before making changes
- Template files go in `templates/` subdirectory

## Secret Management
```python
from deploys.util.secret import get_secret
token = get_secret("service-token")
```

## Reference
See `docs/dependencies/PYINFRA.md` for detailed PyInfra patterns and operation examples.
