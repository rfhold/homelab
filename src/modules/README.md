# Modules

This directory contains higher-level abstractions that combine multiple components or provide a unified interface for switching between different implementations. Modules serve as composition layers that orchestrate components to deliver complete infrastructure solutions.

## Module Design Philosophy

### **Abstraction Layer**
- Modules sit between components and stacks, providing mid-level abstractions
- They combine multiple components into cohesive infrastructure solutions
- They provide implementation flexibility through enum-based configuration
- They simplify complex multi-component setups into single, focused interfaces

### **Implementation Switching**
- Modules allow easy switching between different underlying implementations
- Use TypeScript enums to define available implementation options
- Support graceful evolution from single to multiple implementations
- Provide consistent interfaces regardless of underlying implementation

### **Generic Configuration**
- Use generic arguments that work across implementations
- Avoid implementation-specific configuration objects
- Map generic arguments to implementation-specific settings
- Provide type-safe configuration that doesn't change when switching implementations

### **Composition Over Configuration**
- Focus on composing existing components rather than creating new infrastructure
- Leverage component interfaces and expose their key resources
- Provide unified configuration that maps to underlying component configurations
- Maintain separation of concerns between modules and components

## Module Structure

All modules follow a consistent structure:

### 1. **Implementation Enum**
```typescript
export enum RedisImplementation {
  BITNAMI_VALKEY = "bitnami-valkey",
}
```

### 2. **Generic Configuration Interface**
```typescript
export interface RedisModuleArgs {
  namespace: pulumi.Input<string>;
  implementation: RedisImplementation;
  
  // Generic configuration that works across implementations
  auth?: {
    password?: pulumi.Input<string>;
  };
  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
  persistence?: {
    enabled?: pulumi.Input<boolean>;
    size?: pulumi.Input<string>;
  };
}
```

### 3. **Module Class**
```typescript
export class RedisModule extends pulumi.ComponentResource {
  public readonly instance: Valkey | Redis; // Union type for implementations
  
  constructor(name: string, args: RedisModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Redis", name, args, opts);
    
    switch (args.implementation) {
      case RedisImplementation.BITNAMI_VALKEY:
        this.instance = new Valkey(name, {
          namespace: args.namespace,
          auth: args.auth,
          resources: args.resources,
          persistence: args.persistence,
        }, { parent: this });
        break;
      // Future implementations map same generic args to their specific format
    }
  }
  
  public getConnectionConfig() {
    return this.instance.getConnectionConfig();
  }
}
```

## Module Categories

### **Service Modules**
Modules that provide application services with implementation flexibility:

- **Redis Cache**: Choose between Valkey, Redis, or clustered variants
- **Database**: Choose between PostgreSQL, MySQL, or distributed databases
- **Message Queue**: Choose between RabbitMQ, Redis, or Kafka

### **Infrastructure Modules**
Modules that compose multiple infrastructure components with granular implementation control:

- **Storage**: Combines PVC provisioners (Rook-Ceph) with backup solutions (Velero)
- **Ingress**: Combines load balancer (MetalLB, others), ingress controller (Traefik, others), with DNS (ExternalDNS) and certificates (CertManager)
- **Observability**: Combines monitoring, logging, and tracing components

### **Platform Modules**
Modules that provide complete platform capabilities:

- **Container Platform**: Combines ingress, storage, and essential cluster services
- **Data Platform**: Combines databases, caches, and data processing services
- **Security Platform**: Combines authentication, authorization, and security scanning

## Example Modules

### **Simple Service Module**
```typescript
import * as pulumi from "@pulumi/pulumi";
import { Valkey } from "../components/bitnami-valkey";

export enum RedisImplementation {
  BITNAMI_VALKEY = "bitnami-valkey",
}

export interface RedisModuleArgs {
  namespace: pulumi.Input<string>;
  implementation: RedisImplementation;
  
  // Generic configuration that works across implementations
  auth?: {
    password?: pulumi.Input<string>;
  };
  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
  persistence?: {
    enabled?: pulumi.Input<boolean>;
    size?: pulumi.Input<string>;
  };
}

export class RedisModule extends pulumi.ComponentResource {
  public readonly instance: Valkey;

  constructor(name: string, args: RedisModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Redis", name, args, opts);

    switch (args.implementation) {
      case RedisImplementation.BITNAMI_VALKEY:
        this.instance = new Valkey(name, {
          namespace: args.namespace,
          auth: args.auth,
          resources: args.resources,
          persistence: args.persistence,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown Redis implementation: ${args.implementation}`);
    }

    this.registerOutputs({
      instance: this.instance,
    });
  }

  public getConnectionConfig() {
    return this.instance.getConnectionConfig();
  }
}
```

### **Complex Infrastructure Module with Granular Component Control**
```typescript
import * as pulumi from "@pulumi/pulumi";
import { MetalLb } from "../components/metal-lb";
import { Traefik } from "../components/traefik";
import { ExternalDns } from "../components/external-dns";
import { CertManager } from "../components/cert-manager";

export enum LoadBalancerImplementation {
  METAL_LB = "metal-lb",
}

export enum IngressControllerImplementation {
  TRAEFIK = "traefik",
}

export interface IngressModuleArgs {
  namespace: pulumi.Input<string>;
  loadBalancer: LoadBalancerImplementation;
  ingressController: IngressControllerImplementation;
  
  // Generic configuration that works across implementations
  loadBalancerConfig?: {
    addressPool?: pulumi.Input<string>;
    protocol?: pulumi.Input<string>;
  };
  ingressControllerConfig?: {
    replicas?: pulumi.Input<number>;
    resources?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
  };
  dnsConfig?: {
    provider?: pulumi.Input<string>;
    domain?: pulumi.Input<string>;
  };
  certManagerConfig?: {
    email?: pulumi.Input<string>;
    server?: pulumi.Input<string>;
  };
}

export class IngressModule extends pulumi.ComponentResource {
  public readonly loadBalancer: MetalLb;
  public readonly ingressController: Traefik;
  public readonly dnsProvider: ExternalDns;
  public readonly certManager: CertManager;

  constructor(name: string, args: IngressModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Ingress", name, args, opts);

    // Load Balancer (switchable)
    switch (args.loadBalancer) {
      case LoadBalancerImplementation.METAL_LB:
        this.loadBalancer = new MetalLb(`${name}-lb`, {
          namespace: args.namespace,
          addressPool: args.loadBalancerConfig?.addressPool,
          protocol: args.loadBalancerConfig?.protocol,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown LoadBalancer implementation: ${args.loadBalancer}`);
    }

    // Ingress Controller (switchable)
    switch (args.ingressController) {
      case IngressControllerImplementation.TRAEFIK:
        this.ingressController = new Traefik(`${name}-ingress`, {
          namespace: args.namespace,
          replicas: args.ingressControllerConfig?.replicas,
          resources: args.ingressControllerConfig?.resources,
        }, { parent: this });
        break;
      default:
        throw new Error(`Unknown IngressController implementation: ${args.ingressController}`);
    }

    // DNS Provider (always included)
    this.dnsProvider = new ExternalDns(`${name}-dns`, {
      namespace: args.namespace,
      provider: args.dnsConfig?.provider,
      domain: args.dnsConfig?.domain,
    }, { parent: this });

    // Certificate Manager (always included)
    this.certManager = new CertManager(`${name}-certs`, {
      namespace: args.namespace,
      email: args.certManagerConfig?.email,
      server: args.certManagerConfig?.server,
    }, { parent: this });

    this.registerOutputs({
      loadBalancer: this.loadBalancer,
      ingressController: this.ingressController,
      dnsProvider: this.dnsProvider,
      certManager: this.certManager,
    });
  }
}
```

## Module Guidelines

### **Use Generic Configuration**
- Design configuration interfaces that work across implementations
- Avoid implementation-specific configuration objects
- Map generic arguments to implementation-specific settings within the module
- Provide type-safe configuration that doesn't change when switching implementations

### **Granular Component Control**
- For complex modules, allow switching individual components
- Use separate enums for each switchable component
- Always include certain components (like DNS and cert management in ingress)
- Provide clear separation between what's switchable and what's fixed

### **Keep Modules Purpose-Focused**
- Each module should solve a specific infrastructure problem
- Avoid creating overly broad modules that try to do everything
- Focus on providing a single, well-defined capability

### **Design for Evolution**
- Start with single implementation enums (one value)
- Design interfaces to accommodate future implementations
- Use union types for implementation instances
- Consider backward compatibility when adding new implementations

### **Expose Component Resources**
- Make underlying component instances available as public properties
- This allows consumers to access component-specific functionality
- Provides escape hatches for advanced use cases

### **Provide Unified Interfaces**
- Abstract common operations (like `getConnectionConfig()`) at the module level
- Ensure consistent behavior across different implementations
- Hide implementation-specific details behind common interfaces

### **Configuration Mapping**
- Map generic module-level configuration to component-level configuration
- Provide sensible defaults while allowing customization
- Maintain type safety throughout the mapping process

## Usage Patterns

### **Simple Service Usage**
```typescript
import { RedisModule, RedisImplementation } from "../modules/redis-cache";

const cache = new RedisModule("app-cache", {
  namespace: "application",
  implementation: RedisImplementation.BITNAMI_VALKEY,
  auth: {
    password: "my-secure-password",
  },
  resources: {
    requests: {
      memory: "256Mi",
      cpu: "100m",
    },
  },
  persistence: {
    enabled: true,
    size: "10Gi",
  },
});

// Use unified interface
const cacheConfig = cache.getConnectionConfig();
```

### **Complex Infrastructure Usage**
```typescript
import { 
  IngressModule, 
  LoadBalancerImplementation, 
  IngressControllerImplementation 
} from "../modules/ingress";

const ingress = new IngressModule("cluster-ingress", {
  namespace: "ingress-system",
  loadBalancer: LoadBalancerImplementation.METAL_LB,
  ingressController: IngressControllerImplementation.TRAEFIK,
  loadBalancerConfig: {
    addressPool: "192.168.1.100-192.168.1.110",
    protocol: "layer2",
  },
  ingressControllerConfig: {
    replicas: 3,
    resources: {
      requests: {
        memory: "512Mi",
        cpu: "200m",
      },
    },
  },
  dnsConfig: {
    provider: "adguard",
    domain: "homelab.local",
  },
  certManagerConfig: {
    email: "admin@homelab.local",
    server: "https://acme-staging-v02.api.letsencrypt.org/directory",
  },
});

// Access individual components if needed
const traefikChart = ingress.ingressController.chart;
const certManagerChart = ingress.certManager.chart;
```

## Naming Conventions

### **Resource Types**
```typescript
super("homelab:modules:ModuleName", name, args, opts);
```
- Namespace: `homelab`
- Category: `modules`
- Module: PascalCase module name

### **Implementation Enums**
- Pattern: `{ComponentType}Implementation`
- Values: `SCREAMING_SNAKE_CASE`
- Example: `LoadBalancerImplementation.METAL_LB`

### **Configuration Interfaces**
- Pattern: `{ModuleName}ModuleArgs`
- Example: `RedisModuleArgs`, `IngressModuleArgs`

### **File Names**
- kebab-case matching the service/capability
- Examples: `redis-cache.ts`, `ingress.ts`, `storage.ts`

## Available Modules

| Module | File | Purpose | Components |
|--------|------|---------|------------|
| `PostgreSQLModule` | `postgres.ts` | PostgreSQL database service | Switchable: PostgreSQL implementation |
| `RedisModule` | `redis-cache.ts` | Redis-compatible caching service | Switchable: Redis implementation |
| `IngressModule` | `ingress.ts` | Complete ingress solution | Switchable: Load balancer, Ingress controller<br/>Fixed: DNS, Certificates |
| `StorageModule` | `storage.ts` | Complete storage solution | Switchable: Storage provider<br/>Fixed: Backup solution |

## Adding New Modules

1. **Define the capability** the module will provide
2. **Identify switchable vs fixed components** for complex modules
3. **Design generic configuration interface** that works across implementations
4. **Create implementation enums** for each switchable component
5. **Implement module class** following the structure above
6. **Add unified interface methods** for common operations
7. **Update this README** with the new module entry
8. **Consider future implementations** in the design

## Best Practices

- **Generic Configuration**: Use configuration that works across implementations
- **Granular Control**: Allow switching individual components in complex modules
- **Single Responsibility**: Each module should provide one cohesive capability
- **Implementation Flexibility**: Design for multiple implementations from the start
- **Consistent Interfaces**: Provide unified methods that work across implementations
- **Resource Access**: Expose underlying components for advanced use cases
- **Error Handling**: Provide clear error messages for unsupported implementations
- **Documentation**: Include JSDoc comments with usage examples for each module 