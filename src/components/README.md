# Components

This directory contains Pulumi ComponentResource classes that encapsulate infrastructure components for the homelab. Each component provides a high-level abstraction over one or more Pulumi resources.

## Component Structure

All components follow a consistent structure:

### 1. **ComponentResource Class**
- Extends `pulumi.ComponentResource`
- Uses the resource type pattern: `"homelab:components:ComponentName"`
- Encapsulates related infrastructure resources
- Exposes key resources as `public readonly` properties

### 2. **Configuration Interface**
- Named with `Args` suffix (e.g., `MetalLbArgs`)
- Contains typed configuration options
- Uses `pulumi.Input<T>` for all inputs to support Pulumi outputs

### 3. **Helm Chart Integration**
- Uses centralized chart configuration from `../helm-charts.ts`
- Leverages `k8s.helm.v4.Chart` for Helm deployments
- References chart configs via `HELM_CHARTS.COMPONENT_NAME`
- Uses `createHelmChartArgs()` helper for proper OCI chart handling

## Naming Conventions

### **Resource Types**
```typescript
super("homelab:components:ComponentName", name, args, opts);
```
- Namespace: `homelab`
- Category: `components`
- Component: PascalCase component name

### **Class Names**
- PascalCase (e.g., `MetalLb`, `CertManager`, `ExternalDns`)
- Match the component name in the resource type

### **Configuration Interfaces**
- Component name + `Args` suffix
- Example: `MetalLbArgs`, `CertManagerArgs`

### **File Names**
- kebab-case matching the component concept
- Examples: `metal-lb.ts`, `cert-manager.ts`, `external-dns.ts`

## Example Component

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface ExampleComponentArgs {
  namespace: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
}

export class ExampleComponent extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: ExampleComponentArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ExampleComponent", name, args, opts);

    const chartConfig = HELM_CHARTS.EXAMPLE_CHART;

    // Use helper function to handle both traditional and OCI charts
    const chartOptions = {
      ...createHelmChartArgs(chartConfig, args.namespace),
      values: {
        replicaCount: args.replicas || 1,
      },
    };

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      chartOptions,
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}
```

## Usage Pattern

```typescript
import { ExampleComponent } from "../components/example-component";

const example = new ExampleComponent("my-example", {
  namespace: "example-namespace",
  replicas: 3,
});

// Access exposed resources
const chartStatus = example.chart.status;
```

## Connection Configuration

Components that provide database or cache services (PostgreSQL, Valkey) include connection configuration methods that return all the necessary details to connect to the service:

```typescript
import { PostgreSQL } from "../components/bitnami-postgres";
import { Valkey } from "../components/bitnami-valkey";

const postgres = new PostgreSQL("my-db", {
  namespace: "database",
  database: "myapp",
  username: "appuser",
});

const valkey = new Valkey("my-cache", {
  namespace: "cache",
});

// Get connection configurations
const pgConfig = postgres.getConnectionConfig();
const valkeyConfig = valkey.getConnectionConfig();

// Use in application deployment
const app = new k8s.apps.v1.Deployment("app", {
  spec: {
    template: {
      spec: {
        containers: [{
          name: "app",
          env: [
            {
              name: "DATABASE_HOST",
              value: pgConfig.host,
            },
            {
              name: "DATABASE_PORT",
              value: pgConfig.port.toString(),
            },
            {
              name: "DATABASE_USER",
              value: pgConfig.username,
            },
            {
              name: "DATABASE_PASSWORD",
              value: pgConfig.password,
            },
            {
              name: "DATABASE_NAME",
              value: pgConfig.database,
            },
            {
              name: "CACHE_HOST",
              value: valkeyConfig.host,
            },
            {
              name: "CACHE_PORT",
              value: valkeyConfig.port.toString(),
            },
            {
              name: "CACHE_PASSWORD",
              value: valkeyConfig.password,
            },
          ],
        }],
      },
    },
  },
});
```

### Connection Configuration Benefits

- **Single Source of Truth**: Connection details are maintained in one place within the component
- **Automatic Service Discovery**: The components automatically discover the correct service names from the Helm chart
- **Immutable Configuration**: The method returns a copy to prevent accidental modification
- **Type Safety**: All connection details are properly typed for better developer experience

## Component Guidelines

### **Keep Components Focused**
- Each component should represent a single logical infrastructure unit
- Avoid creating overly complex components that manage unrelated resources

### **Use Minimal Configuration**
- Only expose configuration options that are commonly needed
- Provide sensible defaults for optional parameters
- Consider the 80/20 rule - cover 80% of use cases with simple config

### **Leverage Central Chart Configuration**
- Always add Helm charts to `../helm-charts.ts` first
- Reference charts via `HELM_CHARTS.COMPONENT_NAME` constant
- Use `createHelmChartArgs()` helper and destructure with values
- This ensures version consistency and proper OCI chart handling across the codebase

### **Expose Key Resources**
- Make important resources available as `public readonly` properties
- This allows consumers to access outputs or configure dependencies
- Common examples: `chart`, `service`, `deployment`, `configMap`

### **Resource Naming**
- Use `pulumi.interpolate` for dynamic resource names
- Pattern: `pulumi.interpolate\`\${name}-resource-type\``
- Example: `pulumi.interpolate\`\${name}-chart\``

## Available Components

| Component | File | Purpose |
|-----------|------|---------|
| `MetalLb` | `metal-lb.ts` | Load balancer for bare metal Kubernetes clusters |
| `Traefik` | `traefik.ts` | Modern HTTP reverse proxy and load balancer |
| `ExternalDns` | `external-dns.ts` | Synchronizes exposed Kubernetes Services and Ingresses with DNS providers |
| `ExternalDnsAdguardWebhook` | `external-dns-adguard-webhook.ts` | AdGuard Home webhook provider for ExternalDNS |
| `ExternalDnsRouterosWebhook` | `external-dns-routeros-webhook.ts` | RouterOS webhook provider for ExternalDNS |
| `CertManager` | `cert-manager.ts` | X.509 certificate management for Kubernetes |
| `Certificate` | `certificate.ts` | TLS certificate resource for cert-manager |
| `ClusterIssuer` | `cluster-issuer.ts` | Certificate issuer configuration for cert-manager |
| `ExternalSnapshotter` | `external-snapshotter.ts` | Kubernetes Volume Snapshot functionality for K3s clusters |
| `RookCeph` | `rook-ceph.ts` | Cloud-native storage operator for Kubernetes using Ceph |
| `RookCephCluster` | `rook-ceph-cluster.ts` | Ceph storage cluster with configurable storage layout |
| `Valkey` | `bitnami-valkey.ts` | High-performance data structure server (Redis-compatible) with automatic password generation |
| `PostgreSQL` | `bitnami-postgres.ts` | Open source object-relational database system with automatic password generation |
| `Velero` | `velero.ts` | Backup and disaster recovery for Kubernetes with support for both snapshot and filesystem backups |
| `Whoami` | `whoami.ts` | Simple test service for validating ingress and routing configuration |

## Adding New Components

1. **Add chart configuration** to `../helm-charts.ts`
2. **Create component file** using kebab-case naming
3. **Implement ComponentResource** following the structure above
4. **Update this README** with the new component entry
5. **Export from index** if creating a barrel export file

## Best Practices

- **Resource Options**: Always accept and pass through `pulumi.ComponentResourceOptions`
- **Parent Relationship**: Set `{ parent: this }` on child resources
- **Output Registration**: Call `this.registerOutputs()` with key resources
- **Documentation**: Include JSDoc comments with usage examples
- **Type Safety**: Use proper TypeScript types for all inputs and outputs 