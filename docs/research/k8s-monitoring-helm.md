# Grafana k8s-monitoring Helm Chart Research

## Overview

The Grafana k8s-monitoring Helm chart is a comprehensive Kubernetes observability solution that provides a complete monitoring stack for clusters. It deploys and configures Grafana Alloy (formerly Agent) instances to collect metrics, logs, traces, events, and profiles from Kubernetes clusters and applications.

## Architecture

### Core Components

The chart deploys multiple specialized Alloy instances managed by the Alloy Operator:

1. **alloy-metrics** (StatefulSet)
   - Scrapes infrastructure metrics from kubelet, cAdvisor, kube-state-metrics
   - Accepts metrics via receivers (OTLP, Prometheus remote write)
   - Can be horizontally scaled for large clusters

2. **alloy-logs** (DaemonSet)
   - Collects Pod and Node logs via HostPath mounts or K8s API
   - Runs on every node for local log collection
   - Supports log enrichment and processing

3. **alloy-receiver** (DaemonSet)
   - Opens receiver ports for application telemetry
   - Accepts OTLP, Zipkin, Jaeger, and other protocols
   - Provides local endpoints on each node

4. **alloy-singleton** (Deployment, 1 replica)
   - Collects cluster-wide data like K8s events
   - Handles tasks that must run as a single instance

5. **alloy-profiles** (DaemonSet)
   - Collects continuous profiling data
   - Integrates with Pyroscope for profile storage

### Supporting Components

- **Alloy Operator**: Manages lifecycle of Alloy instances
- **kube-state-metrics**: Generates metrics about K8s objects
- **Node Exporter**: Linux node metrics (DaemonSet)
- **Windows Exporter**: Windows node metrics (DaemonSet)
- **OpenCost**: Cost calculation metrics (optional)
- **Kepler**: Energy consumption metrics (optional)
- **Beyla**: eBPF-based auto-instrumentation (optional)

## Configuration Structure

### 1. Cluster Configuration
```yaml
cluster:
  name: my-cluster  # Required: cluster identifier
```

### 2. Destinations

The chart supports multiple destination types for telemetry data:

#### For Self-Hosted Backends

**Prometheus/Mimir (Metrics)**
```yaml
destinations:
  - name: selfHostedMimir
    type: prometheus
    url: http://mimir.monitoring.svc.cluster.local:9009/api/v1/push
    # Optional authentication
    auth:
      type: basic
      username: "admin"
      password: "password"
```

**Loki (Logs)**
```yaml
destinations:
  - name: selfHostedLoki
    type: loki
    url: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push
    # Optional tenant configuration
    tenantId: "my-tenant"
```

**OTLP (All telemetry types)**
```yaml
destinations:
  - name: otlpBackend
    type: otlp
    protocol: grpc  # or "http"
    url: grpc://tempo.monitoring.svc.cluster.local:4317
    # Selective telemetry types
    metrics:
      enabled: true
    logs:
      enabled: true
    traces:
      enabled: true
```

### 3. Features

Enable/disable specific collection features:

```yaml
# Infrastructure monitoring
clusterMetrics:
  enabled: true
  destinations: ["selfHostedMimir"]  # Optional: specific destinations

clusterEvents:
  enabled: true
  destinations: ["selfHostedLoki"]

# Application monitoring
podLogs:
  enabled: true
  
nodeLogs:
  enabled: true

# Application telemetry
applicationObservability:
  enabled: true
  receivers:
    otlp:
      enabled: true
      grpc:
        port: 4317
      http:
        port: 4318

# Prometheus Operator integration
prometheusOperatorObjects:
  enabled: true  # Discovers ServiceMonitors, PodMonitors, etc.

# Auto-instrumentation with Beyla
autoInstrumentation:
  enabled: true
  beyla:
    enabled: true
```

### 4. Collectors Configuration

```yaml
alloy-metrics:
  enabled: true
  controller:
    type: statefulset
    replicas: 2  # Scale for large clusters

alloy-logs:
  enabled: true
  controller:
    type: daemonset

alloy-receiver:
  enabled: true
  extraPorts:
    - name: jaeger-grpc
      port: 14250
      protocol: TCP
```

## Label Conventions

The chart uses **OTEL semantic conventions** by default but can be configured to use Prometheus labels:

- Default: `k8s.namespace.name`, `k8s.pod.name`, `k8s.container.name`
- Prometheus: `namespace`, `pod`, `container`

Cluster name is added to all telemetry as configured labels (default: `cluster` and `k8s.cluster.name`).

## OTLP Integration

The chart has robust OTLP support for both collection and forwarding:

### Collection (Receivers)
- OTLP gRPC (port 4317)
- OTLP HTTP (port 4318)
- Automatic protocol detection
- Support for metrics, logs, and traces

### Processing
- Batch processing for efficiency
- Memory limiting to prevent OOM
- Attribute/resource processing
- Tail sampling for traces
- Service graph generation

### Forwarding
- Convert Prometheus metrics to OTLP
- Convert Loki logs to OTLP with structured metadata
- Preserve OTEL resource attributes
- Support for both gRPC and HTTP protocols

## Self-Hosted Configuration Example

Complete example for self-hosted Grafana stack:

```yaml
cluster:
  name: homelab-k8s

destinations:
  # Metrics to Mimir
  - name: mimir
    type: prometheus
    url: http://mimir-nginx.monitoring.svc.cluster.local/api/v1/push
    sendNativeHistograms: true
    
  # Logs to Loki
  - name: loki
    type: loki
    url: http://loki-gateway.monitoring.svc.cluster.local/loki/api/v1/push
    
  # Traces to Tempo (via OTLP)
  - name: tempo
    type: otlp
    protocol: grpc
    url: grpc://tempo-distributor.monitoring.svc.cluster.local:4317
    metrics:
      enabled: false  # Only send traces
    logs:
      enabled: false
    traces:
      enabled: true
      
  # Profiles to Pyroscope
  - name: pyroscope
    type: pyroscope
    url: http://pyroscope.monitoring.svc.cluster.local

# Features
clusterMetrics:
  enabled: true
  kube-state-metrics:
    deploy: true
  node-exporter:
    deploy: true

clusterEvents:
  enabled: true

podLogs:
  enabled: true

applicationObservability:
  enabled: true
  receivers:
    otlp:
      enabled: true

prometheusOperatorObjects:
  enabled: true

# Collectors
alloy-metrics:
  enabled: true

alloy-logs:
  enabled: true

alloy-receiver:
  enabled: true

alloy-singleton:
  enabled: true
```

## Customization Options

### 1. Metric Processing
```yaml
destinations:
  - name: mimir
    type: prometheus
    metricProcessingRules: |
      write_relabel_config {
        source_labels = ["__name__"]
        regex = "up|kube_.*"
        action = "keep"
      }
```

### 2. Log Processing
```yaml
destinations:
  - name: loki
    type: loki
    logProcessingStages: |
      stage.json {
        expressions = {
          timestamp = "timestamp",
          level = "level",
        }
      }
```

### 3. Resource Management
```yaml
alloy-metrics:
  alloy:
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "2Gi"
        cpu: "1000m"
```

### 4. Scaling Configuration
```yaml
alloy-metrics:
  controller:
    type: statefulset
    replicas: 3
    autoscaling:
      enabled: true
      minReplicas: 2
      maxReplicas: 10
      targetCPUUtilization: 80
```

## Multi-Cluster Support

The chart supports multi-cluster monitoring:

```yaml
cluster:
  name: production-us-west-1

global:
  clusterLabels:
    - cluster
    - k8s.cluster.name
    - region
    - environment
    
extraLabels:
  region: "us-west-1"
  environment: "production"
```

## Resource Requirements

Typical resource consumption:

- **alloy-metrics**: 256Mi-2Gi RAM, scales with metric volume
- **alloy-logs**: 128Mi-512Mi RAM per node
- **alloy-receiver**: 128Mi-512Mi RAM per node
- **kube-state-metrics**: 128Mi-512Mi RAM
- **node-exporter**: 32Mi-128Mi RAM per node

## Migration Path

### From Prometheus/Grafana Agent Stack

1. The chart can coexist with existing monitoring
2. Use `prometheusOperatorObjects` to discover existing ServiceMonitors
3. Gradually migrate scrape configs to the new stack
4. Can forward to multiple destinations during transition

### From kube-prometheus-stack

1. Disable overlapping components:
```yaml
clusterMetrics:
  kube-state-metrics:
    deploy: false  # Use existing
  node-exporter:
    deploy: false  # Use existing
```

2. Enable Prometheus Operator object discovery:
```yaml
prometheusOperatorObjects:
  enabled: true
```

## Comparison with Alternatives

### vs. kube-prometheus-stack
- **k8s-monitoring**: Unified telemetry collection (metrics, logs, traces, profiles)
- **kube-prometheus**: Primarily metrics-focused
- **k8s-monitoring**: OTLP-native with backward compatibility
- **kube-prometheus**: Prometheus-native

### vs. OpenTelemetry Operator
- **k8s-monitoring**: Opinionated, production-ready configurations
- **OTel Operator**: More flexible but requires more configuration
- **k8s-monitoring**: Integrated Kubernetes-specific collectors
- **OTel Operator**: Generic OpenTelemetry collectors

## Dashboards and Alerts

The chart integrates with Grafana's Kubernetes monitoring dashboards:

- Cluster overview
- Namespace breakdown
- Workload performance
- Pod/container metrics
- Cost analysis (with OpenCost)
- Energy consumption (with Kepler)

Pre-built alert rules for:
- Node health
- Pod restarts
- Resource saturation
- Failed jobs
- PVC issues

## Recommendations for Homelab

### Minimal Setup
```yaml
# Focus on essential metrics and logs
clusterMetrics:
  enabled: true
  
podLogs:
  enabled: true
  
alloy-metrics:
  enabled: true
  controller:
    replicas: 1  # Single replica for small clusters
    
alloy-logs:
  enabled: true
```

### Performance Optimizations

1. **Increase scrape interval for non-critical metrics**:
```yaml
global:
  scrapeInterval: "120s"  # 2 minutes for homelab
```

2. **Filter metrics at source**:
```yaml
clusterMetrics:
  metricRelabelingRules: |
    # Drop high-cardinality metrics
    rule {
      source_labels = ["__name__"]
      regex = "apiserver_request_duration_seconds_bucket"
      action = "drop"
    }
```

3. **Limit log collection**:
```yaml
podLogs:
  namespaces:
    - default
    - monitoring
    - production
```

## Version Information

- Current chart version: 3.5.5
- Alloy version: v1.10.1
- Alloy Operator: 1.2.1
- kube-state-metrics: v2.16.0
- Node Exporter: v1.9.1

## Integration Strategy

### For Self-Hosted Stack

1. **Deploy the chart pointing to self-hosted backends**
2. **Enable required features based on needs**
3. **Start with metrics and gradually add logs/traces**
4. **Use OTLP for future-proofing**
5. **Monitor resource usage and scale accordingly**

### Benefits
- Unified collection architecture
- Reduced operational complexity
- Native Kubernetes integration
- Support for all telemetry types
- Easy scaling and management

### Considerations
- Higher initial resource usage than single-purpose collectors
- Learning curve for Alloy configuration
- Requires Alloy Operator CRDs

## Conclusion

The k8s-monitoring Helm chart provides a comprehensive, scalable, and maintainable solution for Kubernetes observability. It's particularly well-suited for:

- Organizations wanting unified telemetry collection
- Teams migrating to OpenTelemetry
- Environments requiring multi-signal correlation
- Both cloud and self-hosted Grafana deployments

The chart's modular architecture, extensive configuration options, and support for both modern (OTLP) and legacy (Prometheus/Loki) protocols make it an excellent choice for comprehensive Kubernetes monitoring.