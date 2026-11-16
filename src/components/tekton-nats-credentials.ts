import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as vault from "@pulumi/vault";
import { natsAccountId, validateNatsRepositories, type NatsPipelineBinding, type NatsPipelineCredential } from "../nats-accounts";

export interface TektonNatsCredentialsArgs {
  namespace: pulumi.Input<string>;
  serviceAccount: pulumi.Input<string>;
  repositories: NatsPipelineBinding[];
  credentials: pulumi.Input<NatsPipelineCredential[]>;
  openbao: {
    address: pulumi.Input<string>;
    mount: pulumi.Input<string>;
    authMount: pulumi.Input<string>;
    provider: vault.Provider;
  };
}

export class TektonNatsCredentials extends pulumi.ComponentResource {

  constructor(name: string, args: TektonNatsCredentialsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:TektonNatsCredentials", name, {}, opts);
    validateNatsRepositories(args.repositories.map(repository => ({
      ...repository,
      environments: Object.fromEntries(repository.environments.map(environment => [environment, { credentialGeneration: 1 }])),
      maxDisk: 1, maxMemory: 1, maxStreams: 1, maxConsumers: 1, maxConnections: 1,
    })));
    if (!args.repositories.length) throw new Error("NATS exposure requires repository bindings");
    const openbao = pulumi.all({
      address: args.openbao.address, mount: args.openbao.mount, authMount: args.openbao.authMount,
    }).apply(value => {
      const address = new URL(value.address);
      if (address.protocol !== "https:" || address.username || address.password || address.pathname !== "/" ||
          address.search || address.hash || [value.mount, value.authMount].some(path => !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path))) {
        throw new Error("Invalid OpenBao NATS exposure endpoint or mounts");
      }
      return value;
    });
    const configuration: Record<string, Record<string, { role: string; path: string }>> = {};
    for (const repository of args.repositories) {
      if (new Set(repository.environments).size !== repository.environments.length) throw new Error("Duplicate NATS environment exposure");
      const contract = pulumi.output(args.credentials).apply(credentials => {
        for (const environment of repository.environments) {
          const matches = credentials.filter(value => value.repository === repository.repository && value.environment === environment);
          if (matches.length !== 1 ||
              typeof matches[0].credentials !== "string" || typeof matches[0].revoked !== "boolean" ||
              (!matches[0].revoked && !matches[0].credentials)) {
            throw new Error("NATS credential output does not match its Tekton exposure binding");
          }
        }
        return credentials;
      });
      configuration[repository.repository] = {};
      for (const environment of repository.environments) {
        const id = natsAccountId(repository.repository, environment);
        const identity = `nats-${id.slice(0, 40)}`;
        const path = `ci/nats/${repository.repository}/${environment}`;
        configuration[repository.repository][environment] = { role: identity, path };
        const credential = contract.apply(values => values.find(value => value.repository === repository.repository && value.environment === environment)!);
        const record = new vault.kv.SecretV2(`${name}-${id}`, {
          mount: openbao.mount, name: path,
          dataJson: pulumi.secret(credential.apply(value => JSON.stringify({
            credentials: value.revoked ? "" : value.credentials,
            revoked: value.revoked, account: value.account, credentialGeneration: value.credentialGeneration,
          }))),
        }, { parent: this, provider: args.openbao.provider, protect: true });
        const policy = new vault.Policy(`${name}-${id}`, {
          name: identity, allowOverwrite: false,
          policy: pulumi.interpolate`path "${openbao.mount}/data/${path}" {
  capabilities = ["read"]
}`,
        }, { parent: this, provider: args.openbao.provider });
        new vault.kubernetes.AuthBackendRole(`${name}-${id}`, {
          backend: openbao.authMount, roleName: identity,
          boundServiceAccountNames: [args.serviceAccount],
          boundServiceAccountNamespaces: [args.namespace],
          audience: "openbao-nats-v1", tokenNoDefaultPolicy: true, tokenPolicies: [policy.name],
          tokenTtl: 600, tokenMaxTtl: 600, tokenType: "batch",
        }, { parent: this, provider: args.openbao.provider, dependsOn: [record, policy] });
      }
    }
    new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: { namespace: args.namespace, name: "nats-pipeline" },
      data: { "config.json": openbao.apply(value => JSON.stringify({ ...value, repositories: configuration })) },
    }, { parent: this });
    this.registerOutputs({});
  }
}
