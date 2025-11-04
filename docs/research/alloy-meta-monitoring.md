# Alloy Meta Monitoring Configuration

This document describes how to configure meta monitoring (self-monitoring) for Grafana Alloy instances to collect and forward their own internal metrics, logs, and traces.

## Overview

Meta monitoring allows Alloy instances to monitor themselves by:
- **Exposing internal metrics** about component health, resource usage, and throughput
- **Forwarding their own logs** to centralized logging
- **Tracing internal operations** for debugging

This is critical for:
- Monitoring collector health and performance
- Detecting bottlenecks in data pipelines
- Alerting on collector failures
- Understanding resource consumption

## Implementation Approaches

### 1. K8s-Monitoring Chart (selfReporting)

The [Grafana k8s-monitoring Helm chart](https://github.com/grafana/k8s-monitoring-helm) has built-in `selfReporting` functionality that automatically configures meta monitoring for all Alloy instances deployed by the chart.

#### Default Behavior

By default, `selfReporting` is **enabled** with these settings:

```yaml
selfReporting:
  enabled: true
  scrapeInterval: "60s"
  destinations: []  # Uses all configured metrics destinations
```

#### How It Works

When enabled, the chart automatically:
1. Adds `prometheus.exporter.self` component to each Alloy instance
2. Configures `prometheus.scrape` to scrape from the self exporter
3. Forwards metrics to all configured destinations (or specified subset)
4. Labels metrics with `job=alloy` for easy identification

#### Configuration

Configure via the `K8sMonitoring` component in TypeScript:

```typescript
const k8sMonitoring = new K8sMonitoring("k8s-monitoring", {
  namespace: "collectors",
  clusterName: "production",
  destinations: [
    {
      name: "prometheus",
      type: "prometheus",
      url: "http://mimir:9090/api/v1/metrics/write",
    },
  ],
  selfReporting: {
    enabled: true,
    scrapeInterval: "60s",
    destinations: ["prometheus"],  // Optional: limit to specific destinations
  },
});
```

Or directly via Helm values:

```yaml
selfReporting:
  enabled: true
  scrapeInterval: "60s"
  destinations:
    - prometheus  # Only send to prometheus destination
```

#### What Gets Monitored

The k8s-monitoring chart deploys multiple Alloy instances:
- **alloy-metrics** (StatefulSet) - Scrapes cluster metrics
- **alloy-logs** (DaemonSet) - Collects pod/node logs  
- **alloy-receiver** (DaemonSet) - Receives telemetry via HTTP/gRPC
- **alloy-singleton** (Deployment) - Collects cluster events
- **alloy-profiles** (DaemonSet) - Instruments and collects profiles

All instances report their own metrics when `selfReporting` is enabled.

### 2. Standalone Alloy Instances (Manual Configuration)

For Alloy instances deployed outside the k8s-monitoring chart (e.g., on bare metal via pyinfra, or central collectors in Kubernetes), you must manually configure meta monitoring.

#### Alloy River Configuration

Add these components to your Alloy configuration:

```alloy
// Expose Alloy's internal metrics
prometheus.exporter.self "default" {
}

// Scrape from the self exporter
prometheus.scrape "self" {
  targets         = prometheus.exporter.self.default.targets
  forward_to      = [prometheus.remote_write.mimir.receiver]
  scrape_interval = "60s"
  scrape_timeout  = "10s"
}

// Forward to your metrics backend
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir:9090/api/v1/push"
    headers = {
      "X-Scope-OrgID" = "default"
    }
  }
}
```

#### System-Level Alloy (Bare Metal)

For bare metal deployments using the pyinfra template, the configuration has been updated to include meta monitoring:

```alloy
prometheus.exporter.self "default" {
}

prometheus.scrape "self" {
  targets         = prometheus.exporter.self.default.targets
  forward_to      = [prometheus.remote_write.metrics_service.receiver]
  scrape_interval = "60s"
  scrape_timeout  = "10s"
}
```

This is automatically included in `/etc/alloy/config.alloy` when deployed.

#### Kubernetes Alloy Component

For the `Alloy` TypeScript component (used for central collectors), add meta monitoring to the generated River config:

```typescript
// In the component's generateRiverConfig method
const config: string[] = [];

// Self-monitoring
config.push(`prometheus.exporter.self "default" {
}`);

config.push(`prometheus.scrape "self" {
  targets         = prometheus.exporter.self.default.targets
  forward_to      = [prometheus.remote_write.mimir.receiver]
  scrape_interval = "60s"
  scrape_timeout  = "10s"
}`);

// ... rest of configuration
```

## Available Metrics

The `prometheus.exporter.self` component exposes metrics on Alloy's `/metrics` endpoint:

### Component Metrics

- `alloy_component_controller_running_components` - Number of running components
- `alloy_component_controller_evaluating` - Component currently being evaluated
- `alloy_component_evaluation_seconds` - Time spent evaluating components

### Resource Metrics

- `alloy_resources_machine_rx_bytes_total` - Network bytes received
- `alloy_resources_machine_tx_bytes_total` - Network bytes transmitted
- `alloy_resources_process_cpu_seconds_total` - CPU time used
- `alloy_resources_process_resident_memory_bytes` - Memory usage

### Receiver/Exporter Metrics

- `alloy_otelcol_receiver_accepted_spans` - Spans accepted by receiver
- `alloy_otelcol_receiver_refused_spans` - Spans refused by receiver
- `alloy_otelcol_exporter_sent_spans` - Spans sent by exporter
- `alloy_otelcol_exporter_send_failed_spans` - Spans that failed to send
- `alloy_prometheus_remote_write_samples_total` - Total samples written
- `alloy_prometheus_remote_write_samples_pending` - Samples pending write
- `alloy_prometheus_remote_write_samples_failed_total` - Failed sample writes

### Queue Metrics

- `alloy_prometheus_remote_write_queue_length` - Queue length
- `alloy_prometheus_remote_write_shard_capacity` - Shard capacity
- `alloy_prometheus_remote_write_shards` - Number of shards

## Meta Monitoring for Logs and Traces

### Forwarding Alloy Logs

To forward Alloy's own logs to Loki:

```alloy
loki.source.file "alloy_logs" {
  targets = [
    {
      __path__ = "/var/log/alloy/*.log",
      job      = "alloy",
      host     = env("HOSTNAME"),
    },
  ]
  forward_to = [loki.write.loki.receiver]
}
```

Or use the `logging` block to configure internal logging:

```alloy
logging {
  level  = "info"
  format = "json"
}
```

### Tracing Alloy Operations

Enable internal tracing for debugging:

```alloy
tracing {
  sampling_fraction = 0.1
  write_to = [otelcol.exporter.otlp.tempo.input]
}
```

## Monitoring Multiple Alloy Instances

### Using Alloy Integration

The k8s-monitoring chart supports monitoring external Alloy instances via the `integrations.alloy` configuration:

```typescript
integrations: {
  alloy: [
    {
      name: "central-collector",
      namespace: "monitoring",
      labelSelectors: {
        "app.kubernetes.io/name": "alloy",
      },
    },
  ],
}
```

This will:
1. Discover Alloy services matching the label selectors
2. Scrape their `/metrics` endpoint
3. Forward metrics to configured destinations

### Service Discovery

For automatic discovery of Alloy instances:

```alloy
discovery.kubernetes "alloy_instances" {
  role = "service"
  namespaces {
    names = ["monitoring", "collectors"]
  }
  selectors {
    role  = "service"
    label = "app.kubernetes.io/name=alloy"
  }
}

prometheus.scrape "discovered_alloy" {
  targets    = discovery.kubernetes.alloy_instances.targets
  forward_to = [prometheus.remote_write.mimir.receiver]
}
```

## Alerting on Alloy Health

### Example Prometheus Alerts

```yaml
groups:
  - name: alloy
    interval: 30s
    rules:
      - alert: AlloyDown
        expr: up{job="alloy"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Alloy instance {{ $labels.instance }} is down"
          
      - alert: AlloyHighMemoryUsage
        expr: |
          alloy_resources_process_resident_memory_bytes / 1024 / 1024 > 1024
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Alloy instance {{ $labels.instance }} using > 1GB memory"
          
      - alert: AlloyRemoteWriteFailing
        expr: |
          rate(alloy_prometheus_remote_write_samples_failed_total[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Alloy instance {{ $labels.instance }} failing to write samples"
          
      - alert: AlloyComponentEvaluationSlow
        expr: |
          alloy_component_evaluation_seconds > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alloy component evaluation taking > 10s on {{ $labels.instance }}"
```

## Grafana Dashboards

The Grafana k8s-monitoring chart includes built-in dashboards for Alloy monitoring. You can also create custom dashboards using these queries:

### Component Health

```promql
# Number of running components
alloy_component_controller_running_components

# Component evaluation time
rate(alloy_component_evaluation_seconds[5m])
```

### Resource Usage

```promql
# Memory usage
alloy_resources_process_resident_memory_bytes / 1024 / 1024

# CPU usage
rate(alloy_resources_process_cpu_seconds_total[5m])

# Network traffic
rate(alloy_resources_machine_rx_bytes_total[5m])
rate(alloy_resources_machine_tx_bytes_total[5m])
```

### Throughput

```promql
# Metrics throughput
rate(alloy_prometheus_remote_write_samples_total[5m])

# OTLP spans throughput  
rate(alloy_otelcol_receiver_accepted_spans[5m])
```

## Best Practices

### 1. Always Enable Meta Monitoring

Meta monitoring should be enabled for all Alloy instances to ensure observability of the collection pipeline itself.

### 2. Set Appropriate Scrape Intervals

- **Production**: 60s is sufficient for most use cases
- **Development**: 30s for faster feedback
- **High-throughput**: 15s to catch transient issues

### 3. Label Instances Clearly

Add labels to distinguish between Alloy instances:

```alloy
prometheus.scrape "self" {
  targets = prometheus.exporter.self.default.targets
  forward_to = [prometheus.remote_write.mimir.receiver]
  
  clustering {
    labels = {
      environment = "production"
      cluster     = "us-east-1"
      role        = "central-collector"
    }
  }
}
```

### 4. Monitor Queue Depths

High queue depths indicate backpressure or downstream issues. Alert when queues exceed 80% capacity.

### 5. Track Error Rates

Monitor failed writes, refused spans, and component errors to detect pipeline issues early.

### 6. Use Separate Tenant for Meta Metrics

Consider using a separate tenant ID for Alloy's own metrics to isolate them from application metrics:

```alloy
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir:9090/api/v1/push"
    headers = {
      "X-Scope-OrgID" = "platform-monitoring"  // Separate tenant
    }
  }
}
```

## Troubleshooting

### Metrics Not Appearing

1. **Check Alloy is exposing metrics**: `curl http://localhost:12345/metrics`
2. **Verify scrape configuration**: Check `prometheus.scrape` targets
3. **Check remote write**: Look for errors in Alloy logs
4. **Verify destination**: Ensure Mimir/Prometheus is receiving data

### High Memory Usage

1. **Reduce batch sizes** in `otelcol.processor.batch`
2. **Decrease queue sizes** in `prometheus.remote_write`
3. **Limit discovered targets** with label selectors
4. **Enable memory limits** with `otelcol.processor.memory_limiter`

### Component Evaluation Slow

1. **Check complex relabeling** rules
2. **Reduce discovery frequency**
3. **Optimize regex patterns**
4. **Split large configurations** into multiple instances

## References

- [Grafana Alloy Documentation - Monitoring](https://grafana.com/docs/alloy/latest/reference/components/prometheus.exporter.self/)
- [k8s-monitoring Helm Chart - selfReporting](https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring#selfreporting)
- [OpenTelemetry Collector Monitoring](https://opentelemetry.io/docs/collector/monitoring/)
- [Prometheus Remote Write Tuning](https://prometheus.io/docs/practices/remote_write/)
