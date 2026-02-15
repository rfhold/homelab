import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";

export interface KgatewayArgs {
  /** Kubernetes namespace to deploy kgateway into */
  namespace: pulumi.Input<string>;

  /** GatewayClass configuration */
  gatewayClass?: {
    /** Name of the GatewayClass (defaults to "kgateway") */
    name?: pulumi.Input<string>;
    /** Whether to create the GatewayClass (defaults to true) */
    create?: pulumi.Input<boolean>;
  };

  /** AI Gateway configuration */
  aiGateway?: {
    /** Enable AI Gateway features */
    enabled?: pulumi.Input<boolean>;
  };

  /** Install Gateway API CRDs (defaults to true) */
  installGatewayApiCRDs?: pulumi.Input<boolean>;

  /** Gateway API version to install (defaults to "v1.4.0") */
  gatewayApiVersion?: pulumi.Input<string>;

  /** Use experimental Gateway API features (defaults to false) */
  useExperimentalGatewayApi?: pulumi.Input<boolean>;

  /** Enable Gateway API Inference Extension (defaults to false) */
  inferenceExtension?: {
    /** Enable the inference extension */
    enabled?: pulumi.Input<boolean>;
    /** Inference extension version (defaults to "v1.0.2") */
    version?: pulumi.Input<string>;
  };
}

/**
 * kgateway component - provides Kubernetes Gateway API implementation with Envoy-based API Gateway
 *
 * @example
 * ```typescript
 * import { Kgateway } from "../components/kgateway";
 *
 * const kgateway = new Kgateway("kgateway", {
 *   namespace: "kgateway-system",
 * });
 *
 * const kgatewayAI = new Kgateway("kgateway-ai", {
 *   namespace: "kgateway-system",
 *   aiGateway: {
 *     enabled: true,
 *   },
 * });
 * ```
 *
 * @see https://kgateway.dev/
 */
export class Kgateway extends pulumi.ComponentResource {
  /** The kgateway CRDs Helm chart deployment */
  public readonly crdsChart: k8s.helm.v4.Chart;

  /** The kgateway Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  /** The GatewayClass custom resource */
  public readonly gatewayClass?: k8s.apiextensions.CustomResource;

  /** The name of the GatewayClass */
  public readonly gatewayClassName: pulumi.Output<string>;

  /** Gateway API Inference Extension CRDs */
  public readonly inferenceExtensionCrds?: k8s.yaml.v2.ConfigFile;

  /** Agentgateway CRDs Helm chart deployment */
  public readonly agentgatewayCrdsChart?: k8s.helm.v4.Chart;



  constructor(name: string, args: KgatewayArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Kgateway", name, args, opts);

    const gatewayApiVersion = args.gatewayApiVersion ?? "v1.4.0";
    const useExperimental = args.useExperimentalGatewayApi ?? false;
    const installGatewayApiCRDs = args.installGatewayApiCRDs ?? true;

    let gatewayApiCrds: k8s.yaml.v2.ConfigFile | undefined;

    if (installGatewayApiCRDs) {
      const crdsUrl = useExperimental
        ? `https://github.com/kubernetes-sigs/gateway-api/releases/download/${gatewayApiVersion}/experimental-install.yaml`
        : `https://github.com/kubernetes-sigs/gateway-api/releases/download/${gatewayApiVersion}/standard-install.yaml`;

      gatewayApiCrds = new k8s.yaml.v2.ConfigFile(
        `${name}-gateway-api-crds`,
        {
          file: crdsUrl,
        },
        { parent: this }
      );
    }

    if (args.inferenceExtension?.enabled) {
      const inferenceExtensionVersion = args.inferenceExtension.version ?? "v1.0.2";
      const inferenceExtensionUrl = `https://github.com/kubernetes-sigs/gateway-api-inference-extension/releases/download/${inferenceExtensionVersion}/manifests.yaml`;

      this.inferenceExtensionCrds = new k8s.yaml.v2.ConfigFile(
        `${name}-inference-extension-crds`,
        {
          file: inferenceExtensionUrl,
        },
        {
          parent: this,
          dependsOn: gatewayApiCrds ? [gatewayApiCrds] : [],
        }
      );
    }

    const crdsChartConfig = HELM_CHARTS.KGATEWAY_CRDS;
    const crdsChartArgs = createHelmChartArgs(crdsChartConfig, args.namespace);

    const crdsDependencies = [
      ...(gatewayApiCrds ? [gatewayApiCrds] : []),
      ...(this.inferenceExtensionCrds ? [this.inferenceExtensionCrds] : []),
    ];

    this.crdsChart = new k8s.helm.v4.Chart(
      `${name}-crds-chart`,
      {
        ...crdsChartArgs,
      },
      {
        parent: this,
        dependsOn: crdsDependencies,
        ignoreChanges: ["chart"],
      }
    );

    const helmValues: any = {
    };

    if (args.inferenceExtension?.enabled) {
      helmValues.inferenceExtension = {
        enabled: true,
      };
    }

    if (args.aiGateway?.enabled) {
      const agentgatewayCrdsConfig = HELM_CHARTS.AGENTGATEWAY_CRDS;
      const agentgatewayCrdsArgs = createHelmChartArgs(agentgatewayCrdsConfig, args.namespace);

      this.agentgatewayCrdsChart = new k8s.helm.v4.Chart(
        `${name}-agentgateway-crds`,
        {
          ...agentgatewayCrdsArgs,
        },
        {
          parent: this,
          dependsOn: crdsDependencies,
          ignoreChanges: ["chart"],
          customTimeouts: { create: "5m", update: "5m" },
        }
      );

    }

    if (useExperimental) {
      helmValues.controller = {
        ...helmValues.controller,
        extraEnv: {
          ...helmValues.controller?.extraEnv,
          KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES: "true",
        },
      };
    }

    const chartConfig = HELM_CHARTS.KGATEWAY;
    const chartArgs = createHelmChartArgs(chartConfig, args.namespace);

    const chartDependencies: pulumi.Resource[] = [this.crdsChart];
    if (this.agentgatewayCrdsChart) {
      chartDependencies.push(this.agentgatewayCrdsChart);
    }

    const chartTransformations: pulumi.ResourceTransformation[] = [];

    if (args.aiGateway?.enabled) {
      chartTransformations.push((tfArgs: pulumi.ResourceTransformationArgs) => {
        if (tfArgs.type === "kubernetes:apps/v1:Deployment") {
          const containers = tfArgs.props?.spec?.template?.spec?.containers;
          if (containers) {
            for (const container of containers) {
              if (container.name === "controller" && container.env) {
                for (const env of container.env) {
                  if (env.name === "KGW_ENABLE_AGENTGATEWAY") {
                    env.value = "true";
                  }
                }
              }
              if (container.name === "controller" && container.ports) {
                const has9978 = container.ports.some((p: any) => p.containerPort === 9978);
                if (!has9978) {
                  container.ports.push({
                    name: "grpc-xds-agw",
                    containerPort: 9978,
                    protocol: "TCP",
                  });
                }
              }
            }
          }
          return { props: tfArgs.props, opts: tfArgs.opts };
        }
        if (tfArgs.type === "kubernetes:core/v1:Service") {
          const ports = tfArgs.props?.spec?.ports;
          if (ports) {
            const has9978 = ports.some((p: any) => p.port === 9978);
            if (!has9978) {
              ports.push({
                name: "grpc-xds-agw",
                port: 9978,
                targetPort: 9978,
                protocol: "TCP",
              });
            }
          }
          return { props: tfArgs.props, opts: tfArgs.opts };
        }
        return undefined;
      });
    }

    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        ...chartArgs,
        values: helmValues,
      },
      { parent: this, dependsOn: chartDependencies, transformations: chartTransformations }
    );

    const gatewayClassName = args.gatewayClass?.name ?? "kgateway";
    const createGatewayClass = args.gatewayClass?.create ?? true;

    if (createGatewayClass) {
      this.gatewayClass = new k8s.apiextensions.CustomResource(
        `${name}-gateway-class`,
        {
          apiVersion: "gateway.networking.k8s.io/v1",
          kind: "GatewayClass",
          metadata: {
            name: gatewayClassName,
          },
          spec: {
            controllerName: "kgateway.dev/kgateway",
          },
        },
        { parent: this, dependsOn: [this.chart] }
      );
    }

    this.gatewayClassName = pulumi.output(gatewayClassName);

    this.registerOutputs({
      crdsChart: this.crdsChart,
      chart: this.chart,
      gatewayClass: this.gatewayClass,
      gatewayClassName: this.gatewayClassName,
      inferenceExtensionCrds: this.inferenceExtensionCrds,
      agentgatewayCrdsChart: this.agentgatewayCrdsChart,

    });
  }
}
