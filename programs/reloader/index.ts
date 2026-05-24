import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Reloader } from "../../src/components/reloader";

const config = new pulumi.Config();
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const namespace = new k8s.core.v1.Namespace("reloader", {
  metadata: {
    name: "reloader",
  },
});

new Reloader("reloader", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["reloader"],
}, {
  dependsOn: [namespace],
});
