import * as vault from "@pulumi/vault";

export interface OpenCodeConfig {
  enabled: boolean;
  address: string;
  oidc: string;
}

export interface OpenCodeDefinition {
  parentPolicyName: string;
  parentPolicy: string;
  parentRole: vault.jwt.AuthBackendRoleArgs;
  grants: Array<{
    policyName: string;
    policy: string;
    role: vault.tokenauth.AuthBackendRoleArgs;
  }>;
  pluginConfig: {
    address: string;
    mount: string;
    prefix: string;
    oidc: string;
    catalogRole: string;
    readRole: string;
    parentTokenPolicies: string[];
    parentIdentityPolicies: string[];
  };
}

const selfPolicy = `path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}
`;

export function compileOpenCode(config: OpenCodeConfig): OpenCodeDefinition | undefined {
  if (!config.enabled) {
    return undefined;
  }
  if (!config.oidc || /[^a-zA-Z0-9_-]/.test(config.oidc)) {
    throw new Error("OpenBao OpenCode requires a single-segment OIDC mount path");
  }
  const parentPolicyName = "opencode-parent";
  const catalogRole = "opencode-env-catalog";
  const readRole = "opencode-env-read";
  const grants = [
    { policyName: catalogRole, path: "kv/metadata/env", capability: "list" },
    { policyName: readRole, path: "kv/data/env/*", capability: "read" },
  ].map(({ policyName, path, capability }) => {
    return {
      policyName,
      policy: `path "${path}" {
  capabilities = ["${capability}"]
}

${selfPolicy}`,
      role: {
        roleName: policyName,
        allowedPolicies: [policyName],
        allowedPoliciesGlobs: [],
        disallowedPolicies: ["default"],
        disallowedPoliciesGlobs: [],
        allowedEntityAliases: [],
        orphan: false,
        renewable: false,
        tokenNoDefaultPolicy: true,
        tokenExplicitMaxTtl: 60,
        tokenPeriod: 0,
        tokenType: "service",
      },
    };
  });
  return {
    parentPolicyName,
    parentPolicy: selfPolicy + grants.map(({ role }) => `
path "auth/token/create/${role.roleName}" {
  capabilities = ["update"]
}
`).join(""),
    parentRole: {
      backend: config.oidc,
      roleName: "opencode",
      roleType: "oidc",
      allowedRedirectUris: ["http://localhost:8250/oidc/callback"],
      userClaim: "sub",
      tokenNoDefaultPolicy: true,
      tokenPolicies: [parentPolicyName],
      tokenTtl: 604800,
      tokenMaxTtl: 604800,
      tokenExplicitMaxTtl: 604800,
      tokenType: "service",
    },
    grants,
    pluginConfig: {
      address: config.address,
      mount: "kv",
      prefix: "env",
      oidc: config.oidc,
      catalogRole,
      readRole,
      parentTokenPolicies: [parentPolicyName],
      parentIdentityPolicies: [],
    },
  };
}

export function provisionOpenCode(
  definition: OpenCodeDefinition,
  backend: vault.jwt.AuthBackend,
  provider: vault.Provider,
): void {
  const roles = definition.grants.map((grant) => {
    const policy = new vault.Policy(grant.policyName, {
      name: grant.policyName,
      allowOverwrite: false,
      policy: grant.policy,
    }, { provider });
    return new vault.tokenauth.AuthBackendRole(grant.policyName, grant.role, {
      provider,
      dependsOn: [policy],
    });
  });
  const policy = new vault.Policy("openbao-opencode-parent", {
    name: definition.parentPolicyName,
    allowOverwrite: false,
    policy: definition.parentPolicy,
  }, { provider, dependsOn: roles });
  new vault.jwt.AuthBackendRole("openbao-oidc-opencode", {
    ...definition.parentRole,
    backend: backend.path,
  }, { provider, dependsOn: [backend, policy] });
}
