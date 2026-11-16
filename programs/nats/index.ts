import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Nats } from "../../src/components/nats";
import { NatsAccounts } from "../../src/components/nats-accounts";
import type { NatsRepositoryAccounts } from "../../src/nats-accounts";

interface TolerationConfig {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("nats", {
  metadata: {
    name: "nats",
  },
});

const tolerations = config.getObject<TolerationConfig[]>("tolerations");
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const allowAnonymous = config.getBoolean("allow-anonymous") ?? false;
const accounts = !allowAnonymous ? new NatsAccounts("nats-accounts", {
  repositories: config.requireObject<NatsRepositoryAccounts[]>("accounts"),
}) : undefined;
const broker = accounts?.broker;

const nats = new Nats("nats", {
  allowAnonymous,
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["nats"],
  storage: {
    size: config.get("storage-size") || "20Gi",
    storageClass: config.get("storage-class"),
  },
  cpu: config.get("cpu") || "500m",
  memory: config.get("memory") || "1Gi",
  memStorageSize: config.get("mem-storage-size") || "512Mi",
  replicas: config.getNumber("replicas") || 1,
  ...(broker ? { operator: {
    jwt: broker.operatorJwt, systemAccount: broker.systemAccount, systemJwt: broker.systemJwt,
    routePassword: broker.routePassword, accounts: broker.accounts,
  } } : {}),
  ...(tolerations && { tolerations }),
}, {
  dependsOn: [namespace],
});

export const natsNamespace = namespace.metadata.name;
export const natsClientUrl = nats.clientUrl;
export const natsPipelineCredentials = accounts?.pipelineCredentials ?? pulumi.secret([]);

if (broker) {
  new k8s.core.v1.Secret("nats-admin-credentials", {
    metadata: { name: "nats-admin-credentials", namespace: namespace.metadata.name },
    stringData: { "nats.creds": broker.adminCredentials },
  }, { protect: true, dependsOn: [namespace] });
}
