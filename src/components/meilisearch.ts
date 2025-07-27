import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createTOMLDocumentOutput } from "../utils/toml";
import { DOCKER_IMAGES } from "../docker-images";

export interface MeilisearchArgs {
  namespace: string;
  name?: string;
  
  // Core configuration
  masterKey: pulumi.Output<string>;
  environment?: "development" | "production";
  
  // Storage
  storage?: {
    size?: string;  // Default: "10Gi"
    storageClass?: string;
  };
  
  // Resources
  resources?: {
    limits?: {
      cpu?: string;
      memory?: string;
    };
    requests?: {
      cpu?: string;
      memory?: string;
    };
  };
  
  // Advanced configuration
  config?: {
    maxIndexingMemory?: string;
    maxIndexingThreads?: number;
    logLevel?: "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | "OFF";
    httpPayloadSizeLimit?: string;
    noAnalytics?: boolean;
    scheduleSnapshot?: number | boolean;
    experimentalLogsMode?: "human" | "json";
  };
  
  // Image configuration
  image?: {
    repository?: string;  // Default: "getmeili/meilisearch"
    tag?: string;        // Default: "v1.11"
    pullPolicy?: string; // Default: "IfNotPresent"
  };
}

export class MeilisearchComponent extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly url: pulumi.Output<string>;
  
  constructor(name: string, args: MeilisearchArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Meilisearch", name, {}, opts);
    
    const labels = { app: name };
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    
    // Build configuration object
    const configData = pulumi.all([
      args.masterKey,
      args.environment,
      args.config,
    ]).apply(([masterKey, environment, config]) => {
      const meiliConfig: any = {
        db_path: "/meili_data/data.ms",
        env: environment || "production",
        master_key: masterKey,
        http_addr: "0.0.0.0:7700",
      };
      
      // Add optional configuration
      if (config?.maxIndexingMemory) {
        meiliConfig.max_indexing_memory = config.maxIndexingMemory;
      }
      if (config?.maxIndexingThreads !== undefined) {
        meiliConfig.max_indexing_threads = config.maxIndexingThreads;
      }
      if (config?.logLevel) {
        meiliConfig.log_level = config.logLevel;
      }
      if (config?.httpPayloadSizeLimit) {
        meiliConfig.http_payload_size_limit = config.httpPayloadSizeLimit;
      }
      if (config?.noAnalytics) {
        meiliConfig.no_analytics = true;
      }
      if (config?.scheduleSnapshot !== undefined) {
        meiliConfig.schedule_snapshot = config.scheduleSnapshot;
      }
      if (config?.experimentalLogsMode) {
        meiliConfig.experimental_logs_mode = config.experimentalLogsMode;
      }
      
      return meiliConfig;
    });
    
    // Create TOML configuration
    const tomlConfig = createTOMLDocumentOutput(
      configData,
      "Meilisearch Configuration\nManaged by Pulumi",
      { sortKeys: true }
    );
    
    // Create ConfigMap
    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        namespace: args.namespace,
        labels,
      },
      data: {
        "config.toml": tomlConfig,
      },
    }, defaultResourceOptions);
    
    // Create PVC for data persistence
    this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-data`, {
      metadata: {
        namespace: args.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: args.storage?.storageClass,
        resources: {
          requests: {
            storage: args.storage?.size || "10Gi",
          },
        },
      },
    }, defaultResourceOptions);
    
    // Create Deployment
    this.deployment = new k8s.apps.v1.Deployment(name, {
      metadata: {
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            containers: [{
              name: "meilisearch",
              image: args.image ? pulumi.interpolate`${args.image.repository}:${args.image.tag}` : DOCKER_IMAGES.MEILISEARCH.image,
              imagePullPolicy: args.image?.pullPolicy || "IfNotPresent",
              env: [
                {
                  name: "MEILI_CONFIG_FILE_PATH",
                  value: "/meili_data/config.toml",
                },
              ],
              ports: [{ 
                name: "http",
                containerPort: 7700,
                protocol: "TCP",
              }],
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/meili_data",
                },
                {
                  name: "config",
                  mountPath: "/meili_data/config.toml",
                  subPath: "config.toml",
                },
              ],
              resources: args.resources || {
                requests: {
                  cpu: "100m",
                  memory: "512Mi",
                },
                limits: {
                  cpu: "1000m",
                  memory: "2Gi",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: 7700,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health",
                  port: 7700,
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
              },
            }],
            volumes: [
              {
                name: "data",
                persistentVolumeClaim: {
                  claimName: this.pvc.metadata.name,
                },
              },
              {
                name: "config",
                configMap: {
                  name: this.configMap.metadata.name,
                },
              },
            ],
          },
        },
      },
    }, defaultResourceOptions);
    
    // Create Service
    this.service = new k8s.core.v1.Service(name, {
      metadata: {
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          name: "http",
          port: 7700,
          targetPort: 7700,
          protocol: "TCP",
        }],
      },
    }, defaultResourceOptions);
    
    // Export the internal URL
    this.url = pulumi.interpolate`http://${this.service.metadata.name}:7700`;
    
    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      pvc: this.pvc,
      url: this.url,
    });
  }
}