import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface TlsCertificateConfig {
  enabled: boolean;
  issuerRef: pulumi.Input<string>;
  dnsNames: pulumi.Input<pulumi.Input<string>[]>;
  duration?: pulumi.Input<string>;
  renewBefore?: pulumi.Input<string>;
}

export interface OmadaControllerArgs {
  namespace: pulumi.Input<string>;

  timezone?: pulumi.Input<string>;
  blockDhcp?: pulumi.Input<boolean>;

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;

  storage?: {
    data?: StorageConfig;
    logs?: StorageConfig;
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

  service?: {
    type?: pulumi.Input<string>;
    loadBalancerIP?: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    externalTrafficPolicy?: pulumi.Input<string>;
  };

  tls?: TlsCertificateConfig;
}

export class OmadaController extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly dataPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly logsPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly dhcpBlockPolicy?: k8s.networking.v1.NetworkPolicy;
  public readonly certificate?: k8s.apiextensions.CustomResource;

  constructor(name: string, args: OmadaControllerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OmadaController", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const dataStorageConfig: StorageConfig = {
      size: args.storage?.data?.size || "10Gi",
      storageClass: args.storage?.data?.storageClass,
      accessModes: args.storage?.data?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.data?.volumeMode,
      namespace: args.storage?.data?.namespace,
      labels: args.storage?.data?.labels,
      annotations: args.storage?.data?.annotations,
      selector: args.storage?.data?.selector,
      dataSource: args.storage?.data?.dataSource,
    };

    const logsStorageConfig: StorageConfig = {
      size: args.storage?.logs?.size || "5Gi",
      storageClass: args.storage?.logs?.storageClass,
      accessModes: args.storage?.logs?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.logs?.volumeMode,
      namespace: args.storage?.logs?.namespace,
      labels: args.storage?.logs?.labels,
      annotations: args.storage?.logs?.annotations,
      selector: args.storage?.logs?.selector,
      dataSource: args.storage?.logs?.dataSource,
    };

    this.dataPvc = createPVC(`${name}-data`, {
      ...dataStorageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    this.logsPvc = createPVC(`${name}-logs`, {
      ...logsStorageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    const labels = {
      app: "omada-controller",
      component: name,
    };

    const tlsSecretName = `${name}-tls`;

    if (args.tls?.enabled) {
      this.certificate = new k8s.apiextensions.CustomResource(
        `${name}-certificate`,
        {
          apiVersion: "cert-manager.io/v1",
          kind: "Certificate",
          metadata: {
            name: `${name}-tls`,
            namespace: args.namespace,
          },
          spec: {
            secretName: tlsSecretName,
            dnsNames: args.tls.dnsNames,
            issuerRef: {
              name: args.tls.issuerRef,
              kind: "ClusterIssuer",
            },
            duration: args.tls.duration || "2160h",
            renewBefore: args.tls.renewBefore || "360h",
          },
        },
        defaultResourceOptions
      );
    }

    const environment = [
      {
        name: "TZ",
        value: args.timezone || "UTC",
      },
      {
        name: "PUID",
        value: "508",
      },
      {
        name: "PGID",
        value: "508",
      },
      {
        name: "SHOW_SERVER_LOGS",
        value: "true",
      },
      {
        name: "SHOW_MONGODB_LOGS",
        value: "true",
      },
      {
        name: "_JAVA_OPTIONS",
        value: "-Xms512m -Xmx2048m",
      },
    ];

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
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            terminationGracePeriodSeconds: 120,
            securityContext: {
              fsGroup: 508,
            },
            nodeSelector: args.nodeSelector,
            containers: [{
              name: "omada-controller",
              image: DOCKER_IMAGES.OMADA_CONTROLLER.image,
              ports: [
                { containerPort: 80, name: "http", protocol: "TCP" },
                { containerPort: 443, name: "https", protocol: "TCP" },
                { containerPort: 8843, name: "portal-https", protocol: "TCP" },
                { containerPort: 27001, name: "app-discovery", protocol: "UDP" },
                { containerPort: 29810, name: "discovery", protocol: "UDP" },
                { containerPort: 29811, name: "manager-v1", protocol: "TCP" },
                { containerPort: 29812, name: "adopt-v1", protocol: "TCP" },
                { containerPort: 29813, name: "upgrade-v1", protocol: "TCP" },
                { containerPort: 29814, name: "manager-v2", protocol: "TCP" },
                { containerPort: 29815, name: "transfer-v2", protocol: "TCP" },
                { containerPort: 29816, name: "rtty", protocol: "TCP" },
                { containerPort: 29817, name: "device-mon", protocol: "TCP" },
              ],
              env: environment,
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/opt/tplink/EAPController/data",
                },
                {
                  name: "logs",
                  mountPath: "/opt/tplink/EAPController/logs",
                },
                ...(args.tls?.enabled ? [{
                  name: "tls-cert",
                  mountPath: "/cert",
                  readOnly: true,
                }] : []),
              ],
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "1Gi",
                  cpu: args.resources?.requests?.cpu || "500m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "2Gi",
                  cpu: args.resources?.limits?.cpu || "2000m",
                },
              },
              livenessProbe: {
                exec: {
                  command: [
                    "/bin/sh",
                    "-c",
                    "wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:80/ 2>/dev/null || wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:8088/ 2>/dev/null",
                  ],
                },
                initialDelaySeconds: 90,
                periodSeconds: 30,
                timeoutSeconds: 15,
                failureThreshold: 3,
              },
              readinessProbe: {
                exec: {
                  command: [
                    "/bin/sh",
                    "-c",
                    "wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:80/ 2>/dev/null || wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:8088/ 2>/dev/null",
                  ],
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 15,
                failureThreshold: 3,
              },
              startupProbe: {
                exec: {
                  command: [
                    "/bin/sh",
                    "-c",
                    "wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:80/ 2>/dev/null || wget -q -O /dev/null --no-check-certificate --timeout=5 http://localhost:8088/ 2>/dev/null",
                  ],
                },
                initialDelaySeconds: 60,
                periodSeconds: 15,
                timeoutSeconds: 15,
                failureThreshold: 40,
              },
            }],
            volumes: [
              {
                name: "data",
                persistentVolumeClaim: {
                  claimName: this.dataPvc.metadata.name,
                },
              },
              {
                name: "logs",
                persistentVolumeClaim: {
                  claimName: this.logsPvc.metadata.name,
                },
              },
              ...(args.tls?.enabled ? [{
                name: "tls-cert",
                secret: {
                  secretName: tlsSecretName,
                  defaultMode: 0o400,
                },
              }] : []),
            ],
          },
        },
      },
    }, defaultResourceOptions);

    const serviceType = args.service?.type || "LoadBalancer";

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
        annotations: args.service?.annotations,
      },
      spec: {
        type: serviceType,
        loadBalancerIP: args.service?.loadBalancerIP,
        externalTrafficPolicy: args.service?.externalTrafficPolicy,
        selector: labels,
        ports: [
          { port: 80, targetPort: 80, protocol: "TCP", name: "http" },
          { port: 443, targetPort: 443, protocol: "TCP", name: "https" },
          { port: 8088, targetPort: 80, protocol: "TCP", name: "http-legacy" },
          { port: 8043, targetPort: 443, protocol: "TCP", name: "https-legacy" },
          { port: 8843, targetPort: 8843, protocol: "TCP", name: "portal-https" },
          { port: 27001, targetPort: 27001, protocol: "UDP", name: "app-discovery" },
          { port: 29810, targetPort: 29810, protocol: "UDP", name: "discovery" },
          { port: 29811, targetPort: 29811, protocol: "TCP", name: "manager-v1" },
          { port: 29812, targetPort: 29812, protocol: "TCP", name: "adopt-v1" },
          { port: 29813, targetPort: 29813, protocol: "TCP", name: "upgrade-v1" },
          { port: 29814, targetPort: 29814, protocol: "TCP", name: "manager-v2" },
          { port: 29815, targetPort: 29815, protocol: "TCP", name: "transfer-v2" },
          { port: 29816, targetPort: 29816, protocol: "TCP", name: "rtty" },
          { port: 29817, targetPort: 29817, protocol: "TCP", name: "device-mon" },
        ],
      },
    }, defaultResourceOptions);

    if (args.blockDhcp) {
      this.dhcpBlockPolicy = new k8s.networking.v1.NetworkPolicy(`${name}-block-dhcp`, {
        metadata: {
          name: `${name}-block-dhcp`,
          namespace: args.namespace,
          labels: labels,
        },
        spec: {
          podSelector: {
            matchLabels: labels,
          },
          policyTypes: ["Egress"],
          egress: [{
            ports: [
              { port: 1, endPort: 66, protocol: "UDP" },
              { port: 69, endPort: 65535, protocol: "UDP" },
              { port: 1, endPort: 65535, protocol: "TCP" },
            ],
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      dataPvc: this.dataPvc,
      logsPvc: this.logsPvc,
      dhcpBlockPolicy: this.dhcpBlockPolicy,
      certificate: this.certificate,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`https://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:443`;
  }

  public getLoadBalancerIP(): pulumi.Output<string> {
    return this.service.status.apply(status => {
      const ingress = status?.loadBalancer?.ingress;
      if (ingress && ingress.length > 0) {
        return ingress[0].ip || ingress[0].hostname || "";
      }
      return "";
    });
  }
}
