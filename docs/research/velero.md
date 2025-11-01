# Velero Kubernetes Backup Solution with Kopia Integration

## Service Overview

Velero is an open-source backup and disaster recovery tool for Kubernetes clusters that provides backup and restore capabilities for cluster resources and persistent volumes. It enables disaster recovery by reducing time to recovery in case of infrastructure loss, data migration for cluster portability, and data protection through scheduled backups with retention policies. Velero integrates with cloud provider snapshots and supports file system backups using Kopia or Restic as storage backends, offering end-to-end encryption, incremental backups with deduplication, and cross-cluster restore capabilities.

## Architecture and Components

### Core Components

**Velero Server**
- Runs as a deployment in the cluster
- Manages backup and restore operations
- Processes custom resources (Backup, Restore, Schedule)
- Communicates with object storage
- Coordinates with node agents for file system backups

**Node Agent (formerly Restic DaemonSet)**
- DaemonSet running on each node
- Hosts file system backup modules (Kopia/Restic)
- Accesses pod volumes via hostPath mounts
- Handles PodVolumeBackup and PodVolumeRestore operations

**Custom Resources**
- `Backup` - Represents a backup operation
- `Restore` - Represents a restore operation
- `Schedule` - Defines recurring backup schedules
- `BackupStorageLocation` - Configures object storage backend
- `BackupRepository` - Manages backup repository lifecycle
- `PodVolumeBackup` - File system backup of a pod volume
- `PodVolumeRestore` - File system restore of a pod volume

### How Velero Works

**Backup Workflow**
1. Velero client creates a Backup custom resource
2. BackupController validates and begins backup process
3. Controller queries API server for resources to backup
4. Resources are exported and uploaded to object storage
5. For file system backups, PodVolumeBackup resources are created
6. Node agents process volume backups using Kopia/Restic
7. Backup metadata and data stored in object storage

**Restore Workflow**
1. Velero client creates a Restore custom resource
2. RestoreController fetches backup from object storage
3. Resources are validated for compatibility with target cluster
4. Resources are restored to the cluster
5. For volume restores, init containers wait for data restoration
6. Node agents restore volume data from repository

## Kopia Integration

### Kopia as Backup Backend

Velero integrates Kopia modules directly for file system backups, providing:

**Kopia Uploader**
- Generic file system uploader for pod volume data
- Content-addressable storage with deduplication
- Incremental backups using rolling hash
- Compression support (pgzip, s2, zstd)

**Kopia Repository**
- Unified Repository Interface integration
- Manages backup storage and metadata
- Automatic maintenance and garbage collection
- Reed-Solomon error correction support

### Encryption with Kopia

**End-to-End Encryption**
- All data encrypted before leaving the node
- User-controlled encryption keys
- Repository password encrypts primary key
- Supports AES-256 and ChaCha20 algorithms
- File names and metadata also encrypted

**Repository Password Management**
- Default password stored in `velero-repo-credentials` secret
- Can be customized before first backup
- Password required for all repository operations
- Cannot be changed after repository creation

## Container Availability

### Official Velero Images

**Docker Hub**
- **Registry**: docker.io
- **Image**: `velero/velero:latest`
- **Versions**: 
  - `v1.14.x` - Latest stable
  - `v1.13.x` - Previous stable
  - `main` - Development builds

**Restore Helper Image**
- `velero/velero-restore-helper:<VERSION>`
- Used as init container during restores
- Version matches main Velero image

### Supported Architectures
- `linux/amd64` (x86-64)
- `linux/arm64` (ARM64/aarch64)
- `linux/arm/v7` (ARMv7)
- `linux/ppc64le` (PowerPC)
- `linux/s390x` (IBM Z)

## Installation and Configuration

### Minimal Installation with Kopia

```bash
# Install Velero with Kopia as the uploader (default in v1.10+)
velero install \
  --provider aws \
  --bucket my-backup-bucket \
  --secret-file ./credentials \
  --backup-location-config region=us-east-1 \
  --use-node-agent \
  --uploader-type kopia \
  --default-volumes-to-fs-backup
```

### BackupStorageLocation for NFS via S3 Gateway

```yaml
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: default
  namespace: velero
spec:
  provider: aws
  objectStorage:
    bucket: velero-backups
  config:
    region: minio
    s3ForcePathStyle: "true"
    s3Url: http://minio.storage.svc.cluster.local:9000
    # For Kopia repository path customization
    # The full path will be: s3://bucket/kopia/ns/<namespace>
```

### Configuring NFS Storage Backend

**Using MinIO as S3 Gateway to NFS**

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: minio-nfs-pv
spec:
  capacity:
    storage: 1Ti
  accessModes:
    - ReadWriteMany
  nfs:
    server: nfs.example.com
    path: /export/velero-backups
  persistentVolumeReclaimPolicy: Retain
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-storage
  namespace: storage
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Ti
```

### Repository Encryption Configuration

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: velero-repo-credentials
  namespace: velero
type: Opaque
data:
  # Base64 encoded repository password
  # This encrypts the Kopia repository
  repository-password: <base64-encoded-password>
```

### Node Agent Configuration

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
  namespace: velero
spec:
  template:
    spec:
      containers:
      - name: node-agent
        image: velero/velero:v1.14.0
        command:
          - /velero
        args:
          - node-agent
          - server
          - --uploader-type=kopia
        volumeMounts:
        - name: host-pods
          mountPath: /host_pods
          mountPropagation: HostToContainer
        - name: scratch
          mountPath: /scratch
      volumes:
      - name: host-pods
        hostPath:
          path: /var/lib/kubelet/pods
      - name: scratch
        emptyDir: {}
```

## PVC Backup Configuration

### Backup Annotations

**Opt-in Approach (Default)**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
  annotations:
    # Specify volumes to backup
    backup.velero.io/backup-volumes: data-volume,cache-volume
spec:
  volumes:
  - name: data-volume
    persistentVolumeClaim:
      claimName: app-data-pvc
  - name: cache-volume
    emptyDir: {}
```

**Opt-out Approach**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: database-pod
  annotations:
    # Exclude specific volumes from backup
    backup.velero.io/backup-volumes-excludes: temp-volume,logs-volume
spec:
  volumes:
  - name: data-volume
    persistentVolumeClaim:
      claimName: database-pvc
  - name: temp-volume
    emptyDir: {}
```

### Deployment with Annotations

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  template:
    metadata:
      annotations:
        # Applied to all pods in deployment
        backup.velero.io/backup-volumes: persistent-storage
    spec:
      containers:
      - name: app
        volumeMounts:
        - name: persistent-storage
          mountPath: /data
      volumes:
      - name: persistent-storage
        persistentVolumeClaim:
          claimName: webapp-pvc
```

### StatefulSet with Annotations

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
spec:
  template:
    metadata:
      annotations:
        # Backup all persistent volumes
        backup.velero.io/backup-volumes: data,logs
    spec:
      containers:
      - name: mongodb
        volumeMounts:
        - name: data
          mountPath: /data/db
        - name: logs
          mountPath: /var/log/mongodb
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      resources:
        requests:
          storage: 10Gi
  - metadata:
      name: logs
    spec:
      resources:
        requests:
          storage: 2Gi
```

## Backup Operations

### Creating Backups

```bash
# Backup with default file system backup
velero backup create daily-backup \
  --default-volumes-to-fs-backup \
  --include-namespaces app,database

# Backup specific resources
velero backup create pvc-backup \
  --include-resources persistentvolumeclaims,persistentvolumes \
  --default-volumes-to-fs-backup

# Backup with label selector
velero backup create prod-backup \
  --selector environment=production \
  --default-volumes-to-fs-backup
```

### Scheduled Backups

```yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  # Cron expression for daily at 2 AM
  schedule: "0 2 * * *"
  template:
    defaultVolumesToFsBackup: true
    includedNamespaces:
    - production
    - database
    ttl: 720h # 30 days retention
    storageLocation: default
```

### Backup Hooks

```yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    # Pre-backup hook to flush database
    pre.hook.backup.velero.io/container: mongodb
    pre.hook.backup.velero.io/command: '["/bin/bash", "-c", "mongodump --archive=/backup/dump.gz --gzip"]'
    # Backup the volume after hook completes
    backup.velero.io/backup-volumes: data-volume
```

## Restore Operations

### Basic Restore

```bash
# Restore from latest backup
velero restore create --from-backup daily-backup-20240101

# Restore to different namespace
velero restore create --from-backup prod-backup \
  --namespace-mappings production:staging

# Restore specific resources only
velero restore create --from-backup full-backup \
  --include-resources persistentvolumeclaims,configmaps
```

### Restore Hooks

```yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    # Post-restore hook
    post.hook.restore.velero.io/container: app
    post.hook.restore.velero.io/command: '["/bin/sh", "-c", "rake db:migrate"]'
```

## Encryption and Security

### Kopia Encryption Configuration

**Repository Initialization with Custom Encryption**

```bash
# Set custom repository password
kubectl create secret generic velero-repo-credentials \
  -n velero \
  --from-literal=repository-password='your-strong-password-here'

# Velero automatically uses this for Kopia encryption
```

**Encryption Algorithms**
- Default: AES-256-GCM
- Alternative: ChaCha20-Poly1305
- Configured at repository creation
- Cannot be changed after initialization

### Security Best Practices

1. **Repository Password Management**
   - Use strong, unique passwords
   - Store passwords securely (external secret manager)
   - Rotate passwords regularly (requires new repository)

2. **Access Control**
   - Limit RBAC permissions for Velero service account
   - Restrict object storage bucket access
   - Use separate repositories per environment

3. **Network Security**
   - Use TLS for S3/object storage connections
   - Implement network policies for Velero namespace
   - Restrict node agent host access

## Monitoring and Maintenance

### Repository Maintenance

```bash
# Check repository status
velero repo get

# Manual maintenance trigger
velero repo maintenance \
  --repo-type kopia \
  --repo-name velero-repo-default

# Check backup status
velero backup describe daily-backup-20240101
velero backup logs daily-backup-20240101
```

### Monitoring Metrics

```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: velero
  namespace: velero
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: velero
  endpoints:
  - port: monitoring
    interval: 30s
    path: /metrics
```

### Common Issues and Troubleshooting

**Repository Connection Issues**
```bash
# Check repository connectivity
kubectl logs -n velero deploy/velero | grep -i repository

# Verify credentials
kubectl get secret -n velero velero-repo-credentials -o yaml

# Check node agent logs
kubectl logs -n velero -l name=node-agent
```

**Backup Failures**
```bash
# Detailed backup logs
velero backup logs backup-name --details

# Check PodVolumeBackup status
kubectl get podvolumebackups -n velero -o wide

# Verify node agent is running
kubectl get pods -n velero -l name=node-agent
```

## Performance Optimization

### Kopia Performance Tuning

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kopia-config
  namespace: velero
data:
  # Parallel uploads
  KOPIA_PARALLEL_UPLOADS: "8"
  # Cache size (in MB)
  KOPIA_CACHE_SIZE: "5000"
  # Compression algorithm
  KOPIA_COMPRESSION: "zstd"
```

### Resource Allocation

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
spec:
  template:
    spec:
      containers:
      - name: node-agent
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

## Minimal Configuration Summary

To achieve PVC backups with encrypted Kopia vault on NFS storage:

1. **Setup NFS-backed S3 Storage** (e.g., MinIO)
   - Deploy MinIO with NFS PVC
   - Create bucket for Velero backups

2. **Install Velero with Kopia**
   ```bash
   velero install \
     --provider aws \
     --bucket velero-backups \
     --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=http://minio:9000 \
     --use-node-agent \
     --uploader-type kopia \
     --default-volumes-to-fs-backup
   ```

3. **Configure Encryption**
   ```bash
   kubectl create secret generic velero-repo-credentials \
     -n velero \
     --from-literal=repository-password='strong-password'
   ```

4. **Annotate PVCs/Pods**
   ```yaml
   annotations:
     backup.velero.io/backup-volumes: volume-name
   ```

5. **Create Backup Schedule**
   ```bash
   velero schedule create daily \
     --schedule="0 2 * * *" \
     --default-volumes-to-fs-backup \
     --ttl 720h
   ```

This configuration provides:
- Encrypted Kopia repository on NFS storage
- Automatic PVC backups via annotations
- Scheduled backups with retention
- Incremental backups with deduplication
- End-to-end encryption of all backup data