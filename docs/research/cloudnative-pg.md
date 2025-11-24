# CloudNativePG

CloudNativePG is an open-source Kubernetes operator for managing PostgreSQL workloads. Built by EnterpriseDB and maintained as a CNCF Sandbox project under Apache License 2.0.

## Key Features

- Kubernetes-native design with direct API integration
- No external HA tools required (no Patroni, repmgr, or Stolon)
- Declarative configuration using Custom Resource Definitions
- Immutable infrastructure approach
- Current version: 1.27.x (as of October 2025)
- Supports all PostgreSQL versions maintained by PGDG, including PostGIS
- Works on K3s, standard Kubernetes, and managed services (GKE, EKS, AKS)

## Architecture

CloudNativePG uses a custom architecture designed for Kubernetes:

- Instance Manager runs as PID 1 in each PostgreSQL pod
- Controller/Operator watches Kubernetes API and reconciles state
- Custom pod controller instead of StatefulSets
- Plugin-based architecture (CNPG-I) for backup and recovery

## Custom Resources

- Cluster: Primary resource for PostgreSQL cluster definition
- Backup: On-demand backup jobs
- ScheduledBackup: Scheduled backup definitions
- Pooler: PgBouncer connection pooler management
- Database, Publication, Subscription: Declarative database management

## Installation

### Direct Manifest for K3s

```shell
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.27/releases/cnpg-1.27.1.yaml

kubectl rollout status deployment -n cnpg-system cnpg-controller-manager
```

### Helm Chart Installation

```shell
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm upgrade --install cnpg \
  --namespace cnpg-system \
  --create-namespace \
  cnpg/cloudnative-pg
```

## Basic Cluster Configuration

### Minimal HA Cluster

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-cluster
spec:
  instances: 3
  
  storage:
    size: 10Gi
    storageClass: local-path
  
  postgresql:
    parameters:
      max_connections: "100"
      shared_buffers: "256MB"
```

### Production Cluster

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: prod-postgres
spec:
  instances: 3
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "1GB"
      effective_cache_size: "3GB"
      maintenance_work_mem: "256MB"
  
  storage:
    size: 50Gi
    storageClass: longhorn
  
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"
  
  monitoring:
    enablePodMonitor: true
  
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            cnpg.io/cluster: prod-postgres
        topologyKey: kubernetes.io/hostname
```

## High Availability

### Synchronous Replication

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: sync-cluster
spec:
  instances: 3
  
  storage:
    size: 10Gi
  
  postgresql:
    synchronous:
      method: any
      number: 1
      dataDurability: required
  
  replicationSlots:
    highAvailability:
      enabled: true
      slotPrefix: "_cnpg_"
    updateInterval: 30
```

### Data Durability Settings

- dataDurability: required - Prioritizes data safety over availability
- dataDurability: preferred - Prioritizes availability, adjusts quorum dynamically

### Failover Process

1. Readiness probe fails on primary
2. Cluster enters "Failing over" state
3. Fast shutdown attempt, then immediate shutdown if needed
4. Leader election among healthy replicas
5. New primary promoted
6. Former primary restarts as replica

## Backup Configuration

### Object Storage with Barman Cloud

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cluster-backup
spec:
  instances: 3
  
  storage:
    size: 10Gi
  
  plugins:
  - name: barman-cloud.cloudnative-pg.io
  
  backup:
    target: prefer-standby
  
  walStorage:
    size: 1Gi
```

### Scheduled Backup to S3

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: daily-backup
spec:
  schedule: "0 0 0 * * *"
  backupOwnerReference: self
  cluster:
    name: cluster-backup
  method: plugin
  pluginConfiguration:
    name: barman-cloud.cloudnative-pg.io
    parameters:
      destinationPath: "s3://my-bucket/backups/"
      s3Credentials:
        accessKeyId:
          name: aws-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: aws-creds
          key: SECRET_ACCESS_KEY
      endpointURL: "https://s3.amazonaws.com"
```

### Volume Snapshot Backup

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: snapshot-backup
spec:
  schedule: "0 0 3 * * *"
  backupOwnerReference: self
  cluster:
    name: cluster-backup
  method: volumeSnapshot
  online: true
```

## Connection Pooling

### PgBouncer Configuration

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: pooler-example
spec:
  cluster:
    name: postgres-cluster
  
  instances: 3
  type: rw
  
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "25"
      reserve_pool_size: "5"
```

## Current Homelab Implementation

The homelab currently uses Bitnami PostgreSQL Helm charts, not CloudNativePG.

### Current Stack

- Module: src/modules/postgres.ts
- Component: src/components/bitnami-postgres.ts
- Adapter: src/adapters/postgres.ts
- Chart: Bitnami PostgreSQL from oci://registry-1.docker.io/bitnamicharts/postgresql

### Current Usage Pattern

```typescript
import { PostgreSQLModule, PostgreSQLImplementation } from "../modules/postgres";

const database = new PostgreSQLModule("app-database", {
  namespace: "application",
  implementation: PostgreSQLImplementation.BITNAMI_POSTGRESQL,
  auth: {
    database: "myapp",
    username: "appuser",
  },
  storage: {
    size: "20Gi",
  },
});
```

### Custom Images

- ghcr.io/rfhold/bitnami-postgres-documentdb:17.5.0-debian-12-r12 - DocumentDB/MongoDB compatibility for LibreChat
- ghcr.io/rfhold/bitnami-postgres-pgvector:17.5.0-debian-12-r12 - pgvector extension for RAG/vector search

## Migration Considerations

### Benefits of CloudNativePG

- True Kubernetes-native design without external dependencies
- Better high availability with built-in failover
- Plugin-based backup architecture
- Operator Capability Level V (Auto Pilot)
- Monthly release cadence with active development

### Trade-offs

- Relatively newer than Bitnami Helm charts
- Migration requires careful planning
- Plugin ecosystem still evolving (CNPG-I introduced v1.26)
- More complex configuration than simple Helm charts

### K3s Deployment Notes

- Use direct manifest installation for simplicity
- Default storage: local-path provisioner
- Consider Longhorn for production workloads
- Label nodes for PostgreSQL workloads
- Enable volume snapshots if storage class supports it

## Best Practices

### Configuration

- Always enable WAL archiving in production (RPO ≤ 5 minutes)
- Set backup frequency based on RTO requirements
- Use synchronous replication for data-critical applications
- Configure resource limits to prevent contention
- Enable Prometheus monitoring from day one

### Storage

- Use local SSDs for best performance
- Consider separate PVCs for PGDATA and WAL
- Configure max_slot_wal_keep_size to prevent disk exhaustion
- Monitor replication lag metrics

### High Availability

- Use dataDurability: required for data safety
- Use dataDurability: preferred for availability priority
- Configure pod anti-affinity to spread instances across nodes
- Monitor failover metrics and test failover procedures

## References

- Official Documentation: https://cloudnative-pg.io/documentation/1.27/
- GitHub Repository: https://github.com/cloudnative-pg/cloudnative-pg
- Architecture Guide: https://cloudnative-pg.io/documentation/1.27/architecture/
- Backup Documentation: https://cloudnative-pg.io/documentation/1.27/backup/
- CNCF Sandbox Project: https://www.cncf.io/sandbox-projects/
