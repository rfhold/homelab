# Kubernetes Workloads Capability Spec

Stable spec at `docs/specs/kubernetes-workloads/spec.md`. Source of truth. Edited only by the `code-review` skill during delta merge.

## Purpose

## Requirements

### Requirement: Generic Workload Label Passthrough
The system MUST expose generic workload label passthrough for Pulumi components, modules, and chart wrappers so stack configuration can provide operational labels without component-specific drain logic.

#### Scenario: Stack config provides workload labels
Given a stack configuration declares generic workload labels for a workload
When the workload's Pulumi component, module, or chart wrapper creates Kubernetes resources
Then the system MUST apply the configured labels to Kubernetes resource metadata where that resource supports labels
And the system MUST apply the configured labels to pod template metadata for controllers that create pods
And the system MUST NOT require component-specific code for each operational label key

#### Scenario: Workload labels are omitted
Given a stack configuration omits generic workload labels for a workload
When the workload's Pulumi component, module, or chart wrapper creates Kubernetes resources
Then the system MUST preserve existing resource labels
And the system MUST NOT invent an operational workload layer label

### Requirement: Standard Workload Identity Labels
The system MUST support Kubernetes recommended app labels alongside homelab operational labels for workloads managed by stack configuration.

#### Scenario: Workload identity labels are declared
Given a stack configuration declares Kubernetes recommended app labels for a workload
When the workload's Kubernetes resources are rendered
Then the system MUST allow `app.kubernetes.io/name` to identify the application name
And the system MUST allow `app.kubernetes.io/instance` to identify the deployed instance
And the system MUST allow `app.kubernetes.io/component` to identify the workload component
And the system MUST allow `app.kubernetes.io/part-of` to identify the larger system
And the system MUST allow `app.kubernetes.io/managed-by` to identify Pulumi management

#### Scenario: Operational layer label is declared
Given a stack configuration declares `rholden.dev/workload-layer` for a workload
When the workload's Kubernetes resources are rendered
Then the system MUST propagate `rholden.dev/workload-layer` through the generic workload label passthrough
And the system MUST NOT translate the value through component-specific layer mappings

### Requirement: Label-Driven Planned Reboot Selection
The system MUST provide planned reboot workflow support that selects application drain candidates by workload labels rather than by namespace or component-specific rules.

#### Scenario: Default planned reboot selects safe workload layers
Given a planned reboot workflow targets a Kubernetes node
When the workflow selects pods for the initial drain phase
Then the system MUST select pods by configured workload label selectors
And the system MUST exclude pods whose `rholden.dev/workload-layer` is `storage` unless storage handling is explicitly requested
And the system MUST exclude unlabeled pods from default drain selection

#### Scenario: Storage handling requires explicit selection
Given a planned reboot workflow targets a Kubernetes node with storage-layer pods
When storage handling is not explicitly requested
Then the system MUST NOT evict or delete pods labeled `rholden.dev/workload-layer=storage`

#### Scenario: Ceph checks gate storage handling
Given a planned reboot workflow explicitly requests storage handling for a node with Ceph OSD workloads
When the workflow evaluates whether the node can stop storage workloads
Then the system MUST check Ceph cluster health before rebooting the node
And the system MUST check Ceph `osd ok-to-stop` for OSDs on the target node before rebooting the node
And the system MUST NOT reboot the node when the Ceph checks fail

### Requirement: Workload Layer Stack Coverage
The system MUST allow every stack configuration that deploys workloads to declare workload layer labels for all components, deployments, charts, pods, and related workload resources managed by that stack.

#### Scenario: Stack-managed workload resources expose labels
Given a stack manages Kubernetes workload resources
When the stack configuration provides generic workload labels
Then the system MUST provide a regular passthrough path for those labels to components
And the system MUST provide a regular passthrough path for those labels to deployments, stateful workloads, daemon workloads, jobs, cron jobs, chart-managed pods, and pod templates where applicable

#### Scenario: Label passthrough avoids custom drain logic
Given a component receives generic workload labels from stack configuration
When a planned reboot workflow evaluates drain candidates
Then the system MUST rely on the labels present on pod templates or pods
And the system MUST NOT rely on component names, namespaces, or hardcoded workload lists as the primary drain policy

### Requirement: Dedicated Agent Gateway Program
The system MUST provide a dedicated Pantheon-only Pulumi program for Agent Gateway.

#### Scenario: Agent Gateway program exists
Given homelab Pulumi programs are enumerated
When Agent Gateway is deployed
Then the system MUST provide a separate Agent Gateway program instead of deploying Agent Gateway from the ingress or LiteLLM programs

#### Scenario: Agent Gateway program targets Pantheon
Given Agent Gateway stack configuration is inspected
When cluster-specific configuration is rendered
Then the system MUST provide Pantheon configuration
And the system MUST NOT require Romulus configuration for the initial deployment

### Requirement: Agent Gateway Stable Release
The system MUST deploy Agent Gateway stable release `v1.2.1` for the dedicated Agent Gateway program.

#### Scenario: Agent Gateway charts use stable release
Given the Agent Gateway program renders Helm releases
When Agent Gateway CRDs and controller charts are selected
Then the system MUST use Agent Gateway chart version `v1.2.1`

#### Scenario: alpha release is excluded
Given Agent Gateway release versions are configured
When the dedicated Agent Gateway program is rendered
Then the system MUST NOT use Agent Gateway `v1.3.0-alpha.1`

### Requirement: LiteLLM Workload Replacement
The system MUST replace the LiteLLM workload with Agent Gateway for client-facing LLM routing.

#### Scenario: LiteLLM deployment is removed from active routing
Given the Agent Gateway replacement is deployed
When client-facing LLM routing resources are rendered
Then the system MUST route LLM client traffic through Agent Gateway
And the system MUST NOT require the LiteLLM Deployment or Service for client-facing LLM routing

#### Scenario: LiteLLM provider configuration is migrated
Given the existing LiteLLM stack contains OpenAI, Anthropic, Cerebras, Chutes, and vLLM provider configuration
When Agent Gateway configuration is rendered
Then the system MUST represent those upstream providers or local model backends with Agent Gateway backend resources

### Requirement: Provider Prefix Model Routing
The system MUST route external model providers by client model-name prefix and remove the provider prefix before forwarding upstream.

#### Scenario: OpenAI model prefix is stripped
Given a client requests model `openai/gpt-5.2`
When Agent Gateway forwards the request to OpenAI
Then the system MUST send model `gpt-5.2` to the upstream provider

#### Scenario: Anthropic model prefix is stripped
Given a client requests model `anthropic/claude-sonnet-4-6`
When Agent Gateway forwards the request to Anthropic
Then the system MUST send model `claude-sonnet-4-6` to the upstream provider

#### Scenario: custom OpenAI-compatible provider prefix is stripped
Given a client requests a model with a configured external provider prefix such as `chutes/`
When Agent Gateway forwards the request to that OpenAI-compatible provider
Then the system MUST remove the configured provider prefix before forwarding upstream

#### Scenario: Codex proxy prefix is stripped
Given a client requests model `codex/gpt-5.5`
When Agent Gateway forwards the request to Codex Proxy
Then the system MUST send model `gpt-5.5` to Codex Proxy
And the system MUST NOT send the `codex/` provider prefix to Codex Proxy

### Requirement: Dedicated Codex Proxy Program
The system MUST provide a dedicated Pantheon-only Pulumi program for Codex Proxy.

#### Scenario: Codex Proxy program exists
Given homelab Pulumi programs are enumerated
When Codex Proxy is deployed
Then the system MUST provide a separate Codex Proxy program instead of deploying Codex Proxy from the Agent Gateway, LiteLLM, or ingress programs

#### Scenario: Codex Proxy program targets Pantheon
Given Codex Proxy stack configuration is inspected
When cluster-specific configuration is rendered
Then the system MUST provide Pantheon configuration
And the system MUST NOT require Romulus configuration for the initial deployment

### Requirement: Codex Proxy Internal Workload
The system MUST deploy Codex Proxy as an internal-only Kubernetes workload with persistent application data.

#### Scenario: Codex Proxy workload is rendered
Given the Codex Proxy program is deployed
When Kubernetes workload resources are rendered
Then the system MUST create a Codex Proxy workload using a pinned internal registry image tag
And the system MUST NOT use the `latest` image tag

#### Scenario: Codex Proxy image uses internal registry tag
Given the Codex Proxy workload is rendered
When container image references are inspected
Then the system MUST use `cr.holdenitdown.net/rfhold/codex-proxy:v2.0.76` for the Codex Proxy container image
And the system MUST NOT reference the upstream Codex Proxy image directly for the workload

#### Scenario: Codex Proxy data is persistent
Given the Codex Proxy workload is rendered
When persistent storage resources are inspected
Then the system MUST provide persistent storage for Codex Proxy application data
And the system MUST mount that storage at `/app/data`

#### Scenario: Codex Proxy service is internal
Given the Codex Proxy workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service for Codex Proxy
And the system MUST keep Agent Gateway as the client-facing model route for Codex-backed model requests

### Requirement: Codex Proxy Conservative Runtime Defaults
The system MUST configure Codex Proxy with conservative runtime defaults for logging, updates, and proxy checks.

#### Scenario: request body logging is disabled
Given Codex Proxy configuration is rendered
When logging settings are inspected
Then the system MUST disable request body capture by default

#### Scenario: update checks are disabled by default
Given Codex Proxy configuration is rendered
When update settings are inspected
Then the system MUST disable update and self-update behavior by default where the application exposes configuration for those behaviors

#### Scenario: proxy IP checks are not configured by default
Given Codex Proxy configuration is rendered
When proxy settings are inspected
Then the system MUST NOT configure proxy IP health checks unless a later change explicitly enables upstream proxy support

### Requirement: Agent Gateway Codex Provider
The system MUST route Agent Gateway models with the `codex/` prefix to Codex Proxy as a single OpenAI-compatible provider.

#### Scenario: Codex provider targets Codex Proxy
Given Agent Gateway configuration is rendered
When the `codex/` provider is inspected
Then the system MUST target the internal Codex Proxy Service
And the system MUST use Codex Proxy's OpenAI-compatible API endpoint

#### Scenario: Codex provider preserves model passthrough after prefix removal
Given a client requests a Codex-backed model through Agent Gateway
When the client model starts with `codex/`
Then the system MUST route the request to Codex Proxy
And the system MUST forward the model name after removing only the `codex/` prefix

#### Scenario: Codex provider uses no proxy API key
Given Agent Gateway forwards requests to the internal Codex Proxy Service
When provider credentials are rendered
Then the system MUST NOT configure an Agent Gateway-to-Codex-Proxy API key
And the system MUST NOT send an authorization credential from Agent Gateway to Codex Proxy by default

### Requirement: Self-Hosted Model Name Preservation
The system MUST preserve complete self-hosted model names when routing to local vLLM-compatible backends that remain served by Agent Gateway.

#### Scenario: retired GLM self-hosted model is excluded
Given a client-facing model inventory is rendered for Agent Gateway
When GLM 4.7 Flash is no longer served
Then the system MUST NOT include `zai-org/GLM-4.7-Flash` as an available self-hosted model

#### Scenario: embedding self-hosted model keeps full name
Given a client requests model `Qwen/Qwen3-Embedding-4B`
When Agent Gateway forwards the request to the local embedding backend
Then the system MUST send model `Qwen/Qwen3-Embedding-4B` to the upstream backend

#### Scenario: embedding backend targets standalone vLLM Service
Given Agent Gateway renders the backend for model `Qwen/Qwen3-Embedding-4B`
When the backend provider target is inspected
Then the system MUST target `qwen3-embedding.vllm.svc.cluster.local:8000`
And the system MUST NOT target `ai-inference-qwen3-embedding-4b.ai-inference.svc.cluster.local`

### Requirement: Sibling Repository Agent Gateway Client Migration
The system MUST migrate source-controlled sibling repository references from LiteLLM client endpoints and retired model names to Agent Gateway client endpoint and model names.

#### Scenario: LiteLLM endpoint references are replaced
Given sibling repositories are scanned for client-facing LLM endpoint references
When source-controlled files contain references to the LiteLLM endpoint
Then the system MUST replace those references with `agent-gateway.holdenitdown.net`
And the system MUST NOT leave active client configuration pointing at `litellm.holdenitdown.net`

#### Scenario: repository-wide references are covered
Given sibling repositories contain documentation, examples, tests, prompts, and configuration files
When the migration is performed
Then the system MUST update every source-controlled LiteLLM endpoint or retired model reference outside dependency, generated, VCS, and build-output directories

#### Scenario: retired GLM model references are removed
Given sibling repositories reference GLM 4.7 Flash models or aliases
When client-facing model references are migrated
Then the system MUST remove references to GLM 4.7 Flash as an available served model
And the system MUST NOT advertise `zai-org/GLM-4.7-Flash` or GLM 4.7 Flash aliases for Agent Gateway clients

### Requirement: Source-Controlled Embedding Model Reference Alignment
The system MUST align source-controlled embedding model references and filenames to the served `Qwen/Qwen3-Embedding-4B` model.

#### Scenario: retired embedding model references are replaced
Given sibling repositories contain source-controlled references to the retired 8B model
When the embedding model reference alignment is performed
Then the system MUST replace those references with `Qwen/Qwen3-Embedding-4B`
And the system MUST NOT leave the retired 8B model advertised as a served embedding model

#### Scenario: embedding benchmark filenames are aligned
Given sibling repositories contain source-controlled filenames that include the retired embedding model identifier
When the embedding model reference alignment is performed
Then the system MUST rename those files to use the `4B` embedding model identifier
And the renamed files MUST continue to describe the same benchmark or documentation purpose

#### Scenario: archived references are included
Given archived specs, archived tasks, documentation, examples, tests, prompts, configuration, or benchmark files contain retired 8B references
When the embedding model reference alignment is performed
Then the system MUST update those source-controlled references to `Qwen/Qwen3-Embedding-4B`

### Requirement: Standalone Configurable vLLM Program
The system MUST provide a standalone Pulumi program for running vLLM from stack-provided model, node placement, and GPU configuration.

#### Scenario: Standalone program exists
Given homelab Pulumi programs are enumerated
When a standalone vLLM stack is deployed
Then the system MUST provide a separate vLLM program instead of deploying the experiment from the existing ai-inference program

#### Scenario: Stack config selects deployment details
Given the standalone vLLM program configuration is inspected
When a model-specific stack is rendered
Then the system MUST read the served model from stack configuration
And the system MUST read node placement from stack configuration
And the system MUST read GPU runtime and resource settings from stack configuration

#### Scenario: Model cache uses Hugging Face cache paths
Given a standalone vLLM stack configures a model cache volume
When the vLLM workload is rendered
Then the system MUST mount the model cache volume at the Hugging Face cache root
And the system MUST configure Hugging Face cache environment variables to target that persistent volume

#### Scenario: Qwen3 embedding stack exists
Given standalone vLLM stack files are enumerated
When the Qwen3 embedding experiment is configured
Then the system MUST provide `programs/vllm/Pulumi.qwen3-embedding.yaml`
And the system MUST NOT require a model-specific Pulumi program directory for Qwen3 embedding

### Requirement: Qwen3 Embedding Model Workload
The system MUST deploy `Qwen/Qwen3-Embedding-4B` using the standard vLLM OpenAI-compatible image.

#### Scenario: Model and image are configured
Given the `qwen3-embedding` standalone vLLM stack renders its Kubernetes workload
When the vLLM container specification is inspected
Then the system MUST use a standard vLLM OpenAI-compatible image
And the system MUST configure the served model as `Qwen/Qwen3-Embedding-4B`

#### Scenario: Fit-oriented deployment is attempted
Given Athena has 16GB of GPU VRAM
When the `qwen3-embedding` standalone vLLM workload starts
Then the system MUST configure vLLM with initial deployment settings intended to attempt fitting `Qwen/Qwen3-Embedding-4B` within the available GPU memory

### Requirement: Athena GPU Scheduling
The system MUST allow stack configuration to schedule the standalone vLLM workload onto Athena with NVIDIA GPU access.

#### Scenario: GPU resources are requested
Given the `qwen3-embedding` standalone vLLM workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST request NVIDIA GPU resources for the vLLM container
And the system MUST use the NVIDIA runtime class required by the cluster

#### Scenario: Workload targets Athena
Given the `qwen3-embedding` standalone vLLM workload is rendered
When node placement fields are inspected
Then the system MUST constrain the workload to run on Athena according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

### Requirement: Internal-Only vLLM Service
The system MUST expose the standalone vLLM workload only through an internal Kubernetes Service.

#### Scenario: Internal service is rendered
Given the standalone vLLM workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service that targets the vLLM OpenAI-compatible API port

#### Scenario: Public route is omitted
Given the standalone vLLM program is deployed
When edge routing resources are rendered
Then the system MUST NOT create an HTTPRoute for the standalone vLLM service
And the system MUST NOT expose a public hostname for the standalone vLLM service

#### Scenario: Gateway integration remains separate
Given Agent Gateway will serve client traffic for the standalone vLLM backend
When the standalone vLLM program is rendered
Then the system MUST NOT create Agent Gateway backend or route resources

### Requirement: Standalone Configurable llama.cpp Program
The system MUST provide a standalone Pulumi program for running llama.cpp server workloads from stack-provided model, runtime, placement, service, storage, and resource configuration.

#### Scenario: Standalone llama.cpp program exists
Given homelab Pulumi programs are enumerated
When a llama.cpp server stack is deployed
Then the system MUST provide a separate `programs/llama-cpp/` Pulumi program instead of adding llama.cpp serving to the vLLM program

#### Scenario: Stack config selects llama.cpp deployment details
Given the standalone llama.cpp program configuration is inspected
When a model-specific stack is rendered
Then the system MUST read the served model configuration from stack configuration
And the system MUST read node placement from stack configuration
And the system MUST read GPU runtime and resource settings from stack configuration
And the system MUST read service and model-cache configuration from stack configuration

#### Scenario: Model cache uses Hugging Face cache paths
Given a standalone llama.cpp stack configures a model cache volume
When the llama.cpp workload is rendered
Then the system MUST mount the model cache volume into the llama.cpp container
And the system MUST configure Hugging Face cache environment variables to target that persistent volume

### Requirement: Gemma llama.cpp Model Workload
The system MUST provide a standalone llama.cpp stack for serving Gemma 4 E2B GGUF as the client-facing model `gemma-4-e2b`.

#### Scenario: Gemma llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the Gemma GGUF llama.cpp server is configured
Then the system MUST provide `programs/llama-cpp/Pulumi.gemma-4-e2b.yaml`
And the system MUST configure the backend model source for `unsloth/gemma-4-E2B-it-GGUF:Q6_K` or an equivalent resolved GGUF artifact
And the system MUST configure the served client-facing model name as `gemma-4-e2b`

#### Scenario: llama.cpp server image is configured
Given the `gemma-4-e2b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp container specification is inspected
Then the system MUST use a CUDA-capable llama.cpp server image
And the system MUST start an OpenAI-compatible llama.cpp server endpoint

### Requirement: llama.cpp Athena GPU Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Athena with NVIDIA runtime access and configurable GPU resource requests.

#### Scenario: NVIDIA runtime is configured
Given a llama.cpp workload targets Athena
When Kubernetes scheduling fields are inspected
Then the system MUST use the NVIDIA runtime class required by the cluster
And the system MUST constrain the workload to run on Athena according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: GPU resources are configurable
Given a llama.cpp stack includes Kubernetes resource settings
When the workload container resources are rendered
Then the system MUST render the resource requests and limits provided by stack configuration

### Requirement: Agent Gateway Routing for Gemma llama.cpp
The system MUST route Agent Gateway requests for model `gemma-4-e2b` to the internal llama.cpp Gemma service.

#### Scenario: Agent Gateway provider targets llama.cpp service
Given Agent Gateway renders the backend for model `gemma-4-e2b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp Gemma service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing Gemma model name is routed
Given a client requests model `gemma-4-e2b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp Gemma backend
And the system MUST preserve `gemma-4-e2b` as the upstream model name

#### Scenario: Chat completion succeeds through Agent Gateway
Given the llama.cpp Gemma workload is ready
When a client sends a chat completion request for model `gemma-4-e2b` through Agent Gateway
Then the system MUST return a successful OpenAI-compatible chat completion response

### Requirement: Internal-Only llama.cpp Service
The system MUST expose standalone llama.cpp workloads only through internal Kubernetes Services and Agent Gateway routing.

#### Scenario: Internal llama.cpp service is rendered
Given a standalone llama.cpp workload is deployed
When Kubernetes service resources are rendered
Then the system MUST create an internal Service that targets the llama.cpp OpenAI-compatible API port

#### Scenario: llama.cpp direct public route is omitted
Given Agent Gateway will serve client traffic for a standalone llama.cpp backend
When the standalone llama.cpp program is rendered
Then the system MUST NOT create an HTTPRoute for the standalone llama.cpp service
And the system MUST NOT expose a direct public hostname for the standalone llama.cpp service

### Requirement: Legacy ai-inference Stack Retirement
The system MUST retire the legacy `ai-inference` Pulumi stack from active Pantheon model serving.

#### Scenario: ai-inference stack is destroyed
Given local model serving has moved to standalone inference stacks and Agent Gateway
When legacy Pantheon inference resources are reconciled
Then the system MUST destroy the `ai-inference` Pulumi stack resources
And the system MUST NOT require the `ai-inference` namespace workloads for active client-facing model serving

#### Scenario: standalone embedding stack is preserved
Given the standalone vLLM Qwen3 embedding stack exists outside the legacy `ai-inference` stack
When the legacy `ai-inference` stack is retired
Then the system MUST NOT remove the standalone vLLM Qwen3 embedding stack as part of this change

### Requirement: Qwen3.6 llama.cpp Model Workload
The system MUST provide a standalone llama.cpp stack for serving Qwen3.6 35B A3B GGUF as the client-facing model `qwen3.6-35b-a3b`.

#### Scenario: Qwen3.6 llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the Qwen3.6 GGUF llama.cpp server is configured
Then the system MUST provide a separate stack configuration for `qwen3.6-35b-a3b`
And the system MUST configure the backend model source as `unsloth/Qwen3.6-35B-A3B-GGUF`
And the system MUST configure the GGUF artifact as `Qwen3.6-35B-A3B-UD-Q6_K.gguf`
And the system MUST configure the served client-facing model name as `qwen3.6-35b-a3b`

#### Scenario: Qwen3.6 targets 262144 context
Given the `qwen3.6-35b-a3b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp server arguments are inspected
Then the system MUST configure a context size of `262144`
And the system MUST configure a single parallel slot for capacity testing

### Requirement: llama.cpp Mars GPU Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Mars with NVIDIA runtime access and configurable GPU resource requests.

#### Scenario: Qwen3.6 workload targets Mars
Given the `qwen3.6-35b-a3b` standalone llama.cpp workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST constrain the workload to run on Mars according to stack configuration
And the system MUST use the NVIDIA runtime class required by the cluster
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: Gemma workload remains on Athena
Given the existing Gemma 4 E2B llama.cpp workload is deployed on Athena
When the Qwen3.6 llama.cpp workload is added on Mars
Then the system MUST preserve the Gemma workload placement and configuration
And the system MUST NOT replace the Gemma Agent Gateway model route

### Requirement: Agent Gateway Routing for Qwen3.6 llama.cpp
The system MUST route Agent Gateway requests for model `qwen3.6-35b-a3b` to the internal Mars llama.cpp Qwen3.6 service.

#### Scenario: Agent Gateway provider targets Qwen3.6 llama.cpp service
Given Agent Gateway renders the backend for model `qwen3.6-35b-a3b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp Qwen3.6 service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing Qwen3.6 model name is routed
Given a client requests model `qwen3.6-35b-a3b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp Qwen3.6 backend
And the system MUST preserve `qwen3.6-35b-a3b` as the upstream model name

#### Scenario: Gemma route remains available
Given Agent Gateway routes model `gemma-4-e2b` to the existing Gemma llama.cpp backend
When the Qwen3.6 Agent Gateway route is added
Then the system MUST continue routing `gemma-4-e2b` to the Gemma llama.cpp backend
And the system MUST route `qwen3.6-35b-a3b` independently to the Qwen3.6 llama.cpp backend

### Requirement: GPT-OSS llama.cpp Strix Halo Workload
The system MUST provide a standalone llama.cpp stack for serving GPT-OSS on Strix Halo using the upstream ROCm llama.cpp server image.

#### Scenario: GPT-OSS llama.cpp stack exists
Given standalone llama.cpp stack files are enumerated
When the GPT-OSS llama.cpp server is configured
Then the system MUST provide a separate stack configuration for `gpt-oss-120b`
And the system MUST configure the served client-facing model name as `gpt-oss-120b`

#### Scenario: GPT-OSS 120B backend model is configured
Given the `gpt-oss-120b` standalone llama.cpp stack renders its model source configuration
When the Hugging Face model source is inspected
Then the system MUST configure the backend model repository as `ggml-org/gpt-oss-120b-GGUF`
And the system MUST configure the backend model file as `gpt-oss-120b-mxfp4-00001-of-00003.gguf`
And the system MUST NOT rename the served client-facing model from `gpt-oss-120b`

#### Scenario: Upstream ROCm server image is configured
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp container specification is inspected
Then the system MUST use `ghcr.io/ggml-org/llama.cpp:server-rocm`
And the system MUST start an OpenAI-compatible llama.cpp server endpoint

#### Scenario: GPT-OSS starts with 128k context
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the llama.cpp server arguments are inspected
Then the system MUST configure a context size of `131072`
And the system MUST configure a single parallel slot for initial capacity testing

#### Scenario: GPT-OSS allows extended startup
Given the `gpt-oss-120b` standalone llama.cpp stack renders its Kubernetes workload
When the startup probe is inspected
Then the system MUST allow enough startup probe failures for 120B cold start and model loading on Strix Halo

### Requirement: llama.cpp AMD Device Scheduling
The system MUST allow stack configuration to schedule llama.cpp server workloads onto Strix Halo AMD APU nodes with ROCm device access.

#### Scenario: AMD devices are mounted
Given a llama.cpp workload targets a Strix Halo AMD APU node
When Kubernetes workload resources are rendered
Then the system MUST mount `/dev/kfd` into the llama.cpp container
And the system MUST mount `/dev/dri` into the llama.cpp container

#### Scenario: GPT-OSS uses privileged ROCm access
Given the `gpt-oss-120b` standalone llama.cpp workload is rendered
When the llama.cpp container security context is inspected
Then the system MUST run the container with privileged access for ROCm device cgroup access

#### Scenario: GPT-OSS workload targets Strix Halo
Given the `gpt-oss-120b` standalone llama.cpp workload is rendered
When Kubernetes scheduling fields are inspected
Then the system MUST constrain the workload to run on a Strix Halo AMD APU node according to stack configuration
And the system MUST tolerate the cluster GPU inference taint

#### Scenario: Existing NVIDIA llama.cpp stacks are preserved
Given existing Gemma and Qwen3.6 llama.cpp workloads target NVIDIA nodes
When AMD device support is added for the GPT-OSS llama.cpp workload
Then the system MUST preserve the existing NVIDIA runtime and resource configuration for those stacks
And the system MUST NOT require AMD device mounts for llama.cpp stacks that do not configure them

### Requirement: Agent Gateway Routing for GPT-OSS llama.cpp
The system MUST route Agent Gateway requests for model `gpt-oss-120b` to the internal Strix Halo llama.cpp GPT-OSS service.

#### Scenario: Agent Gateway provider targets GPT-OSS llama.cpp service
Given Agent Gateway renders the backend for model `gpt-oss-120b`
When the backend provider target is inspected
Then the system MUST target the internal llama.cpp GPT-OSS service in the Kubernetes cluster
And the system MUST use OpenAI-compatible upstream routing

#### Scenario: Client-facing GPT-OSS model name is routed
Given a client requests model `gpt-oss-120b` through `agent-gateway.holdenitdown.net`
When Agent Gateway evaluates model routing
Then the system MUST route the request to the llama.cpp GPT-OSS backend
And the system MUST preserve `gpt-oss-120b` as the upstream model name

#### Scenario: Existing llama.cpp routes remain available
Given Agent Gateway routes existing llama.cpp models to their backends
When the GPT-OSS Agent Gateway route is added
Then the system MUST continue routing existing llama.cpp models to their current backends
And the system MUST route `gpt-oss-120b` independently to the GPT-OSS llama.cpp backend

### Requirement: Stash-Captured Hugging Face Token for Standalone Inference
The system MUST support Pulumi Stash-captured Hugging Face tokens for standalone vLLM and llama.cpp server programs.

#### Scenario: Standalone vLLM captures Hugging Face token
Given the standalone vLLM program is run with an `HF_TOKEN` environment variable
When the vLLM stack renders a workload that uses Hugging Face model access
Then the system MUST capture the token with Pulumi Stash
And the system MUST provide the token to the vLLM container through the existing Kubernetes Secret environment path

#### Scenario: Standalone llama.cpp captures Hugging Face token
Given the standalone llama.cpp program is run with an `HF_TOKEN` environment variable
When the llama.cpp stack renders a workload that uses Hugging Face model access
Then the system MUST capture the token with Pulumi Stash
And the system MUST provide the token to the llama.cpp container through a Kubernetes Secret environment path

#### Scenario: Missing Hugging Face token fails before deployment
Given a standalone inference program requires Hugging Face model access
When the `HF_TOKEN` environment variable is not set
Then the system MUST fail before rendering Kubernetes resources that require the token

### Requirement: Multi-Hostname HTTPRoute Configuration
The system MUST allow workload and reverse-proxy HTTPRoute configuration to attach more than one hostname to the same route when a service has both primary and alias hostnames.

#### Scenario: Service route has primary and alias hostnames
Given a workload service has a primary `holdenitdown.net` hostname and a local `rholden.dev` alias
When its HTTPRoute is rendered
Then the system MUST include both hostnames on the same HTTPRoute
And the system MUST route both hostnames to the same backend service

#### Scenario: Reverse proxy route has primary and alias hostnames
Given a reverse proxy has a primary `holdenitdown.net` hostname and a local `rholden.dev` alias
When its HTTPRoute is rendered
Then the system MUST include both hostnames on the same HTTPRoute
And the system MUST route both hostnames to the same backend endpoint

### Requirement: Tunnel Alias Scope
The system MUST add `rholden.dev` route aliases only for services that are intentionally exposed through Cloudflare Tunnel aliases.

#### Scenario: Unrelated services keep existing hostnames
Given a service does not have a Cloudflare Tunnel alias under `rholden.dev`
When workload routing resources are rendered
Then the system MUST preserve that service's existing hostname set
And the system MUST NOT add a new `rholden.dev` alias to that service
