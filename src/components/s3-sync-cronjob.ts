import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface S3RemoteConfig {
  endpoint: pulumi.Input<string>;
  bucket: pulumi.Input<string>;
  folder?: pulumi.Input<string>;
  accessKey: pulumi.Input<string>;
  secretKey: pulumi.Input<string>;
}

export interface S3SyncCronJobArgs {
  namespace: pulumi.Input<string>;
  schedule: pulumi.Input<string>;
  source: S3RemoteConfig;
  target: S3RemoteConfig;
  syncMode: pulumi.Input<"sync" | "bisync">;
  rcloneImage?: pulumi.Input<string>;
  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };
}

export class S3SyncCronJob extends pulumi.ComponentResource {
  public readonly cronJob: k8s.batch.v1.CronJob;
  public readonly secret: k8s.core.v1.Secret;
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;

  constructor(name: string, args: S3SyncCronJobArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:S3SyncCronJob", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const rcloneConfig = pulumi.all([
      args.source.endpoint,
      args.source.bucket,
      args.source.folder,
      args.source.accessKey,
      args.source.secretKey,
      args.target.endpoint,
      args.target.bucket,
      args.target.folder,
      args.target.accessKey,
      args.target.secretKey,
    ]).apply(([
      sourceEndpoint,
      sourceBucket,
      sourceFolder,
      sourceAccessKey,
      sourceSecretKey,
      targetEndpoint,
      targetBucket,
      targetFolder,
      targetAccessKey,
      targetSecretKey,
    ]) => {
      return [
        "[source]",
        "type = s3",
        "provider = Ceph",
        "env_auth = false",
        `access_key_id = ${sourceAccessKey}`,
        `secret_access_key = ${sourceSecretKey}`,
        `endpoint = ${sourceEndpoint}`,
        "",
        "[target]",
        "type = s3",
        "provider = Ceph",
        "env_auth = false",
        `access_key_id = ${targetAccessKey}`,
        `secret_access_key = ${targetSecretKey}`,
        `endpoint = ${targetEndpoint}`,
      ].join("\n");
    });

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-rclone-config`,
        namespace: args.namespace,
      },
      stringData: {
        "rclone.conf": rcloneConfig,
      },
    }, defaultResourceOptions);

    const syncCommand = pulumi.all([
      args.syncMode,
      args.source.bucket,
      args.source.folder,
      args.target.bucket,
      args.target.folder,
    ]).apply(([
      syncMode,
      srcBucket,
      srcFolder,
      tgtBucket,
      tgtFolder,
    ]) => {
      const sourcePath = srcFolder ? `source:${srcBucket}/${srcFolder}` : `source:${srcBucket}`;
      const targetPath = tgtFolder ? `target:${tgtBucket}/${tgtFolder}` : `target:${tgtBucket}`;
      
      if (syncMode === "bisync") {
        return ["rclone", "bisync", sourcePath, targetPath, "--resync", "--verbose", "--create-empty-src-dirs"];
      } else {
        return ["rclone", "sync", sourcePath, targetPath, "--verbose", "--create-empty-src-dirs"];
      }
    });

    const labels = { app: name, component: "s3-sync" };

    this.cronJob = new k8s.batch.v1.CronJob(`${name}-cronjob`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        schedule: args.schedule,
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        concurrencyPolicy: "Forbid",
        jobTemplate: {
          spec: {
            backoffLimit: 2,
            template: {
              metadata: {
                labels: labels,
              },
              spec: {
                restartPolicy: "OnFailure",
                containers: [{
                  name: "rclone",
                  image: args.rcloneImage || "rclone/rclone:latest",
                  command: syncCommand,
                  volumeMounts: [{
                    name: "rclone-config",
                    mountPath: "/config/rclone",
                    readOnly: true,
                  }],
                  env: [{
                    name: "RCLONE_CONFIG",
                    value: "/config/rclone/rclone.conf",
                  }],
                  resources: {
                    requests: {
                      memory: args.resources?.requests?.memory || "128Mi",
                      cpu: args.resources?.requests?.cpu || "100m",
                    },
                    limits: {
                      memory: args.resources?.limits?.memory || "512Mi",
                      cpu: args.resources?.limits?.cpu || "500m",
                    },
                  },
                }],
                volumes: [{
                  name: "rclone-config",
                  secret: {
                    secretName: this.secret.metadata.name,
                  },
                }],
              },
            },
          },
        },
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      cronJob: this.cronJob,
      secret: this.secret,
    });
  }

  public getCronJobName(): pulumi.Output<string> {
    return this.cronJob.metadata.name;
  }
}
