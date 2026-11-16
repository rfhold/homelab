import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import {
  natsAccount, natsAccountId, natsBootstrap, validateNatsRepositories,
  type NatsBrokerConfig, type NatsRepositoryAccounts, type NatsPipelineCredential,
} from "../nats-accounts";

export interface NatsAccountsArgs {
  repositories: NatsRepositoryAccounts[];
}

export class NatsAccounts extends pulumi.ComponentResource {
  public readonly broker: pulumi.Output<NatsBrokerConfig>;
  public readonly pipelineCredentials: pulumi.Output<NatsPipelineCredential[]>;

  constructor(name: string, args: NatsAccountsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:NatsAccounts", name, {}, opts);
    validateNatsRepositories(args.repositories);
    if (!args.repositories.length) throw new Error("NATS requires at least one declared repository");
    const bootstrapEntropy = new random.RandomBytes(`${name}-operator`, { length: 96 }, { parent: this, protect: true });
    const bootstrap = pulumi.secret(bootstrapEntropy.base64.apply(value => natsBootstrap(Buffer.from(value, "base64"))));
    const routePassword = new random.RandomPassword(`${name}-route`, { length: 48, special: false }, { parent: this, protect: true }).result;
    const accounts: pulumi.Output<Record<string, string>>[] = [];
    const credentials: pulumi.Output<NatsPipelineCredential>[] = [];
    for (const repository of args.repositories) {
      for (const [environment, declaration] of Object.entries(repository.environments)) {
        const id = natsAccountId(repository.repository, environment);
        const accountEntropy = new random.RandomBytes(`${name}-${id}-account`, { length: 32 }, { parent: this, protect: true });
        const users = Array.from({ length: declaration.credentialGeneration }, (_, generation) =>
          new random.RandomBytes(`${name}-${id}-user-${generation + 1}`, { length: 32 }, { parent: this, protect: true }).base64);
        const account = pulumi.secret(pulumi.all([bootstrap, accountEntropy.base64, pulumi.all(users)])
          .apply(([identity, entropy, history]) => natsAccount(
            identity.operatorSeed, repository, environment,
            Buffer.from(entropy, "base64"), history.map(value => Buffer.from(value, "base64")),
          )));
        credentials.push(account.apply(value => ({
          repository: repository.repository, environment,
          account: value.account, credentialGeneration: declaration.credentialGeneration,
          revoked: declaration.revoked ?? false, credentials: value.credentials,
        })));
        accounts.push(account.apply(value => ({ [value.account]: value.accountJwt })));
      }
    }
    this.broker = pulumi.secret(pulumi.all([bootstrap, routePassword, pulumi.all(accounts)])
      .apply(([identity, password, claims]) => ({
        operatorJwt: identity.operatorJwt, systemAccount: identity.systemAccount,
        systemJwt: identity.systemJwt, adminCredentials: identity.adminCredentials,
        routePassword: password, accounts: claims.reduce((result, claim) => ({ ...result, ...claim }), {} as Record<string, string>),
      })));
    this.pipelineCredentials = pulumi.secret(pulumi.all(credentials));
    this.registerOutputs({ broker: this.broker, pipelineCredentials: this.pipelineCredentials });
  }
}
