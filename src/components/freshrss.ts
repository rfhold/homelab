import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface FreshRSSArgs {
  namespace: pulumi.Input<string>;

  timezone?: pulumi.Input<string>;
  cronMin?: pulumi.Input<string>;
  environment?: "production" | "development";

  config?: {
    dataPath?: pulumi.Input<string>;
    listen?: pulumi.Input<string>;
    copyLogToSyslog?: boolean;
    copySyslogToStderr?: boolean;
    trustedProxy?: pulumi.Input<string>;
  };

  storage: {
    data: StorageConfig;
    extensions?: StorageConfig;
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

  replicas?: pulumi.Input<number>;

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };
}

export class FreshRSS extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly dataPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly extensionsPvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: FreshRSSArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:FreshRSS", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "freshrss",
      component: name,
    };

    this.dataPvc = createPVC(`${name}-data-pvc`, {
      ...args.storage.data,
      namespace: args.namespace,
    }, defaultResourceOptions);

    let extensionsPvcName: pulumi.Output<string> | undefined;
    if (args.storage.extensions) {
      this.extensionsPvc = createPVC(`${name}-extensions-pvc`, {
        ...args.storage.extensions,
        namespace: args.namespace,
      }, defaultResourceOptions);
      extensionsPvcName = this.extensionsPvc.metadata.name;
    }

    const environment = [
      {
        name: "TZ",
        value: args.timezone || "UTC",
      },
      {
        name: "FRESHRSS_ENV",
        value: args.environment || "production",
      },
    ];

    if (args.cronMin) {
      environment.push({
        name: "CRON_MIN",
        value: args.cronMin,
      });
    }

    if (args.config?.dataPath) {
      environment.push({
        name: "DATA_PATH",
        value: args.config.dataPath,
      });
    }

    if (args.config?.listen) {
      environment.push({
        name: "LISTEN",
        value: args.config.listen,
      });
    }

    if (args.config?.copyLogToSyslog !== undefined) {
      environment.push({
        name: "COPY_LOG_TO_SYSLOG",
        value: args.config.copyLogToSyslog ? "On" : "Off",
      });
    }

    if (args.config?.copySyslogToStderr !== undefined) {
      environment.push({
        name: "COPY_SYSLOG_TO_STDERR",
        value: args.config.copySyslogToStderr ? "On" : "Off",
      });
    }

    if (args.config?.trustedProxy) {
      environment.push({
        name: "TRUSTED_PROXY",
        value: args.config.trustedProxy,
      });
    }

    const volumeMounts = [
      {
        name: "data",
        mountPath: "/var/www/FreshRSS/data",
      },
    ];

    const volumes = [
      {
        name: "data",
        persistentVolumeClaim: {
          claimName: this.dataPvc.metadata.name,
        },
      },
    ];

    if (this.extensionsPvc) {
      volumeMounts.push({
        name: "extensions",
        mountPath: "/var/www/FreshRSS/extensions",
      });
      volumes.push({
        name: "extensions",
        persistentVolumeClaim: {
          claimName: extensionsPvcName!,
        },
      });
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: args.replicas || 1,
        strategy: {
          type: "Recreate",
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
              fsGroup: 33,
            },
            containers: [{
              name: "freshrss",
              image: DOCKER_IMAGES.FRESHRSS.image,
              imagePullPolicy: "IfNotPresent",
              ports: [{
                containerPort: 80,
                name: "http",
              }],
              env: environment,
              volumeMounts: volumeMounts,
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
                  port: 80,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 12,
              },
            }],
            volumes: volumes,
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
          port: 80,
          targetPort: 80,
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
                  number: 80,
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
      dataPvc: this.dataPvc,
      extensionsPvc: this.extensionsPvc,
      ingress: this.ingress,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:80`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }
}
