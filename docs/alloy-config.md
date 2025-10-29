# Grafana Alloy Configuration Guide

This guide provides comprehensive documentation for configuring Grafana Alloy to collect and forward telemetry data to Mimir and Loki using both OpenTelemetry (OTLP) and native protocols.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Syntax](#configuration-syntax)
3. [OTLP Receivers](#otlp-receivers)
4. [Native Receivers](#native-receivers)
5. [Processors](#processors)
6. [Connectors](#connectors)
7. [Exporters](#exporters)
8. [Multi-tenancy Configuration](#multi-tenancy-configuration)
9. [TLS Configuration](#tls-configuration)
10. [Service Discovery](#service-discovery)
11. [Complete Configuration Examples](#complete-configuration-examples)

## Overview

Grafana Alloy is a telemetry collector that combines OpenTelemetry and Prometheus pipelines. It uses a declarative River configuration language to define components and their connections. Components are chained together using the `forward_to` parameter to create data processing pipelines.

## Configuration Syntax

The Alloy configuration syntax uses blocks, attributes, and expressions:

```alloy
// Component definition with label
component.type "label" {
    // Attributes
    attribute_name = "value"
    
    // Nested blocks
    nested_block {
        setting = "value"
    }
    
    // Referencing other components
    input = other.component.label.export
    
    // Forwarding to next component
    forward_to = [next.component.label.receiver]
}
```

### Key Concepts

- **Blocks**: Group related settings, typically representing components
- **Attributes**: Individual settings within blocks
- **Expressions**: Compute attribute values, including references to other components
- **Labels**: Unique identifiers for component instances
- **Exports**: Values exposed by components for use by other components

## OTLP Receivers

### otelcol.receiver.otlp

Receives OpenTelemetry data over HTTP and gRPC protocols.

```alloy
otelcol.receiver.otlp "default" {
    // HTTP endpoint configuration (port 4318)
    http {
        endpoint = "0.0.0.0:4318"
        
        // Optional: Add CORS support
        cors {
            allowed_origins = ["*"]
            allowed_headers = ["*"]
        }
        
        // Optional: Authentication
        auth = otelcol.auth.headers.tenant.handler
        
        // Optional: TLS configuration
        tls {
            cert_file = "/path/to/cert.pem"
            key_file  = "/path/to/key.pem"
        }
        
        // URL paths (defaults)
        traces_url_path  = "/v1/traces"
        metrics_url_path = "/v1/metrics"
        logs_url_path    = "/v1/logs"
    }
    
    // gRPC endpoint configuration (port 4317)
    grpc {
        endpoint = "0.0.0.0:4317"
        
        // Optional: Authentication
        auth = otelcol.auth.headers.tenant.handler
        
        // Optional: TLS configuration
        tls {
            cert_file = "/path/to/cert.pem"
            key_file  = "/path/to/key.pem"
        }
        
        // Optional: Keepalive settings
        keepalive {
            server_parameters {
                time    = "2h"
                timeout = "20s"
            }
        }
    }
    
    // Output configuration
    output {
        metrics = [otelcol.processor.batch.default.input]
        logs    = [otelcol.processor.batch.default.input]
        traces  = [otelcol.processor.batch.default.input]
    }
}
```

### Port Summary for OTLP

- **4317**: gRPC endpoint for OTLP
- **4318**: HTTP endpoint for OTLP/JSON

## Native Receivers

### loki.source.api

Receives logs using Loki's native push API on port 3100.

```alloy
loki.source.api "native" {
    http {
        listen_address = "0.0.0.0"
        listen_port    = 3100
        
        // Optional: Connection limits
        conn_limit           = 100
        server_idle_timeout  = "120s"
        server_read_timeout  = "30s"
        server_write_timeout = "30s"
    }
    
    // Optional: Add labels to all received logs
    labels = {
        source = "api"
    }
    
    // Optional: Configure max message size
    max_send_message_size = "100MiB"
    
    // Optional: Use incoming timestamp
    use_incoming_timestamp = true
    
    // Forward to processing or writing
    forward_to = [loki.process.tenant.receiver]
}
```

#### Endpoints

- `/loki/api/v1/push`: Loki push API endpoint
- `/loki/api/v1/raw`: Raw log lines (newline-delimited)
- `/api/v1/push`: Internally redirects to `/loki/api/v1/push`
- `/ready`: Health check endpoint

### prometheus.receive_http

Receives metrics using Prometheus remote write protocol on port 9090.

```alloy
prometheus.receive_http "native" {
    http {
        listen_address = "0.0.0.0"
        listen_port    = 9090
    }
    
    // Forward to processing or writing
    forward_to = [prometheus.relabel.add_labels.receiver]
}
```

## Processors

### otelcol.processor.batch

Batches telemetry data to improve throughput and reduce API calls.

```alloy
otelcol.processor.batch "default" {
    // Batch size limits
    send_batch_size     = 8192
    send_batch_max_size = 16384
    
    // Time-based batching
    timeout = "2s"
    
    // Optional: Separate settings per telemetry type
    metrics {
        timeout = "10s"
    }
    
    logs {
        timeout = "5s"
    }
    
    traces {
        timeout = "2s"
    }
    
    output {
        metrics = [otelcol.exporter.otlphttp.mimir.input]
        logs    = [otelcol.exporter.otlphttp.loki.input]
        traces  = [otelcol.exporter.otlp.tempo.input]
    }
}
```

### loki.process

Processes log entries with various transformations.

```alloy
loki.process "tenant" {
    // Extract tenant ID from labels
    stage.tenant {
        label = "tenant_id"
    }
    
    // Add labels
    stage.labels {
        values = {
            environment = "production"
            cluster     = "main"
        }
    }
    
    // Parse JSON logs
    stage.json {
        expressions = {
            level     = "level"
            timestamp = "time"
            message   = "msg"
        }
    }
    
    forward_to = [loki.write.multi_tenant.receiver]
}
```

### prometheus.relabel

Relabels metrics before forwarding.

```alloy
prometheus.relabel "add_labels" {
    rule {
        target_label = "environment"
        replacement  = "production"
    }
    
    rule {
        source_labels = ["__address__"]
        target_label  = "instance"
    }
    
    forward_to = [prometheus.remote_write.mimir.receiver]
}
```

## Connectors

### otelcol.connector.spanmetrics

Generates metrics from trace spans.

```alloy
otelcol.connector.spanmetrics "default" {
    // Histogram configuration
    histogram {
        explicit {
            buckets = [0.001, 0.01, 0.1, 1, 10, 100]
        }
        unit = "s"
    }
    
    // Dimensions to include in metrics
    dimensions {
        name    = "http.method"
        default = "GET"
    }
    
    dimensions {
        name    = "http.status_code"
        default = "200"
    }
    
    // Metric names
    namespace = "traces.spanmetrics"
    
    // Exemplars configuration
    exemplars {
        enabled = true
    }
    
    output {
        metrics = [otelcol.exporter.prometheus.default.input]
    }
}
```

### otelcol.connector.servicegraph

Generates service dependency graph metrics from traces.

```alloy
otelcol.connector.servicegraph "default" {
    // Latency histogram buckets
    latency_histogram_buckets = [0.001, 0.01, 0.1, 1, 10]
    
    // Dimensions to track
    dimensions = ["http.method", "http.status_code"]
    
    // Store for temporary data
    store {
        ttl = "30s"
        max_items = 10000
    }
    
    output {
        metrics = [otelcol.exporter.prometheus.default.input]
    }
}
```

## Exporters

### otelcol.exporter.otlphttp

Exports OTLP data over HTTP (for logs and metrics).

```alloy
otelcol.exporter.otlphttp "mimir" {
    client {
        endpoint = "http://mimir:9009/otlp"
        
        // Headers for multi-tenancy
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
        
        // TLS configuration
        tls {
            insecure = true  // For development only
            // For production:
            // ca_file   = "/path/to/ca.pem"
            // cert_file = "/path/to/cert.pem"
            // key_file  = "/path/to/key.pem"
        }
        
        // Retry configuration
        retry_on_failure {
            enabled = true
            initial_interval = "5s"
            max_interval = "30s"
            max_elapsed_time = "5m"
        }
        
        // Queue configuration
        sending_queue {
            enabled = true
            num_consumers = 10
            queue_size = 1000
        }
        
        // Compression
        compression = "gzip"
    }
}

otelcol.exporter.otlphttp "loki" {
    client {
        endpoint = "http://loki:3100/otlp"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
}
```

### otelcol.exporter.otlp

Exports OTLP data over gRPC (typically for traces).

```alloy
otelcol.exporter.otlp "tempo" {
    client {
        endpoint = "tempo:4317"
        
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
        
        tls {
            insecure = true  // For development
        }
        
        // gRPC-specific settings
        balancer_name = "round_robin"
        compression   = "gzip"
        
        // Keepalive
        keepalive {
            time                = "10s"
            timeout             = "5s"
            permit_without_stream = true
        }
    }
}
```

### loki.write

Native Loki writer for logs.

```alloy
loki.write "multi_tenant" {
    endpoint {
        url = "http://loki:3100/loki/api/v1/push"
        
        // Multi-tenancy header
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
        
        // Optional: Basic auth
        basic_auth {
            username = "loki"
            password = env("LOKI_PASSWORD")
        }
        
        // Optional: OAuth2
        oauth2 {
            client_id     = env("CLIENT_ID")
            client_secret = env("CLIENT_SECRET")
            token_url     = "https://auth.example.com/token"
        }
        
        // Batch configuration
        batch_wait = "1s"
        batch_size = "1MB"
        
        // Retry configuration
        min_backoff = "500ms"
        max_backoff = "5m"
        max_retries = 10
    }
    
    // Multiple endpoints for HA
    endpoint {
        url = "http://loki-replica:3100/loki/api/v1/push"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
}
```

### prometheus.remote_write

Native Prometheus remote writer for metrics.

```alloy
prometheus.remote_write "mimir" {
    endpoint {
        url = "http://mimir:9009/api/v1/push"
        
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
        
        // Write configuration
        write_buffer_size = 4194304  // 4MB
        retry_on_http_429 = true
        
        // Queue configuration
        queue_config {
            capacity          = 10000
            max_shards        = 50
            min_shards        = 1
            max_samples_per_send    = 5000
            batch_send_deadline     = "5s"
            min_backoff             = "30ms"
            max_backoff             = "5s"
            retry_on_http_429       = true
        }
        
        // Metadata configuration
        send_metadata = true
        send_interval = "1m"
    }
}
```

## Multi-tenancy Configuration

### Using Authentication Headers

```alloy
// Define authentication component
otelcol.auth.headers "tenant" {
    header {
        key   = "X-Tenant-ID"
        value = env("TENANT_ID")
    }
}

// Reference in receiver
otelcol.receiver.otlp "multi_tenant" {
    http {
        auth = otelcol.auth.headers.tenant.handler
    }
    // ... rest of configuration
}
```

### Dynamic Tenant Extraction

```alloy
// Extract tenant from incoming request headers
otelcol.processor.attributes "extract_tenant" {
    actions {
        key    = "tenant_id"
        action = "insert"
        from_context = "X-Tenant-ID"
    }
    
    output {
        metrics = [otelcol.processor.routing.by_tenant.input]
    }
}

// Route to different exporters based on tenant
otelcol.processor.routing "by_tenant" {
    from_attribute = "tenant_id"
    table {
        value = "tenant-1"
        pipelines = ["metrics/tenant1"]
    }
    table {
        value = "tenant-2"
        pipelines = ["metrics/tenant2"]
    }
    
    output {
        metrics = [otelcol.exporter.otlphttp.dynamic.input]
    }
}
```

## TLS Configuration

### Secure TLS Configuration

```alloy
// TLS for receivers
otelcol.receiver.otlp "secure" {
    grpc {
        endpoint = "0.0.0.0:4317"
        tls {
            cert_file = "/certs/server.crt"
            key_file  = "/certs/server.key"
            ca_file   = "/certs/ca.crt"
            
            // Minimum TLS version
            min_version = "TLS 1.2"
            max_version = "TLS 1.3"
            
            // Cipher suites (optional, uses safe defaults if not specified)
            cipher_suites = [
                "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
                "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
            ]
            
            // Client certificate verification
            client_ca_file = "/certs/client-ca.crt"
            
            // Reload certificates periodically
            reload_interval = "24h"
        }
    }
    // ... rest of configuration
}
```

### Insecure Development Configuration

```alloy
// For development/testing only
otelcol.exporter.otlphttp "dev" {
    client {
        endpoint = "http://localhost:4318"
        tls {
            insecure = true
            insecure_skip_verify = true
        }
    }
}
```

## Service Discovery

### Kubernetes Internal DNS

```alloy
// Using Kubernetes service DNS
otelcol.exporter.otlphttp "k8s_internal" {
    client {
        // Service.Namespace.svc.cluster.local:port
        endpoint = "http://mimir.monitoring.svc.cluster.local:9009/otlp"
    }
}

loki.write "k8s_internal" {
    endpoint {
        url = "http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"
    }
}
```

### External Endpoints with Environment Variables

```alloy
// Using environment variables for configuration
argument "endpoints" {
    optional = false
}

otelcol.exporter.otlphttp "external" {
    client {
        endpoint = argument.endpoints.value
        // Or use env function
        // endpoint = env("MIMIR_ENDPOINT")
    }
}
```

### Service Discovery with Multiple Endpoints

```alloy
prometheus.remote_write "ha" {
    // Primary endpoint
    endpoint {
        url = "http://mimir-1:9009/api/v1/push"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
    
    // Secondary endpoint for HA
    endpoint {
        url = "http://mimir-2:9009/api/v1/push"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
}
```

## Complete Configuration Examples

### Full OTLP Pipeline Configuration

```alloy
// Arguments for configuration
argument "mimir_endpoint" {
    optional = false
    default  = "http://mimir:9009/otlp"
}

argument "loki_endpoint" {
    optional = false
    default  = "http://loki:3100/otlp"
}

argument "tempo_endpoint" {
    optional = false
    default  = "tempo:4317"
}

argument "tenant_id" {
    optional = false
    default  = "default"
}

// OTLP Receiver
otelcol.receiver.otlp "main" {
    grpc {
        endpoint = "0.0.0.0:4317"
    }
    
    http {
        endpoint = "0.0.0.0:4318"
    }
    
    output {
        metrics = [otelcol.processor.batch.main.input]
        logs    = [otelcol.processor.batch.main.input]
        traces  = [
            otelcol.processor.batch.main.input,
            otelcol.connector.spanmetrics.main.input,
            otelcol.connector.servicegraph.main.input
        ]
    }
}

// Batch Processor
otelcol.processor.batch "main" {
    send_batch_size     = 8192
    send_batch_max_size = 16384
    timeout            = "2s"
    
    output {
        metrics = [otelcol.exporter.otlphttp.mimir.input]
        logs    = [otelcol.exporter.otlphttp.loki.input]
        traces  = [otelcol.exporter.otlp.tempo.input]
    }
}

// Span Metrics Connector
otelcol.connector.spanmetrics "main" {
    histogram {
        explicit {
            buckets = [0.001, 0.01, 0.1, 1, 10]
        }
    }
    
    dimensions {
        name = "service.name"
    }
    
    dimensions {
        name = "span.kind"
    }
    
    output {
        metrics = [otelcol.exporter.otlphttp.mimir.input]
    }
}

// Service Graph Connector
otelcol.connector.servicegraph "main" {
    latency_histogram_buckets = [0.001, 0.01, 0.1, 1, 10]
    
    output {
        metrics = [otelcol.exporter.otlphttp.mimir.input]
    }
}

// Metrics Exporter
otelcol.exporter.otlphttp "mimir" {
    client {
        endpoint = argument.mimir_endpoint.value
        headers = {
            "X-Scope-OrgID" = argument.tenant_id.value
        }
        compression = "gzip"
    }
}

// Logs Exporter
otelcol.exporter.otlphttp "loki" {
    client {
        endpoint = argument.loki_endpoint.value
        headers = {
            "X-Scope-OrgID" = argument.tenant_id.value
        }
        compression = "gzip"
    }
}

// Traces Exporter
otelcol.exporter.otlp "tempo" {
    client {
        endpoint = argument.tempo_endpoint.value
        headers = {
            "X-Scope-OrgID" = argument.tenant_id.value
        }
        compression = "gzip"
    }
}
```

### Native Protocol Pipeline Configuration

```alloy
// Native Loki receiver
loki.source.api "native" {
    http {
        listen_address = "0.0.0.0"
        listen_port    = 3100
    }
    
    forward_to = [loki.process.pipeline.receiver]
}

// Process logs
loki.process "pipeline" {
    // Parse JSON
    stage.json {
        expressions = {
            level = "level"
            msg   = "message"
        }
    }
    
    // Add labels
    stage.labels {
        values = {
            level = ""
        }
    }
    
    // Set tenant
    stage.tenant {
        value = "tenant-1"
    }
    
    forward_to = [loki.write.grafana.receiver]
}

// Write to Loki
loki.write "grafana" {
    endpoint {
        url = "http://loki:3100/loki/api/v1/push"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
}

// Native Prometheus receiver
prometheus.receive_http "native" {
    http {
        listen_address = "0.0.0.0"
        listen_port    = 9090
    }
    
    forward_to = [prometheus.relabel.process.receiver]
}

// Process metrics
prometheus.relabel "process" {
    rule {
        target_label = "cluster"
        replacement  = "production"
    }
    
    forward_to = [prometheus.remote_write.grafana.receiver]
}

// Write to Mimir
prometheus.remote_write "grafana" {
    endpoint {
        url = "http://mimir:9009/api/v1/push"
        headers = {
            "X-Scope-OrgID" = "tenant-1"
        }
    }
}
```

## Best Practices

### Resource Management

1. **Batching**: Always use batch processors to optimize throughput
2. **Queue Sizes**: Set appropriate queue sizes based on expected load
3. **Memory Limits**: Configure memory limiters for processors
4. **Connection Pooling**: Use connection pooling for exporters

### Error Handling

1. **Retries**: Configure retry policies with exponential backoff
2. **Dead Letter Queues**: Implement DLQ for failed messages
3. **Circuit Breakers**: Use circuit breakers to prevent cascading failures
4. **Monitoring**: Always monitor component health metrics

### Security

1. **TLS**: Always use TLS in production
2. **Authentication**: Implement proper authentication (OAuth2, mTLS)
3. **Multi-tenancy**: Use X-Scope-OrgID headers for tenant isolation
4. **Secret Management**: Use environment variables or secret managers

### Performance Optimization

```alloy
// Optimized batch processor
otelcol.processor.batch "optimized" {
    send_batch_size     = 8192
    send_batch_max_size = 16384
    timeout            = "2s"
    
    // Separate configs per signal
    metrics {
        timeout             = "10s"
        send_batch_max_size = 10000
    }
    
    logs {
        timeout             = "5s"
        send_batch_max_size = 20000
    }
    
    traces {
        timeout             = "2s"
        send_batch_max_size = 5000
    }
}

// Memory limiter
otelcol.processor.memory_limiter "default" {
    check_interval = "1s"
    limit          = "1GiB"
    spike_limit    = "256MiB"
}
```

## Debugging and Troubleshooting

### Debug Logging

```alloy
// Global logging configuration
logging {
    level  = "debug"
    format = "json"
}

// Component-specific debug
otelcol.exporter.debug "troubleshoot" {
    verbosity = "detailed"
    sampling_initial = 10
    sampling_thereafter = 100
}
```

### Health Checks

Alloy exposes the following endpoints for monitoring:

- `/-/ready`: Readiness check
- `/-/healthy`: Health check
- `/metrics`: Prometheus metrics
- `/api/v1/metrics/targets`: Scrape target information

### Common Issues

1. **Port Conflicts**: Ensure ports are not already in use
2. **DNS Resolution**: Verify service DNS names in Kubernetes
3. **TLS Errors**: Check certificate validity and paths
4. **Memory Issues**: Adjust batch sizes and memory limits
5. **Network Timeouts**: Increase timeout values for slow networks

## References

- [Grafana Alloy Documentation](https://grafana.com/docs/alloy/latest/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [Loki Push API](https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki)
- [Prometheus Remote Write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write)
- [Mimir Documentation](https://grafana.com/docs/mimir/latest/)