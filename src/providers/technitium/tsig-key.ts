import * as pulumi from "@pulumi/pulumi";
import {
  getSettings,
  setTsigKeys,
  TechnitiumClientConfig,
  TechnitiumTsigKeyInfo,
} from "./client";

export type TsigAlgorithm =
  | "hmac-md5.sig-alg.reg.int"
  | "hmac-sha1"
  | "hmac-sha256"
  | "hmac-sha256-128"
  | "hmac-sha384"
  | "hmac-sha384-192"
  | "hmac-sha512"
  | "hmac-sha512-256";

export interface TechnitiumTsigKeyResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  keyName: pulumi.Input<string>;
  sharedSecret: pulumi.Input<string>;
  algorithm: pulumi.Input<TsigAlgorithm>;
}

interface TechnitiumTsigKeyInputs {
  serverUrl: string;
  adminPassword: string;
  keyName: string;
  sharedSecret: string;
  algorithm: TsigAlgorithm;
}

interface TechnitiumTsigKeyOutputs {
  serverUrl: string;
  adminPassword: string;
  keyName: string;
  sharedSecret: string;
  algorithm: string;
}

async function upsertTsigKey(
  client: TechnitiumClientConfig,
  keyName: string,
  sharedSecret: string,
  algorithm: string,
): Promise<void> {
  const settings = await getSettings(client);
  const existing = settings.tsigKeys ?? [];

  const filtered = existing.filter(k => k.keyName !== keyName);
  const updated: TechnitiumTsigKeyInfo[] = [
    ...filtered,
    { keyName, sharedSecret, algorithmName: algorithm },
  ];

  await setTsigKeys(client, updated);
}

async function removeTsigKey(
  client: TechnitiumClientConfig,
  keyName: string,
): Promise<void> {
  const settings = await getSettings(client);
  const existing = settings.tsigKeys ?? [];
  const filtered = existing.filter(k => k.keyName !== keyName);
  await setTsigKeys(client, filtered);
}

class TechnitiumTsigKeyProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumTsigKeyInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumTsigKeyOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    await upsertTsigKey(client, inputs.keyName, inputs.sharedSecret, inputs.algorithm);

    return {
      id: inputs.keyName,
      outs: {
        serverUrl: inputs.serverUrl,
        adminPassword: inputs.adminPassword,
        keyName: inputs.keyName,
        sharedSecret: inputs.sharedSecret,
        algorithm: inputs.algorithm,
      },
    };
  }

  async diff(
    _id: string,
    olds: TechnitiumTsigKeyOutputs,
    news: TechnitiumTsigKeyInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];

    if (olds.keyName !== news.keyName) replaces.push("keyName");

    const changed =
      replaces.length > 0 ||
      olds.sharedSecret !== news.sharedSecret ||
      olds.algorithm !== news.algorithm ||
      olds.serverUrl !== news.serverUrl;

    return {
      changes: changed,
      replaces,
      deleteBeforeReplace: true,
    };
  }

  async update(
    _id: string,
    _olds: TechnitiumTsigKeyOutputs,
    news: TechnitiumTsigKeyInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumTsigKeyOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };

    await upsertTsigKey(client, news.keyName, news.sharedSecret, news.algorithm);

    return {
      outs: {
        serverUrl: news.serverUrl,
        adminPassword: news.adminPassword,
        keyName: news.keyName,
        sharedSecret: news.sharedSecret,
        algorithm: news.algorithm,
      },
    };
  }

  async delete(_id: string, props: TechnitiumTsigKeyOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };
    await removeTsigKey(client, props.keyName);
  }

  async read(
    id: string,
    props: TechnitiumTsigKeyOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumTsigKeyOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const settings = await getSettings(client);
    const key = (settings.tsigKeys ?? []).find(k => k.keyName === props.keyName);

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        keyName: props.keyName,
        sharedSecret: key?.sharedSecret ?? props.sharedSecret,
        algorithm: key?.algorithmName ?? props.algorithm,
      },
    };
  }
}

export class TechnitiumTsigKey extends pulumi.dynamic.Resource {
  public readonly keyName!: pulumi.Output<string>;
  public readonly algorithm!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumTsigKeyResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumTsigKeyProvider(), name, { ...args }, opts, "technitium", "TsigKey");
  }
}
