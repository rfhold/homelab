import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface RookCephObjectStoreUserArgs {
  name: pulumi.Input<string>;
  namespace: pulumi.Input<string>;
  store: pulumi.Input<string>;
  displayName: pulumi.Input<string>;
  quotas?: {
    maxBuckets?: pulumi.Input<number>;
    maxSize?: pulumi.Input<string>;
    maxObjects?: pulumi.Input<number>;
  };
  capabilities?: {
    user?: pulumi.Input<string>;
    bucket?: pulumi.Input<string>;
    usage?: pulumi.Input<string>;
    metadata?: pulumi.Input<string>;
    zone?: pulumi.Input<string>;
  };
}

export class RookCephObjectStoreUser extends pulumi.ComponentResource {
  public readonly user: k8s.apiextensions.CustomResource;
  public readonly secretName: pulumi.Output<string>;
  public readonly accessKey: pulumi.Output<string>;
  public readonly secretKey: pulumi.Output<string>;

  constructor(name: string, args: RookCephObjectStoreUserArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:RookCephObjectStoreUser", name, args, opts);

    const spec: any = {
      store: args.store,
      displayName: args.displayName,
    };

    if (args.quotas) {
      spec.quotas = {};
      if (args.quotas.maxBuckets !== undefined) {
        spec.quotas.maxBuckets = args.quotas.maxBuckets;
      }
      if (args.quotas.maxSize !== undefined) {
        spec.quotas.maxSize = args.quotas.maxSize;
      }
      if (args.quotas.maxObjects !== undefined) {
        spec.quotas.maxObjects = args.quotas.maxObjects;
      }
    }

    if (args.capabilities) {
      spec.capabilities = {};
      if (args.capabilities.user !== undefined) {
        spec.capabilities.user = args.capabilities.user;
      }
      if (args.capabilities.bucket !== undefined) {
        spec.capabilities.bucket = args.capabilities.bucket;
      }
      if (args.capabilities.usage !== undefined) {
        spec.capabilities.usage = args.capabilities.usage;
      }
      if (args.capabilities.metadata !== undefined) {
        spec.capabilities.metadata = args.capabilities.metadata;
      }
      if (args.capabilities.zone !== undefined) {
        spec.capabilities.zone = args.capabilities.zone;
      }
    }

    this.user = new k8s.apiextensions.CustomResource(
      `${name}-user`,
      {
        apiVersion: "ceph.rook.io/v1",
        kind: "CephObjectStoreUser",
        metadata: {
          name: args.name,
          namespace: args.namespace,
        },
        spec,
      },
      { parent: this }
    );

    this.secretName = pulumi.interpolate`rook-ceph-object-user-${args.store}-${args.name}`;

    const secret = pulumi.all([this.secretName, args.namespace, this.user.id]).apply(
      ([secretName, namespace]) =>
        k8s.core.v1.Secret.get(
          `${name}-secret`,
          pulumi.interpolate`${namespace}/${secretName}`,
          { parent: this }
        )
    );

    this.accessKey = secret.data.apply(
      data => data ? Buffer.from(data["AccessKey"], "base64").toString("utf-8") : ""
    );

    this.secretKey = secret.data.apply(
      data => data ? Buffer.from(data["SecretKey"], "base64").toString("utf-8") : ""
    );

    this.registerOutputs({
      user: this.user,
      secretName: this.secretName,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
    });
  }
}
