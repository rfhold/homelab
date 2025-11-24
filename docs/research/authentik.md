# Authentik Identity Provider

Authentik is an open-source identity provider and SSO platform supporting OAuth2, SAML, LDAP, and SCIM protocols.

## Overview

Authentik provides centralized authentication and user management with integration support for 50+ applications. It offers both a forever-free open source version and a source-available Enterprise version.

Key capabilities:
- Single sign-on across applications
- User profile and password management
- Flow-based customizable authentication
- Admin and user interfaces with light/dark mode
- Quick user deactivation and impersonation
- Integration with external identity sources

## Deployment

### Docker Compose

Recommended for test environments and small-scale production.

Requirements:
- 2 CPU cores minimum
- 2GB RAM minimum
- Docker with Compose v2

Setup:

```shell
wget https://docs.goauthentik.io/docker-compose.yml
echo "PG_PASS=$(openssl rand -base64 36 | tr -d '\n')" >> .env
echo "AUTHENTIK_SECRET_KEY=$(openssl rand -base64 60 | tr -d '\n')" >> .env
echo "AUTHENTIK_ERROR_REPORTING__ENABLED=true" >> .env
docker compose pull
docker compose up -d
```

Access the initial setup at http://<server-ip>:9000/if/flow/initial-setup/ with default user akadmin.

Custom port configuration:

```shell
COMPOSE_PORT_HTTP=80
COMPOSE_PORT_HTTPS=443
```

### Kubernetes

Deployed via Helm chart for production environments.

Requirements:
- Kubernetes cluster
- Helm package manager

Generate secure credentials:

```shell
openssl rand 60 | base64 -w 0
```

Create values.yaml:

```yaml
authentik:
  secret_key: "PleaseGenerateASecureKey"
  error_reporting:
    enabled: true
  postgresql:
    password: "ThisIsNotASecurePassword"

server:
  ingress:
    ingressClassName: nginx
    enabled: true
    hosts:
      - authentik.domain.tld

postgresql:
  enabled: true
  auth:
    password: "ThisIsNotASecurePassword"
```

Install:

```shell
helm repo add authentik https://charts.goauthentik.io
helm repo update
helm upgrade --install authentik authentik/authentik -f values.yaml
```

For production, use dedicated PostgreSQL operators like CloudNativePG or Zalando Postgres Operator instead of the bundled database.

## Configuration

### Required Components

- PostgreSQL 16 or higher
- Secret key with 32+ characters for encryption
- Email server for notifications

### Core Environment Variables

Database connection:

```shell
AUTHENTIK_POSTGRESQL__HOST=localhost
AUTHENTIK_POSTGRESQL__PORT=5432
AUTHENTIK_POSTGRESQL__USER=authentik
AUTHENTIK_POSTGRESQL__PASSWORD=secure-password
AUTHENTIK_POSTGRESQL__NAME=authentik
```

Application settings:

```shell
AUTHENTIK_SECRET_KEY=generated-secret-key
AUTHENTIK_LOG_LEVEL=info
```

Worker configuration:

```shell
AUTHENTIK_WORKER__PROCESSES=1
AUTHENTIK_WORKER__THREADS=2
AUTHENTIK_WORKER__TASK_MAX_RETRIES=5
```

Listen addresses:

```shell
AUTHENTIK_LISTEN__HTTP=0.0.0.0:9000
AUTHENTIK_LISTEN__HTTPS=0.0.0.0:9443
AUTHENTIK_LISTEN__METRICS=0.0.0.0:9300
```

### Email Configuration

```shell
AUTHENTIK_EMAIL__HOST=smtp.example.com
AUTHENTIK_EMAIL__PORT=587
AUTHENTIK_EMAIL__USERNAME=authentik@example.com
AUTHENTIK_EMAIL__PASSWORD=smtp-password
AUTHENTIK_EMAIL__USE_TLS=true
AUTHENTIK_EMAIL__FROM=authentik@example.com
```

### PostgreSQL Settings

Authentik supports:
- SSL/TLS encrypted connections
- Read replicas for scaling
- Connection pooling via PgBouncer or PgPool
- Hot-reloading of connection settings

The database stores user data, conversations, file metadata, and vector embeddings. Vector operations are CPU-intensive.

## Authentication Integration

### Supported Protocols

- OAuth2 and OpenID Connect
- SAML
- LDAP
- SCIM

### Application Integration

Authentik integrates with applications supporting standard authentication protocols including Google Workspace, GitHub, Slack, AWS, and 50+ other services.

### External Identity Sources

Authentik can federate with:
- Active Directory
- Social login providers
- Any LDAP, SCIM, SAML, or OAuth provider

## Reverse Proxy

Production deployments require a reverse proxy for SSL termination.

Architecture:

```
Internet → Reverse Proxy
  → authentik.domain.tld:443 → Authentik:9000
  → PostgreSQL:5432 (internal only)
```

Requirements:
- Allow .well-known path for OAuth2 discovery
- Disable caching for authentication endpoints
- Enable HTTPS with valid certificates
- Match protocol in environment variables

Configure trusted proxy CIDRs:

```shell
AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS=127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

## Resource Requirements

Production minimum:

CPU: 4 cores total
- Authentik: 1-2 cores
- PostgreSQL: 1-2 cores

Memory: 4-6GB total
- Authentik: 512MB-2GB
- PostgreSQL: 2-4GB

Storage: Varies by usage

PostgreSQL requires significant memory and CPU for vector operations and query processing.

## Upgrading

### Important Notes

- No downgrade support exists
- Always backup database before upgrading
- Review release notes carefully
- Upgrade sequentially through major versions
- Update to latest minor version before next major
- Outposts must match server version

### Docker Compose Upgrade

```shell
wget -O docker-compose.yml https://docs.goauthentik.io/docker-compose.yml
docker compose pull
docker compose up -d
```

### Kubernetes Upgrade

```shell
helm repo update
helm upgrade --install authentik authentik/authentik -f values.yaml
```

### Verification

Check version in Admin interface under Dashboards > Overview.

### Troubleshooting

Search server logs for migration inconsistency errors. If found, restore from backup and upgrade sequentially through versions.

## Security Best Practices

- Generate strong SECRET_KEY with 32+ characters
- Enable HTTPS in production
- Configure email notifications
- Set appropriate log levels
- Configure trusted proxy CIDRs correctly
- Use external PostgreSQL for production
- Implement regular database backups
- Rotate secrets periodically
- Monitor application and database logs

## Maintenance

Regular tasks:
- Backup PostgreSQL database
- Monitor database performance
- Review application logs for errors
- Update authentik to latest versions
- Update outposts when updating server
- Monitor resource usage
- Review and rotate credentials

## Limitations

- No downgrade capability
- Sessions stored in database
- High CPU usage during batch operations
- PostgreSQL password limit of 99 characters
- Container timezone files must not be modified

## References

- Documentation: https://goauthentik.io/docs
- GitHub: https://github.com/goauthentik/authentik
- Docker Hub: https://hub.docker.com/r/goauthentik/authentik
- Helm Chart: https://artifacthub.io/packages/helm/goauthentik/authentik
