# Writing Pulumi Code

A concise guide to writing effective Pulumi infrastructure as code in TypeScript.

## Core Concepts

Pulumi uses familiar programming languages to define infrastructure. Key benefits:

- **Type Safety**: Compile-time validation of configurations
- **Code Reuse**: Functions, classes, and modules for DRY infrastructure
- **Familiar Tools**: Standard IDEs, debuggers, and testing frameworks

## Basic Project Setup

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define resources
const bucket = new aws.s3.BucketV2("my-bucket", {
  tags: { Environment: "production" }
});

// Export outputs
export const bucketName = bucket.id;
```

## Component Resource Pattern

ComponentResources are the foundation of reusable infrastructure:

```typescript
import * as pulumi from "@pulumi/pulumi";

export interface MyComponentArgs {
  namespace: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
}

export class MyComponent extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;

  constructor(name: string, args: MyComponentArgs, opts?: pulumi.ComponentResourceOptions) {
    super("myorg:components:MyComponent", name, args, opts);

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      spec: {
        replicas: args.replicas || 1,
        // ... configuration
      },
    }, { parent: this });

    this.registerOutputs({
      deployment: this.deployment,
    });
  }
}
```

## Essential Patterns

### Input Types
Always use `pulumi.Input<T>` for configuration properties:

```typescript
export interface ComponentArgs {
  // Correct: Accepts both static values and Pulumi outputs
  namespace: pulumi.Input<string>;
  port: pulumi.Input<number>;
  tags: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}
```

### Parent Relationships
Set parent relationships for proper dependency tracking:

```typescript
const secret = new k8s.core.v1.Secret(`${name}-secret`, {
  // ... configuration
}, { parent: this });

const deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
  // ... configuration
}, { parent: this, dependsOn: [secret] });
```

### Output Handling
Work with Pulumi outputs correctly:

```typescript
// Use pulumi.interpolate for string construction
const connectionString = pulumi.interpolate`postgresql://${username}:${password}@${host}:${port}/${database}`;

// Use pulumi.all for multiple outputs
const envVars = pulumi.all([host, port, password]).apply(([h, p, pw]) => ({
  DB_HOST: h,
  DB_PORT: p.toString(),
  DB_PASSWORD: pw,
}));
```

## Best Practices

### Resource Naming
Use consistent naming patterns:

```typescript
const configMap = new k8s.core.v1.ConfigMap(`${name}-config`, { /* ... */ });
const deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, { /* ... */ });
```

### Configuration Management
Structure configuration arguments logically:

```typescript
export interface ComponentArgs {
  // Required core configuration
  namespace: pulumi.Input<string>;
  
  // Grouped related options
  auth?: {
    enabled?: pulumi.Input<boolean>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
  };
  
  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
}
```

### Error Handling
Provide clear error messages and validation:

```typescript
constructor(name: string, args: ComponentArgs, opts?: pulumi.ComponentResourceOptions) {
  super("myorg:components:Type", name, args, opts);

  if (!args.namespace) {
    throw new Error("namespace is required");
  }
}
```

## Stack Organization

### Project Structure
```
my-infrastructure/
├── src/
│   ├── components/          # Reusable components
│   ├── modules/            # Higher-level abstractions
│   └── utils/              # Utility functions
├── stacks/
│   ├── dev/
│   └── prod/
├── package.json
├── tsconfig.json
└── Pulumi.yaml
```

### Configuration
Use Pulumi configuration for environment-specific values:

```typescript
const config = new pulumi.Config();
const environment = config.require("environment");
const replicas = config.getNumber("replicas") || 1;
```

### Stack References
Share outputs between stacks:

```typescript
// In infrastructure stack
export const vpcId = vpc.id;

// In application stack
const infraStack = new pulumi.StackReference("my-org/infrastructure/prod");
const vpcId = infraStack.getOutput("vpcId");
```

## Security

### Secrets Management
Never hardcode secrets:

```typescript
// Correct: Use Pulumi configuration
const config = new pulumi.Config();
const dbPassword = config.requireSecret("db-password");

// Correct: Generate secrets programmatically
const password = new random.RandomPassword("db-password", {
  length: 32,
  special: true,
});
```

### Resource Protection
Protect critical resources:

```typescript
const database = new aws.rds.Instance("prod-db", {
  // ... configuration
}, {
  protect: true, // Prevents accidental deletion
});
```

## Common Patterns

### Conditional Resources
```typescript
const enableDatabase = config.getBoolean("enable-database") ?? false;

const database = enableDatabase
  ? new DatabaseComponent("app-db", { namespace: "default" })
  : undefined;
```

### Resource Loops
```typescript
const environments = ["dev", "staging", "prod"];

const clusters = environments.map(env => 
  new ClusterComponent(`cluster-${env}`, {
    namespace: env,
    replicas: env === "prod" ? 3 : 1,
  })
);
```
