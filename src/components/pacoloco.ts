import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createPVC, StorageConfig } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface PacolocoArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  storage: StorageConfig;
  repos: Record<string, { urls: string[] }>;
}

export class Pacoloco extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: PacolocoArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Pacoloco", name, args, withWorkloadLabels(opts, args.workloadLabels));

    const repoEntries = Object.entries(args.repos)
      .map(([repoName, repo]) => {
        const urlLines = repo.urls.map(u => `      - ${u}`).join("\n");
        return `  ${repoName}:\n    urls:\n${urlLines}`;
      })
      .join("\n");

    const configYaml = `cache_dir: /var/cache/pacoloco\nrepos:\n${repoEntries}\n`;

    const configMap = new k8s.core.v1.ConfigMap("pacoloco-config", {
      metadata: {
        name: "pacoloco-config",
        namespace: args.namespace,
      },
      data: {
        "config.yaml": configYaml,
      },
    }, { parent: this });

    const pvc = createPVC("pacoloco-cache", { ...args.storage, namespace: args.namespace }, { parent: this });

    new k8s.apps.v1.Deployment("pacoloco", {
      metadata: {
        name: "pacoloco",
        namespace: args.namespace,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "RollingUpdate",
          rollingUpdate: {
            maxSurge: 0,
            maxUnavailable: 1,
          },
        },
        selector: {
          matchLabels: { app: "pacoloco" },
        },
        template: {
          metadata: {
            labels: { app: "pacoloco" },
          },
          spec: {
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 65532,
              runAsGroup: 65532,
              fsGroup: 65532,
              fsGroupChangePolicy: "OnRootMismatch",
            },
            containers: [{
              name: "pacoloco",
              image: DOCKER_IMAGES.PACOLOCO.image,
              imagePullPolicy: "IfNotPresent",
              ports: [{ containerPort: 9129 }],
              volumeMounts: [
                {
                  name: "config",
                  mountPath: "/etc/pacoloco.yaml",
                  subPath: "config.yaml",
                },
                {
                  name: "cache-data",
                  mountPath: "/var/cache/pacoloco",
                },
              ],
            }],
            volumes: [
              {
                name: "config",
                configMap: { name: configMap.metadata.name },
              },
              {
                name: "cache-data",
                persistentVolumeClaim: { claimName: pvc.metadata.name },
              },
            ],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service("pacoloco", {
      metadata: {
        name: "pacoloco",
        namespace: args.namespace,
      },
      spec: {
        selector: { app: "pacoloco" },
        ports: [{
          port: 9129,
          targetPort: 9129,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    this.registerOutputs({
      service: this.service,
    });
  }
}
