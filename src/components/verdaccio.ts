import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { RookCephBucket } from "./rook-ceph-bucket";

export interface VerdaccioArgs {
  namespace: pulumi.Input<string>;
  bucket: RookCephBucket;
  urlPrefix: string;
}

export class Verdaccio extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: VerdaccioArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Verdaccio", name, args, opts);

    const labels = { app: "verdaccio" };

    const configYaml = pulumi.interpolate`url_prefix: ${args.urlPrefix}/
uplinks:
  npmjs:
    url: https://registry.npmjs.org
packages:
  '@*/*':
    access: $all
    proxy: npmjs
  '**':
    access: $all
    proxy: npmjs
store:
  aws-s3-storage:
    bucket: ${args.bucket.bucketName}
    endpoint: ${args.bucket.endpoint}
    s3ForcePathStyle: true
    accessKeyId: ${args.bucket.accessKey}
    secretAccessKey: ${args.bucket.secretKey}
    region: us-east-1
`;

    const configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: "verdaccio-config",
        namespace: args.namespace,
        labels,
      },
      data: {
        "config.yaml": configYaml,
      },
    }, { parent: this });

    new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: "verdaccio",
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            containers: [{
              name: "verdaccio",
              image: DOCKER_IMAGES.VERDACCIO.image,
              ports: [{
                containerPort: 4873,
              }],
              volumeMounts: [{
                name: "config",
                mountPath: "/verdaccio/conf/config.yaml",
                subPath: "config.yaml",
              }],
            }],
            volumes: [{
              name: "config",
              configMap: {
                name: configMap.metadata.name,
              },
            }],
          },
        },
      },
    }, { parent: this });

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: "verdaccio",
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 4873,
          targetPort: 4873,
          protocol: "TCP",
        }],
      },
    }, { parent: this });

    this.registerOutputs({
      service: this.service,
    });
  }
}
