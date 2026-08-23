import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AgentGateway, AgentGatewayProviderConfig } from "../../src/components/agent-gateway";

const config = new pulumi.Config("agent-gateway");

const namespaceName = config.require("namespace");
const hostname = config.require("hostname");
const gatewayName = config.get("gatewayName");
const gatewayClassName = config.get("gatewayClassName");
const gatewayAnnotations = config.getObject<Record<string, string>>("gatewayAnnotations");
const installGatewayApiCRDs = config.getBoolean("installGatewayApiCRDs");
const gatewayApiVersion = config.get("gatewayApiVersion");
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const httpRoute = config.getObject<{
  name?: string;
  requestTimeout?: string;
  annotations?: Record<string, string>;
}>("httpRoute");
const adminUi = config.getObject<{
  serviceName?: string;
  routeName?: string;
}>("adminUi");
const modelExtractionExclusionPaths = config.getObject<string[]>("modelExtractionExclusionPaths");
const tls = config.getObject<{
  secretName: string;
}>("tls");

const providersConfig = config.getObject<Array<{
  name: string;
  envVar?: string;
  secretKey?: string;
  provider: Record<string, unknown>;
  policies?: Record<string, unknown>;
}>>("providers") ?? [];

const providerStashes = new Map<string, pulumi.Stash>();

for (const provider of providersConfig) {
  if (provider.envVar) {
    providerStashes.set(provider.name, new pulumi.Stash(`${provider.name}-api-key`, {
      input: pulumi.secret(process.env[provider.envVar] ?? ""),
    }));
  }
}

const namespace = new k8s.core.v1.Namespace("agent-gateway-namespace", {
  metadata: { name: namespaceName },
});

const providers: AgentGatewayProviderConfig[] = providersConfig.map((provider) => {
  const stash = providerStashes.get(provider.name);

  return {
    name: provider.name,
    provider: provider.provider,
    policies: provider.policies,
    secret: stash
      ? {
        value: stash.output,
        key: provider.secretKey,
      }
      : undefined,
  };
});

const agentGateway = new AgentGateway("agent-gateway", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["agent-gateway"],
  hostname,
  gatewayName,
  gatewayClassName,
  gatewayAnnotations,
  installGatewayApiCRDs,
  gatewayApiVersion,
  providers,
  httpRoute,
  adminUi,
  modelExtractionExclusionPaths,
  tls,
}, { dependsOn: [namespace] });

export const routeUrl = agentGateway.getHttpRouteUrl();
export const uiRouteUrl = agentGateway.getAdminUiUrl();
export const gateway = agentGateway.gatewayName;
export const backendNames = agentGateway.backends.map((backend) => backend.metadata.name);
