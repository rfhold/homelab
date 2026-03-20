import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createPVC, StorageConfig } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface ApkProxyArgs {
  namespace: pulumi.Input<string>;
  storage: StorageConfig;
  upstream?: pulumi.Input<string>;
}

export class ApkProxy extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: ApkProxyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ApkProxy", name, args, opts);

    const pvc = createPVC("apk-proxy-cache", { ...args.storage, namespace: args.namespace }, { parent: this });

    new k8s.apps.v1.Deployment("apk-proxy", {
      metadata: {
        name: "apk-proxy",
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: { app: "apk-proxy" },
        },
        template: {
          metadata: {
            labels: { app: "apk-proxy" },
          },
          spec: {
            containers: [{
              name: "apk-proxy",
              image: DOCKER_IMAGES.APK_PROXY.image,
              ports: [{ containerPort: 3142 }],
              env: [
                {
                  name: "UPSTREAM",
                  value: args.upstream ?? "https://dl-cdn.alpinelinux.org",
                },
                {
                  name: "CACHE_DIR",
                  value: "/app/cache",
                },
              ],
              volumeMounts: [{
                name: "cache-data",
                mountPath: "/app/cache",
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

    this.service = new k8s.core.v1.Service("apk-proxy", {
      metadata: {
        name: "apk-proxy-svc",
        namespace: args.namespace,
      },
      spec: {
        selector: { app: "apk-proxy" },
        ports: [{
          port: 3142,
          targetPort: 3142,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    this.registerOutputs({
      service: this.service,
    });
  }
}
