# Gitea Implementation Plan

## Overview
Implementing Gitea as a self-hosted Git service using the official Helm chart from `oci://docker.gitea.com/charts/gitea`. This will provide a complete Git hosting solution with web interface, issue tracking, and CI/CD capabilities.

## Architecture

### Components
1. **Gitea Application**: Main Git service with web interface
2. **PostgreSQL**: Database backend (non-HA, single instance)
3. **Valkey**: Redis-compatible cache (standalone, non-cluster)
4. **Persistent Storage**: Git repositories and application data
5. **Ingress**: HTTPS access via Traefik with cert-manager

### Dependencies
- **Storage**: Requires Rook Ceph for persistent volumes
- **Ingress**: Requires Traefik and cert-manager for HTTPS
- **DNS**: External DNS for automatic subdomain creation

## Implementation Structure

### 1. Component Layer (`src/components/gitea.ts`)
- Helm chart wrapper for Gitea
- PostgreSQL configuration (built-in chart)
- Valkey configuration (built-in chart)
- Persistent volume claims
- Service configuration
- Security contexts and RBAC

### 2. Module Layer (`src/modules/git.ts`)
- High-level Git service abstraction
- Ingress configuration with TLS
- DNS management
- Backup integration (Velero)
- Monitoring setup (if metrics enabled)

### 3. Stack Layer (`stacks/git/`)
- Complete Git service deployment
- Environment-specific configuration
- Resource allocation and scaling

## Configuration Strategy

### Database (PostgreSQL)
```yaml
postgresql:
  enabled: true
  architecture: standalone
  auth:
    database: gitea
    username: gitea
    password: <generated-secret>
  primary:
    persistence:
      size: 20Gi
      storageClass: ceph-block
```

### Cache (Valkey)
```yaml
valkey:
  enabled: true
  architecture: standalone
  auth:
    enabled: false  # Internal cluster communication
  master:
    persistence:
      size: 5Gi
      storageClass: ceph-block
```

### Gitea Application
```yaml
gitea:
  admin:
    username: admin
    email: admin@homelab.local
    password: <generated-secret>
  config:
    database:
      DB_TYPE: postgres
    cache:
      ADAPTER: redis
    server:
      DOMAIN: git.homelab.local
      ROOT_URL: https://git.homelab.local
      SSH_DOMAIN: git.homelab.local
      SSH_PORT: 22
```

### Storage
```yaml
persistence:
  enabled: true
  size: 50Gi
  storageClass: ceph-block
  accessModes: ["ReadWriteOnce"]
```

### Ingress
```yaml
ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.tls: "true"
  hosts:
    - host: git.homelab.local
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: gitea-tls
      hosts:
        - git.homelab.local
```

## Security Considerations

### Authentication
- Strong admin password generation
- LDAP integration capability (future)
- OAuth provider support (future)

### Network Security
- Internal PostgreSQL/Valkey communication
- TLS termination at ingress
- SSH access on standard port 22

### Data Protection
- Encrypted storage via Ceph
- Regular backups via Velero
- Secret management via Kubernetes secrets

## Backup Strategy

### Repository Data
- Velero backup of persistent volumes
- Schedule: Daily incremental, weekly full
- Retention: 30 days

### Database
- PostgreSQL built-in backup via Velero
- Point-in-time recovery capability

### Configuration
- Gitea configuration in Git (infrastructure as code)
- Kubernetes manifests versioned

## Monitoring & Observability

### Metrics (Optional)
```yaml
gitea:
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true
      interval: 30s
```

### Health Checks
- Liveness probe: HTTP endpoint
- Readiness probe: Database connectivity
- Startup probe: Application initialization

## Resource Requirements

### Minimum Resources
- **Gitea**: 500m CPU, 1Gi RAM
- **PostgreSQL**: 250m CPU, 512Mi RAM
- **Valkey**: 100m CPU, 256Mi RAM
- **Storage**: 75Gi total (50Gi repos + 20Gi DB + 5Gi cache)

### Scaling Considerations
- Single replica for simplicity
- Horizontal scaling possible with shared storage
- Database connection pooling via pgpool (if HA needed)

## Migration Path

### Phase 1: Basic Deployment
1. Deploy standalone Gitea with built-in DB/cache
2. Configure basic ingress and TLS
3. Create admin user and test functionality

### Phase 2: Production Hardening
1. Enable metrics and monitoring
2. Configure backup schedules
3. Implement proper secret management
4. Performance tuning

### Phase 3: Advanced Features
1. LDAP/OAuth integration
2. CI/CD runners (Gitea Actions)
3. Container registry integration
4. High availability (if needed)

## File Structure
```
src/
├── components/
│   └── gitea.ts              # Helm chart component
├── modules/
│   └── git.ts                # High-level Git module
└── adapters/
    └── git.ts                # Git service adapter (future)

stacks/
└── git/
    ├── index.ts              # Stack definition
    └── Pulumi.yaml           # Stack configuration

docs/
└── GITEA.md                  # This documentation
```

## Next Steps
1. Implement Gitea component with Helm chart integration
2. Create Git module with ingress and storage configuration
3. Set up Git stack for deployment
4. Test deployment in development environment
5. Configure backup and monitoring
6. Document operational procedures