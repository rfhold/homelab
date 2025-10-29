import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { K8sMonitoring } from "../../src/components/k8s-monitoring";

const config = new pulumi.Config("monitoring");

export const namespaceName = "collectors";

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const telemetryEndpoint = config.require("telemetryEndpoint");
const clusterName = config.require("clusterName");

const k8sMonitoring = new K8sMonitoring(
  "k8s-monitoring",
  {
    namespace: namespace.metadata.name,
    clusterName: clusterName,
    destinations: [
      {
        name: "otlp",
        type: "otlp",
        url: `http://${telemetryEndpoint}:4317`,
        protocol: "grpc",
      },
      {
        name: "prometheus",
        type: "prometheus",
        url: `http://${telemetryEndpoint}:9090/api/v1/metrics/write`,
      },
      {
        name: "loki",
        type: "loki",
        url: `http://${telemetryEndpoint}:3100/loki/api/v1/push`,
      },
    ],
  },
  { dependsOn: [namespace] }
);
