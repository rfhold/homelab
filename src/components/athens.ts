import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { RookCephBucket } from "./rook-ceph-bucket";

export interface AthensArgs {
  namespace: pulumi.Input<string>;
  bucket: RookCephBucket;
  pathPrefix: string;
}

export class Athens extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: AthensArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Athens", name, args, opts);

    const labels = { app: name };

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
              name: "athens",
              image: DOCKER_IMAGES.ATHENS.image,
              ports: [{
                containerPort: 3000,
                name: "http",
              }],
              env: [
                { name: "ATHENS_STORAGE_TYPE", value: "minio" },
                { name: "ATHENS_PATH_PREFIX", value: args.pathPrefix },
                { name: "ATHENS_MINIO_ENDPOINT", value: args.bucket.endpoint },
                { name: "ATHENS_MINIO_ACCESS_KEY_ID", value: args.bucket.accessKey },
                { name: "ATHENS_MINIO_MINIO_SECRET_ACCESS_KEY", value: args.bucket.secretKey },
                { name: "ATHENS_MINIO_BUCKET_NAME", value: args.bucket.bucketName },
                { name: "ATHENS_MINIO_USE_SSL", value: "false" },
                { name: "ATHENS_DOWNLOAD_MODE", value: "sync" },
              ],
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
          port: 3000,
          targetPort: 3000,
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
