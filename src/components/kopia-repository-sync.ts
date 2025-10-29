import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface KopiaRepositorySyncArgs {
  namespace: pulumi.Input<string>;
  schedule: pulumi.Input<string>;
  
  source: {
    endpoint: pulumi.Input<string>;
    bucket: pulumi.Input<string>;
    prefix?: pulumi.Input<string>;
    accessKey: pulumi.Input<string>;
    secretKey: pulumi.Input<string>;
    region?: pulumi.Input<string>;
  };
  
  repositoryPassword: pulumi.Input<string>;
  
  storage: StorageConfig;
  mountPath?: pulumi.Input<string>;
  
  kopiaImage?: pulumi.Input<string>;
  parallel?: pulumi.Input<number>;
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
  
  namespaces?: pulumi.Input<string[]>;
}

export class KopiaRepositorySync extends pulumi.ComponentResource {
  public readonly cronJob: k8s.batch.v1.CronJob;
  public readonly secret: k8s.core.v1.Secret;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;

  constructor(name: string, args: KopiaRepositorySyncArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:KopiaRepositorySync", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: name, component: "kopia-repository-sync" };

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-credentials`,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        "aws-access-key-id": args.source.accessKey,
        "aws-secret-access-key": args.source.secretKey,
      },
    }, defaultResourceOptions);

    const storageConfigWithDefaults: StorageConfig = {
      ...args.storage,
      namespace: args.namespace,
      labels: { ...args.storage.labels, ...labels },
      accessModes: args.storage.accessModes || ["ReadWriteMany"],
    };

    this.pvc = createPVC(`${name}-pvc`, storageConfigWithDefaults, defaultResourceOptions);

    const syncScript = pulumi.all([
      args.source.endpoint,
      args.source.bucket,
      args.source.prefix,
      args.source.region,
      args.mountPath,
      args.parallel,
      args.namespaces,
    ]).apply(([
      endpoint,
      bucket,
      prefix,
      region,
      mountPath,
      parallel,
      namespaces,
    ]) => {
      const nfsPath = mountPath || "/nfs-backup";
      const s3Prefix = prefix || "restic";
      const s3Region = region || "auto";
      const parallelThreads = parallel || 8;

      return `#!/bin/bash
set -e

echo "========================================"
echo "Velero Kopia Repository Sync - $(date)"
echo "========================================"
echo "Source: s3://${bucket}/${s3Prefix}"
echo "Target: ${nfsPath}/repositories"
echo "Method: Object-level sync (opaque copy)"
echo "========================================"

mkdir -p "${nfsPath}/repositories" /tmp/logs

echo "Configuring rclone S3 source..."
rclone config create s3source s3 \\
  provider=Other \\
  access_key_id="$AWS_ACCESS_KEY_ID" \\
  secret_access_key="$AWS_SECRET_ACCESS_KEY" \\
  endpoint="${endpoint}" \\
  region="${s3Region}" \\
  --config /tmp/rclone.conf >/dev/null 2>&1

NAMESPACES_TO_SYNC=()

if [ -z "${namespaces ? `"${namespaces.join(" ")}"` : ""}" ]; then
  echo "Discovering namespaces from S3 repository..."
  
  rclone lsd --config /tmp/rclone.conf "s3source:${bucket}/${s3Prefix}/" 2>/dev/null | awk '{print $NF}' > /tmp/namespaces.txt || true
  
  while IFS= read -r ns; do
    if [ -n "$ns" ]; then
      NAMESPACES_TO_SYNC+=("$ns")
    fi
  done < /tmp/namespaces.txt
else
  NAMESPACES_TO_SYNC=(${namespaces ? namespaces.map(n => `"${n}"`).join(" ") : ""})
fi

if [ \${#NAMESPACES_TO_SYNC[@]} -eq 0 ]; then
  echo "No namespaces found to sync. Exiting."
  exit 0
fi

echo "Found \${#NAMESPACES_TO_SYNC[@]} namespace(s) to sync: \${NAMESPACES_TO_SYNC[*]}"
echo "========================================"

SYNC_ERRORS=0
SYNC_SUCCESS=0
TOTAL_BYTES_SYNCED=0

for namespace in "\${NAMESPACES_TO_SYNC[@]}"; do
  echo ""
  echo "Processing namespace: $namespace"
  echo "----------------------------------------"
  
  S3_SOURCE="s3source:${bucket}/${s3Prefix}/$namespace/"
  NFS_TARGET="${nfsPath}/repositories/$namespace/"
  
  mkdir -p "$NFS_TARGET"
  
  echo "Syncing repository data (this may take a while)..."
  echo "Source: $S3_SOURCE"
  echo "Target: $NFS_TARGET"
  
  SYNC_OUTPUT=$(rclone sync \\
    --config /tmp/rclone.conf \\
    --transfers ${parallelThreads} \\
    --checkers ${parallelThreads} \\
    --stats-one-line \\
    --stats 10s \\
    --verbose \\
    "$S3_SOURCE" "$NFS_TARGET" 2>&1 | tee /tmp/logs/sync-$namespace.log)
  
  SYNC_EXIT_CODE=\${PIPESTATUS[0]}
  
  if [ $SYNC_EXIT_CODE -eq 0 ]; then
    REPO_SIZE=$(du -sh "$NFS_TARGET" 2>/dev/null | awk '{print $1}' || echo "unknown")
    REPO_FILES=$(find "$NFS_TARGET" -type f 2>/dev/null | wc -l || echo "0")
    
    if [ "$REPO_FILES" -gt 0 ]; then
      echo "✓ Successfully synced namespace: $namespace"
      echo "  Files: $REPO_FILES"
      echo "  Size: $REPO_SIZE"
      SYNC_SUCCESS=$((SYNC_SUCCESS + 1))
    else
      echo "ERROR: No files synced for namespace: $namespace"
      SYNC_ERRORS=$((SYNC_ERRORS + 1))
    fi
  else
    echo "ERROR: Failed to sync repository for namespace: $namespace (exit code: $SYNC_EXIT_CODE)"
    SYNC_ERRORS=$((SYNC_ERRORS + 1))
  fi
done

echo ""
echo "========================================"
echo "Sync Summary - $(date)"
echo "========================================"
echo "Total namespaces: \${#NAMESPACES_TO_SYNC[@]}"
echo "Successful syncs: $SYNC_SUCCESS"
echo "Failed syncs: $SYNC_ERRORS"
echo "========================================"

if [ "$SYNC_ERRORS" -gt 0 ]; then
  echo "WARNING: Some repositories failed to sync. Check logs for details."
  exit 1
fi

echo "All repositories synced successfully!"
echo ""
echo "Note: These are opaque copies of Velero's Kopia repositories."
echo "To use them for recovery, restore the data back to S3 and"
echo "Velero will automatically reconnect to the existing repositories."
exit 0
`;
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-configmap`, {
      metadata: {
        name: `${name}-script`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "sync.sh": syncScript,
      },
    }, defaultResourceOptions);

    this.cronJob = new k8s.batch.v1.CronJob(`${name}-cronjob`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
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
                labels,
              },
              spec: {
                restartPolicy: "OnFailure",
                securityContext: {
                  runAsUser: 0,
                  fsGroup: 0,
                },
                containers: [{
                  name: "kopia-sync",
                  image: args.kopiaImage || "kopia/kopia:latest",
                  command: ["/bin/bash", "/scripts/sync.sh"],
                  env: [
                    {
                      name: "AWS_ACCESS_KEY_ID",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret.metadata.name,
                          key: "aws-access-key-id",
                        },
                      },
                    },
                    {
                      name: "AWS_SECRET_ACCESS_KEY",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.secret.metadata.name,
                          key: "aws-secret-access-key",
                        },
                      },
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "nfs-backup",
                      mountPath: args.mountPath || "/nfs-backup",
                    },
                    {
                      name: "script",
                      mountPath: "/scripts",
                      readOnly: true,
                    },
                  ],
                  resources: {
                    requests: {
                      memory: args.resources?.requests?.memory || "2Gi",
                      cpu: args.resources?.requests?.cpu || "1000m",
                    },
                    limits: {
                      memory: args.resources?.limits?.memory || "4Gi",
                      cpu: args.resources?.limits?.cpu || "2000m",
                    },
                  },
                }],
                volumes: [
                  {
                    name: "nfs-backup",
                    persistentVolumeClaim: {
                      claimName: this.pvc.metadata.name,
                    },
                  },
                  {
                    name: "script",
                    configMap: {
                      name: this.configMap.metadata.name,
                      defaultMode: 0o755,
                    },
                  },
                ],
              },
            },
          },
        },
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      cronJob: this.cronJob,
      secret: this.secret,
      configMap: this.configMap,
      pvc: this.pvc,
    });
  }

  public getCronJobName(): pulumi.Output<string> {
    return this.cronJob.metadata.name;
  }

  public getPvcName(): pulumi.Output<string> {
    return this.pvc.metadata.name;
  }
}
