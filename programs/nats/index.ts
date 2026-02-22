import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Nats } from "../../src/components/nats";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("nats", {
  metadata: {
    name: "nats",
  },
});

const nats = new Nats("nats", {
  namespace: namespace.metadata.name,
  storage: {
    size: config.get("storage-size") || "20Gi",
    storageClass: config.get("storage-class"),
  },
  cpu: config.get("cpu") || "500m",
  memory: config.get("memory") || "512Mi",
}, {
  dependsOn: [namespace],
});

export const natsNamespace = namespace.metadata.name;
export const natsClientUrl = nats.clientUrl;
