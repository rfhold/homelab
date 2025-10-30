import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS } from "../helm-charts";

/**
 * Configuration for the Traefik component
 */
export interface TraefikArgs {
  /** Kubernetes namespace to deploy Traefik into */
  namespace: pulumi.Input<string>;
  
  /** Service type for Traefik (LoadBalancer, NodePort, ClusterIP) */
  serviceType?: pulumi.Input<string>;
  
  /** Load balancer IP address (when serviceType is LoadBalancer) */
  loadBalancerIP?: pulumi.Input<string>;
  
  /** Additional service annotations */
  serviceAnnotations?: Record<string, pulumi.Input<string>>;
  
  /** Enable dashboard */
  enableDashboard?: pulumi.Input<boolean>;
  
  /** Default certificate configuration */
  defaultCertificate?: {
    /** Secret name containing the default certificate */
    secretName: pulumi.Input<string>;
  };

  /** Ingress class configuration */
  ingressClass?: {
    /** Name of the ingress class (defaults to release name) */
    name?: pulumi.Input<string>;
    /** Whether to create the ingress class (defaults to true) */
    enabled?: pulumi.Input<boolean>;
    /** Whether this ingress class should be the default (defaults to false) */
    isDefaultClass?: pulumi.Input<boolean>;
  };
}

/**
 * Traefik component - provides modern HTTP reverse proxy and load balancer
 * 
 * @example
 * ```typescript
 * import { Traefik } from "../components/traefik";
 * 
 * const traefik = new Traefik("ingress-controller", {
 *   namespace: "traefik-system",
 *   serviceType: "LoadBalancer",
 *   enableDashboard: true,
 *   defaultCertificate: {
 *     secretName: "default-tls-secret",
 *   },
 *   ingressClass: {
 *     name: "traefik",
 *     isDefaultClass: true,
 *   },
 * });
 * ```
 * 
 * @see https://traefik.io/
 */
export class Traefik extends pulumi.ComponentResource {
  /** The Helm chart deployment */
  public readonly chart: k8s.helm.v4.Chart;

  /** The name of the ingress class */
  public readonly ingressClassName: pulumi.Output<string>;

  constructor(name: string, args: TraefikArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Traefik", name, args, opts);

    const chartConfig = HELM_CHARTS.TRAEFIK;

    // Build Helm values
    const helmValues: any = {
      service: {
        type: args.serviceType || "LoadBalancer",
        annotations: {
          ...(args.loadBalancerIP && {
            "metallb.io/loadBalancerIPs": args.loadBalancerIP,
          }),
          ...(args.serviceAnnotations || {}),
        },
      },
      ingressRoute: {
        dashboard: {
          enabled: args.enableDashboard !== false,
        },
      },
      metrics: {
        prometheus: {
          serviceMonitor: {
            enabled: true,
          },
        },
      },
    };

    // Configure ingress class if provided
    if (args.ingressClass) {
      helmValues.ingressClass = {
        enabled: args.ingressClass.enabled !== false,
        isDefaultClass: args.ingressClass.isDefaultClass || false,
      };
      
      if (args.ingressClass.name) {
        helmValues.ingressClass.name = args.ingressClass.name;
      }
    }

    // Configure default certificate if provided
    if (args.defaultCertificate) {
      helmValues.tlsStore = {
        default: {
          defaultCertificate: {
            secretName: args.defaultCertificate.secretName,
          },
        },
      };
    }

    const chartName = `${name}-chart`;

    // Deploy Traefik using Helm v4 Chart
    this.chart = new k8s.helm.v4.Chart(
      `${name}-chart`,
      {
        chart: chartConfig.chart,
        version: chartConfig.version,
        namespace: args.namespace,
        repositoryOpts: {
          repo: chartConfig.repository,
        },
        values: helmValues,
      },
      { parent: this }
    );

    // Set the ingress class name output
    this.ingressClassName = pulumi.output(args.ingressClass?.name || `${chartName}-traefik`);

    this.registerOutputs({
      chart: this.chart,
      ingressClassName: this.ingressClassName,
    });
  }
} 