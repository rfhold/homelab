import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import * as tls from "@pulumi/tls";
import { DOCKER_IMAGES } from "../docker-images";

export interface TechnitiumDnsServiceConfig {
  type: pulumi.Input<string>;
  annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  externalTrafficPolicy?: pulumi.Input<string>;
  ports: {
    dns: pulumi.Input<number>;
    dnsUdp: pulumi.Input<number>;
    webUi: pulumi.Input<number>;
    cluster: pulumi.Input<number>;
  };
}

export interface TechnitiumDnsStorageConfig {
  size: pulumi.Input<string>;
  storageClass?: pulumi.Input<string>;
}

export interface TechnitiumDnsResourceConfig {
  requests: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
  limits: {
    memory: pulumi.Input<string>;
    cpu: pulumi.Input<string>;
  };
}

export interface TechnitiumDnsArgs {
  namespace: pulumi.Input<string>;
  forwarders: pulumi.Input<string>;
  service: TechnitiumDnsServiceConfig;
  storage: TechnitiumDnsStorageConfig;
  resources: TechnitiumDnsResourceConfig;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  hostAliases?: pulumi.Input<Array<{ ip: pulumi.Input<string>; hostnames: pulumi.Input<string[]> }>>;
  adminPassword?: pulumi.Input<string>;
  clusterNodeDomain?: pulumi.Input<string>;
}

export interface TechnitiumDnsConnectionConfig {
  dnsHost: pulumi.Output<string>;
  webUiUrl: pulumi.Output<string>;
  adminUsername: pulumi.Output<string>;
  adminPassword: pulumi.Output<string>;
}

export class TechnitiumDns extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly secret: k8s.core.v1.Secret;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly tlsSecret: k8s.core.v1.Secret;

  private readonly _adminPassword!: pulumi.Output<string>;
  private readonly _webUiPort!: pulumi.Input<number>;

  constructor(name: string, args: TechnitiumDnsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:TechnitiumDns", name, args, opts);

    const adminPassword = args.adminPassword
      ? pulumi.output(args.adminPassword)
      : new random.RandomPassword(`${name}-password`, {
          length: 32,
          special: true,
          overrideSpecial: "!@#$%^&*()-_=+[]{}|;:,.<>?",
        }, { parent: this }).result;

    Object.assign(this, { _adminPassword: adminPassword, _webUiPort: args.service.ports.webUi });

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
      },
      stringData: {
        adminUsername: "admin",
        adminPassword: adminPassword,
      },
    }, { parent: this });

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-pvc`, {
      metadata: {
        name: `${name}-data`,
        namespace: args.namespace,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: args.storage.size,
          },
        },
        storageClassName: args.storage.storageClass,
      },
    }, { parent: this });

    const privateKey = new tls.PrivateKey(`${name}-tls-key`, {
      algorithm: "RSA",
      rsaBits: 4096,
    }, { parent: this });

    const clusterNodeDomain = args.clusterNodeDomain ?? pulumi.output(name);

    const selfSignedCert = new tls.SelfSignedCert(`${name}-tls-cert`, {
      privateKeyPem: privateKey.privateKeyPem,
      allowedUses: ["server_auth", "key_encipherment", "digital_signature"],
      validityPeriodHours: 87600,
      subject: {
        commonName: clusterNodeDomain,
      },
      dnsNames: [clusterNodeDomain],
    }, { parent: this });

    this.tlsSecret = new k8s.core.v1.Secret(`${name}-tls-secret`, {
      metadata: {
        name: `${name}-tls`,
        namespace: args.namespace,
      },
      stringData: {
        "tls.crt": selfSignedCert.certPem,
        "tls.key": privateKey.privateKeyPem,
      },
    }, { parent: this });

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
        },
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
            nodeSelector: args.nodeSelector,
            hostAliases: args.hostAliases,
            initContainers: [{
              name: "tls-convert",
              image: DOCKER_IMAGES.ALPINE_OPENSSL.image,
              command: ["sh", "-c", [
                "openssl pkcs12 -export",
                "-out /etc/dns/tls/cert.pfx",
                "-inkey /tls-src/tls.key",
                "-in /tls-src/tls.crt",
                "-passout pass:",
              ].join(" ")],
              volumeMounts: [
                { name: "tls-src", mountPath: "/tls-src", readOnly: true },
                { name: "tls-pfx", mountPath: "/etc/dns/tls" },
              ],
            }],
            containers: [{
              name: "technitium-dns",
              image: DOCKER_IMAGES.TECHNITIUM_DNS.image,
              ports: [
                { containerPort: 53, name: "dns-tcp", protocol: "TCP" },
                { containerPort: 53, name: "dns-udp", protocol: "UDP" },
                { containerPort: 5380, name: "web-ui", protocol: "TCP" },
                { containerPort: 53443, name: "cluster", protocol: "TCP" },
              ],
              env: [
                {
                  name: "DNS_SERVER_DOMAIN",
                  value: clusterNodeDomain,
                },
                {
                  name: "DNS_SERVER_ADMIN_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: this.secret.metadata.name,
                      key: "adminPassword",
                    },
                  },
                },
                {
                  name: "DNS_SERVER_RECURSION",
                  value: "AllowOnlyForPrivateNetworks",
                },
                {
                  name: "DNS_SERVER_FORWARDERS",
                  value: args.forwarders,
                },
                {
                  name: "DNS_SERVER_WEB_SERVICE_ENABLE_HTTPS",
                  value: "true",
                },
                {
                  name: "DNS_SERVER_WEB_SERVICE_USE_SELF_SIGNED_CERT",
                  value: "false",
                },
                {
                  name: "DNS_SERVER_WEB_SERVICE_TLS_CERTIFICATE_PATH",
                  value: "/etc/dns/tls/cert.pfx",
                },
                {
                  name: "DNS_SERVER_WEB_SERVICE_TLS_CERTIFICATE_PASSWORD",
                  value: "",
                },
              ],
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/etc/dns",
                },
                {
                  name: "tls-pfx",
                  mountPath: "/etc/dns/tls",
                },
              ],
              resources: args.resources,
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 5380,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 5380,
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
                name: "tls-src",
                secret: {
                  secretName: this.tlsSecret.metadata.name,
                },
              },
              {
                name: "tls-pfx",
                emptyDir: {},
              },
            ],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        annotations: args.service.annotations,
      },
      spec: {
        type: args.service.type,
        externalTrafficPolicy: args.service.externalTrafficPolicy,
        selector: {
          app: name,
        },
        ports: [
          {
            name: "dns-tcp",
            port: args.service.ports.dns,
            targetPort: 53,
            protocol: "TCP",
          },
          {
            name: "dns-udp",
            port: args.service.ports.dnsUdp,
            targetPort: 53,
            protocol: "UDP",
          },
          {
            name: "web-ui",
            port: args.service.ports.webUi,
            targetPort: 5380,
            protocol: "TCP",
          },
          {
            name: "cluster",
            port: args.service.ports.cluster,
            targetPort: 53443,
            protocol: "TCP",
          },
        ],
      },
    }, { parent: this });

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      secret: this.secret,
      pvc: this.pvc,
      tlsSecret: this.tlsSecret,
    });
  }

  getConnectionConfig(): TechnitiumDnsConnectionConfig {
    const serviceHost = pulumi.all([this.service.status, this.service.spec.clusterIP]).apply(([status, clusterIP]) => {
      if (status?.loadBalancer?.ingress?.[0]?.ip) {
        return status.loadBalancer.ingress[0].ip;
      }
      return clusterIP || "";
    });

    const webUiPort = pulumi.output(this._webUiPort);

    return {
      dnsHost: serviceHost,
      webUiUrl: pulumi.interpolate`http://${serviceHost}:${webUiPort}`,
      adminUsername: pulumi.output("admin"),
      adminPassword: this._adminPassword,
    };
  }
}
