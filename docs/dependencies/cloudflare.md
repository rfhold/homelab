# Cloudflare Dependencies Documentation

This homelab project integrates Cloudflare primarily for DNS management and SSL certificate automation. The implementation follows Cloudflare's recommended practices for API token security and Kubernetes integration.

## Core Cloudflare Services Used

### DNS Management
- **Domains**: rholden.dev, rholden.me, holdenitdown.net
- **Provider**: ExternalDNS with Cloudflare API integration
- **Zone Management**: Automated DNS record creation/deletion for Kubernetes services

### SSL Certificate Automation
- **Certificate Authority**: Let's Encrypt (Production & Staging)
- **Challenge Type**: DNS-01 validation via Cloudflare API
- **Management**: cert-manager with Cloudflare DNS solver

### API Token Management
- **Token Type**: Scoped API tokens with minimal permissions
- **Permissions**: Zone Read, DNS Read, DNS Write
- **Security**: Tokens stored as Kubernetes secrets

## API Token Permissions Configuration

Based on Cloudflare's API token permissions documentation, the homelab uses the following permission groups:

```typescript
// DNS Management Token Permissions
{
  "effect": "allow",
  "permissionGroups": [
    {
      "id": "c8fed203ed3043cba015a93ad1616f1f" // Zone Read
    },
    {
      "id": "82e64a83756745bbbb1c9c2701bf816b" // DNS Read  
    },
    {
      "id": "4755a26eedb94da69e1066d98aa820be" // DNS Write
    }
  ],
  "resources": {
    "com.cloudflare.api.account.*": "*"
  }
}
```

This follows the principle of least privilege, granting only the permissions necessary for DNS management operations.

## Domain Configuration

### External DNS Domains
- Primary: `rholden.dev`, `*.rholden.dev`
- Secondary: `rholden.me`, `*.rholden.me`  
- Internal: `holdenitdown.net`, `*.holdenitdown.net` (managed via AdGuard)

### Default Certificate Coverage
- Wildcard certificates for all domains
- Automatic renewal via cert-manager
- 90-day certificate lifetime with 15-day renewal window

## Implementation Architecture

### Component Structure

#### Cloudflare API Token Component
```typescript
export class CloudflareApiToken extends pulumi.ComponentResource {
  public readonly token: cloudflare.ApiToken;
  public readonly value: pulumi.Output<string>;
  
  constructor(name: string, args: CloudflareApiTokenArgs, opts?: pulumi.ComponentResourceOptions) {
    // Creates scoped API tokens with DNS permissions
    this.token = new cloudflare.ApiToken(`${name}-token`, {
      name: args.name || `${name} Token`,
      policies: policies,
      status: "active",
    });
  }
}
```

#### ExternalDNS Integration
```typescript
// Cloudflare provider configuration
env: [
  {
    name: "CF_API_TOKEN",
    value: args.cloudflare.apiToken,
  },
],
provider: {
  name: "cloudflare",
}
```

#### Certificate Management
```typescript
// DNS-01 solver with Cloudflare
const cloudflareSolver: any = {
  dns01: {
    cloudflare: {
      apiTokenSecretRef: {
        name: apiTokenSecret.metadata.name,
        key: "api-token",
      },
    },
  },
};
```

### Multi-Cluster Configuration

#### Pantheon Cluster
```yaml
ingress:dnsProviders:
  - provider: "cloudflare"
    domainFilters: ["rholden.dev", "*.rholden.dev", "rholden.me", "*.rholden.me"]
  - provider: "adguard"
    domainFilters: ["holdenitdown.net", "*.holdenitdown.net"]
```

#### Romulus Cluster
- Identical Cloudflare configuration
- Different IP address pools for VLAN segmentation
- Same domain management approach

### Deployment Workflow

#### Token Creation
```typescript
const cloudflareToken = new CloudflareApiToken("ingress-dns", {
  usage: CloudflareTokenUsage.DNS,
  zones: ["rholden.dev", "rholden.me", "holdenitdown.net"],
  name: "Ingress DNS Management Token",
});
```

#### DNS Provider Configuration
```typescript
const dnsProviders = (dnsProvidersConfig as any[]).map((provider: any) => {
  if (provider.provider === "cloudflare") {
    return {
      provider: "cloudflare",
      domainFilters: provider.domainFilters,
      cloudflare: {
        apiToken: cloudflareToken.value,
      },
    };
  }
});
```

#### Certificate Issuer Setup
```typescript
const clusterIssuers = (clusterIssuersConfig as any[]).map((issuer: any) => {
  return {
    name: issuer.name,
    implementation: issuer.implementation,
    email: config.require(issuer.emailConfig),
    dns01: {
      cloudflare: {
        apiToken: cloudflareToken.value,
      },
    },
  };
});
```

## Integration Points

### Traefik Ingress Controller
- Service type: LoadBalancer with MetalLB
- Default TLS certificate from Cloudflare-managed domains
- Automatic HTTP→HTTPS redirection

### ExternalDNS Sources
- Gateway HTTPRoute, GRPCRoute, TCPRoute, TLSRoute, UDPRoute
- Ingress resources
- Service resources
- TXT record ownership with cluster identifier

### Certificate Lifecycle
- Automatic certificate creation for new Ingress/Gateway resources
- DNS-01 challenge validation via Cloudflare API
- Certificate renewal 15 days before expiry

## Best Practices and Patterns

### Security Considerations

#### API Token Security
- Use scoped tokens instead of global API keys
- Store tokens as Kubernetes secrets, not in configuration files
- Implement token rotation policies
- Monitor token usage via Cloudflare audit logs

#### Network Security
- No direct port exposure to internet
- Cloudflare provides DDoS protection by default
- SSL/TLS termination at Cloudflare edge
- Origin server protection through Cloudflare proxy

### Common Homelab Patterns

#### Multi-Provider DNS Strategy
```yaml
# External domains via Cloudflare (public internet)
- provider: "cloudflare"
  domainFilters: ["rholden.dev", "*.rholden.dev"]

# Internal domains via AdGuard (local network)  
- provider: "adguard"
  domainFilters: ["holdenitdown.net", "*.holdenitdown.net"]
```

#### Certificate Management
- Production and staging Let's Encrypt issuers
- Wildcard certificates for subdomain flexibility
- Default certificate for TLS termination

#### Load Balancer Integration
- MetalLB for internal load balancing
- Cloudflare as external load balancer/reverse proxy
- IP address pools per VLAN for network segmentation

### Performance Optimizations

#### DNS Propagation
- ExternalDNS monitors Kubernetes resources continuously
- Immediate DNS record creation/deletion
- TTL optimization for rapid updates

#### Certificate Performance
- DNS-01 challenges avoid port opening requirements
- Wildcard certificates reduce certificate count
- Automated renewal prevents service interruption

### Monitoring and Observability

#### Service Monitoring
- ExternalDNS service monitoring via Prometheus
- Certificate expiry monitoring
- DNS record synchronization status

#### Troubleshooting Patterns
- Check ExternalDNS logs for DNS update failures
- Verify Cloudflare API token permissions
- Monitor cert-manager certificate status
- Validate DNS propagation timing

### Cost Management

#### Free Tier Optimization
- Cloudflare Free tier provides sufficient features for homelab
- No additional costs for DNS management
- Let's Encrypt certificates are free
- ExternalDNS is open-source

#### Resource Usage
- Minimal API calls (only on resource changes)
- Efficient certificate renewal scheduling
- Low resource footprint for DNS management components

