import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { OpenBaoModule } from "../../src/modules/openbao";

interface ResourceConfig {
  requests?: {
    memory?: string;
    cpu?: string;
  };
  limits?: {
    memory?: string;
    cpu?: string;
  };
}

const config = new pulumi.Config();

const namespaceName = config.get("namespace") ?? "openbao";
const hostname = config.get("hostname") ?? "openbao.holdenitdown.net";
const gatewayName = config.get("gateway-name") ?? "default-gateway";
const gatewayNamespace = config.get("gateway-namespace") ?? "ingress";
const storageClass = config.require("storage-class");
const storageSize = config.get("storage-size") ?? "10Gi";
const resourceConfig = config.getObject<ResourceConfig>("resources");
const oidcMountPath = config.get("oidc-mount-path") ?? "oidc";
const oidcDefaultRole = config.get("oidc-default-role") ?? "operator";
const oidcClientId = config.get("oidc-client-id") ?? "openbao";
const oidcIssuerUrl = config.get("oidc-issuer-url") ?? "https://auth.holdenitdown.net/application/o/openbao/";
const oidcDiscoveryUrl = config.get("oidc-discovery-url") ?? `${oidcIssuerUrl}.well-known/openid-configuration`;
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const oidcUiRedirectUri = `https://${hostname}/ui/vault/auth/oidc/oidc/callback`;
const oidcCliRedirectUri = "http://localhost:8250/oidc/callback";

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const openbao = new OpenBaoModule("openbao", {
  namespace: namespace.metadata.name,
  workloadLabels: workloadLabels["openbao"],
  storage: {
    size: storageSize,
    storageClass,
  },
  resources: resourceConfig,
}, {
  dependsOn: [namespace],
});

const httpRoute = new k8s.apiextensions.CustomResource("openbao-route", {
  apiVersion: "gateway.networking.k8s.io/v1",
  kind: "HTTPRoute",
  metadata: {
    name: "openbao",
    namespace: namespace.metadata.name,
  },
  spec: {
    parentRefs: [{
      group: "gateway.networking.k8s.io",
      kind: "Gateway",
      name: gatewayName,
      namespace: gatewayNamespace,
    }],
    hostnames: [hostname],
    rules: [{
      matches: [{ path: { type: "PathPrefix", value: "/" } }],
      backendRefs: [{
        name: openbao.getUiServiceName(),
        port: 8200,
      }],
    }],
  },
}, {
  dependsOn: [openbao],
});

export const openbaoNamespace = namespace.metadata.name;
export const openbaoHostname = pulumi.output(hostname);
export const openbaoRouteName = httpRoute.metadata.name;
export const openbaoUrl = pulumi.interpolate`https://${hostname}`;
export const openbaoServiceName = openbao.getServiceName();
export const openbaoUiServiceName = openbao.getUiServiceName();
export const openbaoServiceUrl = openbao.getServiceUrl();
export const openbaoUiUrl = openbao.getUiUrl();
export const openbaoStorageClass = pulumi.output(storageClass);
export const openbaoStorageSize = pulumi.output(storageSize);
export const openbaoKvMountPath = openbao.getKvMountPath();
export const openbaoTransitMountPath = openbao.getTransitMountPath();
export const openbaoTransitKeyName = openbao.getTransitKeyName();
export const openbaoOidcMountPath = pulumi.output(oidcMountPath);
export const openbaoOidcDefaultRole = pulumi.output(oidcDefaultRole);
export const openbaoOidcClientId = pulumi.output(oidcClientId);
export const openbaoOidcIssuerUrl = pulumi.output(oidcIssuerUrl);
export const openbaoOidcDiscoveryUrl = pulumi.output(oidcDiscoveryUrl);
export const openbaoOidcUiRedirectUri = pulumi.output(oidcUiRedirectUri);
export const openbaoOidcCliRedirectUri = pulumi.output(oidcCliRedirectUri);
export const openbaoOperations = pulumi.all([
  namespace.metadata.name,
  openbao.getServiceName(),
  openbao.getUiServiceName(),
  openbao.getKvMountPath(),
  openbao.getTransitMountPath(),
  openbao.getTransitKeyName(),
  oidcMountPath,
  oidcDefaultRole,
  oidcClientId,
  oidcIssuerUrl,
  oidcDiscoveryUrl,
  oidcUiRedirectUri,
  oidcCliRedirectUri,
]).apply(([
  resolvedNamespace,
  resolvedServiceName,
  resolvedUiServiceName,
  resolvedKvMountPath,
  resolvedTransitMountPath,
  resolvedTransitKeyName,
  resolvedOidcMountPath,
  resolvedOidcDefaultRole,
  resolvedOidcClientId,
  resolvedOidcIssuerUrl,
  resolvedOidcDiscoveryUrl,
  resolvedOidcUiRedirectUri,
  resolvedOidcCliRedirectUri,
]) => ({
  runbookPath: "docs/operations/openbao.md",
  deploymentOrder: [
    "deploy Authentik so OpenBao OIDC outputs exist",
    "deploy OpenBao independently without reading Authentik outputs",
    "initialize and unseal OpenBao manually",
    "enable OIDC inside OpenBao with operator-run bao commands",
  ],
  bootstrap: {
    namespace: resolvedNamespace,
    serviceName: resolvedServiceName,
    uiServiceName: resolvedUiServiceName,
    localAddress: "http://127.0.0.1:8200",
    portForwardCommand: `kubectl -n ${resolvedNamespace} port-forward service/${resolvedUiServiceName} 8200:8200`,
    statusCommand: "bao status",
    initCommand: "bao operator init",
    unsealCommand: "bao operator unseal",
    manualOnly: true,
  },
  approvedV1Paths: {
    kv: `${resolvedKvMountPath}/`,
    transitKey: `${resolvedTransitMountPath}/keys/${resolvedTransitKeyName}`,
  },
  oidc: {
    mountPath: resolvedOidcMountPath,
    defaultRole: resolvedOidcDefaultRole,
    clientId: resolvedOidcClientId,
    issuerUrl: resolvedOidcIssuerUrl,
    discoveryUrl: resolvedOidcDiscoveryUrl,
    uiRedirectUri: resolvedOidcUiRedirectUri,
    cliRedirectUri: resolvedOidcCliRedirectUri,
  },
  scopeBoundaries: [
    "single-node OpenBao deployment for v1",
    "persistent file storage on the configured Kubernetes storage class",
    "manual operator init and manual unseal only",
    "KV secrets for internal operator and workload values",
    "Transit key for Pulumi secrets-provider migration",
    "no high-availability clustering in v1",
    "no auto-unseal in v1",
    "no public internet exposure",
  ],
}));
