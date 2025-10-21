import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface InferencePoolArgs {
  namespace: pulumi.Input<string>;
  selector: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  targetPorts: pulumi.Input<pulumi.Input<{ number: pulumi.Input<number> }>[]>;
  endpointPickerChartName?: string;
  gatewayProvider?: "gke" | "istio" | "none";
  httpRoute?: {
    enabled: boolean;
    hostname: pulumi.Input<string>;
    gatewayRef: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    };
    modelName?: pulumi.Input<string>;
    requestTimeout?: pulumi.Input<string>;
  };
}

/**
 * InferencePool component - creates a Gateway API Inference Extension InferencePool resource
 * 
 * InferencePool provides load-balanced access to multiple model instances by selecting pods
 * based on label selectors. This enables high availability and horizontal scaling of inference workloads.
 * 
 * This component automatically deploys the Gateway API Inference Extension Helm chart which provides
 * the InferencePool controller and Endpoint Picker Extension (EPP) service required for InferencePool
 * resources to function properly.
 * 
 * @example
 * ```typescript
 * import { InferencePool } from "../components/inference-pool";
 * 
 * const inferencePool = new InferencePool("vllm-pool", {
 *   namespace: "ai-workspace",
 *   selector: {
 *     "app": "vllm",
 *     "model": "llama3"
 *   },
 *   targetPorts: [{ number: 8000 }],
 * });
 * ```
 * 
 * @example
 * ```typescript
 * const multiInstancePool = new InferencePool("multi-instance-pool", {
 *   namespace: "ai-workspace",
 *   selector: {
 *     "app": "vllm",
 *     "environment": "production"
 *   },
 *   targetPorts: [{ number: 8000 }],
 *   gatewayProvider: "gke",
 * });
 * ```
 * 
 * @see https://gateway-api-inference-extension.sigs.k8s.io/reference/spec/#inferencepoolspec
 */
export class InferencePool extends pulumi.ComponentResource {
  public readonly chart?: k8s.helm.v4.Chart;
  public readonly httpRoute?: k8s.apiextensions.CustomResource;

  constructor(public name: string, args: InferencePoolArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:InferencePool", name, args, opts);

    const gatewayProvider = args.gatewayProvider ?? "none";

    const chartConfig = HELM_CHARTS.GATEWAY_API_INFERENCE_POOL;
    const chartArgs = createHelmChartArgs(chartConfig, args.namespace);

    const helmValues: any = {
      inferencePool: {
        modelServers: {
          matchLabels: args.selector,
        },
      },
      provider: {
        name: gatewayProvider,
      },
    };

    this.chart = new k8s.helm.v4.Chart(name,
      {
        ...chartArgs,
        values: helmValues,
      },
      { parent: this }
    );

    if (args.httpRoute?.enabled) {
      const matches: any[] = [{
        path: {
          type: "PathPrefix",
          value: "/",
        },
      }];

      if (args.httpRoute.modelName) {
        matches[0].headers = [{
          type: "Exact",
          name: "X-Gateway-Model-Name",
          value: args.httpRoute.modelName,
        }];
      }

      const timeouts: any = {};
      if (args.httpRoute.requestTimeout) {
        timeouts.request = args.httpRoute.requestTimeout;
      }

      this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
          name: `${name}-route`,
          namespace: args.namespace,
          labels: {
            app: "inference-pool",
            component: name,
          },
        },
        spec: {
          parentRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: args.httpRoute.gatewayRef.name,
            namespace: args.httpRoute.gatewayRef.namespace,
          }],
          hostnames: [args.httpRoute.hostname],
          rules: [{
            backendRefs: [{
              group: "inference.networking.k8s.io",
              kind: "InferencePool",
              name: name,
            }],
            matches: matches,
            ...(Object.keys(timeouts).length > 0 && { timeouts }),
          }],
        },
      }, { parent: this, dependsOn: [this.chart] });
    }

    this.registerOutputs({
      chart: this.chart,
      httpRoute: this.httpRoute,
    });
  }

  public getHttpRouteHostname(): pulumi.Output<string> | undefined {
    if (this.httpRoute) {
      return pulumi.output(this.httpRoute).apply((route: any) => route.spec?.hostnames?.[0] || "") as pulumi.Output<string>;
    }
    return undefined;
  }

  public getPoolName(): pulumi.Output<string> {
    return pulumi.output(this.name);
  }
}
