import * as k8s from "@pulumi/kubernetes";
import { Reloader } from "../../src/components/reloader";

const namespace = new k8s.core.v1.Namespace("reloader", {
  metadata: {
    name: "reloader",
  },
});

new Reloader("reloader", {
  namespace: namespace.metadata.name,
}, {
  dependsOn: [namespace],
});
