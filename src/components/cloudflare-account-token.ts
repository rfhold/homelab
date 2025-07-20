import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

/**
 * Usage types for Cloudflare API tokens
 */
export enum CloudflareTokenUsage {
  DNS = "dns",
}

/**
 * Configuration for the Cloudflare API token component
 */
export interface CloudflareApiTokenArgs {
  /** Usage type for the token */
  usage: pulumi.Input<CloudflareTokenUsage>;
  /** List of zone names the token should have access to */
  zones: pulumi.Input<string[]>;
  /** Token name */
  name?: pulumi.Input<string>;
}

/**
 * Cloudflare API token component - creates scoped API tokens for specific use cases
 * 
 * @example
 * ```typescript
 * import { CloudflareApiToken, CloudflareTokenUsage } from "../components/cloudflare-account-token";
 * 
 * const dnsToken = new CloudflareApiToken("dns-token", {
 *   usage: CloudflareTokenUsage.DNS,
 *   zones: ["example.com", "example.org"],
 *   name: "DNS Management Token",
 * });
 * ```
 */
export class CloudflareApiToken extends pulumi.ComponentResource {
  /** The API token resource */
  public readonly token: cloudflare.ApiToken;
  /** The token value (sensitive) */
  public readonly value: pulumi.Output<string>;

  constructor(name: string, args: CloudflareApiTokenArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:CloudflareApiToken", name, args, opts);

    // Create policies based on usage type
    const policies = pulumi.output(args.usage).apply(usage => {
      switch (usage) {
        case CloudflareTokenUsage.DNS:
          return this.createDnsPolicies(args.zones);
        default:
          throw new Error(`Unsupported token usage: ${usage}`);
      }
    });

    // Create the API token
    this.token = new cloudflare.ApiToken(
      `${name}-token`,
      {
        name: args.name || `${name} Token`,
        policies: policies,
        status: "active",
      },
      { parent: this }
    );

    this.value = this.token.value;

    this.registerOutputs({
      token: this.token,
      value: this.value,
    });
  }

  private createDnsPolicies(_zones: pulumi.Input<string[]>): pulumi.Output<cloudflare.types.input.ApiTokenPolicy[]> {
    return pulumi.output([
      {
        effect: "allow",
        permissionGroups: [
          {
            id: "c8fed203ed3043cba015a93ad1616f1f", // Zone Read
          },
          {
            id: "82e64a83756745bbbb1c9c2701bf816b", // DNS Read
          },
          {
            id: "4755a26eedb94da69e1066d98aa820be", // DNS Write
          },
        ],
        resources: {
          "com.cloudflare.api.account.*": "*"
        },
      },
    ]);
  }


}

// Backward compatibility export
export const CloudflareAccountToken = CloudflareApiToken;
export type CloudflareAccountTokenArgs = CloudflareApiTokenArgs;
