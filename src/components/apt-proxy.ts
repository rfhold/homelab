import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createPVC, StorageConfig } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface AptProxyArgs {
  namespace: pulumi.Input<string>;
  storage: StorageConfig;
  gatewayRef: {
    name: pulumi.Input<string>;
    namespace: pulumi.Input<string>;
  };
  hostname: pulumi.Input<string>;
}

export class AptProxy extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: AptProxyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:AptProxy", name, args, opts);

    const pvc = createPVC("apt-proxy-cache", { ...args.storage, namespace: args.namespace }, { parent: this });

    const deployment = new k8s.apps.v1.Deployment("apt-proxy", {
      metadata: {
        name: "apt-proxy",
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: { app: "apt-proxy" },
        },
        template: {
          metadata: {
            labels: { app: "apt-proxy" },
          },
          spec: {
            containers: [{
              name: "apt-proxy",
              image: DOCKER_IMAGES.APT_PROXY.image,
              ports: [{ containerPort: 3142 }],
              volumeMounts: [{
                name: "cache-data",
                mountPath: "/data",
              }],
            }],
            volumes: [{
              name: "cache-data",
              persistentVolumeClaim: {
                claimName: pvc.metadata.name,
              },
            }],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service("apt-proxy", {
      metadata: {
        name: "apt-proxy",
        namespace: args.namespace,
      },
      spec: {
        selector: { app: "apt-proxy" },
        ports: [{
          port: 3142,
          targetPort: 3142,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    new k8s.apiextensions.CustomResource("apt-proxy-route", {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: {
        name: "apt-proxy-route",
        namespace: args.namespace,
      },
      spec: {
        parentRefs: [{
          name: args.gatewayRef.name,
          namespace: args.gatewayRef.namespace,
        }],
        hostnames: [args.hostname],
        rules: [{
          backendRefs: [{
            name: this.service.metadata.name,
            kind: "Service",
            port: 3142,
          }],
        }],
      },
    }, { parent: this, dependsOn: [this.service] });

    this.registerOutputs({
      service: this.service,
    });
  }
}
