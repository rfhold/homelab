import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface ZotRegistryArgs {
  namespace: pulumi.Input<string>;

  s3: {
    endpoint: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    accessKey: pulumi.Input<string>;
    secretKey: pulumi.Input<string>;
    region?: pulumi.Input<string>;
    rootDirectory?: pulumi.Input<string>;
  };

  sync: {
    dockerHub?: {
      username: pulumi.Input<string>;
      password: pulumi.Input<string>;
    };
    github?: {
      username: pulumi.Input<string>;
      password: pulumi.Input<string>;
    };
    gcr?: {
      username: pulumi.Input<string>;
      password: pulumi.Input<string>;
    };
    quay?: {
      username: pulumi.Input<string>;
      password: pulumi.Input<string>;
    };
  };

  tls?: {
    secretName: pulumi.Input<string>;
  };

  serviceType?: pulumi.Input<string>;
  serviceAnnotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  resources?: {
    requests?: { memory?: pulumi.Input<string>; cpu?: pulumi.Input<string> };
    limits?: { memory?: pulumi.Input<string>; cpu?: pulumi.Input<string> };
  };
}

export class ZotRegistry extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly s3Secret: k8s.core.v1.Secret;
  public readonly syncCredentialsSecret: k8s.core.v1.Secret;
  public readonly endpoint: pulumi.Output<string>;
  public readonly serviceName: pulumi.Output<string>;

  constructor(name: string, args: ZotRegistryArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ZotRegistry", name, args, opts);

    const configJson = pulumi.all([
      args.s3.endpoint,
      args.s3.bucket,
      args.s3.region,
      args.s3.rootDirectory,
    ]).apply(([endpoint, bucket, region, rootDirectory]) => {
      const config: any = {
        distSpecVersion: "1.1.0",
        storage: {
          rootDirectory: "/var/lib/registry",
          storageDriver: {
            name: "s3",
            regionendpoint: endpoint,
            region: region || "us-east-1",
            bucket: bucket,
            rootDirectory: rootDirectory || "/zot",
            secure: true,
            forcepathstyle: true,
          },
          dedupe: false,
          gc: true,
        },
        http: {
          address: "0.0.0.0",
          port: "5000",
          tls: {
            cert: "/certs/tls.crt",
            key: "/certs/tls.key",
          },
          compat: ["docker2s2"],
          accessControl: {
            repositories: {
              "**": {
                anonymousPolicy: ["read", "create", "update", "delete"],
              },
            },
          },
        },
        log: {
          level: "info",
        },
        extensions: {
          search: {
            enable: true,
          },
          ui: {
            enable: true,
          },
          sync: {
            enable: true,
            credentialsFile: "/etc/zot/sync-credentials.json",
            downloadDir: "/tmp/zot-sync",
            registries: [
              {
                urls: ["https://registry-1.docker.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/docker-hub", stripPrefix: true }],
              },
              {
                urls: ["https://ghcr.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/ghcr", stripPrefix: true }],
              },
              {
                urls: ["https://nvcr.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/nvcr", stripPrefix: true }],
              },
              {
                urls: ["https://gcr.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/gcr", stripPrefix: true }],
              },
              {
                urls: ["https://quay.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/quay", stripPrefix: true }],
              },
              {
                urls: ["https://registry.k8s.io"],
                onDemand: true,
                tlsVerify: true,
                content: [{ prefix: "**", destination: "/k8s", stripPrefix: true }],
              },
            ],
          },
        },
      };

      return JSON.stringify(config, null, 2);
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
      },
      data: {
        "config.json": configJson,
      },
    }, { parent: this });

    this.s3Secret = new k8s.core.v1.Secret(`${name}-s3-secret`, {
      metadata: {
        name: `${name}-s3-secret`,
        namespace: args.namespace,
      },
      stringData: {
        accessKey: args.s3.accessKey,
        secretKey: args.s3.secretKey,
      },
    }, { parent: this });

    const syncCredentialsJson = pulumi.all([
      args.sync.dockerHub?.username,
      args.sync.dockerHub?.password,
      args.sync.github?.username,
      args.sync.github?.password,
      args.sync.gcr?.username,
      args.sync.gcr?.password,
      args.sync.quay?.username,
      args.sync.quay?.password,
    ]).apply(([dockerHubUsername, dockerHubPassword, githubUsername, githubPassword, gcrUsername, gcrPassword, quayUsername, quayPassword]) => {
      const creds: any = {};
      if (dockerHubUsername && dockerHubPassword) {
        creds["registry-1.docker.io"] = { username: dockerHubUsername, password: dockerHubPassword };
      }
      if (githubUsername && githubPassword) {
        creds["ghcr.io"] = { username: githubUsername, password: githubPassword };
      }
      if (gcrUsername && gcrPassword) {
        creds["gcr.io"] = { username: gcrUsername, password: gcrPassword };
      }
      if (quayUsername && quayPassword) {
        creds["quay.io"] = { username: quayUsername, password: quayPassword };
      }
      return JSON.stringify(creds, null, 2);
    });

    this.syncCredentialsSecret = new k8s.core.v1.Secret(`${name}-sync-credentials`, {
      metadata: {
        name: `${name}-sync-credentials`,
        namespace: args.namespace,
      },
      stringData: {
        "sync-credentials.json": syncCredentialsJson,
      },
    }, { parent: this });

    const volumes: pulumi.Input<k8s.types.input.core.v1.Volume>[] = [
      {
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
      {
        name: "sync-credentials",
        secret: {
          secretName: this.syncCredentialsSecret.metadata.name,
          items: [{ key: "sync-credentials.json", path: "sync-credentials.json" }],
        },
      },
      ...(args.tls?.secretName ? [{
        name: "certs",
        secret: {
          secretName: args.tls.secretName,
        },
      }] : []),
    ];

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
      {
        name: "config",
        mountPath: "/etc/zot/config.json",
        subPath: "config.json",
        readOnly: true,
      },
      {
        name: "sync-credentials",
        mountPath: "/etc/zot/sync-credentials.json",
        subPath: "sync-credentials.json",
        readOnly: true,
      },
      ...(args.tls?.secretName ? [{
        name: "certs",
        mountPath: "/certs",
        readOnly: true,
      }] : []),
    ];

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
            ...(args.tls?.secretName && {
              annotations: {
                "secret.reloader.stakater.com/reload": args.tls.secretName,
              },
            }),
          },
          spec: {
            containers: [{
              name: "zot",
              image: DOCKER_IMAGES.ZOT_REGISTRY.image,
              ports: [{
                containerPort: 5000,
                name: "https",
                protocol: "TCP",
              }],
              volumeMounts: volumeMounts,
              env: [
                {
                  name: "AWS_ACCESS_KEY_ID",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.s3Secret.metadata.name,
                      key: "accessKey",
                    },
                  },
                },
                {
                  name: "AWS_SECRET_ACCESS_KEY",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.s3Secret.metadata.name,
                      key: "secretKey",
                    },
                  },
                },
              ],
              resources: args.resources,
              livenessProbe: {
                httpGet: {
                  path: "/v2/",
                  port: 5000 as any,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 120,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: "/v2/",
                  port: 5000 as any,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
            volumes: volumes,
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: `${name}-registry`,
        namespace: args.namespace,
        annotations: args.serviceAnnotations,
      },
      spec: {
        type: args.serviceType || "ClusterIP",
        selector: {
          app: name,
        },
        ports: [{
          name: "https",
          port: 443,
          targetPort: 5000 as any,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    this.serviceName = this.service.metadata.name;
    this.endpoint = pulumi.all([this.service.metadata.name, args.namespace]).apply(
      ([serviceName, namespace]) => `https://${serviceName}.${namespace}:443`
    );

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      s3Secret: this.s3Secret,
      syncCredentialsSecret: this.syncCredentialsSecret,
      endpoint: this.endpoint,
      serviceName: this.serviceName,
    });
  }
}
