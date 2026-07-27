import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Strimzi } from "../../src/components/strimzi";

const config = new pulumi.Config("operator");
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const namespace = new k8s.core.v1.Namespace("strimzi", {
  metadata: {
    name: "strimzi",
  },
});

new Strimzi("strimzi", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["strimzi"],
  watchAnyNamespace: true,
  podAnnotations: {
    "k8s.grafana.com/scrape": "true",
    "k8s.grafana.com/job": "strimzi-cluster-operator",
    "k8s.grafana.com/metrics.path": "/metrics",
    "k8s.grafana.com/metrics.portNumber": "8080",
    "k8s.grafana.com/metrics.scheme": "http",
    "k8s.grafana.com/metrics.scrapeInterval": "30s",
  },
}, {
  dependsOn: [namespace],
});
