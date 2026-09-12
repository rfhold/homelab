import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {
  applyAgentGatewayDatabaseBootstrap,
  AgentGatewayProviderConfig,
  AgentGateway,
  parseAgentGatewayRouteStorageMode,
  parseAgentGatewayRoutingRepresentationMode,
  validateAgentGatewayRoutingModes,
  validateResolvedProviderCredential,
} from "../../src/components/agent-gateway";
import { createConnectionString } from "../../src/adapters/postgres";
import { PostgreSQLImplementation, PostgreSQLModule } from "../../src/modules/postgres";

const config = new pulumi.Config("agent-gateway");

const namespaceName = config.require("namespace");
const hostname = config.require("hostname");
const routeStorageMode = parseAgentGatewayRouteStorageMode(config.require("routeStorageMode"));
const routingRepresentationMode = parseAgentGatewayRoutingRepresentationMode(
  config.require("routingRepresentationMode")
);
validateAgentGatewayRoutingModes(routeStorageMode, routingRepresentationMode);
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const modelExtractionExclusionPaths = config.getObject<string[]>("modelExtractionExclusionPaths");

const providersConfig = config.getObject<Array<{
  name: string;
  envVar?: string;
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
    credentialEnvVar: provider.envVar,
    provider: provider.provider,
    policies: provider.policies,
    secret: stash && provider.envVar
      ? {
        value: stash.output.apply((value) => validateResolvedProviderCredential(value, provider.envVar!)),
      }
      : undefined,
  };
});

const database = new PostgreSQLModule("agent-gateway-postgres", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["agent-gateway-postgres"],
  implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
  auth: {
    database: "agentgateway",
    username: "agentgateway",
  },
  instances: 1,
  storage: {
    size: "10Gi",
  },
}, {
  dependsOn: [namespace],
  protect: true,
  transformations: [(resourceArgs) => {
    const props = applyAgentGatewayDatabaseBootstrap(
      resourceArgs.type,
      resourceArgs.props,
      workloadLabels["agent-gateway-postgres"]
    );
    if (props === resourceArgs.props) {
      return undefined;
    }
    return {
      props,
      opts: resourceArgs.opts,
    };
  }],
});

const agentGateway = new AgentGateway("agent-gateway", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["agent-gateway"],
  hostname,
  providers,
  databaseUrl: createConnectionString(database.getConnectionConfig()),
  routeStorageMode,
  routingRepresentationMode,
  modelExtractionExclusionPaths,
}, { dependsOn: [namespace, database] });

export const routeUrl = agentGateway.getHttpRouteUrl();
export const uiRouteUrl = agentGateway.getAdminUiUrl();
export const gateway = agentGateway.gatewayName;
export const gatewayNamespace = agentGateway.gatewayNamespace;
export const backendNames = agentGateway.backendNames;
