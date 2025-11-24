import * as pulumi from "@pulumi/pulumi";
import * as authentik from "@pulumi/authentik";
import * as random from "@pulumi/random";

export interface AuthentikOIDCAppArgs {
  name: pulumi.Input<string>;
  slug: pulumi.Input<string>;
  redirectUri: pulumi.Input<string>;
  launchUrl?: pulumi.Input<string>;
  group?: pulumi.Input<string>;
  accessTokenValidity?: pulumi.Input<string>;
  refreshTokenValidity?: pulumi.Input<string>;
  clientType?: pulumi.Input<"confidential" | "public">;
}

export class AuthentikOIDCApp extends pulumi.ComponentResource {
  public readonly provider: authentik.ProviderOauth2;
  public readonly application: authentik.Application;
  public readonly clientId: pulumi.Output<string>;
  public readonly clientSecret: pulumi.Output<string>;

  constructor(
    name: string,
    args: AuthentikOIDCAppArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:AuthentikOIDCApp", name, args, opts);

    const authorizationFlow = authentik.getFlowOutput(
      { slug: "default-provider-authorization-implicit-consent" },
      { parent: this }
    );

    const invalidationFlow = authentik.getFlowOutput(
      { slug: "default-provider-invalidation-flow" },
      { parent: this }
    );

    const clientSecret = new random.RandomPassword(
      `${name}-client-secret`,
      {
        length: 64,
        special: false,
      },
      { parent: this }
    );

    this.provider = new authentik.ProviderOauth2(
      `${name}-provider`,
      {
        name: args.name,
        clientId: args.slug,
        clientSecret: clientSecret.result,
        authorizationFlow: authorizationFlow.id,
        invalidationFlow: invalidationFlow.id,
        clientType: args.clientType ?? "confidential",
        allowedRedirectUris: [
          {
            matching_mode: "strict",
            url: args.redirectUri,
          },
        ],
        accessTokenValidity: args.accessTokenValidity ?? "minutes=10",
        refreshTokenValidity: args.refreshTokenValidity ?? "days=30",
      },
      { parent: this }
    );

    this.application = new authentik.Application(
      `${name}-app`,
      {
        name: args.name,
        slug: args.slug,
        protocolProvider: this.provider.providerOauth2Id.apply((id) =>
          parseInt(id, 10)
        ),
        metaLaunchUrl: args.launchUrl,
        group: args.group,
      },
      { parent: this }
    );

    this.clientId = pulumi.output(args.slug);
    this.clientSecret = clientSecret.result;

    this.registerOutputs({
      provider: this.provider,
      application: this.application,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
  }

  public getIssuerUrl(authentikDomain: pulumi.Input<string>): pulumi.Output<string> {
    return pulumi.interpolate`https://${authentikDomain}/application/o/${this.clientId}/`;
  }
}
