# Gitea Actions with Docker-in-Docker on Kubernetes

## Table of Contents
1. [Gitea Actions Overview](#gitea-actions-overview)
2. [Docker-in-Docker with Rootless Docker](#docker-in-docker-with-rootless-docker)
3. [Kubernetes Deployment Patterns](#kubernetes-deployment-patterns)
4. [Runner Registration & Configuration](#runner-registration--configuration)
5. [Security Best Practices](#security-best-practices)
6. [Official Images & Examples](#official-images--examples)
7. [Common Issues & Troubleshooting](#common-issues--troubleshooting)

---

## Gitea Actions Overview

### How Gitea Actions Work

Gitea Actions is a built-in CI/CD solution starting with Gitea 1.19 that is compatible with GitHub Actions. It provides a powerful automation framework for building, testing, and deploying code directly from your Gitea repositories.

**Key Components:**
- **Gitea Actions Engine**: Built into Gitea server, orchestrates workflows
- **Act Runner**: Standalone program written in Go, executes jobs
- **Workflow Files**: YAML definitions in `.gitea/workflows/` or `.github/workflows/`
- **Actions**: Reusable scripts/plugins compatible with GitHub Actions format

### Act Runner Architecture

The Act Runner (`act_runner`) is based on a fork of [nektos/act](https://github.com/nektos/act) and serves as the execution engine for Gitea Actions:

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Gitea Server│◄────►│  Act Runner  │◄────►│ Docker/DinD  │
│   (Control) │      │  (Executor)  │      │ (Container)  │
└─────────────┘      └──────────────┘      └──────────────┘
       │                     │                      │
       │                     │                      │
   Job Queue           Job Execution         Container Runtime
```

### Runner Modes

**1. Ephemeral Runners** (Recommended for security)
- Single-use runners that terminate after completing one job
- Registration token is automatically revoked after job assignment
- Prevents credential reuse and improves security
- Requires act_runner 0.2.12+

**2. Persistent Runners**
- Long-lived runners that continuously poll for jobs
- Reuse registration across multiple job executions
- Suitable for trusted environments

---

## Docker-in-Docker with Rootless Docker

### Why Rootless Docker for Security

Rootless Docker provides significant security improvements by running both the Docker daemon and containers without root privileges:

**Benefits:**
- Mitigates container breakout risks
- Reduces attack surface for privilege escalation
- Complies with restricted Pod Security Standards
- Prevents host system compromise

**Trade-offs:**
- Some features unavailable (AppArmor, checkpoint, overlay networks)
- Performance overhead (~10-20% in some workloads)
- Storage driver limitations (no overlay2 without additional setup)

### Configuring Rootless DinD in Kubernetes

#### Basic Rootless DinD Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: act-runner-config
  namespace: gitea-actions
data:
  config.yaml: |
    log:
      level: info
    
    runner:
      file: /data/.runner
      capacity: 2
      timeout: 3h
      insecure: false
      fetch_timeout: 5s
      fetch_interval: 2s
      labels:
        - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
        - "ubuntu-22.04:docker://docker.gitea.com/runner-images:ubuntu-22.04"
    
    cache:
      enabled: true
      dir: "/data/cache"
      host: ""
      port: 0
    
    container:
      network: ""
      privileged: false
      options: "--add-host=gitea.local:host-gateway"
      valid_volumes:
        - '/data/**'
      docker_host: "tcp://localhost:2376"
      force_pull: true
      require_docker: true
      docker_timeout: 30s
```

#### Rootless DinD Pod Template

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: act-runner-rootless
  namespace: gitea-actions
spec:
  serviceName: act-runner
  replicas: 3
  selector:
    matchLabels:
      app: act-runner-rootless
  template:
    metadata:
      labels:
        app: act-runner-rootless
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      
      initContainers:
      - name: setup-docker-certs
        image: busybox:latest
        command: ['sh', '-c', 'mkdir -p /certs/client && chmod 755 /certs']
        volumeMounts:
        - name: docker-certs
          mountPath: /certs
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
      
      containers:
      # Act Runner Container
      - name: runner
        image: gitea/act_runner:nightly-dind-rootless
        imagePullPolicy: Always
        env:
        - name: DOCKER_HOST
          value: tcp://localhost:2376
        - name: DOCKER_CERT_PATH
          value: /certs/client
        - name: DOCKER_TLS_VERIFY
          value: "1"
        - name: GITEA_INSTANCE_URL
          value: "https://gitea.example.com"
        - name: GITEA_RUNNER_REGISTRATION_TOKEN
          valueFrom:
            secretKeyRef:
              name: runner-registration
              key: token
        - name: GITEA_RUNNER_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: GITEA_RUNNER_LABELS
          value: "ubuntu-latest:docker://node:16-bullseye,self-hosted"
        volumeMounts:
        - name: docker-certs
          mountPath: /certs
        - name: runner-data
          mountPath: /data
        - name: config
          mountPath: /config
          readOnly: true
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          capabilities:
            drop: ["ALL"]
      
      # Rootless Docker DinD Sidecar
      - name: dind
        image: docker:24-dind-rootless
        env:
        - name: DOCKER_TLS_CERTDIR
          value: /certs
        - name: DOCKER_HOST
          value: tcp://0.0.0.0:2376
        volumeMounts:
        - name: docker-certs
          mountPath: /certs
        - name: docker-storage
          mountPath: /var/lib/docker
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          privileged: false
          capabilities:
            add:
            - SETUID
            - SETGID
            drop:
            - ALL
      
      volumes:
      - name: docker-certs
        emptyDir: {}
      - name: config
        configMap:
          name: act-runner-config
      
  volumeClaimTemplates:
  - metadata:
      name: runner-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
  - metadata:
      name: docker-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

### Required Pod Security Contexts and Capabilities

For rootless Docker in Kubernetes, specific security contexts are required:

```yaml
# Pod-level security context
securityContext:
  runAsNonRoot: true         # Enforce non-root execution
  runAsUser: 1000            # Rootless user ID
  runAsGroup: 1000           # Rootless group ID
  fsGroup: 1000              # File system group
  seccompProfile:
    type: RuntimeDefault     # Use default seccomp profile

# Container-level for rootless DinD
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  privileged: false          # Not required for rootless!
  capabilities:
    add:
    - SETUID                 # Required for user namespace mapping
    - SETGID                 # Required for group namespace mapping
    drop:
    - ALL                    # Drop all other capabilities
```

### Volume Mounts and Storage Requirements

```yaml
volumes:
# Temporary certificates for Docker TLS
- name: docker-certs
  emptyDir:
    medium: Memory           # Use tmpfs for better performance
    sizeLimit: 100Mi

# Runner configuration
- name: config
  configMap:
    name: act-runner-config
    defaultMode: 0644

# Persistent volumes for StatefulSet
volumeClaimTemplates:
# Runner data (registration, cache)
- metadata:
    name: runner-data
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: fast-ssd
    resources:
      requests:
        storage: 10Gi

# Docker layer storage
- metadata:
    name: docker-storage
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: fast-ssd
    resources:
      requests:
        storage: 50Gi        # Adjust based on image size needs
```

### Network Configuration for DinD

```yaml
apiVersion: v1
kind: Service
metadata:
  name: act-runner-cache
  namespace: gitea-actions
spec:
  type: ClusterIP
  ports:
  - port: 8088
    targetPort: 8088
    protocol: TCP
    name: cache
  selector:
    app: act-runner-rootless
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: act-runner-network
  namespace: gitea-actions
spec:
  podSelector:
    matchLabels:
      app: act-runner-rootless
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: act-runner-rootless
    ports:
    - protocol: TCP
      port: 2376  # Docker API
    - protocol: TCP
      port: 8088  # Cache server
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: gitea
    ports:
    - protocol: TCP
      port: 443
  - to:  # Allow DNS
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  - to:  # Allow external registry access
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 443
```

---

## Kubernetes Deployment Patterns

### StatefulSet vs Deployment vs Job Approaches

#### 1. StatefulSet (Recommended for Persistent Runners)

**Advantages:**
- Stable network identities
- Ordered deployment and scaling
- Persistent volume claims per pod
- Predictable pod names for monitoring

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: act-runner-persistent
spec:
  serviceName: act-runner
  replicas: 3
  podManagementPolicy: Parallel
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: act-runner
  template:
    # ... pod spec
```

#### 2. Deployment (For Stateless Ephemeral Runners)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: act-runner-ephemeral
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  template:
    spec:
      containers:
      - name: runner
        image: gitea/act_runner:nightly
        env:
        - name: GITEA_RUNNER_EPHEMERAL
          value: "1"  # Enable ephemeral mode
```

#### 3. Job/CronJob (For Scheduled or One-time Runners)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: act-runner-job
spec:
  parallelism: 3
  completions: 10
  backoffLimit: 3
  activeDeadlineSeconds: 3600
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: runner
        image: gitea/act_runner:nightly
        env:
        - name: GITEA_RUNNER_EPHEMERAL
          value: "1"
```

### Resource Limits and Requests

```yaml
resources:
  requests:
    memory: "512Mi"      # Minimum for runner
    cpu: "500m"          # 0.5 CPU core
    ephemeral-storage: "1Gi"
  limits:
    memory: "4Gi"        # Max for build jobs
    cpu: "4000m"         # 4 CPU cores
    ephemeral-storage: "10Gi"
```

### Anti-Affinity Rules for Distribution

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - act-runner-rootless
        topologyKey: kubernetes.io/hostname
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      - matchExpressions:
        - key: runner-node
          operator: In
          values:
          - "true"
        - key: kubernetes.io/arch
          operator: In
          values:
          - amd64
          - arm64
```

### Storage Strategies

#### High-Performance Cache Configuration

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: runner-cache-pvc
spec:
  storageClassName: nvme-ssd  # Use fastest available storage
  accessModes:
    - ReadWriteMany           # For shared cache
  resources:
    requests:
      storage: 100Gi
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cache-config
data:
  config.yaml: |
    cache:
      enabled: true
      dir: "/cache/act"
      host: "0.0.0.0"
      port: 8088
      external_server: ""  # Or use external cache like Redis/MinIO
```

#### Build Artifacts Storage

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: artifacts-pv
spec:
  capacity:
    storage: 500Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: nfs.example.com
    path: /exports/artifacts
  persistentVolumeReclaimPolicy: Retain
  storageClassName: nfs-artifacts
```

---

## Runner Registration & Configuration

### Obtaining Registration Tokens

#### 1. Via Gitea Web UI
```bash
# Instance level (admin only)
https://gitea.example.com/-/admin/actions/runners

# Organization level
https://gitea.example.com/<org>/settings/actions/runners

# Repository level
https://gitea.example.com/<owner>/<repo>/settings/actions/runners
```

#### 2. Via Gitea CLI
```bash
# Generate token via gitea CLI
gitea --config /etc/gitea/app.ini actions generate-runner-token

# With specific scope
gitea actions generate-runner-token --scope organization --name myorg
```

#### 3. Via Environment Variable (for Gitea startup)
```bash
# Generate random token
openssl rand -hex 24 > /secrets/runner-token

# Set environment variable
export GITEA_RUNNER_REGISTRATION_TOKEN_FILE=/secrets/runner-token
```

### Environment Variables and Config Files

#### Essential Environment Variables

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: runner-secrets
  namespace: gitea-actions
type: Opaque
stringData:
  GITEA_INSTANCE_URL: "https://gitea.example.com"
  GITEA_RUNNER_REGISTRATION_TOKEN: "D0gvfu2iHfUjNqCYVljVyRV14fISpJxxxxxxxxxx"
  GITEA_RUNNER_NAME: "k8s-runner-${HOSTNAME}"
  GITEA_RUNNER_LABELS: "self-hosted,docker,linux,x64,gpu:tesla-t4"
  CONFIG_FILE: "/config/config.yaml"
```

#### Complete Configuration File

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: runner-full-config
data:
  config.yaml: |
    # Logging configuration
    log:
      level: info  # trace, debug, info, warn, error, fatal
    
    # Runner configuration
    runner:
      file: /data/.runner
      capacity: 3  # Concurrent jobs
      envs:
        CI: "true"
        DOCKER_BUILDKIT: "1"
      env_file: /secrets/.env
      timeout: 3h
      shutdown_timeout: 30s
      insecure: false  # TLS verification
      fetch_timeout: 5s
      fetch_interval: 2s
      github_mirror: ""  # Mirror for github.com actions
      labels:
        - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
        - "ubuntu-22.04:docker://docker.gitea.com/runner-images:ubuntu-22.04"
        - "ubuntu-20.04:docker://docker.gitea.com/runner-images:ubuntu-20.04"
        - "debian-11:docker://docker.gitea.com/runner-images:debian-11"
        - "alpine-latest:docker://docker.gitea.com/runner-images:alpine-latest"
        - "node-16:docker://node:16-bullseye"
        - "python-3.11:docker://python:3.11-slim"
        - "golang-1.21:docker://golang:1.21-alpine"
    
    # Cache server configuration
    cache:
      enabled: true
      dir: "/cache"
      host: "0.0.0.0"
      port: 8088
      external_server: ""  # Or "http://minio:9000/cache/"
    
    # Container configuration
    container:
      network: "bridge"
      privileged: false
      options: |
        --add-host=host.docker.internal:host-gateway
        --dns=1.1.1.1
        --dns=8.8.8.8
      workdir_parent: "/workspace"
      valid_volumes:
        - '**'  # Allow all volumes (adjust for security)
      docker_host: "tcp://localhost:2376"
      force_pull: true
      force_rebuild: false
      require_docker: true
      docker_timeout: 30s
    
    # Host mode configuration (if not using containers)
    host:
      workdir_parent: "/tmp/act"
```

### Runner Labels and Tags

Labels determine which jobs a runner can execute:

```yaml
# Format: label:executor
labels:
  # Standard labels
  - "ubuntu-latest:docker://node:16-bullseye"
  - "ubuntu-22.04:docker://node:16-bullseye"
  
  # Custom images
  - "custom-python:docker://registry.example.com/python:3.11-ml"
  
  # Host execution (use with caution)
  - "metal-runner:host"
  
  # Architecture specific
  - "arm64:docker://arm64v8/ubuntu:22.04"
  - "linux/amd64:docker://ubuntu:22.04"
  
  # GPU enabled
  - "gpu-runner:docker://nvidia/cuda:12.0-runtime"
```

### Secrets Management

#### Using Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: runner-auth
  namespace: gitea-actions
type: Opaque
data:
  token: <base64-encoded-token>
  docker-config: <base64-encoded-docker-config>
---
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-auth>
```

#### Mounting Secrets Safely

```yaml
volumeMounts:
- name: runner-token
  mountPath: /secrets/token
  subPath: token
  readOnly: true
- name: docker-auth
  mountPath: /root/.docker/config.json
  subPath: .dockerconfigjson
  readOnly: true

volumes:
- name: runner-token
  secret:
    secretName: runner-auth
    items:
    - key: token
      path: token
    defaultMode: 0400  # Read-only for owner
- name: docker-auth
  secret:
    secretName: registry-credentials
    defaultMode: 0400
```

---

## Security Best Practices

### Rootless vs Privileged DinD Trade-offs

| Aspect | Rootless Docker | Privileged Docker |
|--------|----------------|-------------------|
| **Security** | ✅ High - No root access | ⚠️ Low - Full root access |
| **Performance** | 🔶 10-20% overhead | ✅ Native performance |
| **Features** | ⚠️ Limited (no AppArmor, overlay) | ✅ Full feature set |
| **Storage Drivers** | VFS, fuse-overlayfs | All drivers available |
| **Port Binding** | >1024 without capabilities | Any port |
| **Pod Security** | ✅ Baseline/Restricted | ❌ Privileged only |

### Network Policies for Runner Isolation

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: runner-isolation
  namespace: gitea-actions
spec:
  podSelector:
    matchLabels:
      app: act-runner
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # No ingress allowed - runners only poll
  - {}
  
  egress:
  # Allow Gitea server
  - to:
    - namespaceSelector:
        matchLabels:
          name: gitea
    ports:
    - protocol: TCP
      port: 443
  
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  
  # Allow container registries
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 443
  - to:
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

### Pod Security Standards Configuration

#### Namespace-level Enforcement

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gitea-actions
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

#### Pod Security Context (Restricted Standard)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-runner
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  
  containers:
  - name: runner
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop:
        - ALL
        add:
        - NET_BIND_SERVICE  # Only if needed
      seccompProfile:
        type: RuntimeDefault
```

### Preventing Secrets Exposure

#### 1. Use Sealed Secrets

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: runner-token
  namespace: gitea-actions
spec:
  encryptedData:
    token: AgA4L1K9R7... # Encrypted token
```

#### 2. RBAC Restrictions

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: runner-role
  namespace: gitea-actions
rules:
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["runner-token", "registry-credentials"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: runner-binding
  namespace: gitea-actions
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: runner-role
subjects:
- kind: ServiceAccount
  name: act-runner
  namespace: gitea-actions
```

#### 3. Audit Logging

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: RequestResponse
  namespaces: ["gitea-actions"]
  verbs: ["get", "list"]
  resources:
  - group: ""
    resources: ["secrets"]
  omitStages:
  - RequestReceived
```

### Build Isolation Strategies

#### 1. User Namespace Isolation

```yaml
apiVersion: v1
kind: Pod
spec:
  hostUsers: false  # Enable user namespace
  containers:
  - name: runner
    securityContext:
      runAsUser: 1000
      runAsGroup: 1000
```

#### 2. Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: runner-quota
  namespace: gitea-actions
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    persistentvolumeclaims: "10"
    pods: "20"
```

#### 3. Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: runner-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: act-runner
```

---

## Official Images & Examples

### Gitea Act Runner Images

| Image | Description | Use Case |
|-------|-------------|----------|
| `gitea/act_runner:latest` | Stable release | Production |
| `gitea/act_runner:nightly` | Latest development | Testing |
| `gitea/act_runner:nightly-dind` | DinD with privileges | Standard DinD |
| `gitea/act_runner:nightly-dind-rootless` | Rootless DinD | Secure environments |

### Docker Rootless Images

| Image | Description | Features |
|-------|-------------|----------|
| `docker:24-dind-rootless` | Latest rootless | Full rootless support |
| `docker:23.0.6-dind-rootless` | Stable rootless | Production ready |
| `docker/rootless` | Minimal rootless | Lightweight |

### Complete Kubernetes Manifest Example

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: gitea-actions
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: act-runner
  namespace: gitea-actions
---
apiVersion: v1
kind: Secret
metadata:
  name: runner-registration
  namespace: gitea-actions
type: Opaque
data:
  token: <base64-encoded-registration-token>
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: runner-config
  namespace: gitea-actions
data:
  config.yaml: |
    log:
      level: info
    runner:
      file: /data/.runner
      capacity: 2
      timeout: 3h
      insecure: false
      fetch_timeout: 5s
      fetch_interval: 2s
      labels:
        - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
        - "ubuntu-22.04:docker://docker.gitea.com/runner-images:ubuntu-22.04"
    cache:
      enabled: true
      dir: "/data/cache"
      host: "0.0.0.0"
      port: 8088
    container:
      network: ""
      privileged: false
      docker_host: "tcp://localhost:2376"
      force_pull: true
      require_docker: true
      docker_timeout: 30s
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: act-runner
  namespace: gitea-actions
spec:
  serviceName: act-runner
  replicas: 2
  selector:
    matchLabels:
      app: act-runner
  template:
    metadata:
      labels:
        app: act-runner
    spec:
      serviceAccountName: act-runner
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      # Act Runner
      - name: runner
        image: gitea/act_runner:nightly-dind-rootless
        imagePullPolicy: Always
        command: ["sh", "-c"]
        args:
        - |
          # Wait for Docker daemon
          while ! nc -z localhost 2376; do
            echo "Waiting for Docker daemon..."
            sleep 5
          done
          echo "Docker daemon is ready"
          # Start runner
          /sbin/tini -- /usr/local/bin/act_runner daemon --config /config/config.yaml
        env:
        - name: DOCKER_HOST
          value: tcp://localhost:2376
        - name: DOCKER_CERT_PATH
          value: /certs/client
        - name: DOCKER_TLS_VERIFY
          value: "1"
        - name: GITEA_INSTANCE_URL
          value: "https://gitea.example.com"
        - name: GITEA_RUNNER_REGISTRATION_TOKEN
          valueFrom:
            secretKeyRef:
              name: runner-registration
              key: token
        - name: GITEA_RUNNER_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: docker-certs
          mountPath: /certs
        - name: runner-data
          mountPath: /data
        - name: config
          mountPath: /config
          readOnly: true
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "pgrep act_runner"
          initialDelaySeconds: 30
          periodSeconds: 30
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
      
      # Rootless Docker DinD
      - name: dind
        image: docker:24-dind-rootless
        env:
        - name: DOCKER_TLS_CERTDIR
          value: /certs
        - name: DOCKER_HOST
          value: tcp://0.0.0.0:2376
        volumeMounts:
        - name: docker-certs
          mountPath: /certs
        - name: docker-storage
          mountPath: /home/rootless/.local/share/docker
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "4"
        livenessProbe:
          exec:
            command:
            - docker
            - version
          initialDelaySeconds: 10
          periodSeconds: 30
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          privileged: false
          capabilities:
            add:
            - SETUID
            - SETGID
            drop:
            - ALL
      
      volumes:
      - name: docker-certs
        emptyDir: {}
      - name: config
        configMap:
          name: runner-config
      
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - act-runner
              topologyKey: kubernetes.io/hostname
  
  volumeClaimTemplates:
  - metadata:
      name: runner-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
  - metadata:
      name: docker-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
---
apiVersion: v1
kind: Service
metadata:
  name: act-runner-cache
  namespace: gitea-actions
spec:
  clusterIP: None
  ports:
  - port: 8088
    targetPort: 8088
    protocol: TCP
    name: cache
  selector:
    app: act-runner
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: act-runner-network-policy
  namespace: gitea-actions
spec:
  podSelector:
    matchLabels:
      app: act-runner
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: act-runner
    ports:
    - protocol: TCP
      port: 8088
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

### Helm Chart Deployment (If Available)

While there's no official Helm chart from Gitea, you can create a custom values file:

```yaml
# values.yaml
replicaCount: 3

image:
  repository: gitea/act_runner
  tag: nightly-dind-rootless
  pullPolicy: Always

gitea:
  url: https://gitea.example.com
  registrationToken: "your-token-here"

runner:
  capacity: 2
  labels:
    - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"

persistence:
  enabled: true
  storageClass: fast-ssd
  runnerDataSize: 10Gi
  dockerStorageSize: 50Gi

resources:
  runner:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "2"
  dind:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "4Gi"
      cpu: "4"

securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000

podSecurityPolicy:
  enabled: false  # Use Pod Security Standards instead

networkPolicy:
  enabled: true

affinity:
  podAntiAffinity:
    type: preferredDuringSchedulingIgnoredDuringExecution
```

---

## Common Issues & Troubleshooting

### DinD Startup Problems

#### Issue: Docker daemon not starting

**Symptoms:**
```bash
$ kubectl logs act-runner-0 -c dind
Cannot connect to the Docker daemon at tcp://localhost:2376. Is the docker daemon running?
```

**Solutions:**

1. **Check security contexts:**
```yaml
# Verify capabilities are set
securityContext:
  capabilities:
    add:
    - SETUID
    - SETGID
```

2. **Increase startup delay:**
```yaml
command: ["sh", "-c"]
args:
- |
  sleep 10  # Give daemon more time
  while ! docker version > /dev/null 2>&1; do
    echo "Waiting for Docker..."
    sleep 5
  done
```

3. **Check storage driver:**
```yaml
env:
- name: DOCKER_DRIVER
  value: fuse-overlayfs  # Use for rootless
```

### Permission Errors with Rootless

#### Issue: Cannot create directories

**Symptoms:**
```bash
mkdir: cannot create directory '/var/lib/docker': Permission denied
```

**Solutions:**

1. **Fix volume ownership:**
```yaml
initContainers:
- name: fix-permissions
  image: busybox
  command: ['sh', '-c', 'chown -R 1000:1000 /data /docker']
  volumeMounts:
  - name: runner-data
    mountPath: /data
  - name: docker-storage
    mountPath: /docker
```

2. **Use correct mount paths:**
```yaml
# For rootless Docker
volumeMounts:
- name: docker-storage
  mountPath: /home/rootless/.local/share/docker  # Correct path
```

### Runner Connection Issues

#### Issue: Runner cannot register

**Symptoms:**
```bash
ERRO Cannot connect to Gitea: context deadline exceeded
```

**Solutions:**

1. **Check network policies:**
```bash
kubectl describe networkpolicy -n gitea-actions
kubectl get endpoints -n gitea
```

2. **Verify DNS resolution:**
```bash
kubectl exec act-runner-0 -c runner -- nslookup gitea.example.com
```

3. **Test connectivity:**
```bash
kubectl exec act-runner-0 -c runner -- curl -v https://gitea.example.com
```

4. **Check certificates:**
```yaml
env:
- name: GITEA_INSECURE
  value: "true"  # Temporarily for testing
```

### Performance Optimization Tips

#### 1. Cache Optimization

```yaml
# Use external cache server
env:
- name: ACTIONS_CACHE_URL
  value: "http://minio:9000/cache/"
- name: ACTIONS_CACHE_S3_BUCKET
  value: "actions-cache"
```

#### 2. Build Kit Optimization

```yaml
env:
- name: DOCKER_BUILDKIT
  value: "1"
- name: BUILDKIT_INLINE_CACHE
  value: "1"
```

#### 3. Storage Optimization

```yaml
# Use local SSD for docker storage
nodeSelector:
  disktype: ssd
volumes:
- name: docker-storage
  hostPath:
    path: /mnt/local-ssd/docker
    type: DirectoryOrCreate
```

#### 4. Registry Mirror

```yaml
# Configure registry mirror for faster pulls
containers:
- name: dind
  env:
  - name: DOCKER_REGISTRY_MIRROR
    value: "https://mirror.gcr.io"
```

#### 5. Resource Tuning

```yaml
# Tune for your workload
resources:
  requests:
    memory: "1Gi"
    cpu: "1"
  limits:
    memory: "8Gi"    # Increase for large builds
    cpu: "8"         # More cores for parallel builds
```

### Debug Commands

```bash
# Check runner status
kubectl get pods -n gitea-actions
kubectl describe pod act-runner-0 -n gitea-actions

# View logs
kubectl logs -f act-runner-0 -c runner -n gitea-actions
kubectl logs -f act-runner-0 -c dind -n gitea-actions

# Execute into container
kubectl exec -it act-runner-0 -c runner -n gitea-actions -- /bin/sh

# Check Docker status
kubectl exec act-runner-0 -c dind -- docker version
kubectl exec act-runner-0 -c dind -- docker info

# Test runner registration
kubectl exec act-runner-0 -c runner -- act_runner register --help

# Monitor resources
kubectl top pod -n gitea-actions
kubectl top node

# Check events
kubectl get events -n gitea-actions --sort-by='.lastTimestamp'

# Validate manifest
kubectl apply --dry-run=client -f runner-manifest.yaml
kubectl apply --dry-run=server -f runner-manifest.yaml
```

### Health Check Scripts

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: health-scripts
data:
  check-docker.sh: |
    #!/bin/sh
    docker version > /dev/null 2>&1 || exit 1
    docker ps > /dev/null 2>&1 || exit 1
    exit 0
  
  check-runner.sh: |
    #!/bin/sh
    pgrep -x act_runner > /dev/null || exit 1
    test -f /data/.runner || exit 1
    exit 0
```

---

## Additional Resources

### Official Documentation
- [Gitea Actions Documentation](https://docs.gitea.com/usage/actions/overview)
- [Act Runner Repository](https://gitea.com/gitea/act_runner)
- [Docker Rootless Documentation](https://docs.docker.com/engine/security/rootless/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

### Community Resources
- [Gitea Forum](https://forum.gitea.com/)
- [Gitea Discord](https://discord.gg/gitea)
- [Act Runner Examples](https://gitea.com/gitea/act_runner/src/branch/main/examples)

### Related Tools
- [nektos/act](https://github.com/nektos/act) - Local GitHub Actions runner
- [actions/runner](https://github.com/actions/runner) - GitHub's official runner
- [Drone CI](https://www.drone.io/) - Container-native CI/CD

## Conclusion

Deploying Gitea Actions runners with Docker-in-Docker using rootless Docker on Kubernetes provides a secure, scalable CI/CD solution. While rootless Docker introduces some limitations and performance overhead, the security benefits far outweigh these trade-offs in most environments.

Key takeaways:
- Use rootless Docker for enhanced security
- Deploy with StatefulSets for persistent runners or Deployments for ephemeral runners
- Implement proper Pod Security Standards
- Configure network policies for isolation
- Monitor and optimize performance based on workload requirements

This configuration provides a production-ready foundation that can be customized based on specific requirements and security policies.