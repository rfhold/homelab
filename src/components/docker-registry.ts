import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createPVC } from "../adapters/storage";
import { createYAMLOutput } from "../utils/yaml";
import { DOCKER_IMAGES } from "../docker-images";

export interface DockerRegistryArgs {
  namespace: pulumi.Input<string>;
  
  mode: "proxy" | "private";
  
  proxy?: {
    remoteUrl: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    ttl?: pulumi.Input<string>;
  };
  
  storage: {
    type: "filesystem" | "s3";
    
    size?: pulumi.Input<string>;
    storageClass?: pulumi.Input<string>;
    
    s3?: {
      endpoint: pulumi.Input<string>;
      bucket: pulumi.Input<string>;
      accessKey: pulumi.Input<string>;
      secretKey: pulumi.Input<string>;
      region?: pulumi.Input<string>;
      secure?: pulumi.Input<boolean>;
      rootDirectory?: pulumi.Input<string>;
    };
  };
  
  port?: pulumi.Input<number>;
  
  serviceType?: pulumi.Input<string>;
  
  serviceAnnotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  
  tls?: {
    secretName: pulumi.Input<string>;
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

export class DockerRegistry extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret?: k8s.core.v1.Secret;
  public readonly endpoint: pulumi.Output<string>;
  public readonly serviceName: pulumi.Output<string>;

  constructor(name: string, args: DockerRegistryArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:DockerRegistry", name, args, opts);

    const port = args.port || 5000;

    const configData = pulumi.all([
      args.mode,
      args.proxy?.remoteUrl,
      args.proxy?.username,
      args.proxy?.password,
      args.proxy?.ttl,
      args.storage.type,
      args.storage.s3?.endpoint,
      args.storage.s3?.bucket,
      args.storage.s3?.region,
      args.storage.s3?.secure,
      args.storage.s3?.rootDirectory,
    ]).apply(([
      mode,
      remoteUrl,
      username,
      password,
      ttl,
      storageType,
      s3Endpoint,
      s3Bucket,
      s3Region,
      s3Secure,
      s3RootDirectory,
    ]) => {
      const config: any = {
        version: "0.1",
        log: {
          level: "info",
          fields: {
            service: "registry",
          },
        },
        storage: {},
        http: {
          addr: `:${port}`,
          headers: {
            "X-Content-Type-Options": ["nosniff"],
          },
        },
        health: {
          storagedriver: {
            enabled: true,
            interval: "10s",
            threshold: 3,
          },
        },
      };

      if (mode === "proxy" && remoteUrl) {
        config.proxy = {
          remoteurl: remoteUrl,
          ttl: ttl || "168h",
        };
        if (username) {
          config.proxy.username = username;
        }
        if (password) {
          config.proxy.password = password;
        }
      }

      if (storageType === "filesystem") {
        config.storage.filesystem = {
          rootdirectory: "/var/lib/registry",
        };
      }

      config.storage.delete = {
        enabled: true,
      };

      config.storage.maintenance = {
        uploadpurging: {
          enabled: true,
          age: "168h",
          interval: "24h",
          dryrun: false,
        },
      };

      return config;
    });

    const configYaml = createYAMLOutput(configData);

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
      },
      data: {
        "config.yml": configYaml,
      },
    }, { parent: this });

    if (args.storage.type === "s3" && args.storage.s3) {
      this.secret = new k8s.core.v1.Secret(`${name}-s3-secret`, {
        metadata: {
          name: `${name}-s3-secret`,
          namespace: args.namespace,
        },
        stringData: {
          accessKey: args.storage.s3.accessKey,
          secretKey: args.storage.s3.secretKey,
        },
      }, { parent: this });
    }

    if (args.storage.type === "filesystem") {
      this.pvc = createPVC(`${name}-storage`, {
        size: args.storage.size || "10Gi",
        storageClass: args.storage.storageClass,
        namespace: args.namespace,
      }, { parent: this });
    }

    const containers: pulumi.Input<k8s.types.input.core.v1.Container>[] = [{
      name: "registry",
      image: DOCKER_IMAGES.DOCKER_REGISTRY.image,
      ports: [{
        containerPort: port,
        name: "http",
        protocol: "TCP",
      }],
      volumeMounts: [
        {
          name: "config",
          mountPath: "/etc/distribution",
          readOnly: true,
        },
        ...(args.storage.type === "filesystem" ? [{
          name: "storage",
          mountPath: "/var/lib/registry",
        }] : []),
        ...(args.tls?.secretName ? [{
          name: "certs",
          mountPath: "/certs",
          readOnly: true,
        }] : []),
      ],
      env: (() => {
        const baseEnvVars: any[] = [
          {
            name: "OTEL_TRACES_EXPORTER",
            value: "none",
          },
        ];
        
        const tlsEnvVars: any[] = args.tls?.secretName ? [
          {
            name: "REGISTRY_HTTP_TLS_CERTIFICATE",
            value: "/certs/tls.crt",
          },
          {
            name: "REGISTRY_HTTP_TLS_KEY",
            value: "/certs/tls.key",
          },
        ] : [];
        
        if (args.storage.type === "s3" && this.secret) {
          return pulumi.output(args.storage.s3).apply(s3Config => {
            if (!s3Config) return [...baseEnvVars, ...tlsEnvVars];
            const s3EnvVars: any[] = [
              ...baseEnvVars,
              ...tlsEnvVars,
              {
                name: "REGISTRY_STORAGE",
                value: "s3",
              },
              {
                name: "REGISTRY_STORAGE_S3_REGION",
                value: s3Config.region || "us-east-1",
              },
              {
                name: "REGISTRY_STORAGE_S3_REGIONENDPOINT",
                value: s3Config.endpoint,
              },
              {
                name: "REGISTRY_STORAGE_S3_BUCKET",
                value: s3Config.bucket,
              },
              {
                name: "REGISTRY_STORAGE_S3_SECURE",
                value: (s3Config.secure !== undefined ? s3Config.secure : true).toString(),
              },
              {
                name: "REGISTRY_STORAGE_S3_FORCEPATHSTYLE",
                value: "true",
              },
              {
                name: "REGISTRY_STORAGE_S3_ACCESSKEY",
                valueFrom: {
                  secretKeyRef: {
                    name: this.secret!.metadata.name,
                    key: "accessKey",
                  },
                },
              },
              {
                name: "REGISTRY_STORAGE_S3_SECRETKEY",
                valueFrom: {
                  secretKeyRef: {
                    name: this.secret!.metadata.name,
                    key: "secretKey",
                  },
                },
              },
            ];
            if (s3Config.rootDirectory) {
              s3EnvVars.push({
                name: "REGISTRY_STORAGE_S3_ROOTDIRECTORY",
                value: s3Config.rootDirectory,
              });
            }
            return s3EnvVars;
          });
        }
        
        return [...baseEnvVars, ...tlsEnvVars];
      })(),
      resources: args.resources,
      livenessProbe: {
        httpGet: {
          path: "/",
          port: port as any,
          scheme: args.tls?.secretName ? "HTTPS" : "HTTP",
        },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
      readinessProbe: {
        httpGet: {
          path: "/",
          port: port as any,
          scheme: args.tls?.secretName ? "HTTPS" : "HTTP",
        },
        initialDelaySeconds: 5,
        periodSeconds: 5,
      },
    }];

    const volumes: pulumi.Input<k8s.types.input.core.v1.Volume>[] = [
      {
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
      ...(args.storage.type === "filesystem" && this.pvc ? [{
        name: "storage",
        persistentVolumeClaim: {
          claimName: this.pvc.metadata.name,
        },
      }] : []),
      ...(args.tls?.secretName ? [{
        name: "certs",
        secret: {
          secretName: args.tls.secretName,
        },
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
          },
          spec: {
            containers: containers,
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
          name: args.tls?.secretName ? "https" : "http",
          port: args.tls?.secretName ? 443 : (port as any),
          targetPort: port as any,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    this.serviceName = this.service.metadata.name;
    this.endpoint = pulumi.all([this.service.metadata.name, args.namespace, args.tls?.secretName]).apply(
      ([serviceName, namespace, tlsSecret]) => {
        const protocol = tlsSecret ? "https" : "http";
        const servicePort = tlsSecret ? 443 : port;
        return `${protocol}://${serviceName}.${namespace}:${servicePort}`;
      }
    );

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      pvc: this.pvc,
      secret: this.secret,
      endpoint: this.endpoint,
      serviceName: this.serviceName,
    });
  }
}
