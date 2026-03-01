import * as pulumi from "@pulumi/pulumi";
import { getCatalogZoneOptions, setCatalogZoneOptions, TechnitiumClientConfig } from "./client";

export interface TechnitiumCatalogZoneOptionsResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  zoneName: pulumi.Input<string>;
  zoneTransferTsigKeyNames: pulumi.Input<string[]>;
}

interface TechnitiumCatalogZoneOptionsInputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  zoneTransferTsigKeyNames: string[];
}

interface TechnitiumCatalogZoneOptionsOutputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  zoneTransferTsigKeyNames: string;
}

async function applyOptions(
  client: TechnitiumClientConfig,
  inputs: TechnitiumCatalogZoneOptionsInputs,
): Promise<TechnitiumCatalogZoneOptionsOutputs> {
  await setCatalogZoneOptions(client, inputs.zoneName, {
    zoneTransfer: "Allow",
    zoneTransferTsigKeyNames: inputs.zoneTransferTsigKeyNames,
  });

  return {
    serverUrl: inputs.serverUrl,
    adminPassword: inputs.adminPassword,
    zoneName: inputs.zoneName,
    zoneTransferTsigKeyNames: inputs.zoneTransferTsigKeyNames.join(","),
  };
}

class TechnitiumCatalogZoneOptionsProvider implements pulumi.dynamic.ResourceProvider {
  async create(
    inputs: TechnitiumCatalogZoneOptionsInputs,
  ): Promise<pulumi.dynamic.CreateResult<TechnitiumCatalogZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };
    const outs = await applyOptions(client, inputs);
    return { id: inputs.zoneName, outs };
  }

  async diff(
    _id: string,
    olds: TechnitiumCatalogZoneOptionsOutputs,
    news: TechnitiumCatalogZoneOptionsInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const newKeys = news.zoneTransferTsigKeyNames.join(",");
    const replaces: string[] = [];
    if (olds.zoneName !== news.zoneName) replaces.push("zoneName");

    const changed =
      replaces.length > 0 ||
      olds.serverUrl !== news.serverUrl ||
      olds.zoneTransferTsigKeyNames !== newKeys;

    return { changes: changed, replaces, deleteBeforeReplace: true };
  }

  async update(
    _id: string,
    _olds: TechnitiumCatalogZoneOptionsOutputs,
    news: TechnitiumCatalogZoneOptionsInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumCatalogZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };
    const outs = await applyOptions(client, news);
    return { outs };
  }

  async delete(_id: string, _props: TechnitiumCatalogZoneOptionsOutputs): Promise<void> {
    // Catalog zone options reset when the zone is deleted.
  }

  async read(
    id: string,
    props: TechnitiumCatalogZoneOptionsOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumCatalogZoneOptionsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const info = await getCatalogZoneOptions(client, props.zoneName);

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        zoneName: props.zoneName,
        zoneTransferTsigKeyNames: info.zoneTransferTsigKeyNames.join(","),
      },
    };
  }
}

export class TechnitiumCatalogZoneOptions extends pulumi.dynamic.Resource {
  public readonly zoneName!: pulumi.Output<string>;
  public readonly zoneTransferTsigKeyNames!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumCatalogZoneOptionsResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumCatalogZoneOptionsProvider(), name, { ...args }, opts, "technitium", "CatalogZoneOptions");
  }
}
