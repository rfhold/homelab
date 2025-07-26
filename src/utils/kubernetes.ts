import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Get the external URL from an ingress resource
 * 
 * @param ingress - The Kubernetes ingress resource
 * @returns The external URL with appropriate protocol (https if TLS is configured)
 * 
 * @example
 * ```typescript
 * const url = getIngressUrl(myIngress);
 * ```
 */
export function getIngressUrl(ingress: k8s.networking.v1.Ingress): pulumi.Output<string> {
  return pulumi.all([
    ingress.spec.rules[0].host,
    ingress.spec.tls,
  ]).apply(([host, tls]) => {
    const protocol = tls && tls.length > 0 ? "https" : "http";
    return `${protocol}://${host}`;
  });
}