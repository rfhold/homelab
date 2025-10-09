import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface RookCephObjectStoreArgs {
  name: pulumi.Input<string>;
  namespace: pulumi.Input<string>;
  hostname: pulumi.Input<string>;
  serviceAnnotations?: pulumi.Input<{ [key: string]: string }>;
  issuerRef: {
    name: pulumi.Input<string>;
    kind?: pulumi.Input<"ClusterIssuer" | "Issuer">;
  };
  gatewayInstances?: pulumi.Input<number>;
  metadataPool?: {
    failureDomain?: pulumi.Input<string>;
    replicaSize?: pulumi.Input<number>;
    requireSafeReplicaSize?: pulumi.Input<boolean>;
  };
  dataPool?: {
    failureDomain?: pulumi.Input<string>;
    replicaSize?: pulumi.Input<number>;
    requireSafeReplicaSize?: pulumi.Input<boolean>;
  };
  reclaimPolicy?: pulumi.Input<"Delete" | "Retain">;
}

export class RookCephObjectStore extends pulumi.ComponentResource {
  public readonly objectStore: k8s.apiextensions.CustomResource;
  public readonly certificate: k8s.apiextensions.CustomResource;
  public readonly service: k8s.core.v1.Service;
  public readonly storageClass: k8s.storage.v1.StorageClass;
  public readonly endpoint: pulumi.Output<string>;
  public readonly storageClassName: pulumi.Output<string>;

  constructor(name: string, args: RookCephObjectStoreArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:RookCephObjectStore", name, args, opts);

    const metadataPool = {
      failureDomain: args.metadataPool?.failureDomain || "host",
      replicated: {
        size: args.metadataPool?.replicaSize || 3,
        requireSafeReplicaSize: args.metadataPool?.requireSafeReplicaSize ?? true,
      },
    };

    const dataPool = {
      failureDomain: args.dataPool?.failureDomain || "host",
      replicated: {
        size: args.dataPool?.replicaSize || 3,
        requireSafeReplicaSize: args.dataPool?.requireSafeReplicaSize ?? true,
      },
      parameters: {
        bulk: "true",
      },
    };

    const certificateSecretName = pulumi.interpolate`${args.name}-rgw-tls`;

    this.certificate = new k8s.apiextensions.CustomResource(
      `${name}-certificate`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          namespace: args.namespace,
        },
        spec: {
          secretName: certificateSecretName,
          dnsNames: [
            args.hostname,
            pulumi.interpolate`*.${args.hostname}`,
          ],
          issuerRef: {
            name: args.issuerRef.name,
            kind: args.issuerRef.kind || "ClusterIssuer",
          },
          duration: "2160h",
          renewBefore: "360h",
        },
      },
      { parent: this }
    );

    this.objectStore = new k8s.apiextensions.CustomResource(
      `${name}-objectstore`,
      {
        apiVersion: "ceph.rook.io/v1",
        kind: "CephObjectStore",
        metadata: {
          name: args.name,
          namespace: args.namespace,
        },
        spec: {
          metadataPool,
          dataPool,
          preservePoolsOnDelete: false,
          gateway: {
            port: 80,
            securePort: 443,
            instances: args.gatewayInstances || 3,
            sslCertificateRef: certificateSecretName,
          },
          hosting: {
            advertiseEndpoint: {
              dnsName: args.hostname,
              port: 443,
              useTls: true,
            },
            dnsNames: [
              args.hostname,
            ],
          },
          healthCheck: {
            startupProbe: {
              disabled: false,
            },
            readinessProbe: {
              disabled: false,
              periodSeconds: 5,
              failureThreshold: 2,
            },
          },
        },
      },
      { parent: this, dependsOn: [this.certificate] }
    );

    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: pulumi.interpolate`${args.name}-rgw-external`,
          namespace: args.namespace,
          annotations: {
            ...args.serviceAnnotations,
          },
        },
        spec: {
          type: "LoadBalancer",
          ports: [
            {
              name: "http",
              port: 80,
              protocol: "TCP",
            },
            {
              name: "https",
              port: 443,
              protocol: "TCP",
            },
          ],
          selector: {
            app: "rook-ceph-rgw",
            rook_object_store: args.name,
          },
        },
      },
      { parent: this, dependsOn: [this.objectStore] }
    );

    this.endpoint = pulumi.interpolate`https://${args.hostname}`;

    const storageClassName = pulumi.interpolate`${args.name}-bucket`;

    this.storageClass = new k8s.storage.v1.StorageClass(
      `${name}-storageclass`,
      {
        metadata: {
          name: storageClassName,
        },
        provisioner: pulumi.interpolate`${args.namespace}.ceph.rook.io/bucket`,
        reclaimPolicy: args.reclaimPolicy || "Delete",
        parameters: {
          objectStoreName: args.name,
          objectStoreNamespace: args.namespace,
        },
      },
      { parent: this, dependsOn: [this.objectStore] }
    );

    this.storageClassName = storageClassName;

    this.registerOutputs({
      objectStore: this.objectStore,
      certificate: this.certificate,
      service: this.service,
      storageClass: this.storageClass,
      endpoint: this.endpoint,
      storageClassName: this.storageClassName,
    });
  }
}
