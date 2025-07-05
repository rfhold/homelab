import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Configuration for the ExternalSnapshotter component
 */
export interface ExternalSnapshotterArgs {
  /** Kubernetes namespace to deploy the snapshot controller into */
  namespace: pulumi.Input<string>;
  /** Version of external-snapshotter to install */
  version?: pulumi.Input<string>;
}

/**
 * ExternalSnapshotter component - provides Kubernetes Volume Snapshot functionality for K3s
 * 
 * This component installs the necessary CRDs and snapshot controller required for 
 * volume snapshots in K3s clusters, which don't include external-snapshotter by default.
 * 
 * @example
 * ```typescript
 * import { ExternalSnapshotter } from "../components/external-snapshotter";
 * 
 * const snapshotter = new ExternalSnapshotter("volume-snapshotter", {
 *   namespace: "kube-system",
 *   version: "v8.2.0",
 * });
 * ```
 * 
 * @see https://github.com/kubernetes-csi/external-snapshotter
 * @see https://kubernetes-csi.github.io/docs/snapshot-restore-feature.html
 */
export class ExternalSnapshotter extends pulumi.ComponentResource {
  /** The snapshot CRDs */
  public readonly crds: k8s.kustomize.v2.Directory;
  /** The snapshot controller deployment */
  public readonly controller: k8s.kustomize.v2.Directory;

  constructor(name: string, args: ExternalSnapshotterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ExternalSnapshotter", name, args, opts);

    const version = args.version || "v8.2.0";
    
    // Install Volume Snapshot CRDs using Kustomize
    this.crds = new k8s.kustomize.v2.Directory(
      `${name}-crds`,
      {
        directory: pulumi.interpolate`https://github.com/kubernetes-csi/external-snapshotter/client/config/crd?ref=${version}`,
      },
      { parent: this }
    );

    // Install Snapshot Controller using Kustomize with namespace override
    this.controller = new k8s.kustomize.v2.Directory(
      `${name}-controller`,
      {
        directory: pulumi.interpolate`https://github.com/kubernetes-csi/external-snapshotter/deploy/kubernetes/snapshot-controller?ref=${version}`,
      },
      { 
        parent: this,
        dependsOn: [this.crds],
        transformations: [
          (args: any) => {
            // Override namespace for all resources except ClusterRole and ClusterRoleBinding
            if (args.props.metadata && args.props.kind !== "ClusterRole" && args.props.kind !== "ClusterRoleBinding") {
              args.props.metadata.namespace = args.namespace;
            }
            return {
              props: args.props,
              opts: args.opts,
            };
          }
        ]
      }
    );

    this.registerOutputs({
      crds: this.crds,
      controller: this.controller,
    });
  }
} 