import * as pulumi from "@pulumi/pulumi";
import { createZone, deleteZone, listZones, deleteZoneIfExists, TechnitiumClientConfig } from "./client";

export interface TechnitiumZoneResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  zoneName: pulumi.Input<string>;
  zoneType: pulumi.Input<"Primary" | "Secondary" | "Forwarder" | "Stub">;
}

interface TechnitiumZoneInputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  zoneType: "Primary" | "Secondary" | "Forwarder" | "Stub";
}

interface TechnitiumZoneOutputs {
  serverUrl: string;
  adminPassword: string;
  zoneName: string;
  zoneType: string;
}

class TechnitiumZoneProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumZoneInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumZoneOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    const zones = await listZones(client);
    const exists = zones.some(z => z.name === inputs.zoneName);
    if (!exists) {
      await createZone(client, inputs.zoneName, inputs.zoneType);
    }

    return {
      id: inputs.zoneName,
      outs: {
        serverUrl: inputs.serverUrl,
        adminPassword: inputs.adminPassword,
        zoneName: inputs.zoneName,
        zoneType: inputs.zoneType,
      },
    };
  }

  async diff(
    _id: string,
    olds: TechnitiumZoneOutputs,
    news: TechnitiumZoneInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];

    if (olds.zoneName !== news.zoneName) replaces.push("zoneName");
    if (olds.zoneType !== news.zoneType) replaces.push("zoneType");

    return {
      changes: replaces.length > 0 || olds.serverUrl !== news.serverUrl,
      replaces,
      deleteBeforeReplace: true,
    };
  }

  async update(
    id: string,
    _olds: TechnitiumZoneOutputs,
    news: TechnitiumZoneInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumZoneOutputs>> {
    return {
      outs: {
        serverUrl: news.serverUrl,
        adminPassword: news.adminPassword,
        zoneName: id,
        zoneType: news.zoneType,
      },
    };
  }

  async delete(_id: string, props: TechnitiumZoneOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };
    await deleteZone(client, props.zoneName);
  }

  async read(
    id: string,
    props: TechnitiumZoneOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumZoneOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const zones = await listZones(client);
    const zone = zones.find(z => z.name === props.zoneName);

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        zoneName: props.zoneName,
        zoneType: zone?.type ?? props.zoneType,
      },
    };
  }
}

export class TechnitiumZone extends pulumi.dynamic.Resource {
  public readonly zoneName!: pulumi.Output<string>;
  public readonly zoneType!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumZoneResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumZoneProvider(), name, { ...args }, opts, "technitium", "Zone");
  }
}
