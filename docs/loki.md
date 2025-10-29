# Grafana Loki Helm Chart Documentation

## Official Helm Chart Details

### Repository Information
- **Repository URL**: https://grafana.github.io/helm-charts
- **Chart Name**: `loki`
- **Current Version**: 6.44.0 (as of October 2025)
- **App Version**: 3.5.7

### Installation Commands
```bash
# Add the Grafana Helm repository
helm repo add grafana https://grafana.github.io/helm-charts

# Update the repository
helm repo update

# Install Loki
helm install loki grafana/loki -f values.yaml
```

## Deployment Modes

### Simple Scalable Mode (Recommended)
The Simple Scalable deployment mode is **currently maintained and recommended for production use**. It's the default configuration installed by the Loki Helm chart and strikes a balance between monolithic simplicity and microservices complexity.

#### What Simple Scalable Mode Provides:
- **Separation of concerns**: Splits Loki into three distinct execution paths:
  - **Write path** (`-target=write`): Handles log ingestion (Distributor, Ingester)
  - **Read path** (`-target=read`): Handles queries (Query Frontend, Querier)
  - **Backend path** (`-target=backend`): Handles maintenance tasks (Compactor, Index Gateway, Query Scheduler, Ruler)
- **Independent scaling**: Each component can be scaled independently based on workload
- **Production ready**: Can scale up to a few TBs of logs per day
- **Simpler than microservices**: Easier to deploy and maintain than full microservices mode

#### Default Components in Simple Scalable Mode:
- Read component (3 replicas)
- Write component (3 replicas)
- Backend component (3 replicas)
- Loki Canary (1 DaemonSet)
- Gateway (1 NGINX replica)
- Index and Chunk cache (1 replica)
- Minio (optional, for testing)

### Configuration for Simple Scalable Mode
```yaml
deploymentMode: SimpleScalable

backend:
  replicas: 3
read:
  replicas: 3
write:
  replicas: 3
```

## S3 Storage Configuration

### Important Security Note
**WARNING**: When using S3 storage, DO NOT use the default bucket names (`chunk`, `ruler`, `admin`). Choose unique names for each bucket to avoid security issues. This caution does not apply to MinIO.

### Complete S3 Configuration Example
```yaml
loki:
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  
  storage_config:
    aws:
      region: <your-aws-region>  # e.g., us-west-2
      bucketnames: <your-chunk-bucket>  # e.g., my-loki-chunks
      s3forcepathstyle: false
  
  pattern_ingester:
    enabled: true
  
  limits_config:
    allow_structured_metadata: true
    volume_enabled: true
    retention_period: 672h  # 28 days retention
  
  querier:
    max_concurrent: 4

  storage:
    type: s3
    bucketNames:
      chunks: <your-chunk-bucket>    # e.g., my-loki-chunks
      ruler: <your-ruler-bucket>     # e.g., my-loki-ruler
      admin: <your-admin-bucket>     # e.g., my-loki-admin
    s3:
      # Option 1: S3 URL format (for S3-compatible storage or on-premises)
      # s3: s3://access_key:secret_access_key@custom_endpoint/bucket_name
      
      # Option 2: Individual configuration fields
      endpoint: <optional-custom-endpoint>  # Leave empty for AWS S3
      region: <your-aws-region>
      secretAccessKey: <your-secret-access-key>
      accessKeyId: <your-access-key-id>
      signatureVersion: v4  # or v2
      s3ForcePathStyle: false
      insecure: false
      http_config: {}

deploymentMode: SimpleScalable

backend:
  replicas: 3
read:
  replicas: 3
write:
  replicas: 3

# Disable MinIO for production
minio:
  enabled: false
```

### S3 Configuration Using IAM Role (Recommended for EKS)
```yaml
# Service Account configuration
serviceAccount:
  annotations:
    "eks.amazonaws.com/role-arn": "arn:aws:iam::<account-id>:role/<role-name>"

loki:
  storage:
    type: s3
    s3:
      region: us-west-2
    bucketNames:
      chunks: my-loki-chunks
      ruler: my-loki-ruler
      admin: my-loki-admin
# Note: endpoint, secretAccessKey, and accessKeyId are omitted when using IAM roles
```

## Key S3 Configuration Parameters

### Required Parameters
- **region**: AWS region where your S3 buckets are located
- **bucketNames**: Unique names for chunks, ruler, and admin buckets
- **storage.type**: Must be set to `s3`

### Authentication Options
1. **Access Keys**: Provide `accessKeyId` and `secretAccessKey`
2. **IAM Role**: Use service account annotations (recommended for EKS)
3. **S3 URL**: Include credentials in the URL for S3-compatible storage

### Optional Parameters
- **endpoint**: Custom S3-compatible endpoint (for MinIO, Ceph, etc.)
- **s3ForcePathStyle**: Set to `true` for S3-compatible storage that requires path-style access
- **signatureVersion**: AWS signature version (v2 or v4)
- **insecure**: Allow HTTP connections (not recommended for production)
- **retention_period**: How long to retain logs (default: 744h/31 days)

## Prerequisites and Dependencies

### Kubernetes Requirements
- Kubernetes cluster with at least 3 nodes (for Simple Scalable mode)
- Helm 3 or above
- kubectl configured to access your cluster

### Storage Requirements
- S3 buckets created with appropriate permissions
- IAM role/user with the following permissions:
  - `s3:ListBucket`
  - `s3:GetObject`
  - `s3:PutObject`
  - `s3:DeleteObject`

### Network Requirements
- Ingress controller (if exposing Loki externally)
- Load balancer for the gateway service

## Best Practices for Production

1. **Use unique bucket names**: Avoid default names for security
2. **Enable retention policies**: Configure `retention_period` based on compliance needs
3. **Use IAM roles**: Prefer IAM roles over access keys for AWS deployments
4. **Monitor Loki**: Deploy monitoring using Grafana dashboards
5. **Configure resource limits**: Set appropriate CPU and memory limits
6. **Enable compression**: Use `snappy` for chunk encoding
7. **Plan for scale**: Start with Simple Scalable mode, move to microservices if needed

## Testing Configuration with MinIO

For development and testing, you can use MinIO:

```yaml
loki:
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  ingester:
    chunk_encoding: snappy
  pattern_ingester:
    enabled: true
  limits_config:
    allow_structured_metadata: true
    volume_enabled: true

deploymentMode: SimpleScalable

backend:
  replicas: 2
read:
  replicas: 2
write:
  replicas: 3

# Enable MinIO for testing
minio:
  enabled: true

gateway:
  service:
    type: LoadBalancer
```

## Useful Links

- [Official Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Helm Chart Repository](https://github.com/grafana/helm-charts/tree/main/charts/loki)
- [Loki GitHub Repository](https://github.com/grafana/loki)
- [Deployment Modes Documentation](https://grafana.com/docs/loki/latest/get-started/deployment-modes/)
- [Storage Configuration Guide](https://grafana.com/docs/loki/latest/configure/storage/)
- [Helm Chart Values Reference](https://grafana.com/docs/loki/latest/setup/install/helm/reference/)
- [AWS S3 Security Update](https://grafana.com/blog/2024/06/27/grafana-security-update-grafana-loki-and-unintended-data-write-attempts-to-amazon-s3-buckets/)

## Next Steps

After deploying Loki:
1. Configure log shipping agents (Promtail, Grafana Alloy, Fluentd, etc.)
2. Set up Grafana dashboards for log visualization
3. Configure alerting rules for important log patterns
4. Implement Meta Monitoring for the Loki deployment itself
5. Test disaster recovery procedures