# Pulumi

## What is Pulumi?

Pulumi is an [open-source infrastructure as code (IaC) platform](https://github.com/pulumi/pulumi) that enables developers and infrastructure teams to define, deploy, and manage cloud infrastructure using general-purpose programming languages such as TypeScript, Python, Go, C#, Java, and YAML. Unlike traditional IaC tools that use domain-specific languages, [Pulumi allows you to use familiar programming languages](https://www.pulumi.com/docs/iac/) you already know and love, bringing the full power of software engineering to infrastructure management.

Pulumi operates on a desired state (declarative) model while providing the flexibility of imperative programming constructs. According to the [official documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/), when you author a Pulumi program, the end result will be the state you declare, regardless of the current state of your infrastructure. This approach combines the benefits of both declarative and imperative paradigms.

## Key Features

### Multi-Language Support

One of Pulumi's most distinctive features is its support for multiple programming languages. As noted in the [Pulumi vs Terraform comparison](https://www.pulumi.com/docs/iac/comparisons/terraform/), Pulumi lets you use:

- **TypeScript/JavaScript**: Full npm ecosystem access with async/await for complex orchestration
- **Python**: Leverage NumPy for calculations, Pandas for data processing, and the entire PyPI ecosystem
- **Go**: Access powerful concurrency features and the Go standard library
- **C#/.NET**: Integrate with existing enterprise .NET ecosystems
- **Java**: Utilize enterprise-grade frameworks and tools
- **YAML**: Available for teams preferring simpler, declarative configurations

This flexibility allows teams to use languages they're already proficient in, reducing the learning curve and enabling the application of established software engineering practices to infrastructure.

### Cloud-Native and Multi-Cloud

Pulumi provides [broad support across cloud providers](https://www.pulumi.com/docs/iac/), including:

- **Native providers** for AWS, Azure, Google Cloud, and Kubernetes with same-day resource coverage
- Over 170 cloud providers and packages in the [Pulumi Registry](https://www.pulumi.com/registry/)
- 100% Kubernetes API coverage with compile-time type-checking
- Support for Helm 2 and 3, CustomResourceDefinitions (CRDs), and Kubernetes YAML

According to the [architecture documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/), Pulumi also supports adapting any Terraform provider for use, enabling management of any infrastructure supported by the Terraform provider ecosystem.

### State Management

Pulumi uses a desired state model where code represents the desired infrastructure state. The [state management system](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/) works as follows:

- By default, state is managed through the [free Pulumi Cloud service](https://app.pulumi.com/)
- State can also be self-hosted using various backends (local filesystem, AWS S3, Azure Blob Storage, Google Cloud Storage)
- State files are always transmitted and stored securely
- The engine compares desired state with current state to determine what resources need to be created, updated, or deleted

### Built-in Secrets Management

Unlike tools that store secrets in plain text, [Pulumi encrypts secrets by default](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/) both in transit and at rest. According to the [Terraform comparison](https://www.pulumi.com/docs/iac/comparisons/terraform/):

- Secrets are encrypted in transit and at rest in the state file
- Per-stack encryption keys provided by the Pulumi Service
- Anything a secret touches (CLI outputs, logs, state files) gets encrypted
- Support for custom encryption using your own keys managed by third-party solutions
- Simple API (`pulumi.secret()`) to mark any value as a secret

### Component Model

Pulumi provides a [powerful component model](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/) for building reusable infrastructure abstractions:

- Create higher-level abstractions that encapsulate complexity
- Components have trackable state and appear in diffs
- Logical names track resource identity across deployments
- **Pulumi Packages** allow authoring components in one language and making them accessible in all supported languages
- Components can use other components, enabling composition patterns

## Architecture

### System Components

Pulumi's architecture consists of several core components that work together, as described in the [architecture documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/):

#### Language Hosts

The language host is responsible for running your Pulumi program and consists of:

1. **Language Executor**: A binary named `pulumi-language-<language-name>` that launches the runtime for your chosen language
2. **Language SDK**: Prepares your program for execution and handles resource registration (e.g., `@pulumi/pulumi` for Node.js, `pulumi` for Python)

When a resource is registered (via `new Resource()` in JavaScript or `Resource(...)` in Python), the language SDK communicates the registration request to the deployment engine.

#### Deployment Engine

The [deployment engine](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/) is embedded in the `pulumi` CLI and:

- Computes the set of operations needed to drive current state to desired state
- Determines if resources need to be created, updated in place, or replaced
- Manages dependencies between resources based on inputs and outputs
- Handles concurrency and parallel resource operations when possible
- Records resource information in the state file

#### Resource Providers

Resource providers consist of:

1. **Resource Plugin**: Binary used by the deployment engine to manage resources (stored in `~/.pulumi/plugins`)
2. **SDK**: Provides bindings for each resource type the provider can manage

Providers can be installed via package managers (npm, PyPI, etc.) and automatically download the required plugin binary.

### Execution Flow

According to the [how Pulumi works documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/), here's what happens when you run `pulumi up`:

1. The CLI launches the language host for your chosen language
2. Your program executes and registers resources with the deployment engine
3. For each resource registration:
   - The engine consults existing state to determine if the resource exists
   - If new, the engine uses the resource provider to create it
   - If existing, the engine compares old and new state to determine updates or replacements
4. The engine determines dependencies based on resource inputs/outputs
5. Operations are executed in parallel when possible, respecting dependencies
6. After program execution, the engine identifies resources not seen in new registrations for deletion
7. State is updated with all changes

### Declarative and Imperative Approach

As explained in the [architecture documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/), Pulumi's architecture separates concerns:

- **Language host**: Imperative (for traditional programming languages) or declarative (for YAML)
- **Pulumi engine**: Declarative
- **Providers**: Imperative

This separation provides "the best of both imperative and declarative approaches for your infrastructure as code solutions."

## Comparison with Terraform

### Key Similarities

Both [Pulumi and Terraform](https://spacelift.io/blog/pulumi-vs-terraform) share several characteristics:

- Both are infrastructure as code tools
- Support declarative desired-state models
- Support major cloud providers
- Provide CI/CD integration
- Track infrastructure state
- Support resource importing

### Key Differences

According to the [official comparison](https://www.pulumi.com/docs/iac/comparisons/terraform/), here are the fundamental differences:

#### Language Approach

- **Terraform**: Uses HashiCorp Configuration Language (HCL), a proprietary DSL
  - Simpler for beginners but can become complex at scale
  - Limited programming constructs (loops, conditionals require workarounds)
  - Common to see codebases spanning tens of thousands of lines
  - Difficult to practice DRY (Don't Repeat Yourself) principles

- **Pulumi**: Uses general-purpose programming languages
  - Full access to language features (loops, conditionals, functions, classes)
  - Can leverage existing package ecosystems
  - Better code reuse through functions, classes, and packages
  - Familiar to developers, though slightly steeper learning curve for non-programmers

#### IDE and Developer Experience

As noted in the [Spacelift comparison](https://spacelift.io/blog/pulumi-vs-terraform):

- **Terraform**: Limited IDE support through plugins
- **Pulumi**: 
  - Full IDE support with code completion, error detection, and strong typing
  - Native testing frameworks for unit, property, and integration tests
  - Can embed IaC directly in application code via Automation API

#### State Management

Both tools manage state differently:

- **Terraform**: 
  - Stores state locally by default in `terraform.tfstate`
  - Remote state requires manual configuration
  - No built-in secrets encryption in state files

- **Pulumi**: 
  - Uses [Pulumi Cloud](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/) by default (eliminates concurrency and state management concerns)
  - Self-managed state available for advanced use cases
  - Secrets always encrypted in state files

#### Testing

According to the [comparison documentation](https://www.pulumi.com/docs/iac/comparisons/terraform/):

- **Terraform**: Supports integration testing; requires third-party tools like Terratest for robust testing
- **Pulumi**: 
  - Native testing frameworks
  - Unit tests (fast in-memory tests with mocked external calls)
  - Property tests (assertions during deployment)
  - Integration tests (ephemeral infrastructure testing)

#### Modularity and Reuse

- **Terraform**: Limited to HCL modules, which can become complex and difficult to maintain
- **Pulumi**: 
  - Can reuse functions, classes, packages, and components
  - [Component model](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/) allows creating higher-level abstractions
  - Components can be packaged and shared across all supported languages

#### Licensing

An important distinction noted in the [Terraform comparison](https://www.pulumi.com/docs/iac/comparisons/terraform/):

- **Terraform**: Uses Business Source License 1.1 (as of August 2023), which is not considered open source
- **Pulumi**: Uses Apache License 2.0, which is fully open source and business-friendly

## Best Practices

### Resource Naming

According to [Pulumi's recommended patterns](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/):

- Give every resource a **Pulumi resource name** (logical name used in state)
- Let Pulumi determine **cloud resource names** (physical names) with automatic suffixes
- Benefits:
  - Ensures names meet cloud provider requirements
  - Random suffixes prevent resource collisions across stacks
  - Enables zero-downtime updates through resource replacement
- Consider using a unique prefix for resources: `${organization}-${tenant}-${environment}-${resourceName}`

### Secrets Management

Following the [best practices guide](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/):

1. **Use Stack Configuration Secrets**:
   ```bash
   pulumi config set --secret apiKey mySecretValue
   ```
   The value is encrypted and safely stored in the stack configuration file

2. **Generated Passwords**: Use Pulumi's `RandomPassword` API for generated secrets

3. **Transform Plain Text to Secrets**: Use `pulumi.secret()` to protect any arbitrary data:
   ```typescript
   const protectedSecret = pulumi.secret(plainTextValue);
   ```

4. **Zero-Knowledge Deployment**: Effectively separate code from sensitive information

### Follow Cloud Provider Best Practices

As recommended in the [patterns guide](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/), integrate cloud vendor best practices:

- [AWS Best Practices](https://aws.amazon.com/organizations/getting-started/best-practices/)
- [Azure Best Practices](https://docs.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)
- [Google Cloud Best Practices](https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations)
- [Kubernetes Best Practices](https://kubernetes.io/docs/setup/best-practices/)

### Language-Specific Best Practices

Choose your programming language wisely and follow its conventions:

- **TypeScript**: Follow [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- **Python**: Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) and [PEP 20](https://www.python.org/dev/peps/pep-0020/)
- **C#**: Follow [Microsoft's C# coding conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- **Go**: Follow [Go best practices](https://golangdocs.com/golang-best-practices)

### IDE Selection

According to the [basics guide](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/), choose an IDE that provides:

- Code completion for your language
- Code syntax checking and linting
- Integrated code documentation
- Source control integration (git, etc.)
- Plugin support to augment capabilities

## Common Patterns

### Projects and Stacks

- **Projects**: A directory containing `Pulumi.yaml` that defines your infrastructure
- **Stacks**: Isolated instances of your infrastructure (e.g., dev, staging, production)
- Use stacks to manage multiple environments with the same code

### Component Resources

From the [component documentation](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/):

- Create reusable, higher-level abstractions
- Encapsulate complexity behind simple interfaces
- Track state and appear in diffs
- Can contain other components for composition

### Resource Options

- **dependsOn**: Specify explicit dependencies between resources
- **protect**: Prevent accidental deletion of critical resources
- **ignoreChanges**: Ignore changes to specific resource properties
- **deleteBeforeReplace**: Control replacement order for resources
- **aliases**: Enable refactoring without resource replacement

### Dynamic Providers

[Pulumi's dynamic providers](https://www.pulumi.com/docs/iac/comparisons/terraform/) allow you to:

- Create custom resources by directly coding CRUD operations
- Support new resource types not yet available in providers
- Perform complex integrations like database migrations
- Implement configuration management alongside IaC workflows

### Transformations

[Transformations](https://www.pulumi.com/docs/iac/comparisons/terraform/) allow you to:

- Programmatically set or override input properties of resources
- Apply consistent settings across infrastructure collections
- Implement cross-cutting concerns without manipulating individual resources

## Advanced Features

### Automation API

The [Automation API](https://www.pulumi.com/docs/iac/comparisons/terraform/) provides:

- Programmatic interface for running Pulumi programs without the CLI
- Strongly typed and safe way to use Pulumi in embedded contexts
- Ability to create custom experiences tailored to your domain
- Integration of IaC management directly in application code

### Policy as Code

Pulumi offers [CrossGuard for policy as code](https://www.pulumi.com/docs/iac/comparisons/terraform/):

- Open source and free to use
- Write rules in Python, JavaScript, or OPA Rego
- Enforce security, best practices, and cost controls
- Programmable guardrails across all infrastructure

### Migration Tools

For teams migrating from other tools, Pulumi provides:

- [Built-in converters](https://www.pulumi.com/docs/iac/comparisons/terraform/) to migrate Terraform HCL to Pulumi
- Ability to reference existing Terraform state
- Import existing resources with code generation
- Support for Kubernetes YAML and Azure ARM template conversion

## Sources

- [Pulumi Official Documentation](https://www.pulumi.com/docs/iac/)
- [How Pulumi Works](https://www.pulumi.com/docs/iac/concepts/how-pulumi-works/)
- [Pulumi vs. Terraform Comparison](https://www.pulumi.com/docs/iac/comparisons/terraform/)
- [Spacelift: Pulumi vs. Terraform](https://spacelift.io/blog/pulumi-vs-terraform)
- [Pulumi Recommended Patterns: The Basics](https://www.pulumi.com/blog/pulumi-recommended-patterns-the-basics/)
- [Pulumi GitHub Repository](https://github.com/pulumi/pulumi)
- [Pulumi Registry](https://www.pulumi.com/registry/)
