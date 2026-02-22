import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import * as bcrypt from "bcryptjs";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface RadicaleArgs {
  namespace: pulumi.Input<string>;

  auth: {
    username: pulumi.Input<string>;
  };

  storage?: StorageConfig;

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

  httpRoute?: {
    enabled?: boolean;
    hostname: pulumi.Input<string>;
    gatewayRef: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    };
    requestTimeout?: pulumi.Input<string>;
  };
}

export class Radicale extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly secret: k8s.core.v1.Secret;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;
  public readonly password: pulumi.Output<string>;

  constructor(name: string, args: RadicaleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Radicale", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "radicale",
      component: name,
    };

    const generatedPassword = new random.RandomPassword(`${name}-password`, {
      length: 32,
      special: false,
    }, defaultResourceOptions);

    this.password = generatedPassword.result;

    const htpasswd = pulumi.all([args.auth.username, generatedPassword.result]).apply(
      ([username, password]) => {
        const hash = bcrypt.hashSync(password, 5);
        return `${username}:${hash}`;
      }
    );

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "1Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    this.pvc = createPVC(`${name}-data-pvc`, {
      ...storageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "config": [
          "[server]",
          "hosts = 0.0.0.0:5232",
          "",
          "[auth]",
          "type = htpasswd",
          "htpasswd_filename = /etc/radicale/users",
          "htpasswd_encryption = bcrypt",
          "",
          "[storage]",
          "filesystem_folder = /data/collections",
          "",
          "[web]",
          "type = internal",
        ].join("\n"),
      },
    }, defaultResourceOptions);

    this.secret = new k8s.core.v1.Secret(`${name}-htpasswd`, {
      metadata: {
        name: `${name}-htpasswd`,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        users: htpasswd,
      },
    }, defaultResourceOptions);

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            securityContext: {
              fsGroup: 1000,
            },
            containers: [{
              name: "radicale",
              image: DOCKER_IMAGES.RADICALE.image,
              args: ["--config", "/config/config"],
              ports: [{
                containerPort: 5232,
                name: "http",
              }],
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/data/collections",
                },
                {
                  name: "config",
                  mountPath: "/config",
                  readOnly: true,
                },
                {
                  name: "htpasswd",
                  mountPath: "/etc/radicale",
                  readOnly: true,
                },
              ],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "64Mi",
                  cpu: args.resources?.requests?.cpu || "50m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "128Mi",
                  cpu: args.resources?.limits?.cpu || "200m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 5232,
                },
                initialDelaySeconds: 10,
                periodSeconds: 30,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 5232,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/",
                  port: 5232,
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 6,
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
              {
                name: "htpasswd",
                secret: {
                  secretName: this.secret.metadata.name,
                },
              },
            ],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 5232,
          targetPort: 5232,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.httpRoute?.enabled) {
      this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
          name,
          namespace: args.namespace,
          labels,
        },
        spec: {
          parentRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: args.httpRoute.gatewayRef.name,
            namespace: args.httpRoute.gatewayRef.namespace,
          }],
          hostnames: [args.httpRoute.hostname],
          rules: [{
            matches: [{ path: { type: "PathPrefix", value: "/" } }],
            backendRefs: [{
              name: this.service.metadata.name,
              port: 5232,
            }],
            timeouts: args.httpRoute.requestTimeout
              ? { request: args.httpRoute.requestTimeout }
              : undefined,
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      pvc: this.pvc,
      configMap: this.configMap,
      secret: this.secret,
      httpRoute: this.httpRoute,
      password: this.password,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:5232`;
  }
}
