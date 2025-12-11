# NanoMQ Kubernetes Deployment

## Overview

NanoMQ is an ultra-lightweight MQTT messaging broker designed for IoT edge computing.

Key features:
- MQTT 5.0/3.1.1 compliant
- Boot footprint less than 200KB
- Asynchronous I/O with actor model
- Multi-threading with SMP support
- Million-level TPS performance
- Built-in MQTT bridges, rule engine, and HTTP APIs

## Docker Images

Official images from Docker Hub: `emqx/nanomq`

Image variants:
- `emqx/nanomq:latest` - Basic version (MQTT broker, TCP/WebSocket bridging)
- `emqx/nanomq:X.X.X-slim` - Slim version (Basic + TLS/SSL + SQLite)
- `emqx/nanomq:X.X.X-full` - Full version (All features including Rule Engine, QUIC, ZMQ)

Latest version: 0.24.6

Exposed ports:
- 1883: MQTT/TCP
- 8883: MQTT/TLS
- 8083: WebSocket
- 8084: Secure WebSocket
- 8081: HTTP Management API

## Kubernetes Deployment

No official Helm chart exists - requires custom manifests.

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nanomq-config
data:
  nanomq.conf: |
    mqtt {
        property_size = 32
        max_packet_size = 256MB
        max_mqueue_len = 2048
        retry_interval = 10s
        keepalive_multiplier = 1.25
    }

    listeners.tcp {
        bind = "0.0.0.0:1883"
    }

    listeners.ws {
        bind = "0.0.0.0:8083/mqtt"
    }

    http_server {
        port = 8081
        limit_conn = 32
        username = admin
        password = public
        auth_type = basic
    }

    log {
        to = [console]
        level = info
    }

    auth {
        allow_anonymous = true
        no_match = allow
        deny_action = ignore
    }

    system {
        num_taskq_thread = 0
        max_taskq_thread = 0
        parallel = 0
    }
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nanomq
  labels:
    app: nanomq
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nanomq
  template:
    metadata:
      labels:
        app: nanomq
    spec:
      containers:
      - name: nanomq
        image: emqx/nanomq:0.24.6-slim
        ports:
        - name: mqtt
          containerPort: 1883
        - name: mqtts
          containerPort: 8883
        - name: ws
          containerPort: 8083
        - name: http
          containerPort: 8081
        env:
        - name: NANOMQ_BROKER_URL
          value: "nmq-tcp://0.0.0.0:1883"
        - name: NANOMQ_HTTP_SERVER_ENABLE
          value: "true"
        - name: NANOMQ_LOG_LEVEL
          value: "info"
        - name: NANOMQ_LOG_TO
          value: "console"
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v4/brokers
            port: 8081
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/v4/brokers
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: config
          mountPath: /etc/nanomq.conf
          subPath: nanomq.conf
      volumes:
      - name: config
        configMap:
          name: nanomq-config
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nanomq
spec:
  type: ClusterIP
  ports:
  - name: mqtt
    port: 1883
    targetPort: 1883
  - name: mqtts
    port: 8883
    targetPort: 8883
  - name: ws
    port: 8083
    targetPort: 8083
  - name: http
    port: 8081
    targetPort: 8081
  selector:
    app: nanomq
```

## Environment Variables

### Core Settings

- NANOMQ_BROKER_URL: Broker bind address (nmq-tcp://0.0.0.0:1883)
- NANOMQ_PARALLEL: Concurrent handlers count
- NANOMQ_NUM_TASKQ_THREAD: Worker threads
- NANOMQ_ALLOW_ANONYMOUS: Allow anonymous login (true/false)
- NANOMQ_HTTP_SERVER_ENABLE: Enable HTTP API (true/false)
- NANOMQ_HTTP_SERVER_PORT: HTTP API port (default: 8081)
- NANOMQ_HTTP_SERVER_USERNAME: HTTP auth username
- NANOMQ_HTTP_SERVER_PASSWORD: HTTP auth password
- NANOMQ_LOG_TO: Log output (console/file/syslog)
- NANOMQ_LOG_LEVEL: Log level (trace/debug/info/warn/error/fatal)

### TLS Settings

- NANOMQ_TLS_ENABLE: Enable TLS (true/false)
- NANOMQ_TLS_URL: TLS bind address (tls+nmq-tcp://0.0.0.0:8883)
- NANOMQ_TLS_CA_CERT_PATH: CA certificate path
- NANOMQ_TLS_CERT_PATH: Server certificate path
- NANOMQ_TLS_KEY_PATH: Private key path
- NANOMQ_TLS_VERIFY_PEER: Verify client certificates

## TLS Configuration

Requires slim or full image variant.

### TLS Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nanomq-tls
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
  ca.crt: <base64-encoded-ca>
```

### TLS Deployment Addition

```yaml
env:
- name: NANOMQ_TLS_ENABLE
  value: "true"
- name: NANOMQ_TLS_URL
  value: "tls+nmq-tcp://0.0.0.0:8883"
- name: NANOMQ_TLS_CA_CERT_PATH
  value: "/etc/certs/ca.crt"
- name: NANOMQ_TLS_CERT_PATH
  value: "/etc/certs/tls.crt"
- name: NANOMQ_TLS_KEY_PATH
  value: "/etc/certs/tls.key"
volumeMounts:
- name: tls-certs
  mountPath: /etc/certs
  readOnly: true
volumes:
- name: tls-certs
  secret:
    secretName: nanomq-tls
```

### HOCON TLS Config

```hocon
listeners.ssl {
    bind = "0.0.0.0:8883"
    keyfile = "/etc/certs/tls.key"
    certfile = "/etc/certs/tls.crt"
    cacertfile = "/etc/certs/ca.crt"
    verify_peer = false
    fail_if_no_peer_cert = false
}
```

## Persistence with SQLite

Available in slim and full versions. Use StatefulSet for persistence.

### SQLite Configuration

```hocon
sqlite {
    disk_cache_size = 102400
    mounted_file_path = "/data/"
    flush_mem_threshold = 100
    resend_interval = 5000
}
```

### StatefulSet with PVC

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nanomq
spec:
  serviceName: nanomq
  replicas: 1
  selector:
    matchLabels:
      app: nanomq
  template:
    metadata:
      labels:
        app: nanomq
    spec:
      containers:
      - name: nanomq
        image: emqx/nanomq:0.24.6-slim
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /etc/nanomq.conf
          subPath: nanomq.conf
      volumes:
      - name: config
        configMap:
          name: nanomq-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

## Health Checks

HTTP endpoints for probes (require HTTP server enabled):
- /api/v4/brokers - Broker health status
- /api/v4/nodes - Node status and connections
- /api/v4/metrics - CPU and memory metrics
- /api/v4/prometheus - Prometheus format metrics

All endpoints require Basic Auth (default: admin:public).

### Probe with Auth Header

```yaml
livenessProbe:
  httpGet:
    path: /api/v4/brokers
    port: 8081
    httpHeaders:
    - name: Authorization
      value: Basic YWRtaW46cHVibGlj
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/v4/brokers
    port: 8081
    httpHeaders:
    - name: Authorization
      value: Basic YWRtaW46cHVibGlj
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Prometheus Monitoring

Enable metrics scraping with service annotations:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nanomq
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8081"
    prometheus.io/path: "/api/v4/prometheus"
```

Available metrics:
- nanomq_connections_count - Current connections
- nanomq_sessions_count - Active sessions
- nanomq_topics_count - Topic count
- nanomq_subscribers_count - Subscriber count
- nanomq_messages_received - Messages received
- nanomq_messages_sent - Messages sent
- nanomq_messages_dropped - Messages dropped
- nanomq_memory_usage - Memory usage (bytes)
- nanomq_cpu_usage - CPU usage (%)

## Resource Sizing

### Small (< 1000 connections)

```yaml
resources:
  requests:
    memory: "64Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"
```

### Medium (1000-10000 connections)

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "2000m"
```

### Large (> 10000 connections)

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "1000m"
  limits:
    memory: "2Gi"
    cpu: "4000m"
```

## Performance Tuning

Match thread configuration to available CPU cores:

```hocon
system {
    num_taskq_thread = <CPU_CORES>
    max_taskq_thread = <CPU_CORES>
    parallel = <CPU_CORES * 2>
}

mqtt {
    session.msq_len = 65535
}
```

## Security Best Practices

1. Disable anonymous access: NANOMQ_ALLOW_ANONYMOUS=false
2. Use TLS for MQTT (requires slim or full image)
3. Store credentials in Kubernetes Secrets
4. Enable Network Policies to restrict traffic
5. Change default HTTP API credentials

## High Availability

NanoMQ does not have built-in clustering. For HA:
- Deploy multiple replicas behind LoadBalancer
- Use external message persistence
- Use MQTT bridging to central broker for message durability

## References

- Official Documentation: https://nanomq.io/docs/en/latest/
- Docker Hub: https://hub.docker.com/r/emqx/nanomq
- GitHub: https://github.com/nanomq/nanomq
- HTTP API: https://nanomq.io/docs/en/latest/api/v4.html
