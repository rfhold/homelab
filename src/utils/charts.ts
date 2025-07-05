import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Extracts all Service resources from a Helm chart
 * @param chart The Helm chart to extract services from
 * @returns Pulumi Output containing array of Service resources
 */
export function getServicesFromChart(chart: k8s.helm.v4.Chart): pulumi.Output<any[]> {
  return pulumi.output(chart.resources).apply(resources => {
    return resources.filter((resource: any) => {
      return resource.kind === "Service" && resource.apiVersion === "v1";
    });
  });
}

 