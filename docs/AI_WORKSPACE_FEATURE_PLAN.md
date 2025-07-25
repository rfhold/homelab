# AI Workspace Feature Plan

## Overview
This document outlines the implementation plan for creating a LibreChat component and an AI workspace module that provides a comprehensive AI service ecosystem including web scraping, search, speech-to-text (STT), text-to-speech (TTS), and inference serving capabilities.

## Architecture

### Component: LibreChat
A Pulumi component that wraps the LibreChat Helm chart with extensive configuration options.

### Module: AI Workspace
A Pulumi module that orchestrates multiple AI-related services with implementation switching and automatic integration with LibreChat.

## LibreChat Component

### Configuration Requirements
- **Model Providers**: Support for OpenAI, Anthropic, and custom endpoints (Ollama, vLLM)
- **S3 Connection**: For file storage with configurable bucket and credentials
- **Resource Limits**: CPU and memory limits/requests
- **Authentication**: Social logins (GitHub, etc.) with allowed domains
- **Interface Options**: Customizable UI features and welcome messages
- **MCP Servers**: Support for Model Context Protocol servers
- **Speech Configuration**: STT/TTS settings with provider selection

### Key Features
- Automatic database provisioning (PostgreSQL)
- Redis/Valkey cache integration
- Ingress configuration with TLS support
- Persistent volume claims for data storage
- Environment variable injection for service connections

## AI Workspace Module

### Service-Oriented Architecture
The module will use a service-oriented configuration approach where each service is explicitly configured:

```typescript
// Enums for implementation selection
enum STTImplementation {
  SPEACHES = "speaches",
  OPENAI = "openai",
}

enum TTSImplementation {
  SPEACHES = "speaches",
  OPENAI = "openai",
}

enum FirecrawlProvider {
  OPENAI = "openai",
  // Future: ANTHROPIC = "anthropic",
  // Future: LOCAL = "local",
}

aiWorkspace: {
  librechat: {
    enabled: true,
    stt: {
      implementation: STTImplementation.SPEACHES, // or OPENAI
    },
    tts: {
      implementation: TTSImplementation.SPEACHES, // or OPENAI
    },
    // ... other LibreChat config
  },
  firecrawl: {
    enabled: true,
    replicas: 1,
    resources: { /* limits and requests */ },
    storage: { /* PVC config */ },
    provider: {
      type: FirecrawlProvider.OPENAI,
      apiKey: "...", // or reference from openai.apiKey if enabled
      model: "gpt-4o-mini", // LLM for extraction/processing
      embeddingModel: "text-embedding-3-small", // for semantic search
    },
  },
  searxng: {
    enabled: true,
    replicas: 1,
    engines: [...],
    resources: { /* limits and requests */ },
  },
  speaches: {
    enabled: true,
    stt: {
      model: "large-v3", // Faster-Whisper model
    },
    tts: {
      voices: [...], // Kokoro voices
    },
    storage: { /* model storage PVC */ },
    resources: { /* limits and requests */ },
  },
  openai: {
    enabled: true,
    apiKey: "...",
    models: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "gpt-4-turbo"],
    stt: {
      model: "whisper-1",
    },
    tts: {
      model: "tts-1-hd",
      voice: "alloy", // alloy, echo, fable, onyx, nova, shimmer
    },
  },
  anthropic: {
    enabled: true,
    apiKey: "...",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  },
  // TODO: inference serving (ollama, vllm)
}
```

### Services

#### 1. Firecrawl
- **Components**: API, Worker, Playwright setup
- **Dependencies**: PostgreSQL (dedicated), Redis (dedicated)
- **Storage**: Persistent volume for crawled data
- **Configuration**: 
  - Replica count (default: 1)
  - Resource limits with sane defaults
  - API authentication keys
  - Provider configuration (OpenAI, future: Anthropic, local)
  - Model selection for content extraction/processing
  - Embedding model for semantic search capabilities

#### 2. SearXNG
- **Dependencies**: Redis for caching
- **Storage**: Cache persistence
- **Configuration**:
  - Search engines selection
  - Privacy settings
  - Resource limits
  - Replica count (default: 1)

#### 3. Speaches (STT/TTS)
- **Type**: Self-hosted speech service combining Faster-Whisper (STT) and Kokoro (TTS)
- **Storage**: Model and voice storage via PVC
- **Configuration**:
  - STT: Model selection (e.g., "large-v3"), language settings
  - TTS: Voice selection, language settings
  - Resource allocation
  - Replica count

#### 4. OpenAI Provider
- **Type**: External API provider
- **Services**: Chat models, STT (Whisper), and TTS
- **Configuration**:
  - API key
  - Chat models array (gpt-4o, gpt-4o-mini, o1, o1-mini, etc.)
  - STT configuration (model selection)
  - TTS configuration (model and voice selection)
  - No storage required

#### 5. Anthropic Provider
- **Type**: External API provider
- **Services**: Claude models for chat
- **Configuration**:
  - API key
  - Model selection
  - No storage required

#### 6. Inference Serving
- **TODO**: Implementation for Ollama and vLLM
- Placeholder for future development

### Integration Features

#### Auto-Connect
- Module automatically configures LibreChat with service endpoints
- Service discovery based on enabled services
- Dynamic URL generation for internal services
- API key propagation for external services

#### Implementation Switching
- LibreChat can specify which implementation to use via enums
- Support for mixed deployments (e.g., OpenAI for TTS, local for STT)
- Easy switching between providers without reconfiguration

#### Database Management
- LibreChat manages its own database
- Module creates dedicated databases for services that need them
- Shared Redis instances where appropriate
- Connection string generation and injection

### Security & Networking
- TLS enabled where possible
- API key management for service-to-service communication
- External provider API keys passed through module configuration
- No network policies initially (future enhancement)

### Resource Management
- All services have configurable resource limits
- Sane defaults provided for each service
- Replica counts configurable (default: 1)
- Persistent volume claims for all stateful services

## Implementation Plan

### Phase 1: LibreChat Component
1. Create `librechat.ts` component with full configuration interface
2. Implement Helm chart integration
3. Add database and cache provisioning
4. Configure S3 integration
5. Set up ingress with TLS

### Phase 2: AI Workspace Module Structure
1. Create `ai-workspace.ts` module with service-oriented configuration
2. Define implementation enums for STT and TTS
3. Set up module structure with service switching logic

### Phase 3: Service Implementations
1. Implement Firecrawl service configuration
2. Implement SearXNG service configuration
3. Implement Speaches service (combining Faster-Whisper STT and Kokoro TTS)
5. Add OpenAI provider configurations

### Phase 4: Integration
1. Implement auto-connect functionality
2. Configure service discovery and URL generation
3. Set up API key propagation
4. Test implementation switching

### Phase 5: Documentation & Testing
1. Update component README with LibreChat documentation
2. Update module README with AI workspace documentation
3. Create usage examples
4. Add configuration examples for common scenarios

## Configuration Examples

### Basic AI Workspace
```typescript
new AIWorkspaceModule("ai-workspace", {
  namespace: "ai",
  librechat: {
    enabled: true,
    domain: "chat.example.com",
    stt: { implementation: STTImplementation.SPEACHES },
    tts: { implementation: TTSImplementation.SPEACHES },
  },
  speaches: {
    enabled: true,
    stt: {
      model: "large-v3",
    },
    tts: {
      voices: ["af_heart", "af_bella"],
    },
  },
});
```

### Mixed Provider Setup
```typescript
new AIWorkspaceModule("ai-workspace", {
  namespace: "ai",
  librechat: {
    enabled: true,
    domain: "chat.example.com",
    stt: { implementation: STTImplementation.OPENAI },
    tts: { implementation: TTSImplementation.SPEACHES },
  },
  openai: {
    enabled: true,
    apiKey: config.require("openai-api-key"),
    models: ["gpt-4o", "gpt-4o-mini"],
    stt: {
      model: "whisper-1",
    },
    tts: {
      model: "tts-1",
      voice: "nova",
    },
  },
  speaches: {
    enabled: true,
    tts: {
      voices: ["af_heart", "af_bella"],
    },
  },
  firecrawl: {
    enabled: true,
    replicas: 2,
    provider: {
      type: FirecrawlProvider.OPENAI,
      model: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
    },
  },
  searxng: {
    enabled: true,
  },
});
```

### Full External Providers Setup
```typescript
new AIWorkspaceModule("ai-workspace", {
  namespace: "ai",
  librechat: {
    enabled: true,
    domain: "chat.example.com",
    stt: { implementation: STTImplementation.OPENAI },
    tts: { implementation: TTSImplementation.OPENAI },
    modelProviders: {
      openai: true,
      anthropic: true,
    },
  },
  openai: {
    enabled: true,
    apiKey: config.require("openai-api-key"),
    models: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini"],
    stt: {
      model: "whisper-1",
    },
    tts: {
      model: "tts-1-hd",
      voice: "alloy",
    },
  },
  anthropic: {
    enabled: true,
    apiKey: config.require("anthropic-api-key"),
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  },
  firecrawl: {
    enabled: true,
    provider: {
      type: FirecrawlProvider.OPENAI,
      model: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-large",
    },
  },
});
```

## Future Enhancements
- Network policies for service isolation
- Horizontal pod autoscaling
- Multi-region deployment support
- Additional STT/TTS providers
- Inference serving implementation (Ollama, vLLM)
- Monitoring and observability integration
- Backup and disaster recovery