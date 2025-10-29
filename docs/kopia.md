# Kopia Backup Solution

## Overview

Kopia is a fast and secure open-source backup software that provides encrypted, compressed, and deduplicated backups using cloud, network, or local storage. It addresses the need for reliable, efficient backup solutions with features like content-addressable storage, end-to-end encryption, and support for multiple storage backends.

### Problem Solved

Kopia solves several key backup challenges:
- **Data Protection**: Provides encrypted backups with user-controlled keys
- **Storage Efficiency**: Deduplication and compression reduce storage costs
- **Flexibility**: Supports various storage backends from local disk to cloud providers
- **Performance**: Fast incremental backups with efficient change detection
- **Multi-Machine Support**: Repository server mode enables centralized backup management

## Key Features

### Core Capabilities

- **Encrypted Snapshots**: All data encrypted before leaving the source machine using AES-256 or ChaCha20
- **Content-Addressable Storage**: Deduplication across entire repository saves storage space
- **Incremental Forever**: Only changed data is uploaded after initial backup
- **Compression**: Multiple algorithms supported (zstd, pgzip, s2)
- **Error Correction**: Reed-Solomon algorithm protects against data corruption
- **Cross-Platform**: Windows, macOS, Linux support with both CLI and GUI
- **Repository Server Mode**: Centralized backup management for multiple clients

### Storage Features

- **Deduplication**: Automatic detection of duplicate content across all snapshots
- **Rolling Hash Splitting**: Efficient handling of changes to large files
- **Pack Files**: Small blocks combined into larger packs for efficient cloud storage
- **Maintenance**: Automatic cleanup and optimization of repository storage

## Architecture

### Repository Structure

Kopia uses a layered architecture:

1. **BLOB Storage Layer**: Raw storage backend (filesystem, S3, etc.)
2. **Content-Addressable Block Storage (CABS)**: Manages encrypted, deduplicated blocks
3. **Content-Addressable Object Storage (CAOS)**: Handles objects of arbitrary size
4. **Label-Addressable Manifest Storage (LAMS)**: Stores metadata like snapshots and policies

### Data Organization

- **Blocks**: Small data chunks (typically ≤20MB) identified by cryptographic hashes
- **Packs**: Combined blocks (20-40MB) for efficient storage and transfer
- **Objects**: Logical units that can span multiple blocks
- **Manifests**: JSON metadata describing snapshots, policies, and users

### File Naming Conventions

- `p*` - Data packs containing file content
- `q*` - Metadata packs
- `x*` - Index files
- `k*` - Directory listings
- `m*` - Manifest blocks

## Storage Backends

### Cloud Storage
- **Amazon S3** and S3-compatible (MinIO, Wasabi, etc.)
- **Azure Blob Storage**
- **Backblaze B2**
- **Google Cloud Storage**
- **Google Drive** (experimental)

### Network Storage
- **WebDAV**
- **SFTP/SSH**
- **Kopia Repository Server**

### Local Storage
- **Filesystem** (local disk, NAS, USB)
- **Network-attached storage**

### Via Rclone (Experimental)
- **Dropbox**
- **OneDrive**
- Other Rclone-supported backends

## Installation & Setup

### Installation Methods

#### Binary Installation
```bash
# macOS (Homebrew)
brew install kopia

# Linux (APT)
curl -s https://kopia.io/signing-key | sudo gpg --dearmor -o /etc/apt/keyrings/kopia-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kopia-keyring.gpg] http://packages.kopia.io/apt/ stable main" | sudo tee /etc/apt/sources.list.d/kopia.list
sudo apt update && sudo apt install kopia

# Docker
docker pull kopia/kopia:latest
```

### Basic Setup

#### Create Repository (S3 Example)
```bash
kopia repository create s3 \
  --bucket=my-backup-bucket \
  --access-key=AKIAIOSFODNN7EXAMPLE \
  --secret-access-key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --password=my-repository-password
```

#### Create Snapshot
```bash
kopia snapshot create /path/to/data
```

#### Restore Data
```bash
# Mount snapshot
kopia mount k1234567890abcdef /mnt/snapshot

# Direct restore
kopia restore k1234567890abcdef /path/to/restore
```

## Kubernetes Integration

### Deployment Patterns

#### 1. Standalone Backup Jobs
Deploy Kopia as CronJobs to backup persistent volumes:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kopia-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kopia
            image: kopia/kopia:latest
            command:
            - kopia
            - snapshot
            - create
            - /data
            env:
            - name: KOPIA_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: kopia-credentials
                  key: password
            volumeMounts:
            - name: data
              mountPath: /data
              readOnly: true
            - name: config
              mountPath: /app/config
            - name: cache
              mountPath: /app/cache
          volumes:
          - name: data
            persistentVolumeClaim:
              claimName: app-data-pvc
          - name: config
            persistentVolumeClaim:
              claimName: kopia-config
          - name: cache
            emptyDir: {}
          restartPolicy: OnFailure
```

#### 2. Repository Server Deployment
Deploy Kopia server for centralized backup management:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kopia-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kopia-server
  template:
    metadata:
      labels:
        app: kopia-server
    spec:
      containers:
      - name: kopia
        image: kopia/kopia:latest
        command:
        - kopia
        - server
        - start
        - --address=0.0.0.0:51515
        - --tls-cert-file=/tls/cert.pem
        - --tls-key-file=/tls/key.pem
        - --server-username=admin
        - --server-password=$(SERVER_PASSWORD)
        ports:
        - containerPort: 51515
          name: grpc
        env:
        - name: KOPIA_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kopia-repository
              key: password
        - name: SERVER_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kopia-server
              key: password
        volumeMounts:
        - name: config
          mountPath: /app/config
        - name: cache
          mountPath: /app/cache
        - name: tls
          mountPath: /tls
          readOnly: true
      volumes:
      - name: config
        persistentVolumeClaim:
          claimName: kopia-server-config
      - name: cache
        persistentVolumeClaim:
          claimName: kopia-server-cache
      - name: tls
        secret:
          secretName: kopia-server-tls
---
apiVersion: v1
kind: Service
metadata:
  name: kopia-server
spec:
  selector:
    app: kopia-server
  ports:
  - port: 51515
    targetPort: 51515
    name: grpc
  type: ClusterIP
```

#### 3. Client DaemonSet for Node Backups
Deploy Kopia clients on each node to backup host paths:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kopia-client
spec:
  selector:
    matchLabels:
      app: kopia-client
  template:
    metadata:
      labels:
        app: kopia-client
    spec:
      containers:
      - name: kopia
        image: kopia/kopia:latest
        command:
        - kopia
        - repository
        - connect
        - server
        - --url=https://kopia-server:51515
        - --server-cert-fingerprint=$(CERT_FINGERPRINT)
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/sh
              - -c
              - |
                kopia policy set --global \
                  --compression=zstd \
                  --keep-latest=10 \
                  --keep-daily=7 \
                  --keep-weekly=4 \
                  --keep-monthly=12
                kopia snapshot create /host/data --all
        env:
        - name: KOPIA_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kopia-client
              key: password
        - name: CERT_FINGERPRINT
          valueFrom:
            configMapKeyRef:
              name: kopia-config
              key: server-cert-fingerprint
        volumeMounts:
        - name: host-data
          mountPath: /host/data
          readOnly: true
        - name: config
          mountPath: /app/config
      volumes:
      - name: host-data
        hostPath:
          path: /var/lib
      - name: config
        emptyDir: {}
      hostPID: true
      hostNetwork: true
```

### Helm Charts

While there's no official Helm chart, community options exist:

```bash
# Example using community Helm chart
helm repo add kopia https://charts.example.com/kopia
helm install kopia kopia/kopia \
  --set repository.s3.bucket=my-backups \
  --set repository.s3.accessKey=AKIAIOSFODNN7EXAMPLE \
  --set repository.s3.secretKey=secret \
  --set repository.password=mypassword
```

## Configuration

### Policy Configuration

Policies control backup behavior:

```bash
# Set global policy
kopia policy set --global \
  --compression=zstd \
  --keep-latest=10 \
  --keep-daily=7 \
  --keep-weekly=4 \
  --keep-monthly=12 \
  --keep-yearly=3

# Set path-specific policy
kopia policy set /data/important \
  --keep-latest=20 \
  --compression=zstd-better-compression
```

### Snapshot Scheduling

```bash
# Schedule automatic snapshots
kopia policy set /data \
  --snapshot-time="02:00,14:00" \
  --snapshot-interval=6h
```

### Ignore Rules

Create `.kopiaignore` files or set policy rules:

```bash
# Add ignore rules to policy
kopia policy set /data \
  --add-ignore="*.tmp" \
  --add-ignore=".git/" \
  --add-ignore="node_modules/"
```

## Security

### Encryption

- **Algorithms**: AES-256-GCM-HMAC-SHA256 (default) or ChaCha20-Poly1305
- **Key Management**: Password-based key derivation with repository master key
- **End-to-End**: All data encrypted before leaving source machine
- **Zero-Knowledge**: Repository password never transmitted to storage

### Authentication

#### Repository Server
- Username/password authentication
- TLS certificate validation
- Server control password for admin operations

#### Access Control (ACL)
```bash
# Enable ACL
kopia server acl enable

# Grant user access to global policy
kopia server acl add --user alice@wonderland \
  --access FULL --target type=policy,policyType=global

# Allow read-only access to snapshots
kopia server acl add --user bob@laptop \
  --access READ --target type=snapshot
```

### Best Practices

1. **Strong Passwords**: Use long, random passwords stored in password manager
2. **TLS Certificates**: Always use TLS for repository server connections
3. **Regular Testing**: Periodically verify backup integrity
4. **Principle of Least Privilege**: Grant minimum necessary permissions
5. **Backup Repository Password**: Store securely - loss means data loss

## Use Cases

### 1. Personal Computer Backup
- Direct repository connection
- GUI or CLI interface
- Scheduled snapshots with retention policies

### 2. Kubernetes Workload Backup
- CronJob-based backup of PVCs
- Repository server for centralized management
- Multiple namespaces with isolated access

### 3. Multi-Server Environment
- Central repository server
- Client agents on each server
- Unified policy management

### 4. Development Environment Backup
- Fast incremental snapshots
- Mount old snapshots for file recovery
- Ignore build artifacts and dependencies

### 5. Disaster Recovery
- Off-site cloud storage
- Multiple repository copies
- Regular restore testing

## Comparison with Other Solutions

### Kopia vs Velero

| Feature | Kopia | Velero |
|---------|-------|---------|
| **Focus** | General-purpose backup | Kubernetes-native backup |
| **Architecture** | Client-server or standalone | Kubernetes operator |
| **Storage** | Multiple backends | Object storage + CSI snapshots |
| **Deduplication** | Built-in | No |
| **Encryption** | Built-in | Via plugins |
| **Resource Backup** | Files/directories | Kubernetes resources + volumes |
| **Ease of Use** | Simple for files | Simple for Kubernetes |
| **Restoration** | File-level | Cluster/namespace level |

### Kopia vs Restic

| Feature | Kopia | Restic |
|---------|-------|---------|
| **Performance** | Generally faster | Good performance |
| **Deduplication** | Content-defined chunking | Fixed-size chunking |
| **Compression** | Multiple algorithms | Limited options |
| **GUI** | Native GUI available | Third-party only |
| **Server Mode** | Built-in | Requires REST server |
| **Maintenance** | Automatic | Manual pruning |
| **Memory Usage** | Efficient | Can be high |

### Kopia vs Borg

| Feature | Kopia | Borg |
|---------|-------|---------|
| **Cross-Platform** | Full support | Limited Windows |
| **Cloud Storage** | Native support | Requires rclone |
| **Speed** | Very fast | Fast |
| **Compression** | Multiple options | LZ4, ZLIB, LZMA |
| **Repository Format** | Modern design | Mature, stable |
| **Server Mode** | Built-in | No native support |
| **Concurrent Access** | Supported | Limited |

## Best Practices for Kubernetes Homelab

### 1. Repository Setup
- Use S3-compatible storage (MinIO) for local cluster
- Enable compression (zstd recommended)
- Configure appropriate retention policies

### 2. Deployment Strategy
- **Small Clusters**: Single Kopia server with CronJob clients
- **Large Clusters**: Distributed clients with central repository
- **Mixed Workloads**: Combine with Velero for complete coverage

### 3. Backup Schedule
```yaml
# Example backup strategy
daily-backups:
  - databases: every 4 hours, keep 7 days
  - application-data: every 12 hours, keep 14 days
  - configuration: every 24 hours, keep 30 days
  - media-files: weekly, keep 6 months
```

### 4. Storage Optimization
- Use `.kopiaignore` for build artifacts
- Enable compression for text-heavy workloads
- Consider storage tiers for long-term retention

### 5. Monitoring
```bash
# Check repository status
kopia repository status

# Verify backup integrity
kopia snapshot verify --all

# List recent snapshots
kopia snapshot list --all
```

### 6. Recovery Testing
- Regularly test restore procedures
- Document recovery processes
- Maintain restore time objectives (RTO)

## Implementation Recommendations

### For Kubernetes Homelab

1. **Start Simple**: Deploy Kopia server with filesystem/NFS backend
2. **PVC Backups**: Use CronJobs for scheduled PVC snapshots
3. **Configuration Backup**: Combine with `kubectl` exports for resource definitions
4. **Progressive Enhancement**: Add cloud storage for off-site backups
5. **Integration**: Consider hybrid approach with Velero for complete solution

### Example Implementation

```bash
# 1. Create namespace
kubectl create namespace backup-system

# 2. Deploy MinIO for S3-compatible storage
kubectl apply -f minio-deployment.yaml

# 3. Deploy Kopia server
kubectl apply -f kopia-server.yaml

# 4. Configure backup jobs for each PVC
kubectl apply -f kopia-backup-jobs.yaml

# 5. Set up monitoring and alerts
kubectl apply -f kopia-monitoring.yaml
```

## Conclusion

Kopia is an excellent choice for Kubernetes homelab backups when you need:
- File-level backup and restore capabilities
- Efficient storage with deduplication and compression
- Flexibility in storage backends
- Simple deployment without complex operators

It complements Kubernetes-native solutions like Velero by providing efficient file-system level backups while Velero handles application-level disaster recovery. The combination provides comprehensive data protection for homelab environments.

## Resources

- **Official Website**: https://kopia.io
- **GitHub Repository**: https://github.com/kopia/kopia
- **Documentation**: https://kopia.io/docs/
- **Community Forum**: https://kopia.discourse.group/
- **Slack Channel**: https://slack.kopia.io
- **Docker Hub**: https://hub.docker.com/r/kopia/kopia