# kgateway - Kubernetes Gateway API Implementation

## Table of Contents
- [Overview](#overview)
- [What is kgateway?](#what-is-kgateway)
- [Key Features and Capabilities](#key-features-and-capabilities)
- [kgateway vs Other Gateway Solutions](#kgateway-vs-other-gateway-solutions)
- [Installation](#installation)
- [Basic Configuration and Setup](#basic-configuration-and-setup)
- [Common Use Cases and Examples](#common-use-cases-and-examples)
- [Integration with Common Kubernetes Tools](#integration-with-common-kubernetes-tools)
- [Production Best Practices](#production-best-practices)
- [Homelab Integration Strategy](#homelab-integration-strategy)

## Overview

kgateway (formerly known as Gloo) is a cloud-native, Envoy-powered API Gateway that implements the Kubernetes Gateway API. It's a CNCF sandbox project that has been production-ready since 2019, making it one of the most mature and widely deployed Envoy-based gateways in the market.

## What is kgateway?

kgateway is a comprehensive gateway solution that serves multiple purposes:

- **Kubernetes Ingress Controller**: An advanced ingress/edge router powered by Envoy and programmed with the Gateway API
- **API Gateway**: Aggregates web APIs and applies functions like authentication, authorization, and rate limiting
- **AI Gateway**: Protects applications, models, and data when producing or consuming LLMs
- **Service Mesh Gateway**: Functions as a waypoint proxy for ambient mesh implementations
- **MCP Gateway**: Federates Model Context Protocol (MCP) tool servers into a single, scalable endpoint
- **Migration Engine**: Routes to backends implemented as microservices, serverless functions, or legacy apps

### Architecture

kgateway consists of two primary components:

1. **Control Plane**: Manages configuration and translates Gateway API resources into Envoy configuration
2. **Data Plane**: Envoy-based proxies that handle actual traffic routing and processing

The project supports multiple data plane implementations:
- **kgateway proxy**: For API gateway and general ingress use cases
- **agentgateway proxy**: For AI-specific use cases (MCP, A2A, LLM routing)

## Key Features and Capabilities

### Core Features

- **Gateway API Native**: Full implementation of the Kubernetes Gateway API specification
- **Multi-protocol Support**: HTTP/HTTPS, gRPC, TCP, UDP, and TLS passthrough
- **Advanced Routing**: Path-based, header-based, method-based, and query parameter routing
- **Traffic Management**: Load balancing, traffic splitting, retries, timeouts, and circuit breaking
- **Security**: CORS, CSRF, rate limiting, external auth, access logging, and TLS management
- **Transformations**: Request/response header manipulation, path rewrites, and body transformations
- **Observability**: Metrics, logs, and distributed tracing support

### AI Gateway Features

- **LLM Provider Integration**: Support for OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure, Mistral, and more
- **Prompt Guards**: Basic guardrails for prompt protection
- **Prompt Enrichment**: System-level prompt modification
- **Model Failover**: Automatic failover between models
- **Function Calling**: Support for tool/function invocation
- **AI Observability**: Specialized metrics and logging for AI workloads

### Advanced Features

- **Route Delegation**: Multi-level route management with policy inheritance
- **Dynamic Forward Proxy**: Route to external services without pre-configuration
- **AWS Lambda Integration**: Native support for serverless backends
- **External Processing (ExtProc)**: Integrate external services for request/response processing
- **Session Affinity**: Consistent hashing and session persistence

## kgateway vs Other Gateway Solutions

### Comparison Matrix

| Feature | kgateway | Istio Gateway | NGINX Ingress | Traefik | Kong | Contour |
|---------|----------|---------------|---------------|---------|------|---------|
| **Gateway API Support** | ✅ Full | ✅ Full | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ✅ Full |
| **Envoy-based** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **AI Gateway Features** | ✅ | ❌ | ❌ | ❌ | ⚠️ Limited | ❌ |
| **MCP Support** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Serverless Backends** | ✅ | ⚠️ | ❌ | ❌ | ✅ | ❌ |
| **Multi-cluster** | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| **Service Mesh Integration** | ✅ | ✅ Native | ❌ | ❌ | ⚠️ | ❌ |
| **CNCF Project** | ✅ Sandbox | ✅ Graduated | ❌ | ❌ | ❌ | ✅ Incubating |
| **Production Since** | 2019 | 2017 | 2015 | 2016 | 2014 | 2017 |

### Key Differentiators

1. **Comprehensive AI Support**: kgateway is the only gateway with native support for AI workloads, MCP, and agent-to-agent communication
2. **Flexible Architecture**: Supports both centralized gateway and distributed microgateway patterns
3. **Advanced Routing**: Superior route delegation and multi-tenant capabilities
4. **Hybrid Application Support**: Excellent for migrating from legacy to cloud-native architectures

## Installation

### Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Helm 3.x installed

### Quick Installation

```bash
# 1. Install Gateway API CRDs (choose one)
## Standard Installation
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/standard-install.yaml

## Experimental Installation (includes additional features)
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/experimental-install.yaml

# 2. Install kgateway CRDs
helm upgrade -i --create-namespace \
  --namespace kgateway-system \
  --version v2.1.0 \
  kgateway-crds \
  oci://cr.kgateway.dev/kgateway-dev/charts/kgateway-crds

# 3. Install kgateway control plane
helm upgrade -i \
  --namespace kgateway-system \
  --version v2.1.0 \
  kgateway \
  oci://cr.kgateway.dev/kgateway-dev/charts/kgateway

# 4. Verify installation
kubectl get pods -n kgateway-system
```

### Advanced Helm Installation

```bash
# Create values file
cat <<EOF > kgateway-values.yaml
kubeGateway:
  # Enable Gateway API features
  gatewayApi:
    enabled: true
  
  # Control plane settings
  deployment:
    replicas: 2
    resources:
      requests:
        memory: 256Mi
        cpu: 100m
      limits:
        memory: 512Mi
        cpu: 500m

# Gateway proxy settings
gatewayProxy:
  enabled: true
  kind: Deployment
  replicas: 3
  service:
    type: LoadBalancer
    httpPort: 80
    httpsPort: 443
  resources:
    requests:
      memory: 256Mi
      cpu: 100m
    limits:
      memory: 512Mi
      cpu: 1000m

# Observability
observability:
  enabled: true
  deployment:
    stats:
      enabled: true
      prometheusPort: 9091

# Integrations
integrations:
  certManager:
    enabled: true
  externalDns:
    enabled: true
EOF

# Install with custom values
helm upgrade -i \
  --namespace kgateway-system \
  --version v2.1.0 \
  -f kgateway-values.yaml \
  kgateway \
  oci://cr.kgateway.dev/kgateway-dev/charts/kgateway
```

### ArgoCD Installation

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kgateway
  namespace: argocd
spec:
  project: default
  source:
    repoURL: cr.kgateway.dev
    targetRevision: v2.1.0
    chart: kgateway-dev/charts/kgateway
    helm:
      values: |
        kubeGateway:
          gatewayApi:
            enabled: true
        gatewayProxy:
          enabled: true
          service:
            type: LoadBalancer
  destination:
    server: https://kubernetes.default.svc
    namespace: kgateway-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## Basic Configuration and Setup

### 1. Create a Gateway

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: kgateway-system
spec:
  gatewayClassName: kgateway
  listeners:
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: All
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: tls-secret
        kind: Secret
    allowedRoutes:
      namespaces:
        from: All
```

### 2. Create an HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
  namespace: default
spec:
  parentRefs:
  - name: main-gateway
    namespace: kgateway-system
  hostnames:
  - "example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-service
      port: 8080
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: web-service
      port: 80
```

### 3. Advanced HTTPRoute with Traffic Management

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: advanced-route
  namespace: default
spec:
  parentRefs:
  - name: main-gateway
    namespace: kgateway-system
  hostnames:
  - "app.example.com"
  rules:
  # Canary deployment with traffic split
  - matches:
    - path:
        type: PathPrefix
        value: /v2
    - headers:
      - name: x-canary
        value: "true"
    backendRefs:
    - name: app-v2
      port: 8080
      weight: 20
    - name: app-v1
      port: 8080
      weight: 80
  # Request modification
  - matches:
    - path:
        type: PathPrefix
        value: /legacy
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /api/v1
    - type: RequestHeaderModifier
      requestHeaderModifier:
        add:
        - name: X-Legacy-Request
          value: "true"
    backendRefs:
    - name: legacy-service
      port: 8080
```

## Common Use Cases and Examples

### 1. HTTPS with Automatic Certificate Management

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: https-gateway
  namespace: kgateway-system
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: kgateway
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "*.example.com"
    tls:
      mode: Terminate
      certificateRefs:
      - name: wildcard-cert
        kind: Secret
    allowedRoutes:
      namespaces:
        from: All
```

### 2. Rate Limiting Configuration

```yaml
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: RateLimitFilter
metadata:
  name: global-rate-limit
  namespace: kgateway-system
spec:
  type: Global
  global:
    rules:
    - clientSelectors:
      - headers:
        - name: x-api-key
          value: premium
      limit:
        requests: 1000
        unit: Hour
    - clientSelectors: []  # Default for all other requests
      limit:
        requests: 100
        unit: Hour
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: rate-limited-api
spec:
  parentRefs:
  - name: main-gateway
    namespace: kgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    filters:
    - type: ExtensionRef
      extensionRef:
        group: gateway.envoyproxy.io
        kind: RateLimitFilter
        name: global-rate-limit
    backendRefs:
    - name: api-service
      port: 8080
```

### 3. External Authentication

```yaml
apiVersion: gateway.solo.io/v1
kind: AuthConfig
metadata:
  name: oauth-config
  namespace: kgateway-system
spec:
  configs:
  - oauth2:
      accessTokenValidation:
        jwt:
          remoteJwks:
            url: https://auth.example.com/.well-known/jwks.json
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: protected-route
spec:
  parentRefs:
  - name: main-gateway
    namespace: kgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /protected
    filters:
    - type: ExtensionRef
      extensionRef:
        group: gateway.solo.io
        kind: AuthConfig
        name: oauth-config
    backendRefs:
    - name: protected-service
      port: 8080
```

### 4. AI Gateway Configuration

```yaml
apiVersion: gateway.solo.io/v1
kind: AIGateway
metadata:
  name: llm-gateway
  namespace: kgateway-system
spec:
  providers:
  - name: openai
    type: OpenAI
    apiKey:
      secretRef:
        name: openai-secret
        key: api-key
    models:
    - gpt-4
    - gpt-3.5-turbo
  - name: anthropic
    type: Anthropic
    apiKey:
      secretRef:
        name: anthropic-secret
        key: api-key
    models:
    - claude-3-opus
    - claude-3-sonnet
  
  promptGuards:
  - name: content-filter
    rules:
    - type: BlockList
      patterns:
      - "sensitive-data"
      - "confidential"
    - type: MaxTokens
      value: 4096
  
  promptEnrichment:
  - name: system-context
    template: |
      You are a helpful assistant. Current date: {{ .Date }}
      User organization: {{ .Headers.X-Org-Id }}
  
  routes:
  - match:
      path: /v1/chat/completions
    destination:
      provider: openai
      model: gpt-4
      failover:
      - provider: anthropic
        model: claude-3-opus
    guards:
    - content-filter
    enrichment:
    - system-context
```

### 5. Dynamic Forward Proxy

```yaml
apiVersion: gateway.solo.io/v1
kind: DynamicForwardProxy
metadata:
  name: external-apis
  namespace: kgateway-system
spec:
  allowedHosts:
  - "api.github.com"
  - "api.stripe.com"
  - "*.googleapis.com"
  dnsCache:
    dnsRefreshRate: 60s
    maxHosts: 100
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: proxy-route
spec:
  parentRefs:
  - name: main-gateway
    namespace: kgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /external
    filters:
    - type: ExtensionRef
      extensionRef:
        group: gateway.solo.io
        kind: DynamicForwardProxy
        name: external-apis
```

## Integration with Common Kubernetes Tools

### cert-manager Integration

```yaml
# ClusterIssuer for Let's Encrypt
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        gatewayHTTPRoute:
          parentRefs:
          - name: main-gateway
            namespace: kgateway-system
            kind: Gateway

---
# Certificate resource
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-cert
  namespace: kgateway-system
spec:
  secretName: example-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - example.com
  - "*.example.com"
```

### external-dns Integration

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
  namespace: kgateway-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get","watch","list"]
- apiGroups: ["gateway.networking.k8s.io"]
  resources: ["gateways","httproutes","grpcroutes","tlsroutes","tcproutes","udproutes"] 
  verbs: ["get","watch","list"]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
  namespace: kgateway-system
spec:
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.14.0
        args:
        - --source=gateway-httproute
        - --provider=cloudflare
        - --cloudflare-proxied
        - --txt-owner-id=kgateway
        env:
        - name: CF_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-api-token
              key: apiToken
```

### Prometheus Integration

```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: kgateway-metrics
  namespace: kgateway-system
spec:
  selector:
    matchLabels:
      app: kgateway
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
---
# Grafana Dashboard ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: kgateway-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "kgateway Metrics",
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "rate(envoy_http_downstream_rq_total[5m])"
              }
            ]
          },
          {
            "title": "Response Time P99",
            "targets": [
              {
                "expr": "histogram_quantile(0.99, rate(envoy_http_downstream_rq_time_bucket[5m]))"
              }
            ]
          },
          {
            "title": "Error Rate",
            "targets": [
              {
                "expr": "rate(envoy_http_downstream_rq_xx{response_code_class=\"5\"}[5m])"
              }
            ]
          }
        ]
      }
    }
```

### Istio Ambient Mesh Integration

```yaml
# Use kgateway as a waypoint proxy
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    istio.io/use-waypoint: kgateway-waypoint
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: kgateway-waypoint
  namespace: production
  annotations:
    istio.io/waypoint-for: service
spec:
  gatewayClassName: kgateway
  listeners:
  - name: mesh
    protocol: HBONE
    port: 15008
    allowedRoutes:
      namespaces:
        from: Same
```

## Production Best Practices

### 1. High Availability Configuration

```yaml
# Control Plane HA
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kgateway
  namespace: kgateway-system
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: kgateway
            topologyKey: kubernetes.io/hostname
      containers:
      - name: kgateway
        resources:
          requests:
            memory: 512Mi
            cpu: 250m
          limits:
            memory: 1Gi
            cpu: 1000m
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 2. Gateway Proxy Auto-scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-proxy-hpa
  namespace: kgateway-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway-proxy
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: envoy_http_downstream_rq_active
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### 3. Security Hardening

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: hardened-gateway
  namespace: kgateway-system
spec:
  gatewayClassName: kgateway
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: api.example.com
    tls:
      mode: Terminate
      certificateRefs:
      - name: api-cert
      options:
        gateway.networking.k8s.io/TLSMinimumVersion: "1.3"
        gateway.networking.k8s.io/TLSCipherSuites:
        - TLS_AES_256_GCM_SHA384
        - TLS_AES_128_GCM_SHA256
        - TLS_CHACHA20_POLY1305_SHA256
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            gateway-access: "true"
---
# Network Policy for gateway namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kgateway-network-policy
  namespace: kgateway-system
spec:
  podSelector:
    matchLabels:
      app: kgateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kgateway-system
    - podSelector:
        matchLabels:
          app: gateway-proxy
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
    ports:
    - protocol: TCP
      port: 443
```

### 4. Observability Stack

```yaml
# OpenTelemetry Collector for traces
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: kgateway-system
data:
  otel-config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024
      resource:
        attributes:
        - key: gateway.cluster
          value: production
          action: insert
    exporters:
      prometheus:
        endpoint: "0.0.0.0:8889"
      jaeger:
        endpoint: jaeger-collector.observability:14250
        tls:
          insecure: false
    service:
      pipelines:
        metrics:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [prometheus]
        traces:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [jaeger]
---
# Gateway with observability enabled
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: observable-gateway
  namespace: kgateway-system
  annotations:
    gateway.envoyproxy.io/enable-telemetry: "true"
    gateway.envoyproxy.io/telemetry-endpoint: "otel-collector.kgateway-system:4317"
spec:
  gatewayClassName: kgateway
  listeners:
  - name: http
    protocol: HTTP
    port: 80
```

### 5. Backup and Disaster Recovery

```yaml
# Velero backup schedule for kgateway resources
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: kgateway-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  template:
    includedNamespaces:
    - kgateway-system
    includedResources:
    - gateways
    - httproutes
    - grpcroutes
    - tcproutes
    - tlsroutes
    - secrets
    - configmaps
    ttl: 720h  # 30 days retention
    storageLocation: default
    volumeSnapshotLocations:
    - default
```

## Homelab Integration Strategy

Based on your homelab infrastructure using Pulumi and existing Traefik setup, here's a migration and integration strategy for kgateway:

### 1. Pulumi Component for kgateway

```typescript
// src/components/kgateway.ts
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Namespace } from "@pulumi/kubernetes/core/v1";
import { Release } from "@pulumi/kubernetes/helm/v3";

export interface KgatewayConfig {
  namespace?: string;
  version?: string;
  gatewayClass?: string;
  service?: {
    type?: string;
    loadBalancerIP?: string;
    annotations?: { [key: string]: string };
  };
  proxy?: {
    replicas?: number;
    resources?: {
      requests?: { memory?: string; cpu?: string };
      limits?: { memory?: string; cpu?: string };
    };
  };
  integrations?: {
    certManager?: boolean;
    externalDns?: boolean;
    prometheus?: boolean;
  };
}

export class Kgateway extends pulumi.ComponentResource {
  public readonly namespace: Namespace;
  public readonly release: Release;
  public readonly gatewayClass: k8s.apiextensions.CustomResource;

  constructor(
    name: string,
    args: KgatewayConfig,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:kgateway:Kgateway", name, {}, opts);

    const config = {
      namespace: args.namespace || "kgateway-system",
      version: args.version || "v2.1.0",
      gatewayClass: args.gatewayClass || "kgateway",
      ...args,
    };

    // Create namespace
    this.namespace = new Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: config.namespace,
          labels: {
            "pod-security.kubernetes.io/enforce": "restricted",
            "pod-security.kubernetes.io/audit": "restricted",
            "pod-security.kubernetes.io/warn": "restricted",
          },
        },
      },
      { parent: this }
    );

    // Install Gateway API CRDs
    const gatewayApiCrds = new k8s.yaml.ConfigFile(
      `${name}-gateway-api-crds`,
      {
        file: "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.0/experimental-install.yaml",
      },
      { parent: this }
    );

    // Install kgateway CRDs
    const kgatewayCrds = new Release(
      `${name}-crds`,
      {
        chart: "kgateway-crds",
        version: config.version,
        namespace: config.namespace,
        repositoryOpts: {
          repo: "oci://cr.kgateway.dev/kgateway-dev/charts",
        },
      },
      { parent: this, dependsOn: [this.namespace, gatewayApiCrds] }
    );

    // Prepare Helm values
    const values = {
      kubeGateway: {
        gatewayApi: {
          enabled: true,
        },
        deployment: {
          replicas: 2,
          resources: {
            requests: { memory: "256Mi", cpu: "100m" },
            limits: { memory: "512Mi", cpu: "500m" },
          },
        },
      },
      gatewayProxy: {
        enabled: true,
        kind: "Deployment",
        replicas: args.proxy?.replicas || 2,
        service: {
          type: args.service?.type || "LoadBalancer",
          httpPort: 80,
          httpsPort: 443,
          loadBalancerIP: args.service?.loadBalancerIP,
          annotations: args.service?.annotations || {},
        },
        resources: args.proxy?.resources || {
          requests: { memory: "256Mi", cpu: "100m" },
          limits: { memory: "512Mi", cpu: "1000m" },
        },
      },
      observability: {
        enabled: args.integrations?.prometheus || false,
        deployment: {
          stats: {
            enabled: args.integrations?.prometheus || false,
            prometheusPort: 9091,
          },
        },
      },
      integrations: {
        certManager: {
          enabled: args.integrations?.certManager || false,
        },
        externalDns: {
          enabled: args.integrations?.externalDns || false,
        },
      },
    };

    // Install kgateway
    this.release = new Release(
      `${name}-release`,
      {
        chart: "kgateway",
        version: config.version,
        namespace: config.namespace,
        repositoryOpts: {
          repo: "oci://cr.kgateway.dev/kgateway-dev/charts",
        },
        values: values,
      },
      { parent: this, dependsOn: [kgatewayCrds] }
    );

    // Create GatewayClass
    this.gatewayClass = new k8s.apiextensions.CustomResource(
      `${name}-gateway-class`,
      {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "GatewayClass",
        metadata: {
          name: config.gatewayClass,
        },
        spec: {
          controllerName: "solo.io/kgateway",
          parametersRef: {
            group: "gateway.solo.io",
            kind: "GatewayParameters",
            name: "default",
            namespace: config.namespace,
          },
        },
      },
      { parent: this, dependsOn: [this.release] }
    );

    this.registerOutputs({
      namespace: this.namespace.metadata.name,
      gatewayClass: this.gatewayClass.metadata.name,
    });
  }
}
```

### 2. Migration Module from Traefik

```typescript
// src/modules/kgateway-ingress.ts
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Kgateway } from "../components/kgateway";
import { MetalLb } from "../components/metal-lb";
import { ExternalDns } from "../components/external-dns";
import { CertManager } from "../components/cert-manager";

export interface KgatewayIngressConfig {
  namespace: string;
  ipAddressPools: any[];
  dnsProviders: any[];
  clusterIssuers: any[];
  defaultCertificate?: any;
  enableAIGateway?: boolean;
}

export class KgatewayIngressModule extends pulumi.ComponentResource {
  public readonly kgateway: Kgateway;
  public readonly gateway: k8s.apiextensions.CustomResource;

  constructor(
    name: string,
    args: KgatewayIngressConfig,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:modules:KgatewayIngress", name, {}, opts);

    // Deploy kgateway
    this.kgateway = new Kgateway(
      `${name}-kgateway`,
      {
        namespace: args.namespace,
        service: {
          type: "LoadBalancer",
          annotations: {
            "metallb.universe.tf/loadBalancerIPs": args.ipAddressPools[0].addresses[0].split("/")[0],
          },
        },
        integrations: {
          certManager: true,
          externalDns: true,
          prometheus: true,
        },
      },
      { parent: this }
    );

    // Create main Gateway
    this.gateway = new k8s.apiextensions.CustomResource(
      `${name}-gateway`,
      {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "Gateway",
        metadata: {
          name: "main",
          namespace: args.namespace,
          annotations: {
            "cert-manager.io/cluster-issuer": args.clusterIssuers[0].name,
          },
        },
        spec: {
          gatewayClassName: "kgateway",
          listeners: [
            {
              name: "http",
              protocol: "HTTP",
              port: 80,
              allowedRoutes: {
                namespaces: { from: "All" },
              },
            },
            {
              name: "https",
              protocol: "HTTPS",
              port: 443,
              tls: {
                mode: "Terminate",
                certificateRefs: args.defaultCertificate ? [
                  {
                    name: args.defaultCertificate.secretName,
                    kind: "Secret",
                  },
                ] : [],
              },
              allowedRoutes: {
                namespaces: { from: "All" },
              },
            },
          ],
        },
      },
      { parent: this, dependsOn: [this.kgateway] }
    );

    // Optional: Create AI Gateway if enabled
    if (args.enableAIGateway) {
      new k8s.apiextensions.CustomResource(
        `${name}-ai-gateway`,
        {
          apiVersion: "gateway.solo.io/v1",
          kind: "AIGateway",
          metadata: {
            name: "ai",
            namespace: args.namespace,
          },
          spec: {
            listeners: [
              {
                name: "ai",
                protocol: "HTTP",
                port: 8080,
                hostname: "ai.local",
              },
            ],
            providers: [
              {
                name: "ollama",
                type: "Ollama",
                endpoint: "http://ollama.ai-workspace:11434",
              },
            ],
          },
        },
        { parent: this, dependsOn: [this.gateway] }
      );
    }

    this.registerOutputs({
      gatewayName: this.gateway.metadata.name,
      gatewayNamespace: this.gateway.metadata.namespace,
    });
  }
}
```

### 3. Progressive Migration Strategy

#### Phase 1: Parallel Deployment
1. Deploy kgateway alongside existing Traefik
2. Use different IP addresses from MetalLB pool
3. Test with non-critical services

#### Phase 2: Service Migration
1. Migrate services one by one
2. Start with stateless, simple services
3. Update DNS records progressively

#### Phase 3: Feature Adoption
1. Implement AI Gateway features for LLM workloads
2. Add advanced routing and transformation rules
3. Integrate with existing observability stack

#### Phase 4: Complete Migration
1. Migrate critical services
2. Decommission Traefik
3. Consolidate IP addresses

### 4. Example Migration for a Service

```typescript
// programs/ingress/index.ts - Modified to support dual-gateway
import { KgatewayIngressModule } from "../../src/modules/kgateway-ingress";

// Deploy kgateway in parallel with Traefik
const kgatewayIngress = new KgatewayIngressModule("kgateway-ingress", {
  namespace: "kgateway-system",
  ipAddressPools: [
    {
      name: "kgateway-pool",
      addresses: ["192.168.1.150-192.168.1.155"],
    },
  ],
  dnsProviders: dnsProviders,
  clusterIssuers: clusterIssuers,
  defaultCertificate: defaultCertificateConfig,
  enableAIGateway: true,
});

// Create HTTPRoute for migrated service
const migratedRoute = new k8s.apiextensions.CustomResource("whoami-kgateway-route", {
  apiVersion: "gateway.networking.k8s.io/v1",
  kind: "HTTPRoute",
  metadata: {
    name: "whoami",
    namespace: "default",
  },
  spec: {
    parentRefs: [
      {
        name: "main",
        namespace: "kgateway-system",
      },
    ],
    hostnames: ["whoami.example.com"],
    rules: [
      {
        backendRefs: [
          {
            name: "whoami",
            port: 80,
          },
        ],
      },
    ],
  },
}, { dependsOn: [kgatewayIngress] });
```

### 5. Integration with Existing AI Workspaces

```yaml
# Route vLLM through kgateway
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: vllm-route
  namespace: ai-workspace
spec:
  parentRefs:
  - name: main
    namespace: kgateway-system
  hostnames:
  - "llm.homelab.local"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v1
    backendRefs:
    - name: vllm-service
      port: 8000
---
# AI Gateway configuration for prompt protection
apiVersion: gateway.solo.io/v1
kind: PromptGuard
metadata:
  name: vllm-guard
  namespace: ai-workspace
spec:
  rules:
  - type: MaxTokens
    value: 8192
  - type: ContentFilter
    filters:
    - type: PII
      action: Block
  - type: RateLimiting
    requests: 100
    unit: Hour
    per: User
```

## Integration with cert-manager and external-dns

### cert-manager Configuration

To enable cert-manager to work with kgateway's Gateway API resources:

1. **Enable Gateway API Support**: cert-manager must be deployed with the `--feature-gates=ExperimentalGatewayAPISupport=true` flag
2. **Use DNS-01 Challenge**: Configure ClusterIssuer to use DNS-01 challenge with Cloudflare
3. **Annotate Gateway**: Add `cert-manager.io/cluster-issuer` annotation to Gateway resource

The cert-manager component automatically enables Gateway API support with the following configuration:

```typescript
extraArgs: [
  "--feature-gates=ExperimentalGatewayAPISupport=true",
]
```

### external-dns Configuration

To enable external-dns to watch Gateway API resources:

1. **Configure Sources**: Add Gateway API sources to external-dns configuration
2. **DNS Provider**: Use Cloudflare provider with API token for DNS management

The external-dns component automatically includes Gateway API sources:

```typescript
sources: [
  "gateway-httproute",
  "gateway-grpcroute",
  "gateway-tcproute",
  "gateway-tlsroute",
  "gateway-udproute",
  "ingress",
  "service",
]
```

### ClusterIssuer with DNS-01

The ClusterIssuer component supports DNS-01 challenge with Cloudflare:

```typescript
{
  name: "letsencrypt-prod",
  implementation: ClusterIssuerImplementation.LETSENCRYPT_PROD,
  email: "admin@example.com",
  dns01: {
    cloudflare: {
      apiToken: "your-cloudflare-api-token",
    },
  },
}
```

### Gateway with cert-manager Integration

When creating a Gateway with automatic certificate management:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: default
  namespace: kgateway-system
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: kgateway
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "*.example.com"
    tls:
      mode: Terminate
      certificateRefs:
      - name: example-tls
        kind: Secret
```

cert-manager will automatically create a Certificate resource and manage the TLS secret for the Gateway.

### HTTPRoute with DNS Management

external-dns automatically creates DNS records for HTTPRoute resources:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
  namespace: default
spec:
  parentRefs:
  - name: default
    namespace: kgateway-system
  hostnames:
  - "app.example.com"
  rules:
  - backendRefs:
    - name: app-service
      port: 8080
```

external-dns will create an A record for `app.example.com` pointing to the Gateway's load balancer IP.

## Summary

kgateway offers a powerful, feature-rich alternative to traditional ingress controllers with unique capabilities for AI workloads. For your homelab:

**Advantages:**
- Native Gateway API support (future-proof)
- Comprehensive AI Gateway features
- Better suited for LLM/AI workloads
- Advanced routing and transformation capabilities
- Strong service mesh integration potential
- Works seamlessly with cert-manager and external-dns

**Considerations:**
- More complex than Traefik for basic use cases
- Newer project (though based on mature Gloo)
- Requires migration effort from existing Traefik setup

**Recommendation:**
Consider a phased approach where kgateway is initially deployed for AI/LLM workloads while maintaining Traefik for traditional services. This allows you to leverage kgateway's strengths without disrupting existing services.