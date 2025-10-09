import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface RookCephBucketArgs {
  name: pulumi.Input<string>;
  namespace: pulumi.Input<string>;
  storageClassName: pulumi.Input<string>;
  generateBucketName?: pulumi.Input<string>;
  bucketName?: pulumi.Input<string>;
  readUsers?: pulumi.Input<string[]>;
  writeUsers?: pulumi.Input<string[]>;
  additionalConfig?: {
    maxObjects?: pulumi.Input<string>;
    maxSize?: pulumi.Input<string>;
    bucketOwner?: pulumi.Input<string>;
    bucketPolicy?: pulumi.Input<string>;
  };
}

function generateBucketPolicy(
  bucketName: pulumi.Input<string>,
  readUsers?: pulumi.Input<string[]>,
  writeUsers?: pulumi.Input<string[]>
): pulumi.Output<string | undefined> {
  return pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: {
        AWS: pulumi.output(readUsers ?? []).apply((users: string[]) => users.map(user => `arn:aws:iam:::user/${user}`)),
      },
      Action: ["s3:GetObject", "s3:ListBucket"],
      Resource: [
        pulumi.interpolate`arn:aws:s3:::${bucketName}/*`,
        pulumi.interpolate`arn:aws:s3:::${bucketName}`,
      ],
    }, {
      Effect: "Allow",
      Principal: {
        AWS: pulumi.output(writeUsers ?? []).apply((users: string[]) => users.map(user => `arn:aws:iam:::user/${user}`)),
      },
      Action: ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"],
      Resource: [
        pulumi.interpolate`arn:aws:s3:::${bucketName}/*`,
        pulumi.interpolate`arn:aws:s3:::${bucketName}`,
      ],
    }]
  })
}

export class RookCephBucket extends pulumi.ComponentResource {
  public readonly bucketClaim: k8s.apiextensions.CustomResource;
  public readonly configMapName: pulumi.Output<string>;
  public readonly secretName: pulumi.Output<string>;
  public readonly bucketName: pulumi.Output<string>;
  public readonly endpoint: pulumi.Output<string>;
  public readonly accessKey: pulumi.Output<string>;
  public readonly secretKey: pulumi.Output<string>;

  constructor(name: string, args: RookCephBucketArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:RookCephBucket", name, args, opts);

    const spec: any = {
      storageClassName: args.storageClassName,
    };

    if (args.generateBucketName) {
      spec.generateBucketName = args.generateBucketName;
    }

    if (args.bucketName) {
      spec.bucketName = args.bucketName;
    }

    const effectiveBucketName = args.bucketName || args.generateBucketName || args.name;
    const generatedPolicy = generateBucketPolicy(effectiveBucketName, args.readUsers, args.writeUsers);

    const additionalConfig = pulumi.output(generatedPolicy).apply(policy => {
      const config: any = {};

      if (args.additionalConfig?.maxObjects !== undefined) {
        config.maxObjects = args.additionalConfig.maxObjects;
      }
      if (args.additionalConfig?.maxSize !== undefined) {
        config.maxSize = args.additionalConfig.maxSize;
      }
      if (args.additionalConfig?.bucketOwner !== undefined) {
        config.bucketOwner = args.additionalConfig.bucketOwner;
      }
      if (args.additionalConfig?.bucketPolicy !== undefined) {
        config.bucketPolicy = args.additionalConfig.bucketPolicy;
      } else if (policy !== undefined) {
        config.bucketPolicy = policy;
      }

      return Object.keys(config).length > 0 ? config : undefined;
    });

    if (args.additionalConfig || args.readUsers || args.writeUsers) {
      spec.additionalConfig = additionalConfig;
    }

    this.bucketClaim = new k8s.apiextensions.CustomResource(
      `${name}-bucketclaim`,
      {
        apiVersion: "objectbucket.io/v1alpha1",
        kind: "ObjectBucketClaim",
        metadata: {
          name: args.name,
          namespace: args.namespace,
        },
        spec,
      },
      { parent: this }
    );

    this.configMapName = pulumi.output(args.name);
    this.secretName = pulumi.output(args.name);

    const configMap = pulumi.all([args.name, args.namespace, this.bucketClaim.id]).apply(
      ([configMapName, namespace]) =>
        k8s.core.v1.ConfigMap.get(
          `${name}-configmap`,
          pulumi.interpolate`${namespace}/${configMapName}`,
          { parent: this }
        )
    );

    const secret = pulumi.all([args.name, args.namespace, this.bucketClaim.id]).apply(
      ([secretName, namespace]) =>
        k8s.core.v1.Secret.get(
          `${name}-secret`,
          pulumi.interpolate`${namespace}/${secretName}`,
          { parent: this }
        )
    );

    this.bucketName = configMap.data.apply(
      data => data ? data["BUCKET_NAME"] : ""
    );

    this.endpoint = pulumi.all([
      configMap.data.apply(data => data ? data["BUCKET_HOST"] : ""),
      configMap.data.apply(data => data ? data["BUCKET_PORT"] : "")
    ]).apply(([host, port]) => {
      if (host && port) {
        return `${host}:${port}`;
      }
      return host || "";
    });

    this.accessKey = secret.data.apply(
      data => data ? Buffer.from(data["AWS_ACCESS_KEY_ID"], "base64").toString("utf-8") : ""
    );

    this.secretKey = secret.data.apply(
      data => data ? Buffer.from(data["AWS_SECRET_ACCESS_KEY"], "base64").toString("utf-8") : ""
    );

    this.registerOutputs({
      bucketClaim: this.bucketClaim,
      configMapName: this.configMapName,
      secretName: this.secretName,
      bucketName: this.bucketName,
      endpoint: this.endpoint,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
    });
  }
}
