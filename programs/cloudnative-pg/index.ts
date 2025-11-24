import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { CloudNativePG } from "../../src/components/cloudnative-pg";

const config = new pulumi.Config("operator");

const namespace = new k8s.core.v1.Namespace("cloudnative-pg", {
  metadata: {
    name: "cloudnative-pg",
  },
});

new CloudNativePG("cloudnative-pg", {
  namespace: namespace.metadata.name,
  monitoring: {
    enablePodMonitor: true,
  },
}, {
  dependsOn: [namespace],
});
