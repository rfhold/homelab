# Cloudflare Tunnel Kubernetes Integration

## Overview

Cloudflare Tunnel provides secure connectivity between Kubernetes clusters and Cloudflare's network without requiring public IP addresses. The tunnel creates outbound-only connections, eliminating the need for inbound firewall rules while providing DDoS protection, SSL termination, and caching for all traffic.

The cloudflared daemon establishes 4 connections to 2 data centers for redundancy. Multiple deployment approaches exist, from simple token-based setups to advanced ingress controller integration.

## Key Concepts

### Terminology

- Tunnel: A secure pathway identified by UUID and name
- Connector (cloudflared): The daemon that establishes tunnel connections
- Replica: Multiple cloudflared instances running for high availability
- Remotely-managed: Configuration stored in Cloudflare dashboard
- Locally-managed: Configuration stored in local files or Kubernetes ConfigMaps

### Management Types

Two primary management approaches exist:

1. Remotely-managed (Recommended for Kubernetes): Configuration in Cloudflare dashboard, only tunnel token needed in cluster
2. Locally-managed: Configuration in ConfigMaps, provides fine-grained control

## Deployment Methods

### 1. Remotely-Managed Deployment

The simplest approach with configuration managed through the Cloudflare dashboard. Only the tunnel token is needed in the cluster.

Best for: Simple setups, quick deployment, getting started

#### Setup Steps

Create the tunnel in Cloudflare dashboard:

```
Zero Trust → Networks → Tunnels → Create Tunnel
```

Copy the tunnel token, then create the Kubernetes resources:

```bash
kubectl create namespace cloudflare

kubectl create secret generic cloudflare-tunnel-token \
  --from-literal=token="<your-token>" \
  -n cloudflare
```

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: cloudflare
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --no-autoupdate
        - --metrics
        - 0.0.0.0:2000
        - run
        - --token
        - $(TUNNEL_TOKEN)
        env:
        - name: TUNNEL_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-tunnel-token
              key: token
        livenessProbe:
          httpGet:
            path: /ready
            port: 2000
          failureThreshold: 1
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
```

#### Route Configuration

Configure routes in the Cloudflare dashboard:

```
Navigate to tunnel → Configure → Public Hostnames → Add route
```

Example route configuration:

```
Hostname: app.example.com
Service: http://service-name.namespace.svc.cluster.local:80
```

### 2. DaemonSet Pattern

Deploy one tunnel pod per node for automatic high availability that scales with cluster growth.

Best for: Production clusters, homelabs, automatic HA

Use the same manifest as the remotely-managed deployment, but change the resource type:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: cloudflared
  namespace: cloudflare
spec:
  selector:
    matchLabels:
      app: cloudflared
  template:
    # Same template as Deployment above
```

#### Benefits

- Automatic tunnel pod on every node
- Traffic continues if individual nodes fail
- No manual replica count management
- Scales automatically as nodes are added

### 3. Ingress Controller

Automatically creates tunnels from Ingress resources and manages DNS records.

Best for: Many services, GitOps workflows, native Kubernetes integration

#### Installation

```bash
helm repo add strrl.dev https://helm.strrl.dev

helm install cloudflare-tunnel-ingress-controller \
  strrl.dev/cloudflare-tunnel-ingress-controller \
  -n cloudflare-tunnel-ingress-controller \
  --create-namespace \
  --set cloudflare.apiToken="<api-token>" \
  --set cloudflare.accountId="<account-id>" \
  --set cloudflare.tunnelName="<tunnel-name>"
```

#### API Token Permissions

The API token requires these permissions:

- Zone:Zone:Read
- Zone:DNS:Edit
- Account:Cloudflare Tunnel:Edit

#### Ingress Example

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-app
  namespace: apps
spec:
  ingressClassName: cloudflare-tunnel
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80
```

The controller automatically creates the tunnel route and DNS record.

### 4. Locally-Managed with ConfigMap

Provides maximum control with complex routing rules and path-based routing.

Best for: Advanced routing requirements, fine-grained control

#### Initial Setup

```bash
cloudflared tunnel login
cloudflared tunnel create k8s-tunnel
```

Create the Kubernetes secret with tunnel credentials:

```bash
kubectl create secret generic tunnel-credentials \
  --from-file=credentials.json=/path/to/.cloudflared/<tunnel-id>.json \
  -n cloudflare
```

#### Configuration ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudflared-config
  namespace: cloudflare
data:
  config.yaml: |
    tunnel: k8s-tunnel
    credentials-file: /etc/cloudflared/creds/credentials.json
    metrics: 0.0.0.0:2000
    no-autoupdate: true
    
    ingress:
      - hostname: app.example.com
        service: http://app-service.apps.svc.cluster.local:80
        originRequest:
          noTLSVerify: true
      
      - hostname: api.example.com
        path: /v1/*
        service: http://api-service.apps.svc.cluster.local:8080
      
      - service: http_status:404
```

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: cloudflare
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --config
        - /etc/cloudflared/config/config.yaml
        - run
        volumeMounts:
        - name: config
          mountPath: /etc/cloudflared/config
          readOnly: true
        - name: creds
          mountPath: /etc/cloudflared/creds
          readOnly: true
        livenessProbe:
          httpGet:
            path: /ready
            port: 2000
          failureThreshold: 1
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
      volumes:
      - name: config
        configMap:
          name: cloudflared-config
      - name: creds
        secret:
          secretName: tunnel-credentials
```

#### DNS Configuration

Configure DNS records for the tunnel:

```bash
cloudflared tunnel route dns k8s-tunnel app.example.com
cloudflared tunnel route dns k8s-tunnel api.example.com
```

## Authentication Options

Cloudflare Access provides an authentication layer for tunneled services.

### Authentication Methods

1. Public Exposure: No Access policy applied
2. Email-based: Allow specific email addresses or domains
3. SSO Integration: Okta, Azure AD, Google Workspace, GitHub
4. Service Tokens: Machine-to-machine authentication
5. Device Posture: Require device compliance checks
6. Geo-blocking: Geographic access restrictions

### Setup Process

Configure Access policies in the Cloudflare dashboard:

```
Access → Applications → Add Application
```

Configuration options:

- Application name: Identify the protected application
- Application domain: The hostname to protect
- Policy: Select authentication method and rules

## Production Best Practices

### Health Monitoring

Configure health checks and metrics:

```yaml
livenessProbe:
  httpGet:
    path: /ready
    port: 2000
  failureThreshold: 1
  initialDelaySeconds: 10
  periodSeconds: 10
```

Enable Prometheus metrics scraping on port 2000. Monitor the `cloudflared_tunnel_connections_registered_total` metric to verify tunnel connectivity.

### Security

- Store tunnel tokens in Kubernetes Secrets with etcd encryption enabled
- Never commit tokens or credentials to Git repositories
- Use proper TLS verification in production environments
- Apply NetworkPolicies to restrict cloudflared pod egress traffic

### Scaling Recommendations

- Use fixed replica counts (2-3 replicas) or DaemonSet pattern
- Do NOT use HorizontalPodAutoscaler (breaks connections on scale-down)
- Use Cloudflare Load Balancer for traffic distribution across tunnels

### Resource Allocation

```yaml
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 256Mi
```

### Protocol Selection

The cloudflared daemon supports multiple protocols:

- Default: auto (QUIC with HTTP/2 fallback)
- Explicit HTTP/2: Use `--protocol http2` if UDP is blocked
- QUIC provides better performance when available

### Version Management

- Use specific image tags instead of `:latest`
- Always include `--no-autoupdate` flag in deployment
- Manage cloudflared versions through container image updates

## Comparison of Approaches

### Remotely-Managed Deployment

- Complexity: Low
- Best for: Simple setups, getting started
- Pros: Quick setup, dashboard configuration, minimal maintenance
- Cons: Less flexibility in routing rules

### DaemonSet Pattern

- Complexity: Low
- Best for: High availability, homelabs, automatic scaling
- Pros: Automatic HA, scales with node count, no replica management
- Cons: One pod per node may be overkill for small clusters

### Ingress Controller

- Complexity: Medium
- Best for: Many services, GitOps workflows, Kubernetes-native patterns
- Pros: Native K8s integration, automatic DNS management, declarative
- Cons: Additional dependency, requires API token management

### Locally-Managed

- Complexity: High
- Best for: Complex routing, advanced use cases, path-based routing
- Pros: Maximum flexibility, fine-grained control
- Cons: More maintenance overhead, manual DNS management

## Common Use Cases

### Internal Dashboard with SSO

Expose Kubernetes dashboard with authentication:

1. Create tunnel route to `kubernetes-dashboard.kubernetes-dashboard.svc.cluster.local:443`
2. Configure Cloudflare Access with Google OAuth provider
3. Add policy allowing specific email domain

### API Gateway with Service Tokens

Secure API access for machine-to-machine communication:

1. Route API subdomain to backend service
2. Configure Access policy with service token authentication
3. Distribute service token to authorized clients

### Multiple Environment Separation

Separate tunnels for different environments:

- Development: dev-tunnel with dev.example.com routes
- Staging: staging-tunnel with staging.example.com routes
- Production: prod-tunnel with example.com routes

### Private Network Access

Configure private network access via WARP client:

1. Configure private network routes in tunnel settings
2. Install WARP client on client devices
3. Access internal services without public exposure

## Quick Start Guide

Complete setup for a secure tunnel:

### Step 1: Create Tunnel

Create tunnel in Cloudflare dashboard:

```
Zero Trust → Networks → Tunnels → Create Tunnel
```

Copy the tunnel token.

### Step 2: Deploy to Kubernetes

```bash
kubectl create namespace cloudflare

kubectl create secret generic cloudflare-tunnel-token \
  --from-literal=token="<your-token>" \
  -n cloudflare
```

Apply the remotely-managed deployment manifest from section 1.

### Step 3: Configure Route

In Cloudflare dashboard:

```
Navigate to tunnel → Configure → Public Hostnames → Add route
```

Configuration:

```
Hostname: app.example.com
Service: http://my-service.default:80
```

### Step 4: Add Authentication (Optional)

```
Access → Applications → Add Application
- Name: My Application
- Domain: app.example.com
- Policy: Configure authentication method
```

### Step 5: Verify

```bash
kubectl get pods -n cloudflare
kubectl logs -n cloudflare -l app=cloudflared
curl https://app.example.com
```

## References

### Official Documentation

- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/
- Kubernetes Guide: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/
- Run Parameters: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/
- Access Applications: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/

### Open Source Projects

- Ingress Controller: https://github.com/STRRL/cloudflare-tunnel-ingress-controller
- Examples Repository: https://github.com/cloudflare/argo-tunnel-examples
