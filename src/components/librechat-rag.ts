import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

/**
 * Configuration for the LibreChat RAG API component
 */
export interface LibreChatRagArgs {
  /** Kubernetes namespace to deploy LibreChat RAG API into */
  namespace: pulumi.Input<string>;
  
  /** Custom name for the component (defaults to resource name) */
  name?: pulumi.Input<string>;
  
  /** Docker image configuration */
  image?: {
    /** Docker image to use (defaults to DOCKER_IMAGES.LIBRECHAT_RAG_API_LITE.image) */
    repository?: pulumi.Input<string>;
    /** Image pull policy */
    pullPolicy?: pulumi.Input<string>;
  };
  
  /** Database connection configuration */
  database: {
    /** Database host */
    host: pulumi.Input<string>;
    /** Database port (defaults to 5432) */
    port?: pulumi.Input<number>;
    /** Database name */
    name: pulumi.Input<string>;
    /** Database admin password (postgres user) */
    adminPassword: pulumi.Input<string>;
  };
  
  /** Vector store configuration */
  vectorStore?: {
    /** Vector store provider (defaults to "pgvector") */
    provider?: pulumi.Input<string>;
    /** Embedding model to use (defaults to "text-embedding-3-small") */
    embeddingModel?: pulumi.Input<string>;
    /** Chunk size for document processing (defaults to 1000) */
    chunkSize?: pulumi.Input<number>;
    /** Chunk overlap for document processing (defaults to 200) */
    chunkOverlap?: pulumi.Input<number>;
  };
  
  /** OpenAI configuration for embeddings */
  openai: {
    /** OpenAI API key */
    apiKey: pulumi.Input<string>;
  };
  
  /** Resource limits and requests */
  resources?: {
    /** Resource requests */
    requests?: {
      /** Memory request (defaults to "512Mi") */
      memory?: pulumi.Input<string>;
      /** CPU request (defaults to "250m") */
      cpu?: pulumi.Input<string>;
    };
    /** Resource limits */
    limits?: {
      /** Memory limit (defaults to "2Gi") */
      memory?: pulumi.Input<string>;
      /** CPU limit (defaults to "1000m") */
      cpu?: pulumi.Input<string>;
    };
  };
  
  /** Number of replicas (defaults to 1) */
  replicas?: pulumi.Input<number>;
  
  /** Port configuration (defaults to 8000) */
  port?: pulumi.Input<number>;
  
  /** Additional environment variables */
  extraEnv?: pulumi.Input<k8s.types.input.core.v1.EnvVar[]>;
}

/**
 * LibreChat RAG API component - provides Retrieval-Augmented Generation capabilities for LibreChat
 * 
 * This component deploys the LibreChat RAG API service which enables:
 * - Document upload and processing
 * - Vector embeddings generation using OpenAI
 * - Similarity search using pgvector
 * - Context retrieval for enhanced AI responses
 * 
 * @example
 * ```typescript
 * import { LibreChatRag } from "../components/librechat-rag";
 * 
 * const ragApi = new LibreChatRag("rag-api", {
 *   namespace: "ai-workspace",
 *   database: {
 *     host: "pgvector-postgresql",
 *     port: 5432,
 *     name: "librechat_rag",
 *     adminPassword: pulumi.secret("secure-password"),
 *   },
 *   openai: {
 *     apiKey: config.requireSecret("openai-api-key"),
 *   },
 *   vectorStore: {
 *     embeddingModel: "text-embedding-3-small",
 *     chunkSize: 1000,
 *     chunkOverlap: 200,
 *   },
 *   resources: {
 *     requests: {
 *       memory: "1Gi",
 *       cpu: "500m",
 *     },
 *     limits: {
 *       memory: "4Gi",
 *       cpu: "2000m",
 *     },
 *   },
 * });
 * 
 * // Access the API endpoint
 * const apiEndpoint = ragApi.getApiEndpoint();
 * ```
 * 
 * @see https://github.com/danny-avila/LibreChat
 * @see https://docs.librechat.ai/features/rag
 */
export class LibreChatRag extends pulumi.ComponentResource {
  /** The Kubernetes deployment */
  public readonly deployment: k8s.apps.v1.Deployment;
  
  /** The Kubernetes service */
  public readonly service: k8s.core.v1.Service;
  
  /** The Kubernetes secret containing sensitive configuration */
  public readonly secret: k8s.core.v1.Secret;
  
  constructor(name: string, args: LibreChatRagArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:LibreChatRag", name, {}, opts);
    
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    
    const labels = { 
      app: "librechat-rag",
      component: args.name || name,
    };
    
    const ragPort = args.port || 8000;
    
    // Create secret for sensitive data
    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        POSTGRES_PASSWORD: args.database.adminPassword,
        OPENAI_API_KEY: args.openai.apiKey,
      },
    }, defaultResourceOptions);
    
    // Environment variables
    const env = pulumi.all([
      args.database.name,
      args.database.host,
      args.database.port,
      args.vectorStore?.provider,
      args.vectorStore?.embeddingModel,
      args.vectorStore?.chunkSize,
      args.vectorStore?.chunkOverlap,
      args.extraEnv,
    ]).apply(([
      dbName,
      dbHost,
      dbPort,
      vectorProvider,
      embeddingModel,
      chunkSize,
      chunkOverlap,
      extraEnv,
    ]) => {
      const envVars: k8s.types.input.core.v1.EnvVar[] = [
        // Database configuration
        { name: "POSTGRES_DB", value: dbName as string },
        { name: "POSTGRES_USER", value: "postgres" },
        {
          name: "POSTGRES_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "POSTGRES_PASSWORD",
            },
          },
        },
        { name: "DB_HOST", value: dbHost as string },
        { name: "DB_PORT", value: (dbPort || 5432).toString() },
        
        // OpenAI configuration
        {
          name: "OPENAI_API_KEY",
          valueFrom: {
            secretKeyRef: {
              name: this.secret.metadata.name,
              key: "OPENAI_API_KEY",
            },
          },
        },
        
        // Vector store configuration
        { name: "VECTOR_DB_TYPE", value: vectorProvider || "pgvector" },
        { name: "EMBEDDING_MODEL", value: embeddingModel || "text-embedding-3-small" },
        { name: "CHUNK_SIZE", value: (chunkSize || 1000).toString() },
        { name: "CHUNK_OVERLAP", value: (chunkOverlap || 200).toString() },
        
        // Service configuration
        { name: "RAG_PORT", value: ragPort.toString() },
        { name: "ENV", value: "production" },
        { name: "LOG_LEVEL", value: "info" },
      ];
      
      // Add any extra environment variables
      if (extraEnv) {
        envVars.push(...(extraEnv as k8s.types.input.core.v1.EnvVar[]));
      }
      
      return envVars;
    });
    
    // Create deployment
    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas || 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            containers: [{
              name: "rag-api",
              image: args.image?.repository || DOCKER_IMAGES.LIBRECHAT_RAG_API_LITE.image,
              imagePullPolicy: args.image?.pullPolicy || "IfNotPresent",
              ports: [{
                containerPort: ragPort,
                name: "http",
              }],
              env,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "512Mi",
                  cpu: args.resources?.requests?.cpu || "250m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "2Gi",
                  cpu: args.resources?.limits?.cpu || "1000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: ragPort,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: ragPort,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            }],
          },
        },
      },
    }, defaultResourceOptions);
    
    // Create service
    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: args.name || name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: ragPort,
          targetPort: ragPort,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);
    
    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
    });
  }
  
  /**
   * Get the API endpoint URL for the RAG service
   * @returns The internal cluster URL for the RAG API
   */
  public getApiEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}:${this.service.spec.ports[0].port}`;
  }
}