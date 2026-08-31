import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as authentik from "@pulumi/authentik";
import * as tls from "@pulumi/tls";
import * as vault from "@pulumi/vault";
import { OpenBaoModule } from "../../src/modules/openbao";
import { OpenBaoMode } from "../../src/components/openbao";
import { AuthentikOIDCApp } from "../../src/components/authentik-oidc-app";

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
const gatewaySectionName = config.get("gateway-section-name") ?? "https-0";
const configuredMode = config.get("mode") ?? "standalone";
if (configuredMode !== "standalone" && configuredMode !== "raft") {
  throw new Error(`Unsupported OpenBao mode: ${configuredMode}`);
}
const mode: OpenBaoMode = configuredMode;
const replicas = config.getNumber("replicas") ?? (mode === "raft" ? 3 : 1);
if (mode === "raft" && replicas !== 3) {
  throw new Error("OpenBao Raft mode requires exactly three replicas");
}
if (mode === "standalone" && replicas !== 1) {
  throw new Error("OpenBao standalone mode requires exactly one replica");
}
const routeEnabled = config.getBoolean("route-enabled") ?? true;
const storageClass = config.require("storage-class");
const storageSize = config.get("storage-size") ?? "10Gi";
const resourceConfig = config.getObject<ResourceConfig>("resources");
const oidcMountPath = config.get("oidc-mount-path") ?? "oidc";
const oidcDefaultRole = config.get("oidc-default-role") ?? "operator";
const oidcClientId = config.get("oidc-client-id") ?? "openbao";
const oidcIssuerUrl = config.get("oidc-issuer-url") ?? "https://auth.holdenitdown.net/application/o/openbao/";
const oidcDiscoveryUrl = config.get("oidc-discovery-url") ?? `${oidcIssuerUrl}.well-known/openid-configuration`;
const oidcRegistrationEnabled = config.getBoolean("oidc-registration-enabled") ?? false;
const oidcApiManagementEnabled = config.getBoolean("oidc-api-management-enabled") ?? false;
const kvApiManagementEnabled = config.getBoolean("kv-api-management-enabled") ?? false;
const transitApiManagementEnabled = config.getBoolean("transit-api-management-enabled") ?? false;
const kubernetesApiManagementEnabled = config.getBoolean("kubernetes-api-management-enabled") ?? false;
const apiManagementEnabled = oidcApiManagementEnabled || kvApiManagementEnabled || kubernetesApiManagementEnabled;
if (oidcApiManagementEnabled && !oidcRegistrationEnabled) {
  throw new Error("OpenBao OIDC API management requires OIDC registration");
}
if (transitApiManagementEnabled && !oidcApiManagementEnabled) {
  throw new Error("OpenBao Transit API management requires OIDC API management");
}
if (transitApiManagementEnabled && mode !== "raft") {
  throw new Error("OpenBao Transit API management requires Raft mode");
}
if (kvApiManagementEnabled && !kubernetesApiManagementEnabled) {
  throw new Error("OpenBao KV API management requires Kubernetes API management");
}
if (apiManagementEnabled && !process.env.VAULT_TOKEN?.trim()) {
  throw new Error("OpenBao API management requires a non-empty VAULT_TOKEN environment variable");
}
const oidcClientSecretVersion = oidcApiManagementEnabled
  ? config.requireNumber("oidc-client-secret-version")
  : undefined;
if (oidcClientSecretVersion !== undefined
  && (!Number.isInteger(oidcClientSecretVersion) || oidcClientSecretVersion <= 0)) {
  throw new Error("OpenBao OIDC client secret version must be an integer greater than zero");
}
const oidcAuthorizationGroupName = oidcRegistrationEnabled
  ? config.require("oidc-authorization-group")
  : undefined;
if (transitApiManagementEnabled && oidcAuthorizationGroupName !== "cyber") {
  throw new Error("OpenBao Transit API management requires the exact cyber authorization group");
}
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};
const oidcUiRedirectUri = `https://${hostname}/ui/vault/auth/oidc/oidc/callback`;
const oidcCliRedirectUri = "http://localhost:8250/oidc/callback";
const kubernetesAuthMountPath = "kubernetes";
const kubernetesAdminPolicyName = "openbao-pulumi-admin";

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
  kubernetesAuth: {
    enabled: kubernetesApiManagementEnabled,
  },
  server: {
    mode,
    replicas,
  },
}, {
  dependsOn: [namespace],
});

const httpRoute = routeEnabled ? new k8s.apiextensions.CustomResource("openbao-route", {
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
      sectionName: gatewaySectionName,
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
}) : undefined;

let openbaoOidcSigningKeyPair: authentik.CertificateKeyPair | undefined;
if (oidcRegistrationEnabled) {
  const openbaoOidcSigningPrivateKey = new tls.PrivateKey("openbao-oidc-signing-key", {
    algorithm: "RSA",
    rsaBits: 4096,
  }, { parent: openbao });

  const openbaoOidcSigningCertificate = new tls.SelfSignedCert("openbao-oidc-signing-certificate", {
    privateKeyPem: openbaoOidcSigningPrivateKey.privateKeyPem,
    allowedUses: ["digital_signature"],
    validityPeriodHours: 87600,
    subject: {
      commonName: "OpenBao OIDC Signing Key",
    },
  }, { parent: openbao });

  openbaoOidcSigningKeyPair = new authentik.CertificateKeyPair("openbao-oidc-signing-key-pair", {
    name: "OpenBao OIDC Signing Key",
    certificateData: openbaoOidcSigningCertificate.certPem,
    keyData: pulumi.secret(openbaoOidcSigningPrivateKey.privateKeyPem),
  }, { parent: openbao });
}

const openbaoOidcApp = oidcRegistrationEnabled ? new AuthentikOIDCApp("openbao-oidc", {
  name: "OpenBao",
  slug: oidcClientId,
  redirectUris: [oidcUiRedirectUri, oidcCliRedirectUri],
  launchUrl: `https://${hostname}`,
  group: "Infrastructure",
  policyEngineMode: "all",
  signingKey: openbaoOidcSigningKeyPair?.certificateKeyPairId,
}) : undefined;

let openbaoOidcAuthorizationGroup: authentik.PolicyBinding | undefined;
if (openbaoOidcApp && oidcAuthorizationGroupName) {
  const openbaoAuthorizationGroup = authentik.getGroupOutput({
    name: oidcAuthorizationGroupName,
  });

  openbaoOidcAuthorizationGroup = new authentik.PolicyBinding("openbao-oidc-authorization-group", {
    group: openbaoAuthorizationGroup.id,
    target: openbaoOidcApp.application.uuid,
    order: 0,
  });
}

const registeredOidcIssuerUrl = openbaoOidcApp?.getIssuerUrl(new URL(oidcIssuerUrl).hostname);
const effectiveOidcClientId = openbaoOidcApp?.clientId ?? pulumi.output(oidcClientId);
const effectiveOidcIssuerUrl = registeredOidcIssuerUrl ?? pulumi.output(oidcIssuerUrl);
const effectiveOidcDiscoveryUrl = registeredOidcIssuerUrl
  ? pulumi.interpolate`${registeredOidcIssuerUrl}.well-known/openid-configuration`
  : pulumi.output(oidcDiscoveryUrl);

const openbaoProvider = apiManagementEnabled ? new vault.Provider("openbao", {
  address: `https://${hostname}`,
  skipChildToken: true,
}, {
  dependsOn: [openbao],
}) : undefined;

if (openbaoProvider) {
  if (kvApiManagementEnabled) {
    new vault.Mount("openbao-kv", {
      path: openbao.getKvMountPath(),
      type: "kv",
      options: {
        version: "2",
      },
    }, {
      provider: openbaoProvider,
    });
  }

  const openbaoPulumiAdminPolicy = new vault.Policy("openbao-pulumi-admin", {
    name: kubernetesAdminPolicyName,
    allowOverwrite: false,
    policy: `path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "patch", "sudo"]
}

path "sys/raw" {
  capabilities = ["deny"]
}

path "sys/raw/*" {
  capabilities = ["deny"]
}

path "sys/init" {
  capabilities = ["deny"]
}

path "sys/seal" {
  capabilities = ["deny"]
}

path "sys/rekey" {
  capabilities = ["deny"]
}

path "sys/rekey/*" {
  capabilities = ["deny"]
}

path "sys/rekey-recovery-key" {
  capabilities = ["deny"]
}

path "sys/rekey-recovery-key/*" {
  capabilities = ["deny"]
}

path "sys/generate-root" {
  capabilities = ["deny"]
}

path "sys/generate-root/*" {
  capabilities = ["deny"]
}

path "sys/rotate" {
  capabilities = ["deny"]
}

path "sys/rotate/*" {
  capabilities = ["deny"]
}

path "sys/storage/raft" {
  capabilities = ["deny"]
}

path "sys/storage/raft/*" {
  capabilities = ["deny"]
}

path "sys/step-down" {
  capabilities = ["deny"]
}
`,
  }, {
    provider: openbaoProvider,
  });

  if (oidcApiManagementEnabled) {
    if (!openbaoOidcApp || !openbaoOidcAuthorizationGroup) {
      throw new Error("OpenBao OIDC API management requires the Authentik OIDC application and authorization binding");
    }

    const openbaoOidcBackend = new vault.jwt.AuthBackend("openbao-oidc", {
      path: oidcMountPath,
      type: "oidc",
      defaultRole: oidcDefaultRole,
      oidcDiscoveryUrl: effectiveOidcIssuerUrl,
      boundIssuer: effectiveOidcIssuerUrl,
      oidcClientId: effectiveOidcClientId,
      oidcClientSecretWo: pulumi.secret(openbaoOidcApp.clientSecret),
      oidcClientSecretWoVersion: oidcClientSecretVersion,
    }, {
      provider: openbaoProvider,
      dependsOn: [openbao, openbaoOidcApp, openbaoOidcAuthorizationGroup],
    });

    new vault.jwt.AuthBackendRole("openbao-oidc-operator", {
      backend: openbaoOidcBackend.path,
      roleName: oidcDefaultRole,
      roleType: "oidc",
      allowedRedirectUris: [oidcUiRedirectUri, oidcCliRedirectUri],
      userClaim: "sub",
      tokenNoDefaultPolicy: true,
      tokenPolicies: ["default"],
    }, {
      provider: openbaoProvider,
      dependsOn: [openbaoOidcBackend],
    });

    new vault.jwt.AuthBackendRole("openbao-oidc-admin", {
      backend: openbaoOidcBackend.path,
      roleName: "admin",
      roleType: "oidc",
      allowedRedirectUris: [oidcUiRedirectUri, oidcCliRedirectUri],
      userClaim: "sub",
      tokenNoDefaultPolicy: true,
      tokenPolicies: [openbaoPulumiAdminPolicy.name],
      tokenTtl: 1800,
      tokenMaxTtl: 1800,
      tokenExplicitMaxTtl: 1800,
      tokenType: "service",
    }, {
      provider: openbaoProvider,
      dependsOn: [openbaoOidcBackend, openbaoPulumiAdminPolicy],
    });

    const openbaoSshPolicy = new vault.Policy("openbao-ssh", {
      name: "homelab-ssh-client-sign",
      allowOverwrite: false,
      policy: `path "homelab-ssh-client/sign/homelab" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}
`,
    }, {
      provider: openbaoProvider,
    });

    new vault.jwt.AuthBackendRole("openbao-oidc-ssh", {
      backend: openbaoOidcBackend.path,
      roleName: "ssh",
      roleType: "oidc",
      allowedRedirectUris: [oidcCliRedirectUri],
      userClaim: "sub",
      tokenNoDefaultPolicy: true,
      tokenPolicies: [openbaoSshPolicy.name],
      tokenTtl: 28800,
      tokenMaxTtl: 28800,
      tokenExplicitMaxTtl: 28800,
      tokenType: "service",
    }, {
      provider: openbaoProvider,
      dependsOn: [openbaoOidcBackend, openbaoSshPolicy],
    });

    if (transitApiManagementEnabled) {
      const openbaoTransitMount = new vault.Mount("openbao-transit", {
        path: "transit",
        type: "transit",
      }, {
        provider: openbaoProvider,
      });

      const openbaoTransitKey = new vault.transit.SecretBackendKey("openbao-transit-pulumi", {
        backend: openbaoTransitMount.path,
        name: "pulumi",
        type: "aes256-gcm96",
        allowPlaintextBackup: false,
        deletionAllowed: false,
        exportable: false,
      }, {
        provider: openbaoProvider,
        dependsOn: [openbaoTransitMount],
      });

      const openbaoPulumiTransitPolicy = new vault.Policy("openbao-pulumi-transit-policy", {
        name: "pulumi-transit",
        allowOverwrite: false,
        policy: `path "transit/encrypt/pulumi" {
  capabilities = ["update"]
}

path "transit/decrypt/pulumi" {
  capabilities = ["update"]
}
`,
      }, {
        provider: openbaoProvider,
        dependsOn: [openbaoTransitKey],
      });

      new vault.jwt.AuthBackendRole("openbao-oidc-cyber", {
        backend: openbaoOidcBackend.path,
        roleName: "cyber",
        roleType: "oidc",
        allowedRedirectUris: [oidcCliRedirectUri],
        userClaim: "sub",
        tokenNoDefaultPolicy: true,
        tokenPolicies: [openbaoPulumiTransitPolicy.name],
      }, {
        provider: openbaoProvider,
        dependsOn: [openbaoOidcBackend, openbaoPulumiTransitPolicy],
      });
    }
  }

  if (kubernetesApiManagementEnabled) {
    const openbaoKubernetesAuthBackend = new vault.AuthBackend("openbao-kubernetes", {
      path: kubernetesAuthMountPath,
      type: "kubernetes",
    }, {
      provider: openbaoProvider,
    });

    new vault.kubernetes.AuthBackendConfig(
      "openbao-kubernetes",
      {
        backend: openbaoKubernetesAuthBackend.path,
        kubernetesHost: "https://kubernetes.default.svc:443",
        disableLocalCaJwt: false,
      },
      {
        provider: openbaoProvider,
        dependsOn: [openbaoKubernetesAuthBackend],
      }
    );
  }
}

export const openbaoNamespace = namespace.metadata.name;
export const openbaoHostname = pulumi.output(hostname);
export const openbaoRouteEnabled = pulumi.output(routeEnabled);
export const openbaoRouteName = httpRoute?.metadata.name ?? pulumi.output("");
export const openbaoUrl = pulumi.interpolate`https://${hostname}`;
export const openbaoServiceName = openbao.getServiceName();
export const openbaoUiServiceName = openbao.getUiServiceName();
export const openbaoServiceUrl = openbao.getServiceUrl();
export const openbaoUiUrl = openbao.getUiUrl();
export const openbaoStorageClass = pulumi.output(storageClass);
export const openbaoStorageSize = pulumi.output(storageSize);
export const openbaoTopology = pulumi.output({ mode, replicas });
export const openbaoKvMountPath = openbao.getKvMountPath();
export const openbaoTransitMountPath = openbao.getTransitMountPath();
export const openbaoTransitKeyName = openbao.getTransitKeyName();
export const openbaoOidcMountPath = pulumi.output(oidcMountPath);
export const openbaoOidcDefaultRole = pulumi.output(oidcDefaultRole);
export const openbaoOidcClientId = effectiveOidcClientId;
export const openbaoOidcClientSecret = pulumi.secret(openbaoOidcApp?.clientSecret);
export const openbaoOidcIssuerUrl = effectiveOidcIssuerUrl;
export const openbaoOidcDiscoveryUrl = effectiveOidcDiscoveryUrl;
export const openbaoOidcUiRedirectUri = pulumi.output(oidcUiRedirectUri);
export const openbaoOidcCliRedirectUri = pulumi.output(oidcCliRedirectUri);
export const openbaoOidcApiManagementEnabled = pulumi.output(oidcApiManagementEnabled);
export const openbaoKvApiManagementEnabled = pulumi.output(kvApiManagementEnabled);
export const openbaoTransitApiManagementEnabled = pulumi.output(transitApiManagementEnabled);
export const openbaoKubernetesApiManagementEnabled = pulumi.output(kubernetesApiManagementEnabled);
export const openbaoKubernetesAuthMountPath = pulumi.output(kubernetesAuthMountPath);
export const openbaoKubernetesAdminPolicyName = pulumi.output(kubernetesAdminPolicyName);
export const openbaoOperations = pulumi.all([
  namespace.metadata.name,
  openbao.getServiceName(),
  openbao.getUiServiceName(),
  openbao.getKvMountPath(),
  openbao.getTransitMountPath(),
  openbao.getTransitKeyName(),
  oidcMountPath,
  oidcDefaultRole,
  effectiveOidcClientId,
  effectiveOidcIssuerUrl,
  effectiveOidcDiscoveryUrl,
  oidcUiRedirectUri,
  oidcCliRedirectUri,
  mode,
  replicas,
  routeEnabled,
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
  resolvedMode,
  resolvedReplicas,
  resolvedRouteEnabled,
]) => ({
  runbookPath: "docs/operations/openbao.md",
  deploymentOrder: [
    oidcRegistrationEnabled
      ? "deploy OpenBao to register its Authentik OIDC application"
      : "deploy OpenBao without registering Authentik OIDC resources",
    resolvedMode === "raft"
      ? "initialize one OpenBao voter, join both followers, and unseal all three voters manually"
      : "initialize and unseal OpenBao manually",
    oidcApiManagementEnabled
      ? "reconcile the OpenBao OIDC backend and operator, admin, SSH roles through Pulumi"
      : "leave OpenBao OIDC API management disabled",
    kubernetesApiManagementEnabled
      ? "reconcile Kubernetes auth and the broad Pulumi administrator policy"
      : "leave OpenBao Kubernetes API management disabled",
    kvApiManagementEnabled
      ? "adopt or reconcile the KV v2 mount after the required inventory and import gate"
      : "leave OpenBao KV API management disabled",
    kubernetesApiManagementEnabled
      ? "then reconcile tekton/pantheon to attach its CI identity to the exported backend and policy"
      : "leave the Tekton OpenBao administration attachment disabled",
  ],
  bootstrap: {
    namespace: resolvedNamespace,
    serviceName: resolvedServiceName,
    uiServiceName: resolvedUiServiceName,
    localAddress: "http://127.0.0.1:8200",
    portForwardCommand: resolvedMode === "raft"
      ? `kubectl -n ${resolvedNamespace} port-forward pod/${resolvedServiceName}-0 8200:8200`
      : `kubectl -n ${resolvedNamespace} port-forward service/${resolvedUiServiceName} 8200:8200`,
    statusCommand: "bao status",
    initCommand: resolvedMode === "raft"
      ? "bao operator init -key-shares=5 -key-threshold=3"
      : "bao operator init",
    unsealCommand: "bao operator unseal",
    manualOnly: true,
  },
  topology: {
    mode: resolvedMode,
    replicas: resolvedReplicas,
    routeEnabled: resolvedRouteEnabled,
  },
  approvedV1Paths: {
    transitKey: `${resolvedTransitMountPath}/keys/${resolvedTransitKeyName}`,
  },
  kv: {
    enabled: kvApiManagementEnabled,
    mountPath: resolvedKvMountPath,
    version: 2,
    payloadOwner: "operator",
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
  kubernetesAuth: {
    enabled: kubernetesApiManagementEnabled,
    mountPath: kubernetesAuthMountPath,
    policyName: kubernetesAdminPolicyName,
    identityAttachmentOwner: "tekton/pantheon",
  },
  scopeBoundaries: [
    resolvedMode === "raft"
      ? "three-voter integrated Raft deployment"
      : "single-node standalone deployment",
    resolvedMode === "raft"
      ? "one retained persistent volume per Raft voter"
      : "persistent file storage on the configured Kubernetes storage class",
    "manual operator init and manual unseal only",
    "Transit key for Pulumi secrets-provider use",
    "no backup or disaster-recovery readiness claim",
    "no auto-unseal",
    "no operator-managed end-to-end API TLS",
    "no public internet exposure",
  ],
}));
