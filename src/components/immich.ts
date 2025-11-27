import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { PostgreSQLConfig } from "../adapters/postgres";
import { RedisConfig } from "../adapters/redis";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { getIngressUrl } from "../utils/kubernetes";

export interface ResourceArgs {
  requests?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
  limits?: {
    memory?: pulumi.Input<string>;
    cpu?: pulumi.Input<string>;
  };
}

export interface TlsArgs {
  enabled?: pulumi.Input<boolean>;
  secretName?: pulumi.Input<string>;
}

export interface ImmichMachineLearningArgs {
  enabled?: pulumi.Input<boolean>;
  replicas?: pulumi.Input<number>;
  requestThreads?: pulumi.Input<number>;
  modelInterOpThreads?: pulumi.Input<number>;
  modelIntraOpThreads?: pulumi.Input<number>;
  workers?: pulumi.Input<number>;
  modelTtl?: pulumi.Input<number>;
  cacheFolder?: pulumi.Input<string>;
  preloadClipTextual?: pulumi.Input<string>;
  preloadClipVisual?: pulumi.Input<string>;
  preloadFacialRecognitionDetection?: pulumi.Input<string>;
  preloadFacialRecognitionRecognition?: pulumi.Input<string>;
  resources?: ResourceArgs;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
}

export interface ImmichServerArgs {
  replicas?: pulumi.Input<number>;
  resources?: ResourceArgs;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
}

export interface ImmichArgs {
  /** Kubernetes namespace to deploy Immich into */
  namespace: pulumi.Input<string>;

  /** PostgreSQL database connection configuration */
  postgresql: PostgreSQLConfig;

  /** Redis/Valkey connection configuration */
  redis: RedisConfig;

  /** Storage configuration for Immich library */
  libraryStorage?: StorageConfig;

  /** Storage configuration for ML model cache */
  modelCacheStorage?: StorageConfig;

  /** Machine learning configuration */
  machineLearning?: ImmichMachineLearningArgs;

  /** Server configuration */
  server?: ImmichServerArgs;

  /** Ingress configuration */
  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: TlsArgs;
  };

  /** Immich image tag (defaults to chart version) */
  imageTag?: pulumi.Input<string>;

  /** Additional environment variables */
  env?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * Immich component - Self-hosted photo and video management solution
 * 
 * This component deploys the complete Immich stack including:
 * - Immich Server (NestJS, REST API, WebSockets, business logic)
 * - Immich Machine Learning (FastAPI Python, AI/ML inference)
 * - Integration with external PostgreSQL and Redis/Valkey
 * - Persistent storage for photo library and ML model cache
 * - Ingress with support for large file uploads
 * 
 * @example
 * ```typescript
 * import { Immich } from "../components/immich";
 * 
 * const immich = new Immich("photos", {
 *   namespace: "media",
 *   postgresql: {
 *     host: "postgres-rw.database.svc.cluster.local",
 *     port: 5432,
 *     database: "immich",
 *     username: "immich",
 *     password: postgresPassword,
 *   },
 *   redis: {
 *     host: "valkey.media.svc.cluster.local",
 *     port: 6379,
 *     password: valkeyPassword,
 *   },
 *   libraryStorage: {
 *     size: "500Gi",
 *     storageClass: "ceph-block",
 *   },
 *   modelCacheStorage: {
 *     size: "10Gi",
 *     storageClass: "ceph-block",
 *   },
 *   machineLearning: {
 *     enabled: true,
 *     replicas: 1,
 *     requestThreads: 4,
 *     modelIntraOpThreads: 2,
 *     preloadClipTextual: "ViT-B-16-SigLIP__webli",
 *     preloadClipVisual: "ViT-B-16-SigLIP__webli",
 *     resources: {
 *       requests: { memory: "2Gi", cpu: "1000m" },
 *       limits: { memory: "4Gi", cpu: "4000m" },
 *     },
 *   },
 *   server: {
 *     replicas: 1,
 *     resources: {
 *       requests: { memory: "1Gi", cpu: "500m" },
 *       limits: { memory: "2Gi", cpu: "2000m" },
 *     },
 *   },
 *   ingress: {
 *     enabled: true,
 *     className: "traefik",
 *     host: "photos.example.com",
 *     tls: { enabled: true },
 *   },
 * });
 * 
 * const url = immich.getIngressUrl();
 * ```
 * 
 * @see https://immich.app/
 * @see https://github.com/immich-app/immich-charts
 */
export class Immich extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  /** The Ingress resource (if enabled) */
  public readonly ingress?: k8s.networking.v1.Ingress;

  /** Library storage PVC */
  public readonly libraryPvc?: k8s.core.v1.PersistentVolumeClaim;

  /** Model cache storage PVC */
  public readonly modelCachePvc?: k8s.core.v1.PersistentVolumeClaim;

  constructor(name: string, args: ImmichArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Immich", name, args, opts);

    const labels = { app: name };

    // Create library storage PVC if configured
    if (args.libraryStorage) {
      this.libraryPvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-library`, {
        metadata: {
          name: `${name}-library`,
          namespace: args.namespace,
          labels,
        },
        spec: createPVCSpec(args.libraryStorage),
      }, { parent: this });
    }

    // Create model cache storage PVC if configured
    if (args.modelCacheStorage) {
      this.modelCachePvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-model-cache`, {
        metadata: {
          name: `${name}-model-cache`,
          namespace: args.namespace,
          labels,
        },
        spec: createPVCSpec(args.modelCacheStorage),
      }, { parent: this });
    }

    // Build chart values
    const chartValues = this.buildChartValues(args, labels);

    // Deploy Immich using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        ...createHelmChartArgs(HELM_CHARTS.IMMICH, args.namespace),
        values: chartValues,
      },
      { parent: this }
    );

    // Create ingress if enabled
    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels,
          annotations: pulumi.all([
            args.ingress.annotations || {},
            pulumi.output(args.ingress.tls?.enabled || false),
          ]).apply(([annotations, tlsEnabled]) => ({
            ...annotations,
            ...(tlsEnabled ? {} : {
              "traefik.ingress.kubernetes.io/router.tls": "false",
            }),
          })),
        },
        spec: {
          ingressClassName: args.ingress.className,
          tls: args.ingress.tls?.enabled ? [{
            hosts: [args.ingress.host],
            secretName: args.ingress.tls.secretName || `${name}-tls`,
          }] : undefined,
          rules: [{
            host: args.ingress.host,
            http: {
              paths: [{
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: `${name}-chart-server`,
                    port: {
                      number: 2283,
                    },
                  },
                },
              }],
            },
          }],
        },
      }, { parent: this });
    }

    this.registerOutputs({
      chart: this.chart,
      ingress: this.ingress,
      libraryPvc: this.libraryPvc,
      modelCachePvc: this.modelCachePvc,
    });
  }

  private buildChartValues(args: ImmichArgs, labels: { [key: string]: string }): any {
    const mlConfig = args.machineLearning || {};

    const baseValues: any = {
      controllers: {
        main: {
          containers: {
            main: {
              image: {
                tag: args.imageTag || "v2.3.1",
              },
              env: {
                DB_HOSTNAME: args.postgresql.host,
                DB_PORT: args.postgresql.port || 5432,
                DB_USERNAME: args.postgresql.username,
                DB_PASSWORD: args.postgresql.password,
                DB_DATABASE_NAME: args.postgresql.database,
                REDIS_HOSTNAME: args.redis.host,
                REDIS_PORT: args.redis.port || 6379,
                REDIS_PASSWORD: args.redis.password,
                ...args.env,
              },
            },
          },
        },
      },
      immich: {
        persistence: {
          library: {
            existingClaim: this.libraryPvc?.metadata.name,
          },
        },
      },
      valkey: {
        enabled: false,
      },
      server: {
        enabled: true,
        controllers: {
          main: {
            replicas: args.server?.replicas || 1,
            containers: {
              main: {
                image: {
                  tag: args.imageTag || "v2.3.1",
                },
                resources: args.server?.resources,
                env: {
                  DB_HOSTNAME: args.postgresql.host,
                  DB_PORT: args.postgresql.port || 5432,
                  DB_USERNAME: args.postgresql.username,
                  DB_PASSWORD: args.postgresql.password,
                  DB_DATABASE_NAME: args.postgresql.database,
                  REDIS_HOSTNAME: args.redis.host,
                  REDIS_PORT: args.redis.port || 6379,
                  REDIS_PASSWORD: args.redis.password,
                },
              },
            },
            ...(args.server?.nodeSelector && { nodeSelector: args.server.nodeSelector }),
            ...(args.server?.tolerations && {
              pod: { tolerations: args.server.tolerations },
            }),
          },
        },
      },
      "machine-learning": {
        enabled: mlConfig.enabled !== false,
        controllers: {
          main: {
            replicas: mlConfig.replicas || 1,
            containers: {
              main: {
                image: {
                  tag: args.imageTag || "v2.3.1",
                },
                resources: mlConfig.resources,
                env: {
                  TRANSFORMERS_CACHE: "/cache",
                  HF_XET_CACHE: "/cache/huggingface-xet",
                  MPLCONFIGDIR: "/cache/matplotlib-config",
                  MACHINE_LEARNING_REQUEST_THREADS: mlConfig.requestThreads || 4,
                  MACHINE_LEARNING_MODEL_INTER_OP_THREADS: mlConfig.modelInterOpThreads || 1,
                  MACHINE_LEARNING_MODEL_INTRA_OP_THREADS: mlConfig.modelIntraOpThreads || 2,
                  MACHINE_LEARNING_WORKERS: mlConfig.workers || 1,
                  MACHINE_LEARNING_MODEL_TTL: mlConfig.modelTtl || 300,
                  ...(mlConfig.preloadClipTextual && {
                    MACHINE_LEARNING_PRELOAD__CLIP__TEXTUAL: mlConfig.preloadClipTextual,
                  }),
                  ...(mlConfig.preloadClipVisual && {
                    MACHINE_LEARNING_PRELOAD__CLIP__VISUAL: mlConfig.preloadClipVisual,
                  }),
                  ...(mlConfig.preloadFacialRecognitionDetection && {
                    MACHINE_LEARNING_PRELOAD__FACIAL_RECOGNITION__DETECTION: mlConfig.preloadFacialRecognitionDetection,
                  }),
                  ...(mlConfig.preloadFacialRecognitionRecognition && {
                    MACHINE_LEARNING_PRELOAD__FACIAL_RECOGNITION__RECOGNITION: mlConfig.preloadFacialRecognitionRecognition,
                  }),
                },
              },
            },
            ...(mlConfig.nodeSelector && { nodeSelector: mlConfig.nodeSelector }),
            ...(mlConfig.tolerations && {
              pod: { tolerations: mlConfig.tolerations },
            }),
          },
        },
        persistence: {
          cache: {
            enabled: true,
            existingClaim: this.modelCachePvc?.metadata.name,
            type: "persistentVolumeClaim",
          },
        },
      },
    };

    return baseValues;
  }

  /**
   * Returns the ingress URL for the Immich web interface
   */
  public getIngressUrl(): pulumi.Output<string> | undefined {
    if (this.ingress) {
      return getIngressUrl(this.ingress);
    }
    return undefined;
  }

  /**
   * Returns the internal service URL for Immich server
   */
  public getServerUrl(namespace: pulumi.Input<string>): pulumi.Output<string> {
    return pulumi.interpolate`http://immich-server.${namespace}.svc.cluster.local:2283`;
  }

  /**
   * Returns the internal service URL for Immich machine learning
   */
  public getMachineLearningUrl(namespace: pulumi.Input<string>): pulumi.Output<string> {
    return pulumi.interpolate`http://immich-machine-learning.${namespace}.svc.cluster.local:3003`;
  }
}