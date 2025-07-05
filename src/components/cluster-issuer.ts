import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Configuration for DNS01 challenge solvers
 */
export interface Dns01SolverConfig {
  /** Cloudflare DNS01 solver configuration */
  cloudflare?: {
    /** Cloudflare API token with DNS edit permissions */
    apiToken: pulumi.Input<string>;
    /** Optional: Cloudflare zone ID to limit operations to specific zone */
    zoneId?: pulumi.Input<string>;
  };
}

/**
 * Configuration for the cluster issuer component
 */
export interface ClusterIssuerArgs {
  /** Kubernetes namespace where cert-manager is installed */
  namespace: pulumi.Input<string>;
  /** The name of the cluster issuer */
  name: pulumi.Input<string>;
  /** ACME server URL */
  acmeServer: pulumi.Input<string>;
  /** Email address for ACME registration */
  email: pulumi.Input<string>;
  /** DNS01 solver configuration */
  dns01: Dns01SolverConfig;
}

/**
 * ClusterIssuer component - creates a single cert-manager ClusterIssuer resource for certificate automation
 * 
 * @example
 * ```typescript
 * import { ClusterIssuer } from "../components/cluster-issuer";
 * 
 * const clusterIssuer = new ClusterIssuer("letsencrypt-prod", {
 *   namespace: "cert-manager",
 *   name: "letsencrypt-prod",
 *   acmeServer: "https://acme-v02.api.letsencrypt.org/directory",
 *   email: "admin@example.com",
 *   dns01: {
 *     cloudflare: {
 *       apiToken: "your-cloudflare-api-token",
 *     },
 *   },
 * });
 * ```
 * 
 * @see https://cert-manager.io/docs/configuration/acme/dns01/
 */
export class ClusterIssuer extends pulumi.ComponentResource {
  /** The ClusterIssuer resource */
  public readonly issuer: k8s.apiextensions.CustomResource;

  constructor(name: string, args: ClusterIssuerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:ClusterIssuer", name, args, opts);

    // Build DNS01 solver configuration
    const solvers: any[] = [];
    
    if (args.dns01.cloudflare) {
      // Create secret for Cloudflare API token
      const apiTokenSecret = new k8s.core.v1.Secret(
        `${name}-cloudflare-api-token`,
        {
          metadata: {
            name: pulumi.interpolate`${args.name}-cloudflare-api-token`,
            namespace: args.namespace,
          },
          type: "Opaque",
          stringData: {
            "api-token": args.dns01.cloudflare.apiToken,
          },
        },
        { parent: this }
      );

      const cloudflareSolver: any = {
        dns01: {
          cloudflare: {
            apiTokenSecretRef: {
              name: apiTokenSecret.metadata.name,
              key: "api-token",
            },
          },
        },
      };

      // Add zone ID if specified
      if (args.dns01.cloudflare.zoneId) {
        cloudflareSolver.dns01.cloudflare.zoneId = args.dns01.cloudflare.zoneId;
      }

      solvers.push(cloudflareSolver);
    }

    // Create the ClusterIssuer resource
    this.issuer = new k8s.apiextensions.CustomResource(
      `${name}-issuer`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: {
          name: args.name,
        },
        spec: {
          acme: {
            server: args.acmeServer,
            email: args.email,
            privateKeySecretRef: {
              name: pulumi.interpolate`${args.name}-private-key`,
            },
            solvers: solvers,
          },
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      issuer: this.issuer,
    });
  }
} 