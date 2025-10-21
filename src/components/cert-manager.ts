import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

/**
 * Configuration for the cert-manager component
 */
export interface CertManagerArgs {
  /** Kubernetes namespace to deploy cert-manager into */
  namespace: pulumi.Input<string>;
  /** Whether to install Custom Resource Definitions (CRDs) */
  installCRDs?: pulumi.Input<boolean>;
}

/**
 * cert-manager component - provides X.509 certificate management for Kubernetes
 * 
 * @example
 * ```typescript
 * import { CertManager } from "../components/cert-manager";
 * 
 * const certManager = new CertManager("cert-manager", {
 *   namespace: "cert-manager",
 *   installCRDs: true,
 * });
 * ```
 * 
 * @see https://cert-manager.io/
 */
export class CertManager extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  constructor(name: string, args: CertManagerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CertManager", name, args, opts);

    const chartConfig = HELM_CHARTS.CERT_MANAGER;

    // Deploy cert-manager using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
        values: {
          installCRDs: args.installCRDs ?? true,
          config: {
            apiVersion: "controller.config.cert-manager.io/v1alpha1",
            kind: "ControllerConfiguration",
            enableGatewayAPI: true,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
    });
  }
}
