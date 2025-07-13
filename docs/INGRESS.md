# Ingress Module

The ingress module provides a complete ingress solution for Kubernetes clusters, combining load balancing, ingress control, DNS management, and certificate automation in a single, configurable package.

## Purpose

The ingress module handles the complete flow from external traffic to internal services by orchestrating multiple infrastructure components through a unified interface.

## Core Components

### Load Balancer
- **MetalLB**: Provides load balancer functionality for bare-metal clusters
- **IP Address Pools**: Configurable IP ranges for different network segments
- **L2 Advertisements**: VLAN-aware advertisements with node selectors

### Ingress Controller
- **Traefik**: HTTP reverse proxy and load balancer with dashboard support
- **Ingress Classes**: Configurable ingress class management
- **Service Configuration**: Flexible service types and load balancer IP assignment

### DNS Management
- **ExternalDNS**: Automatic DNS record creation and management
- **Multiple Providers**: Support for Cloudflare, RouterOS, AdGuard Home, and webhook providers
- **Domain Filtering**: Provider-specific domain handling

### Certificate Management
- **cert-manager**: Automated X.509 certificate management
- **ClusterIssuers**: Let's Encrypt integration with production and staging environments
- **DNS01 Challenges**: DNS-based certificate validation for wildcard certificates
- **Default Certificates**: Cluster-wide certificate management

## Usage

The ingress module is typically deployed as a single stack:

```typescript
import { IngressModule, LoadBalancerImplementation, IngressControllerImplementation } from "../modules/ingress";

const ingress = new IngressModule("cluster-ingress", {
  namespace: "ingress-system",
  loadBalancer: LoadBalancerImplementation.METAL_LB,
  ingressController: IngressControllerImplementation.TRAEFIK,
  // ... configuration
});
```

## What Belongs Here

### Core Functionality
- Load balancers and IP address management
- Ingress controllers and HTTP routing
- DNS integration and record management
- Certificate provisioning and renewal
- Traffic routing and path-based routing

### Network Integration
- VLAN support and network segmentation
- External load balancer integration
- Service mesh gateway integration

### Security Features
- Certificate automation and TLS termination
- Authentication and authorization integration
- Rate limiting and traffic shaping