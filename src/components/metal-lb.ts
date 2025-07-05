import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

/**
 * Configuration for a MetalLB IP address pool
 */
export interface IPAddressPoolConfig {
  /** Name of the IP address pool */
  name: string;
  /** IP address ranges in CIDR notation or range format (e.g., "192.168.1.240-192.168.1.250" or "192.168.10.0/24") */
  addresses: pulumi.Input<string[]>;
  /** Whether to automatically assign IPs from this pool (default: true) */
  autoAssign?: pulumi.Input<boolean>;
  /** Whether to avoid problematic IPs like .0 and .255 (default: true) */
  avoidBuggyIPs?: pulumi.Input<boolean>;
}

/**
 * Configuration for L2 advertisements with VLAN support
 */
export interface L2AdvertisementConfig {
  /** Name of the L2 advertisement */
  name: string;
  /** IP address pools to advertise via this advertisement */
  ipAddressPools: string[];
  /** Network interfaces to advertise from (supports VLAN interfaces like eth0.100) */
  interfaces?: pulumi.Input<string[]>;
  /** Node selector to limit which nodes can advertise */
  nodeSelectors?: pulumi.Input<k8s.types.input.meta.v1.LabelSelector[]>;
}

/**
 * Arguments for IPAddressPool component
 */
export interface IPAddressPoolArgs {
  /** Kubernetes namespace */
  namespace: pulumi.Input<string>;
  /** Pool configuration */
  poolConfig: IPAddressPoolConfig;
}

/**
 * IPAddressPool component - manages a single MetalLB IP address pool
 */
export class IPAddressPool extends pulumi.ComponentResource {
  /** The IPAddressPool custom resource */
  public readonly pool: k8s.apiextensions.CustomResource;

  constructor(name: string, args: IPAddressPoolArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:IPAddressPool", name, args, opts);

    this.pool = new k8s.apiextensions.CustomResource(
      `${name}-pool`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "IPAddressPool",
        metadata: {
          name: args.poolConfig.name,
          namespace: args.namespace,
        },
        spec: {
          addresses: args.poolConfig.addresses,
          autoAssign: args.poolConfig.autoAssign ?? true,
          avoidBuggyIPs: args.poolConfig.avoidBuggyIPs ?? true,
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      pool: this.pool,
    });
  }
}

/**
 * Arguments for L2Advertisement component
 */
export interface L2AdvertisementArgs {
  /** Kubernetes namespace */
  namespace: pulumi.Input<string>;
  /** L2 advertisement configuration */
  advertisementConfig: L2AdvertisementConfig;
}

/**
 * L2Advertisement component - manages a single MetalLB L2 advertisement
 */
export class L2Advertisement extends pulumi.ComponentResource {
  /** The L2Advertisement custom resource */
  public readonly advertisement: k8s.apiextensions.CustomResource;

  constructor(name: string, args: L2AdvertisementArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:L2Advertisement", name, args, opts);

    this.advertisement = new k8s.apiextensions.CustomResource(
      `${name}-advertisement`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "L2Advertisement",
        metadata: {
          name: args.advertisementConfig.name,
          namespace: args.namespace,
        },
        spec: {
          ipAddressPools: args.advertisementConfig.ipAddressPools,
          ...(args.advertisementConfig.interfaces && { interfaces: args.advertisementConfig.interfaces }),
          ...(args.advertisementConfig.nodeSelectors && { nodeSelectors: args.advertisementConfig.nodeSelectors }),
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      advertisement: this.advertisement,
    });
  }
}

/**
 * Configuration for the MetalLB component
 */
export interface MetalLbArgs {
  /** Kubernetes namespace to deploy MetalLB into */
  namespace: pulumi.Input<string>;
}

/**
 * MetalLB component - provides the core MetalLB operator via Helm chart
 * 
 * @example
 * ```typescript
 * import { MetalLb } from "../components/metal-lb";
 * 
 * const metalLb = new MetalLb("load-balancer", {
 *   namespace: "metallb-system",
 * });
 * ```
 * 
 * @see https://metallb.universe.tf/
 */
export class MetalLb extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: MetalLbArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:MetalLb", name, args, opts);

    const chartConfig = HELM_CHARTS.METAL_LB;

    // Deploy MetalLB using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}
