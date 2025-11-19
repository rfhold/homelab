import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVCSpec } from "../adapters/storage";

export interface TrmnlLaravelArgs {
  namespace: pulumi.Input<string>;

  timezone?: pulumi.Input<string>;

  registrationEnabled?: pulumi.Input<boolean>;

  proxyRefreshMinutes?: pulumi.Input<number>;

  proxyBaseUrl?: pulumi.Input<string>;

  storage?: {
    database?: StorageConfig;
    generated?: StorageConfig;
  };

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
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
}

export class TrmnlLaravel extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly databasePvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly storagePvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly appKey: random.RandomPassword;

  constructor(name: string, args: TrmnlLaravelArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:TrmnlLaravel", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    this.appKey = new random.RandomPassword(`${name}-app-key`, {
      length: 32,
      special: false,
    }, defaultResourceOptions);

    const databaseStorageConfig: StorageConfig = {
      size: args.storage?.database?.size || "5Gi",
      storageClass: args.storage?.database?.storageClass,
      accessModes: args.storage?.database?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.database?.volumeMode,
      namespace: args.storage?.database?.namespace,
      labels: args.storage?.database?.labels,
      annotations: args.storage?.database?.annotations,
      selector: args.storage?.database?.selector,
      dataSource: args.storage?.database?.dataSource,
    };

    const generatedStorageConfig: StorageConfig = {
      size: args.storage?.generated?.size || "10Gi",
      storageClass: args.storage?.generated?.storageClass || args.storage?.database?.storageClass,
      accessModes: args.storage?.generated?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.generated?.volumeMode,
      namespace: args.storage?.generated?.namespace,
      labels: args.storage?.generated?.labels,
      annotations: args.storage?.generated?.annotations,
      selector: args.storage?.generated?.selector,
      dataSource: args.storage?.generated?.dataSource,
    };

    const databasePvcSpec = createPVCSpec(databaseStorageConfig);
    const generatedPvcSpec = createPVCSpec(generatedStorageConfig);

    this.databasePvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-database`, {
      metadata: {
        name: `${name}-database`,
        namespace: args.namespace,
      },
      spec: databasePvcSpec,
    }, defaultResourceOptions);

    this.storagePvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-storage`, {
      metadata: {
        name: `${name}-storage`,
        namespace: args.namespace,
      },
      spec: generatedPvcSpec,
    }, defaultResourceOptions);

    const appKeyBase64 = this.appKey.result.apply(key => Buffer.from(key).toString('base64'));

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      stringData: {
        APP_KEY: pulumi.interpolate`base64:${appKeyBase64}`,
      },
    }, defaultResourceOptions);

    const labels = { app: "trmnl", component: name };

    const env: k8s.types.input.core.v1.EnvVar[] = [
      {
        name: "APP_KEY",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "APP_KEY",
          },
        },
      },
      { name: "PHP_OPCACHE_ENABLE", value: "1" },
      { name: "DB_DATABASE", value: "database/storage/database.sqlite" },
      { name: "APP_TIMEZONE", value: args.timezone || "UTC" },
      { name: "REGISTRATION_ENABLED", value: (args.registrationEnabled !== false ? "1" : "0") },
    ];

    if (args.proxyRefreshMinutes !== undefined) {
      env.push({ name: "TRMNL_PROXY_REFRESH_MINUTES", value: args.proxyRefreshMinutes.toString() });
    }

    if (args.proxyBaseUrl) {
      env.push({ name: "TRMNL_PROXY_BASE_URL", value: args.proxyBaseUrl });
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
          rollingUpdate: undefined,
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            securityContext: {
              fsGroup: 1000,
            },
            containers: [{
              name: "trmnl",
              image: DOCKER_IMAGES.TRMNL_BYOS_LARAVEL.image,
              ports: [{
                containerPort: 8080,
                name: "http",
              }],
              env: env,
              volumeMounts: [
                {
                  name: "database",
                  mountPath: "/var/www/html/database/storage",
                },
                {
                  name: "storage",
                  mountPath: "/var/www/html/storage/app/public/images/generated",
                },
              ],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "256Mi",
                  cpu: args.resources?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "512Mi",
                  cpu: args.resources?.limits?.cpu || "500m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 8080,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 8080,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
            }],
            volumes: [
              {
                name: "database",
                persistentVolumeClaim: {
                  claimName: this.databasePvc.metadata.name,
                },
              },
              {
                name: "storage",
                persistentVolumeClaim: {
                  claimName: this.storagePvc.metadata.name,
                },
              },
            ],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 8080,
          targetPort: 8080,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      const ingressRules = [{
        host: args.ingress.host,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix" as const,
            backend: {
              service: {
                name: this.service.metadata.name,
                port: {
                  number: 8080,
                },
              },
            },
          }],
        },
      }];

      const ingressTls = args.ingress.tls?.enabled ? [{
        hosts: [args.ingress.host],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          rules: ingressRules,
          tls: ingressTls,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
      databasePvc: this.databasePvc,
      storagePvc: this.storagePvc,
      ingress: this.ingress,
      appKey: this.appKey,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}:8080`;
  }

  public getIngressUrl(): pulumi.Output<string> | undefined {
    if (this.ingress) {
      return pulumi.interpolate`https://${this.ingress.spec.rules[0].host}`;
    }
    return undefined;
  }
}
