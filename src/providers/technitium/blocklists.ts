import * as pulumi from "@pulumi/pulumi";
import { getBlockListUrls, setBlockListUrls, TechnitiumClientConfig } from "./client";

export interface TechnitiumBlocklistsResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  urls: pulumi.Input<string[]>;
}

interface TechnitiumBlocklistsInputs {
  serverUrl: string;
  adminPassword: string;
  urls: string[];
}

interface TechnitiumBlocklistsOutputs {
  serverUrl: string;
  adminPassword: string;
  urls: string;
}

function serializeUrls(urls: string[]): string {
  return [...urls].sort().join(",");
}

class TechnitiumBlocklistsProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumBlocklistsInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumBlocklistsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    await setBlockListUrls(client, inputs.urls);

    return {
      id: "blocklists",
      outs: {
        serverUrl: inputs.serverUrl,
        adminPassword: inputs.adminPassword,
        urls: serializeUrls(inputs.urls),
      },
    };
  }

  async diff(
    _id: string,
    olds: TechnitiumBlocklistsOutputs,
    news: TechnitiumBlocklistsInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const changed =
      olds.serverUrl !== news.serverUrl ||
      olds.urls !== serializeUrls(news.urls);

    return { changes: changed, replaces: [], deleteBeforeReplace: false };
  }

  async update(
    _id: string,
    _olds: TechnitiumBlocklistsOutputs,
    news: TechnitiumBlocklistsInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumBlocklistsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };

    await setBlockListUrls(client, news.urls);

    return {
      outs: {
        serverUrl: news.serverUrl,
        adminPassword: news.adminPassword,
        urls: serializeUrls(news.urls),
      },
    };
  }

  async delete(_id: string, props: TechnitiumBlocklistsOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    await setBlockListUrls(client, []);
  }

  async read(
    id: string,
    props: TechnitiumBlocklistsOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumBlocklistsOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const urls = await getBlockListUrls(client);

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        urls: serializeUrls(urls),
      },
    };
  }
}

export class TechnitiumBlocklists extends pulumi.dynamic.Resource {
  public readonly urls!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumBlocklistsResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumBlocklistsProvider(), name, {
      ...args,
    }, opts, "technitium", "Blocklists");
  }
}
