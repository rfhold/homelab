import * as pulumi from "@pulumi/pulumi";
import {
  getClusterState,
  initCluster,
  deleteCluster,
  updateClusterNodeIpAddresses,
  TechnitiumClientConfig,
} from "./client";

const PROVIDER_VERSION = "2";

export interface TechnitiumClusterResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  clusterDomain: pulumi.Input<string>;
  nodeIpAddresses: pulumi.Input<string>;
}

interface TechnitiumClusterInputs {
  serverUrl: string;
  adminPassword: string;
  clusterDomain: string;
  nodeIpAddresses: string;
}

interface TechnitiumClusterOutputs {
  serverUrl: string;
  adminPassword: string;
  clusterDomain: string;
  nodeIpAddresses: string;
  primaryNodeUrl: string;
  providerVersion?: string;
}

class TechnitiumClusterProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumClusterInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumClusterOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };

    const state = await getClusterState(client);

    if (!state.clusterInitialized || state.clusterDomain !== inputs.clusterDomain) {
      await initCluster(client, inputs.clusterDomain, inputs.nodeIpAddresses);
    }

    const updated = await getClusterState(client);
    const primaryNodeUrl = updated.primaryNodeUrl ?? `https://${inputs.nodeIpAddresses.split(",")[0].trim()}:53443/`;

    return {
      id: inputs.clusterDomain,
      outs: {
        serverUrl: inputs.serverUrl,
        adminPassword: inputs.adminPassword,
        clusterDomain: inputs.clusterDomain,
        nodeIpAddresses: inputs.nodeIpAddresses,
        primaryNodeUrl,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }

  async diff(
    _id: string,
    olds: TechnitiumClusterOutputs,
    news: TechnitiumClusterInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];
    if (olds.clusterDomain !== news.clusterDomain) replaces.push("clusterDomain");

    const changed =
      replaces.length > 0 ||
      olds.nodeIpAddresses !== news.nodeIpAddresses ||
      olds.serverUrl !== news.serverUrl ||
      olds.providerVersion !== PROVIDER_VERSION;

    return { changes: changed, replaces, deleteBeforeReplace: true };
  }

  async update(
    _id: string,
    olds: TechnitiumClusterOutputs,
    news: TechnitiumClusterInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumClusterOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };

    if (olds.nodeIpAddresses !== news.nodeIpAddresses) {
      await updateClusterNodeIpAddresses(client, news.nodeIpAddresses);
    }

    const state = await getClusterState(client);
    const primaryNodeUrl = state.primaryNodeUrl ?? olds.primaryNodeUrl;

    return {
      outs: {
        serverUrl: news.serverUrl,
        adminPassword: news.adminPassword,
        clusterDomain: news.clusterDomain,
        nodeIpAddresses: news.nodeIpAddresses,
        primaryNodeUrl,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }

  async delete(_id: string, props: TechnitiumClusterOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };
    await deleteCluster(client);
  }

  async read(
    id: string,
    props: TechnitiumClusterOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumClusterOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const state = await getClusterState(client);
    const primaryNodeUrl = state.primaryNodeUrl ?? props.primaryNodeUrl;

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        clusterDomain: state.clusterDomain ?? props.clusterDomain,
        nodeIpAddresses: props.nodeIpAddresses,
        primaryNodeUrl,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }
}

export class TechnitiumCluster extends pulumi.dynamic.Resource {
  public readonly clusterDomain!: pulumi.Output<string>;
  public readonly nodeIpAddresses!: pulumi.Output<string>;
  public readonly primaryNodeUrl!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumClusterResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumClusterProvider(), name, { primaryNodeUrl: undefined, ...args }, opts, "technitium", "Cluster");
  }
}
