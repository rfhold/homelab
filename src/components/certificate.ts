import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Configuration for the certificate component
 */
export interface CertificateArgs {
  /** Kubernetes namespace to deploy the certificate into */
  namespace: pulumi.Input<string>;
  /** Name of the certificate */
  name: pulumi.Input<string>;
  /** Secret name where the certificate will be stored */
  secretName: pulumi.Input<string>;
  /** List of DNS names for the certificate */
  dnsNames: pulumi.Input<pulumi.Input<string>[]>;
  /** Name of the ClusterIssuer to use for issuing the certificate */
  issuerRef: pulumi.Input<string>;
  /** Duration of the certificate (optional, defaults to 2160h = 90 days) */
  duration?: pulumi.Input<string>;
  /** Renew before expiry (optional, defaults to 360h = 15 days) */
  renewBefore?: pulumi.Input<string>;
}

/**
 * Certificate component - creates cert-manager Certificate resources
 * 
 * @example
 * ```typescript
 * import { Certificate } from "../components/certificate";
 * 
 * const defaultCert = new Certificate("default-cert", {
 *   namespace: "ingress-system",
 *   name: "default-certificate",
 *   secretName: "default-tls-secret",
 *   dnsNames: ["*.example.com", "example.com"],
 *   issuerRef: "letsencrypt-prod",
 * });
 * ```
 */
export class Certificate extends pulumi.ComponentResource {
  /** The Certificate resource */
  public readonly certificate: k8s.apiextensions.CustomResource;

  constructor(name: string, args: CertificateArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Certificate", name, args, opts);

    // Create the cert-manager Certificate resource
    this.certificate = new k8s.apiextensions.CustomResource(
      `${name}-cert`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: args.name,
          namespace: args.namespace,
        },
        spec: {
          secretName: args.secretName,
          dnsNames: args.dnsNames,
          issuerRef: {
            name: args.issuerRef,
            kind: "ClusterIssuer",
          },
          duration: args.duration || "2160h", // 90 days
          renewBefore: args.renewBefore || "360h", // 15 days
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      certificate: this.certificate,
    });
  }

  /**
   * Get the secret name where the certificate is stored
   */
  public getSecretName(): pulumi.Output<string> {
    return (this.certificate as any).spec.apply((spec: any) => spec.secretName);
  }

  /**
   * Get the DNS names covered by this certificate
   */
  public getDnsNames(): pulumi.Output<string[]> {
    return (this.certificate as any).spec.apply((spec: any) => spec.dnsNames);
  }
} 