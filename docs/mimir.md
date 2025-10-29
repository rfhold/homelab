# Grafana Mimir Deployment with Helm

## Overview

Grafana Mimir is a highly scalable, multi-tenant, long-term storage system for Prometheus and OpenTelemetry metrics. It provides horizontally scalable, highly available architecture that can handle millions of metrics series with support for multi-tenancy, long-term retention, and PromQL-based querying.

### Key Features
- **Horizontally scalable**: Can scale to billions of active time series
- **Multi-tenant**: Isolate data and queries by tenant
- **Long-term storage**: Store metrics for years with efficient compression
- **High availability**: Built-in replication and zone-aware deployment
- **Compatible**: Drop-in replacement for Prometheus remote write
- **Query federation**: Query across multiple tenants
- **Recording rules and alerting**: Built-in ruler and Alertmanager components

## Recommended Helm Chart

### Official Helm Chart Repository
The official Helm chart for Grafana Mimir is `mimir-distributed`:

```bash
# Add the Grafana Helm repository
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install the chart
helm install mimir grafana/mimir-distributed -n mimir-system --create-namespace
```

**Repository URL**: https://grafana.github.io/helm-charts  
**Chart Name**: `mimir-distributed`  
**Latest Version**: 6.0.0-rc.0 (as of documentation)  
**GitHub Source**: https://github.com/grafana/mimir/tree/main/operations/helm/charts/mimir-distributed

## Deployment Modes

Grafana Mimir supports multiple deployment modes:

### 1. Monolithic Mode
- All components run in a single process
- Simplest deployment option
- Suitable for development and small-scale deployments
- Can be horizontally scaled by running multiple instances

### 2. Microservices Mode
- Each component runs as a separate service
- Maximum flexibility for scaling individual components
- Recommended for production deployments
- Higher operational complexity

### 3. Read-Write Mode (Experimental)
- Groups components into three services: read, write, and backend
- Balance between simplicity and scalability
- Reduces operational overhead compared to full microservices

### Important Note on "Simple Scalable" Mode
**The "simple scalable" deployment mode referenced in some older documentation has been superseded by the new architecture.** The current Helm chart (v6.0.0+) uses the **ingest storage architecture** with Kafka by default, which provides better scalability and reliability than the previous simple scalable mode.

The modern approach uses:
- **Kafka** for ingestion buffering and decoupling
- **Zone-aware replication** for high availability
- **Improved resource utilization** through better component separation

## S3 Storage Configuration

Grafana Mimir requires an object storage backend for long-term metrics storage. S3 (or compatible) is the most common choice.

### Prerequisites
- S3 bucket or S3-compatible storage (MinIO, GCS, Azure Blob with S3 API)
- IAM credentials with appropriate permissions
- Separate buckets for different storage types (blocks, ruler, alertmanager)

### S3 Configuration Example

```yaml
# values.yaml for Helm deployment
mimir:
  structuredConfig:
    common:
      storage:
        backend: s3
        s3:
          endpoint: s3.us-east-1.amazonaws.com  # Or your S3-compatible endpoint
          region: us-east-1
          bucket_name: mimir-metrics  # Will be prefixed for different components
          access_key_id: ${AWS_ACCESS_KEY_ID}  # Use environment variable
          secret_access_key: ${AWS_SECRET_ACCESS_KEY}  # Use environment variable
          # For S3-compatible storage with self-signed certificates:
          # http:
          #   insecure_skip_verify: true

    blocks_storage:
      s3:
        bucket_name: mimir-blocks
        
    alertmanager_storage:
      s3:
        bucket_name: mimir-alertmanager
        
    ruler_storage:
      s3:
        bucket_name: mimir-ruler

# Disable built-in MinIO if using external S3
minio:
  enabled: false

# Disable Kafka if not using ingest storage architecture
# (Note: Kafka is enabled by default in v6.0.0+)
kafka:
  enabled: false  # Set to true for ingest storage architecture
```

### S3 IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::mimir-blocks",
        "arn:aws:s3:::mimir-alertmanager",
        "arn:aws:s3:::mimir-ruler"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::mimir-blocks/*",
        "arn:aws:s3:::mimir-alertmanager/*",
        "arn:aws:s3:::mimir-ruler/*"
      ]
    }
  ]
}
```

## Important Configuration Parameters

### Resource Sizing
The Helm chart includes example values files for different scales:

1. **Default (`values.yaml`)**: Testing and development
2. **Small scale (`small.yaml`)**: ~1M active series, single replicas
3. **Large scale (`large.yaml`)**: ~10M active series, HA configuration

### Key Parameters

```yaml
# Zone-aware replication for HA
ingester:
  replicas: 3
  zoneAwareReplication:
    enabled: true
    zones:
      - name: zone-a
        nodeSelector:
          topology.kubernetes.io/zone: us-east-1a
      - name: zone-b
        nodeSelector:
          topology.kubernetes.io/zone: us-east-1b
      - name: zone-c
        nodeSelector:
          topology.kubernetes.io/zone: us-east-1c

# Query caching with memcached
results-cache:
  enabled: true
  replicas: 3

index-cache:
  enabled: true
  replicas: 3

# Compactor for block optimization
compactor:
  persistentVolume:
    size: 20Gi
  resources:
    requests:
      cpu: 1
      memory: 2Gi

# Multi-tenancy configuration
mimir:
  structuredConfig:
    multitenancy_enabled: true
    limits:
      max_global_series_per_user: 1500000
      max_global_series_per_metric: 50000
```

## Prerequisites and Dependencies

### Required
- **Kubernetes**: Version 1.29.0 or higher
- **Helm**: Version 3.8 or higher
- **Object Storage**: S3, GCS, Azure Blob, or compatible
- **Persistent Storage**: For component state and caching

### Optional but Recommended
- **Kafka**: For ingest storage architecture (included in chart)
- **Memcached**: For query result and metadata caching
- **Grafana**: For visualization (separate deployment)
- **Prometheus or OpenTelemetry Collector**: For metrics collection

### Storage Requirements
- **Ingester**: 50Gi per replica (for WAL and local data)
- **Store Gateway**: 10-20Gi per replica (for index cache)
- **Compactor**: 20Gi (for temporary compaction work)
- **Alertmanager**: 1Gi per replica (for state)

## Best Practices and Considerations

### High Availability
1. **Enable zone-aware replication** for ingesters and store-gateways
2. **Deploy multiple replicas** of critical components (minimum 3 for ingesters)
3. **Use anti-affinity rules** to spread replicas across nodes
4. **Configure appropriate PodDisruptionBudgets**

### Performance Optimization
1. **Enable caching layers** (results, index, metadata, chunks)
2. **Configure query sharding** for large queries
3. **Set appropriate resource requests and limits**
4. **Use SSD storage for persistent volumes**

### Security
1. **Enable multi-tenancy** with X-Scope-OrgID headers
2. **Configure TLS** for component communication
3. **Use IAM roles** for cloud storage access when possible
4. **Implement network policies** to restrict component communication

### Monitoring
1. **Enable ServiceMonitors** for Prometheus Operator
2. **Deploy Grafana dashboards** (included in chart)
3. **Configure alerting rules** for critical metrics
4. **Monitor resource utilization** and scale accordingly

## Migration Considerations

If migrating from:
- **Cortex**: Direct migration path available with minimal changes
- **Thanos**: Use Thanos sidecar for gradual migration
- **Single-zone to multi-zone**: Follow the migration guide for zone-aware replication
- **Older Helm chart versions**: Review breaking changes in CHANGELOG.md

## Official Documentation and Resources

### Primary Documentation
- **Grafana Mimir Documentation**: https://grafana.com/docs/mimir/latest/
- **Helm Chart Documentation**: https://grafana.com/docs/helm-charts/mimir-distributed/latest/
- **Architecture Overview**: https://grafana.com/docs/mimir/latest/get-started/about-grafana-mimir-architecture/
- **Configuration Reference**: https://grafana.com/docs/mimir/latest/configure/configuration-parameters/

### Additional Resources
- **GitHub Repository**: https://github.com/grafana/mimir
- **Helm Chart Source**: https://github.com/grafana/mimir/tree/main/operations/helm/charts/mimir-distributed
- **Example Configurations**: https://github.com/grafana/mimir/tree/main/operations/helm/charts/mimir-distributed
- **Production Tips**: https://grafana.com/docs/mimir/latest/manage/run-production-environment/production-tips/
- **Capacity Planning**: https://grafana.com/docs/mimir/latest/manage/run-production-environment/planning-capacity/
- **Runbooks**: https://grafana.com/docs/mimir/latest/manage/mimir-runbooks/

### Community Resources
- **Grafana Community Forums**: https://community.grafana.com/
- **Grafana Slack**: https://slack.grafana.com/
- **Stack Overflow**: Tag `grafana-mimir`

## Notes

- The Helm chart defaults to using the **ingest storage architecture** with Kafka as of v6.0.0, which replaces the older "simple scalable" mode
- For production deployments, always use external object storage rather than the built-in MinIO
- Zone-aware replication is enabled by default in recent chart versions
- The chart supports both Grafana Mimir (OSS) and Grafana Enterprise Metrics (GEM)
- Consider using KEDA for autoscaling components based on metrics