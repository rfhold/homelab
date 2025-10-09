import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface K3sEtcdS3ConfigArgs {
  namespace: pulumi.Input<string>;
  secretName: pulumi.Input<string>;
  s3Config: {
    endpoint: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    region: pulumi.Input<string>;
    accessKey: pulumi.Input<string>;
    secretKey: pulumi.Input<string>;
    folder?: pulumi.Input<string>;
    skipSslVerify?: pulumi.Input<boolean>;
    insecure?: pulumi.Input<boolean>;
    timeout?: pulumi.Input<string>;
  };
}

export class K3sEtcdS3Config extends pulumi.ComponentResource {
  public readonly secret: k8s.core.v1.Secret;

  constructor(name: string, args: K3sEtcdS3ConfigArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:K3sEtcdS3Config", name, args, opts);

    const skipSslVerify = pulumi.output(args.s3Config.skipSslVerify ?? false).apply(v => v.toString());
    const insecure = pulumi.output(args.s3Config.insecure ?? false).apply(v => v.toString());
    const timeout = pulumi.output(args.s3Config.timeout ?? "5m");
    const folder = pulumi.output(args.s3Config.folder ?? "");

    const stringData = pulumi.all([
      args.s3Config.endpoint,
      args.s3Config.bucket,
      args.s3Config.region,
      args.s3Config.accessKey,
      args.s3Config.secretKey,
      folder,
      skipSslVerify,
      insecure,
      timeout,
    ]).apply(([endpoint, bucket, region, accessKey, secretKey, folderValue, skipSslVerifyValue, insecureValue, timeoutValue]) => {
      const data: { [key: string]: string } = {
        "etcd-s3-endpoint": endpoint,
        "etcd-s3-bucket": bucket,
        "etcd-s3-region": region,
        "etcd-s3-access-key": accessKey,
        "etcd-s3-secret-key": secretKey,
        "etcd-s3-skip-ssl-verify": skipSslVerifyValue,
        "etcd-s3-insecure": insecureValue,
        "etcd-s3-timeout": timeoutValue,
      };

      if (folderValue && folderValue !== "") {
        data["etcd-s3-folder"] = folderValue;
      }

      return data;
    });

    this.secret = new k8s.core.v1.Secret(
      `${name}-secret`,
      {
        metadata: {
          name: args.secretName,
          namespace: args.namespace,
        },
        type: "etcd.k3s.cattle.io/s3-config-secret",
        stringData: stringData,
      },
      { parent: this }
    );

    this.registerOutputs({
      secret: this.secret,
    });
  }
}
