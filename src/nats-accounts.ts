import { createHash } from "node:crypto";
import { encodeAccount, encodeOperator, encodeUser, fmtCreds } from "@nats-io/jwt";
import { fromSeed, Prefix, type KeyPair } from "@nats-io/nkeys";
import { Codec } from "@nats-io/nkeys/lib/codec";

export interface NatsEnvironment {
  credentialGeneration: number;
  revoked?: boolean;
}

export interface NatsRepositoryAccounts {
  repository: string;
  environments: Record<string, NatsEnvironment>;
  maxDisk: number;
  maxMemory: number;
  maxStreams: number;
  maxConsumers: number;
  maxConnections: number;
}

export interface NatsBootstrap {
  operatorSeed: string;
  operatorJwt: string;
  systemAccount: string;
  systemJwt: string;
  adminCredentials: string;
}

export interface NatsAccount {
  account: string;
  accountJwt: string;
  accountSeed: string;
  userSeeds: string[];
  credentials: string;
}

export interface NatsBrokerConfig extends Omit<NatsBootstrap, "operatorSeed"> {
  routePassword: string;
  accounts: Record<string, string>;
}

export interface NatsPipelineBinding {
  repository: string;
  environments: string[];
}

export interface NatsPipelineCredential {
  repository: string;
  environment: string;
  account: string;
  credentialGeneration: number;
  revoked: boolean;
  credentials: string;
}

const text = new TextDecoder();
const bytes = new TextEncoder();

function key(prefix: Prefix, entropy: Uint8Array): KeyPair {
  if (entropy.length !== 32) throw new Error("NATS keys require 32 bytes of protected entropy");
  return fromSeed(Codec.encodeSeed(prefix, entropy));
}

export function natsAccountId(repository: string, environment: string): string {
  return createHash("sha256").update(`${repository}/${environment}`).digest("hex");
}

export function validateNatsRepositories(policies: NatsRepositoryAccounts[]): void {
  if (!Array.isArray(policies) || policies.length > 100) throw new Error("Invalid NATS repository declarations");
  const repositories = new Set<string>();
  for (const p of policies) {
    if (!p || typeof p !== "object" ||
        typeof p.repository !== "string" || p.repository.length > 255 ||
        !/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(p.repository) ||
        !p.environments || typeof p.environments !== "object" || Array.isArray(p.environments) ||
        !Object.keys(p.environments).length || Object.keys(p.environments).length > 8 ||
        repositories.has(p.repository)) throw new Error("Invalid or duplicate NATS repository declaration");
    for (const [name, environment] of Object.entries(p.environments)) {
      if (!/^[a-z](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(name) ||
          !environment || typeof environment !== "object" || Array.isArray(environment) ||
          Object.keys(environment).some(field => !["credentialGeneration", "revoked"].includes(field)) ||
          !Number.isInteger(environment.credentialGeneration) ||
          environment.credentialGeneration < 1 || environment.credentialGeneration > 100 ||
          (environment.revoked !== undefined && typeof environment.revoked !== "boolean")) {
        throw new Error("Invalid NATS environment or credential generation");
      }
    }
    for (const field of ["maxDisk", "maxMemory", "maxStreams", "maxConsumers", "maxConnections"] as const) {
      if (!Number.isSafeInteger(p[field]) || p[field] < 1) throw new Error("NATS quotas must be positive integers");
    }
    repositories.add(p.repository);
  }
}

export async function natsBootstrap(entropy: Uint8Array): Promise<NatsBootstrap> {
  if (entropy.length !== 96) throw new Error("NATS bootstrap requires 96 protected random bytes");
  const operator = key(Prefix.Operator, entropy.slice(0, 32));
  const system = key(Prefix.Account, entropy.slice(32, 64));
  const admin = key(Prefix.User, entropy.slice(64, 96));
  return {
    operatorSeed: text.decode(operator.getSeed()),
    operatorJwt: await encodeOperator("homelab", operator, { system_account: system.getPublicKey() }),
    systemAccount: system.getPublicKey(),
    systemJwt: await encodeAccount("SYS", system, {
      limits: { conn: -1, data: -1, payload: -1, subs: -1, imports: 0, exports: 0, leaf: 0, wildcards: true, disallow_bearer: true },
    }, { signer: operator }),
    adminCredentials: text.decode(fmtCreds(await encodeUser("admin", admin, system), admin)),
  };
}

export async function natsAccount(
  operatorSeed: string,
  policy: NatsRepositoryAccounts,
  environment: string,
  accountEntropy: Uint8Array,
  userEntropies: Uint8Array[],
): Promise<NatsAccount> {
  validateNatsRepositories([policy]);
  const declaration = policy.environments[environment];
  if (!declaration || declaration.credentialGeneration !== userEntropies.length) throw new Error("NATS credential history is incomplete");
  const operator = fromSeed(bytes.encode(operatorSeed));
  const account = key(Prefix.Account, accountEntropy);
  const users = userEntropies.map(entropy => key(Prefix.User, entropy));
  const current = users[users.length - 1];
  const revocations = Object.fromEntries(users
    .filter(user => declaration.revoked || user !== current)
    .map(user => [user.getPublicKey(), 253402300799]));
  const userJwt = await encodeUser(`${policy.repository}/${environment}/server`, current, account, {
    pub: { allow: [">"], deny: ["$SYS.>"] },
    sub: { allow: [">"], deny: ["$SYS.>"] },
    bearer_token: false,
  });
  return {
    account: account.getPublicKey(),
    accountSeed: text.decode(account.getSeed()),
    userSeeds: users.map(user => text.decode(user.getSeed())),
    accountJwt: await encodeAccount(`${policy.repository}/${environment}`, account, {
      limits: {
        data: -1, payload: -1, subs: -1,
        conn: policy.maxConnections, imports: 0, exports: 0, leaf: 0,
        mem_storage: policy.maxMemory, disk_storage: policy.maxDisk,
        streams: policy.maxStreams, consumer: policy.maxConsumers,
        wildcards: true, disallow_bearer: true,
      },
      revocations,
    }, { signer: operator }),
    credentials: declaration.revoked ? "" : text.decode(fmtCreds(userJwt, current)),
  };
}
