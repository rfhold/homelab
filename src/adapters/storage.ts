import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Configuration for creating Kubernetes Persistent Volume Claims (PVCs)
 */
export interface StorageConfig {
  /** Storage size (e.g., "10Gi", "1Ti", "500Mi") */
  size: pulumi.Input<string>;
  
  /** Storage class name (e.g., "fast-ssd", "standard", "slow") */
  storageClass?: pulumi.Input<string>;
  
  /** Access modes for the PVC (defaults to ["ReadWriteOnce"]) */
  accessModes?: pulumi.Input<string[]>;
  
  /** Volume mode: "Filesystem" or "Block" (defaults to "Filesystem") */
  volumeMode?: pulumi.Input<string>;
  
  /** Namespace for the PVC (defaults to "default") */
  namespace?: pulumi.Input<string>;
  
  /** Labels to apply to the PVC */
  labels?: pulumi.Input<Record<string, string>>;
  
  /** Annotations to apply to the PVC */
  annotations?: pulumi.Input<Record<string, string>>;
  
  /** Selector for binding to specific PVs */
  selector?: pulumi.Input<{
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: string;
      values?: string[];
    }>;
  }>;
  
  /** Data source for cloning or restoring from snapshots */
  dataSource?: pulumi.Input<{
    name: string;
    kind: string;
    apiGroup?: string;
  }>;
}

/**
 * Creates a Kubernetes PVC specification from storage configuration
 * 
 * @param name Name for the PVC
 * @param config Storage configuration
 * @param opts Optional Pulumi resource options
 * @returns Kubernetes PVC resource
 */
export function createPVC(name: string, config: StorageConfig, opts?: pulumi.ResourceOptions): k8s.core.v1.PersistentVolumeClaim {
  return new k8s.core.v1.PersistentVolumeClaim(name, {
    metadata: {
      name: name,
      namespace: config.namespace || "default",
      labels: config.labels,
      annotations: config.annotations,
    },
    spec: {
      accessModes: config.accessModes || ["ReadWriteOnce"],
      volumeMode: config.volumeMode || "Filesystem",
      storageClassName: config.storageClass,
      resources: {
        requests: {
          storage: config.size,
        },
      },
      selector: config.selector,
      dataSource: config.dataSource,
    },
  }, opts);
}

/**
 * Creates a PVC specification object (without creating the actual resource)
 * Useful for embedding in other Kubernetes resources
 * 
 * @param config Storage configuration
 * @returns PVC specification object
 */
export function createPVCSpec(config: StorageConfig) {
  return {
    accessModes: config.accessModes || ["ReadWriteOnce"],
    volumeMode: config.volumeMode || "Filesystem",
    storageClassName: config.storageClass,
    resources: {
      requests: {
        storage: config.size,
      },
    },
    selector: config.selector,
    dataSource: config.dataSource,
  };
}


