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
    let policies: cloudflare.types.input.ApiTokenPolicy[];
    switch (args.usage) {
      case CloudflareTokenUsage.DNS:
        policies = this.createDnsPolicies(args.zones);
        break;
      default:
        throw new Error(`Unsupported token usage: ${args.usage}`);
    }

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

  private createDnsPolicies(_zones: pulumi.Input<string[]>): cloudflare.types.input.ApiTokenPolicy[] {
    const ZONE_READ = "c8fed203ed3043cba015a93ad1616f1f";
    const DNS_READ = "82e64a83756745bbbb1c9c2701bf816b";
    const DNS_WRITE = "4755a26eedb94da69e1066d98aa820be";

    return [
      {
        effect: "allow",
        permissionGroups: [
          { id: ZONE_READ },
          { id: DNS_READ },
          { id: DNS_WRITE },
        ],
        resources: JSON.stringify({ "com.cloudflare.api.account.*": "*" }),
      },
    ];
  }


}

// Backward compatibility export
export const CloudflareAccountToken = CloudflareApiToken;
export type CloudflareAccountTokenArgs = CloudflareApiTokenArgs;
