import * as pulumi from "@pulumi/pulumi";
import { getSettings, setDnssecValidation, setDnsServerDomain, setNotifyAllowedNetworks, TechnitiumClientConfig } from "./client";

const PROVIDER_VERSION = "2";

export interface TechnitiumServerSettingsResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  dnssecValidation: pulumi.Input<boolean>;
  dnsServerDomain?: pulumi.Input<string>;
  notifyAllowedNetworks?: pulumi.Input<string[]>;
}

interface TechnitiumServerSettingsInputs {
  serverUrl: string;
  adminPassword: string;
  dnssecValidation: boolean;
  dnsServerDomain?: string;
  notifyAllowedNetworks?: string[];
  providerVersion: string;
}

interface TechnitiumServerSettingsOutputs {
  serverUrl: string;
  adminPassword: string;
  dnssecValidation: boolean;
  dnsServerDomain?: string;
  notifyAllowedNetworks?: string[];
  providerVersion: string;
}

async function applySettings(
  client: TechnitiumClientConfig,
  inputs: TechnitiumServerSettingsInputs,
): Promise<void> {
  await setDnssecValidation(client, inputs.dnssecValidation);
  if (inputs.dnsServerDomain !== undefined) {
    await setDnsServerDomain(client, inputs.dnsServerDomain);
  }
  if (inputs.notifyAllowedNetworks !== undefined) {
    await setNotifyAllowedNetworks(client, inputs.notifyAllowedNetworks);
  }
}

class TechnitiumServerSettingsProvider implements pulumi.dynamic.ResourceProvider {
  async create(
    inputs: TechnitiumServerSettingsInputs,
  ): Promise<pulumi.dynamic.CreateResult<TechnitiumServerSettingsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    await applySettings(client, inputs);

    const outs: TechnitiumServerSettingsOutputs = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
      dnssecValidation: inputs.dnssecValidation,
      providerVersion: inputs.providerVersion,
    } as TechnitiumServerSettingsOutputs;
    if (inputs.dnsServerDomain !== undefined) {
      outs.dnsServerDomain = inputs.dnsServerDomain;
    }
    if (inputs.notifyAllowedNetworks !== undefined) {
      outs.notifyAllowedNetworks = inputs.notifyAllowedNetworks;
    }
    return { id: "server-settings", outs };
  }

  async diff(
    _id: string,
    olds: TechnitiumServerSettingsOutputs,
    news: TechnitiumServerSettingsInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const versionChanged = (olds.providerVersion ?? "") !== news.providerVersion;
    const changed =
      versionChanged ||
      olds.serverUrl !== news.serverUrl ||
      olds.dnssecValidation !== news.dnssecValidation ||
      olds.dnsServerDomain !== news.dnsServerDomain ||
      JSON.stringify(olds.notifyAllowedNetworks ?? []) !== JSON.stringify(news.notifyAllowedNetworks ?? []);

    return { changes: changed, replaces: versionChanged ? ["providerVersion"] : [], deleteBeforeReplace: false };
  }

  async update(
    _id: string,
    _olds: TechnitiumServerSettingsOutputs,
    news: TechnitiumServerSettingsInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumServerSettingsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };

    await applySettings(client, news);

    const outs: TechnitiumServerSettingsOutputs = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
      dnssecValidation: news.dnssecValidation,
      providerVersion: news.providerVersion,
    } as TechnitiumServerSettingsOutputs;
    if (news.dnsServerDomain !== undefined) {
      outs.dnsServerDomain = news.dnsServerDomain;
    }
    if (news.notifyAllowedNetworks !== undefined) {
      outs.notifyAllowedNetworks = news.notifyAllowedNetworks;
    }
    return { outs };
  }

  async delete(_id: string, props: TechnitiumServerSettingsOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };
    await setDnssecValidation(client, true);
  }

  async read(
    id: string,
    props: TechnitiumServerSettingsOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumServerSettingsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const settings = await getSettings(client);

    const readProps: TechnitiumServerSettingsOutputs = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
      dnssecValidation: settings.dnssecValidation ?? true,
      providerVersion: props.providerVersion ?? PROVIDER_VERSION,
    } as TechnitiumServerSettingsOutputs;
    if (settings.dnsServerDomain !== undefined) {
      readProps.dnsServerDomain = settings.dnsServerDomain;
    }
    if (settings.notifyAllowedNetworks !== undefined) {
      readProps.notifyAllowedNetworks = settings.notifyAllowedNetworks;
    }
    return { id, props: readProps };
  }
}

export class TechnitiumServerSettings extends pulumi.dynamic.Resource {
  public readonly dnssecValidation!: pulumi.Output<boolean>;
  public readonly dnsServerDomain!: pulumi.Output<string>;
  public readonly notifyAllowedNetworks!: pulumi.Output<string[] | undefined>;

  constructor(
    name: string,
    args: TechnitiumServerSettingsResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumServerSettingsProvider(), name, { ...args, providerVersion: PROVIDER_VERSION }, opts, "technitium", "ServerSettings");
  }
}
