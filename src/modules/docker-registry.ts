import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DockerRegistry } from "../components/docker-registry";
import { Certificate } from "../components/certificate";

export interface ProxyRegistryConfig {
  name: string;
  remoteUrl: pulumi.Input<string>;
  cacheSize?: pulumi.Input<string>;
  storageClass?: pulumi.Input<string>;
  username?: pulumi.Input<string>;
  password?: pulumi.Input<string>;
  ttl?: pulumi.Input<string>;
  serviceType?: pulumi.Input<string>;
  serviceAnnotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tls?: {
    secretName?: pulumi.Input<string>;
    dnsNames?: pulumi.Input<pulumi.Input<string>[]>;
    issuerRef?: pulumi.Input<string>;
    duration?: pulumi.Input<string>;
    renewBefore?: pulumi.Input<string>;
  };
}

export interface PrivateRegistryS3Config {
  endpoint: pulumi.Input<string>;
  bucket: pulumi.Input<string>;
  accessKey: pulumi.Input<string>;
  secretKey: pulumi.Input<string>;
  region?: pulumi.Input<string>;
  rootDirectory?: pulumi.Input<string>;
}

export interface DockerRegistryModuleArgs {
  namespace: pulumi.Input<string>;

  privateRegistry?: {
    s3: PrivateRegistryS3Config;
    serviceType?: pulumi.Input<string>;
    serviceAnnotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
    tls?: {
      secretName?: pulumi.Input<string>;
      dnsNames?: pulumi.Input<pulumi.Input<string>[]>;
      issuerRef?: pulumi.Input<string>;
      duration?: pulumi.Input<string>;
      renewBefore?: pulumi.Input<string>;
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
  };

  proxyRegistries: ProxyRegistryConfig[];
}

export class DockerRegistryModule extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly privateRegistry?: DockerRegistry;
  public readonly privateRegistryCertificate?: Certificate;
  public readonly proxyRegistries: Array<{ name: pulumi.Output<string>; registry: DockerRegistry; certificate?: Certificate }>;
  public readonly privateRegistryEndpoint?: pulumi.Output<string>;
  public readonly proxyRegistryEndpoints: pulumi.Output<Record<string, string>>;

  constructor(name: string, args: DockerRegistryModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:DockerRegistry", name, args, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    this.namespace = new k8s.core.v1.Namespace(`${name}-namespace`, {
      metadata: {
        name: args.namespace,
      },
    }, defaultResourceOptions);

    this.proxyRegistries = [];

    if (args.privateRegistry) {
      const s3Config = args.privateRegistry.s3;
      const tlsConfig = args.privateRegistry.tls;

      let tlsSecretName: pulumi.Input<string> | undefined;
      let privateDependsOn: pulumi.Input<pulumi.Resource>[] = [this.namespace];

      if (tlsConfig?.dnsNames && tlsConfig?.issuerRef) {
        const certSecretName = tlsConfig.secretName || `${name}-private-tls`;
        
        this.privateRegistryCertificate = new Certificate(`${name}-private-cert`, {
          namespace: args.namespace,
          name: `${name}-private-cert`,
          secretName: certSecretName,
          dnsNames: tlsConfig.dnsNames,
          issuerRef: tlsConfig.issuerRef,
          duration: tlsConfig.duration,
          renewBefore: tlsConfig.renewBefore,
        }, {
          dependsOn: [this.namespace],
          ...defaultResourceOptions,
        });

        tlsSecretName = certSecretName;
        privateDependsOn.push(this.privateRegistryCertificate);
      } else if (tlsConfig?.secretName) {
        tlsSecretName = tlsConfig.secretName;
      }

      this.privateRegistry = new DockerRegistry(`${name}-private`, {
        namespace: args.namespace,
        mode: "private",
        storage: {
          type: "s3",
          s3: {
            endpoint: s3Config.endpoint,
            bucket: s3Config.bucket,
            accessKey: s3Config.accessKey,
            secretKey: s3Config.secretKey,
            region: s3Config.region || "us-east-1",
            secure: true,
            rootDirectory: s3Config.rootDirectory,
          },
        },
        serviceType: args.privateRegistry.serviceType,
        serviceAnnotations: args.privateRegistry.serviceAnnotations,
        tls: tlsSecretName ? { secretName: tlsSecretName } : undefined,
        resources: args.privateRegistry.resources,
      }, {
        dependsOn: privateDependsOn,
        ...defaultResourceOptions,
      });

      this.privateRegistryEndpoint = this.privateRegistry.endpoint;
    }

    for (let i = 0; i < args.proxyRegistries.length; i++) {
      const proxyConfig = args.proxyRegistries[i];
      const tlsConfig = proxyConfig.tls;

      let tlsSecretName: pulumi.Input<string> | undefined;
      let certificate: Certificate | undefined;
      let proxyDependsOn: pulumi.Input<pulumi.Resource>[] = [this.namespace];

      if (tlsConfig?.dnsNames && tlsConfig?.issuerRef) {
        const certSecretName = tlsConfig.secretName || `${name}-proxy-${i}-tls`;
        
        certificate = new Certificate(`${name}-proxy-${i}-cert`, {
          namespace: args.namespace,
          name: `${name}-proxy-${i}-cert`,
          secretName: certSecretName,
          dnsNames: tlsConfig.dnsNames,
          issuerRef: tlsConfig.issuerRef,
          duration: tlsConfig.duration,
          renewBefore: tlsConfig.renewBefore,
        }, {
          dependsOn: [this.namespace],
          ...defaultResourceOptions,
        });

        tlsSecretName = certSecretName;
        proxyDependsOn.push(certificate);
      } else if (tlsConfig?.secretName) {
        tlsSecretName = tlsConfig.secretName;
      }

      const proxy = new DockerRegistry(`${name}-proxy-${i}`, {
        namespace: args.namespace,
        mode: "proxy",
        proxy: {
          remoteUrl: proxyConfig.remoteUrl,
          username: proxyConfig.username,
          password: proxyConfig.password,
          ttl: proxyConfig.ttl || "168h",
        },
        storage: {
          type: "filesystem",
          size: proxyConfig.cacheSize || "10Gi",
          storageClass: proxyConfig.storageClass,
        },
        serviceType: proxyConfig.serviceType,
        serviceAnnotations: proxyConfig.serviceAnnotations,
        tls: tlsSecretName ? { secretName: tlsSecretName } : undefined,
      }, {
        dependsOn: proxyDependsOn,
        ...defaultResourceOptions,
      });

      this.proxyRegistries.push({
        name: pulumi.output(proxyConfig.name),
        registry: proxy,
        certificate: certificate,
      });
    }

    this.proxyRegistryEndpoints = pulumi.output(
      Promise.all(
        this.proxyRegistries.map(async (item) => {
          const proxyName = await item.name;
          const endpoint = await item.registry.endpoint;
          return { name: proxyName, endpoint };
        })
      )
    ).apply(items => {
      const result: Record<string, string> = {};
      for (const item of items) {
        result[item.name] = item.endpoint;
      }
      return result;
    });

    this.registerOutputs({
      namespace: this.namespace,
      privateRegistry: this.privateRegistry,
      privateRegistryCertificate: this.privateRegistryCertificate,
      proxyRegistries: this.proxyRegistries,
      privateRegistryEndpoint: this.privateRegistryEndpoint,
      proxyRegistryEndpoints: this.proxyRegistryEndpoints,
    });
  }

  public getPrivateRegistryEndpoint(): pulumi.Output<string> | undefined {
    return this.privateRegistryEndpoint;
  }

  public getProxyEndpoint(name: string): pulumi.Output<string> {
    return this.proxyRegistryEndpoints.apply(endpoints => endpoints[name]);
  }

  public getAllProxyEndpoints(): pulumi.Output<Record<string, string>> {
    return this.proxyRegistryEndpoints;
  }
}
