import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { RookCephBucket } from "./rook-ceph-bucket";
import { StorageConfig, createPVC } from "../adapters/storage";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface KellnrArgs extends WorkloadLabelArgs {
  namespace: pulumi.Input<string>;
  cratesBucket: RookCephBucket;
  dbStorage: StorageConfig;
  originPath: string;
}

export class Kellnr extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: KellnrArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Kellnr", name, args, withWorkloadLabels(opts, args.workloadLabels));

    const labels = { app: name };

    const dbPvc = createPVC("kellnr-db", { ...args.dbStorage, namespace: args.namespace }, { parent: this });

    const deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            containers: [{
              name: "kellnr",
              image: DOCKER_IMAGES.KELLNR.image,
              ports: [{
                containerPort: 8000,
                name: "http",
              }],
              env: [
                { name: "KELLNR_ORIGIN__HOSTNAME", value: "mirrors.holdenitdown.net" },
                { name: "KELLNR_ORIGIN__PORT", value: "443" },
                { name: "KELLNR_ORIGIN__PROTOCOL", value: "https" },
                { name: "KELLNR_ORIGIN__PATH", value: args.originPath },
                { name: "KELLNR_S3__ENABLED", value: "true" },
                { name: "KELLNR_S3__ENDPOINT", value: pulumi.interpolate`https://${args.cratesBucket.endpoint}` },
                { name: "KELLNR_S3__ACCESS_KEY", value: args.cratesBucket.accessKey },
                { name: "KELLNR_S3__SECRET_KEY", value: args.cratesBucket.secretKey },
                { name: "KELLNR_S3__CRATES_BUCKET", value: args.cratesBucket.bucketName },
                { name: "KELLNR_S3__CRATESIO_BUCKET", value: args.cratesBucket.bucketName },
                { name: "KELLNR_S3__ALLOW_HTTP", value: "true" },
                { name: "KELLNR_PROXY__ENABLED", value: "true" },
              ],
              volumeMounts: [{
                name: "db-data",
                mountPath: "/kellnr/data",
              }],
            }],
            volumes: [{
              name: "db-data",
              persistentVolumeClaim: {
                claimName: dbPvc.metadata.name,
              },
            }],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 8000,
          targetPort: 8000,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, { parent: this });

    this.registerOutputs({
      service: this.service,
    });
  }
}
