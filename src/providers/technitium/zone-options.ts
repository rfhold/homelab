import * as pulumi from "@pulumi/pulumi";
import { getZoneOptions, setZoneOptions, TechnitiumClientConfig } from "./client";

export type ZoneUpdatePolicy = "Deny" | "Allow" | "AllowOnlyZoneNameServers" | "UseSpecifiedNetworkACL";

export interface UpdateSecurityPolicy {
  tsigKeyName: string;
  domain: string;
  allowedTypes: string[];
}

export interface TechnitiumZoneOptionsResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  zoneName: pulumi.Input<string>;
  update: pulumi.Input<ZoneUpdatePolicy>;
  updateNetworkACL?: pulumi.Input<string[]>;
  updateSecurityPolicies?: pulumi.Input<UpdateSecurityPolicy[]>;
  catalog?: pulumi.Input<string>;
}

interface TechnitiumZoneOptionsInputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  update: ZoneUpdatePolicy;
  updateNetworkACL?: string[];
  updateSecurityPolicies?: UpdateSecurityPolicy[];
  catalog?: string;
}

interface TechnitiumZoneOptionsOutputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  update: string;
  updateNetworkACL: string;
  updateSecurityPolicies: string;
  catalog: string;
}

function serializeSecurityPolicies(policies: UpdateSecurityPolicy[]): string {
  if (policies.length === 0) return "false";
  return policies
    .map(p => `${p.tsigKeyName}|${p.domain}|${p.allowedTypes.join(",")}`)
    .join("|");
}

async function applyZoneOptions(
  client: TechnitiumClientConfig,
  inputs: TechnitiumZoneOptionsInputs,
): Promise<TechnitiumZoneOptionsOutputs> {
  const options: Record<string, string> = {
    update: inputs.update,
  };

  const networkACL = inputs.updateNetworkACL ?? [];
  const policies = inputs.updateSecurityPolicies ?? [];

  options.updateNetworkACL = networkACL.length > 0 ? networkACL.join(",") : "false";
  options.updateSecurityPolicies = serializeSecurityPolicies(policies);

  if (inputs.catalog) {
    options.catalog = inputs.catalog;
  }

  await setZoneOptions(client, inputs.zoneName, options);

  return {
    serverUrl: inputs.serverUrl,
    adminPassword: inputs.adminPassword,
    zoneName: inputs.zoneName,
    update: inputs.update,
    updateNetworkACL: options.updateNetworkACL,
    updateSecurityPolicies: options.updateSecurityPolicies,
    catalog: inputs.catalog ?? "",
  };
}

class TechnitiumZoneOptionsProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumZoneOptionsInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    const outs = await applyZoneOptions(client, inputs);
    return { id: inputs.zoneName, outs };
  }

  async diff(
    _id: string,
    olds: TechnitiumZoneOptionsOutputs,
    news: TechnitiumZoneOptionsInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const newACL = (news.updateNetworkACL ?? []).length > 0
      ? (news.updateNetworkACL ?? []).join(",")
      : "false";

    const newPolicies = serializeSecurityPolicies(news.updateSecurityPolicies ?? []);

    const replaces: string[] = [];
    if (olds.zoneName !== news.zoneName) replaces.push("zoneName");

    const changed =
      replaces.length > 0 ||
      olds.update !== news.update ||
      olds.updateNetworkACL !== newACL ||
      olds.updateSecurityPolicies !== newPolicies ||
      olds.serverUrl !== news.serverUrl ||
      (olds.catalog ?? "") !== (news.catalog ?? "");

    return { changes: changed, replaces, deleteBeforeReplace: true };
  }

  async update(
    _id: string,
    _olds: TechnitiumZoneOptionsOutputs,
    news: TechnitiumZoneOptionsInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };

    const outs = await applyZoneOptions(client, news);
    return { outs };
  }

  async delete(_id: string, _props: TechnitiumZoneOptionsOutputs): Promise<void> {
    // Zone options are reset when the zone itself is deleted.
  }

  async read(
    id: string,
    props: TechnitiumZoneOptionsOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const info = await getZoneOptions(client, props.zoneName);
    const networkACL = (info.updateNetworkACL ?? []).length > 0
      ? info.updateNetworkACL.join(",")
      : "false";
    const policies = serializeSecurityPolicies(info.updateSecurityPolicies ?? []);

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        zoneName: props.zoneName,
        update: info.update ?? props.update,
        updateNetworkACL: networkACL,
        updateSecurityPolicies: policies,
        catalog: props.catalog,
      },
    };
  }
}

export class TechnitiumZoneOptions extends pulumi.dynamic.Resource {
  public readonly zoneName!: pulumi.Output<string>;
  public readonly update!: pulumi.Output<string>;
  public readonly updateNetworkACL!: pulumi.Output<string>;
  public readonly updateSecurityPolicies!: pulumi.Output<string>;
  public readonly catalog!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumZoneOptionsResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumZoneOptionsProvider(), name, {
      updateNetworkACL: undefined,
      updateSecurityPolicies: undefined,
      catalog: undefined,
      ...args,
    }, opts, "technitium", "ZoneOptions");
  }
}
