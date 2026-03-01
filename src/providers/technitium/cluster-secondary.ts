import * as pulumi from "@pulumi/pulumi";
import {
  getClusterState,
  initJoinCluster,
  forceLeaveCluster,
  deleteSecondaryNode,
  updateSecondaryNode,
  getServerCertificateBase64Url,
  updateClusterNodeIpAddresses,
  deleteZoneIfExists,
  resyncZone,
  TechnitiumClientConfig,
} from "./client";

const PROVIDER_VERSION = "4";

export interface TechnitiumClusterSecondaryResourceInputs {
  serverUrl: pulumi.Input<string>;
  adminPassword: pulumi.Input<string>;
  nodeIpAddresses: pulumi.Input<string>;
  nodeHostname: pulumi.Input<string>;
  nodePort: pulumi.Input<number>;
  primaryNodeUrl: pulumi.Input<string>;
  primaryNodeMgmtUrl: pulumi.Input<string>;
  primaryNodeIpAddress: pulumi.Input<string>;
  primaryNodeUsername: pulumi.Input<string>;
  primaryNodePassword: pulumi.Input<string>;
  ignoreCertificateErrors: pulumi.Input<boolean>;
}

interface TechnitiumClusterSecondaryInputs {
  serverUrl: string;
  adminPassword: string;
  nodeIpAddresses: string;
  nodeHostname: string;
  nodePort: number;
  primaryNodeUrl: string;
  primaryNodeMgmtUrl: string;
  primaryNodeIpAddress: string;
  primaryNodeUsername: string;
  primaryNodePassword: string;
  ignoreCertificateErrors: boolean;
}

interface TechnitiumClusterSecondaryOutputs {
  serverUrl: string;
  adminPassword: string;
  nodeIpAddresses: string;
  nodeHostname: string;
  nodePort: number;
  primaryNodeUrl: string;
  primaryNodeMgmtUrl: string;
  primaryNodeIpAddress: string;
  primaryNodeUsername: string;
  primaryNodePassword: string;
  ignoreCertificateErrors: boolean;
  providerVersion: string;
}

async function doFullRejoin(
  client: TechnitiumClientConfig,
  primaryClient: TechnitiumClientConfig,
  inputs: TechnitiumClusterSecondaryInputs,
  clusterDomain: string,
): Promise<void> {
  const currentState = await getClusterState(client);
  if (currentState.clusterInitialized) {
    await forceLeaveCluster(client);
  }
  await deleteZoneIfExists(client, clusterDomain);

  const primaryState = await getClusterState(primaryClient);
  const secondaryNode = primaryState.nodes?.find(
    n => n.nodeDomain === inputs.nodeHostname || n.nodeIpAddresses.includes(inputs.nodeIpAddresses),
  );
  if (secondaryNode) {
    await deleteSecondaryNode(primaryClient, secondaryNode.nodeId);
  }

  await initJoinCluster(
    client,
    inputs.nodeIpAddresses,
    inputs.primaryNodeUrl,
    inputs.primaryNodeIpAddress,
    inputs.ignoreCertificateErrors,
    inputs.primaryNodeUsername,
    inputs.primaryNodePassword,
  );

  const clusterCatalog = `cluster-catalog.${clusterDomain}`;
  await resyncZone(client, clusterCatalog);
}

async function tryUpdateSecondaryTlsa(
  primaryClient: TechnitiumClientConfig,
  inputs: TechnitiumClusterSecondaryInputs,
): Promise<boolean> {
  try {
    const primaryState = await getClusterState(primaryClient);
    const secondaryNode = primaryState.nodes?.find(
      n => n.nodeDomain === inputs.nodeHostname || n.nodeIpAddresses.includes(inputs.nodeIpAddresses),
    );
    if (!secondaryNode) return false;

    const cert = await getServerCertificateBase64Url(inputs.nodeHostname, inputs.nodePort);
    const secondaryNodeUrl = `https://${inputs.nodeHostname}:${inputs.nodePort}/`;
    await updateSecondaryNode(
      primaryClient,
      secondaryNode.nodeId,
      secondaryNodeUrl,
      inputs.nodeIpAddresses,
      cert,
    );
    return true;
  } catch {
    return false;
  }
}

class TechnitiumClusterSecondaryProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: TechnitiumClusterSecondaryInputs): Promise<pulumi.dynamic.CreateResult<TechnitiumClusterSecondaryOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: inputs.serverUrl,
      adminPassword: inputs.adminPassword,
    };
    const primaryClient: TechnitiumClientConfig = {
      serverUrl: inputs.primaryNodeMgmtUrl,
      adminPassword: inputs.primaryNodePassword,
    };

    const clusterDomain = inputs.nodeHostname.split(".").slice(1).join(".");

    await doFullRejoin(client, primaryClient, inputs, clusterDomain);

    return {
      id: `${inputs.serverUrl}/cluster-secondary`,
      outs: {
        serverUrl: inputs.serverUrl,
        adminPassword: inputs.adminPassword,
        nodeIpAddresses: inputs.nodeIpAddresses,
        nodeHostname: inputs.nodeHostname,
        nodePort: inputs.nodePort,
        primaryNodeUrl: inputs.primaryNodeUrl,
        primaryNodeMgmtUrl: inputs.primaryNodeMgmtUrl,
        primaryNodeIpAddress: inputs.primaryNodeIpAddress,
        primaryNodeUsername: inputs.primaryNodeUsername,
        primaryNodePassword: inputs.primaryNodePassword,
        ignoreCertificateErrors: inputs.ignoreCertificateErrors,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }

  async diff(
    _id: string,
    olds: TechnitiumClusterSecondaryOutputs,
    news: TechnitiumClusterSecondaryInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];
    if (olds.primaryNodeUrl !== news.primaryNodeUrl) replaces.push("primaryNodeUrl");

    const changed =
      replaces.length > 0 ||
      olds.nodeIpAddresses !== news.nodeIpAddresses ||
      olds.serverUrl !== news.serverUrl ||
      olds.providerVersion !== PROVIDER_VERSION;

    return { changes: changed, replaces, deleteBeforeReplace: true };
  }

  async update(
    _id: string,
    olds: TechnitiumClusterSecondaryOutputs,
    news: TechnitiumClusterSecondaryInputs,
  ): Promise<pulumi.dynamic.UpdateResult<TechnitiumClusterSecondaryOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: news.serverUrl,
      adminPassword: news.adminPassword,
    };
    const primaryClient: TechnitiumClientConfig = {
      serverUrl: news.primaryNodeMgmtUrl,
      adminPassword: news.primaryNodePassword,
    };

    if (olds.providerVersion !== PROVIDER_VERSION) {
      const clusterDomain = news.nodeHostname.split(".").slice(1).join(".");
      const updated = await tryUpdateSecondaryTlsa(primaryClient, news);
      if (!updated) {
        await doFullRejoin(client, primaryClient, news, clusterDomain);
      }
    } else if (olds.nodeIpAddresses !== news.nodeIpAddresses) {
      await updateClusterNodeIpAddresses(client, news.nodeIpAddresses);
    }

    return {
      outs: {
        serverUrl: news.serverUrl,
        adminPassword: news.adminPassword,
        nodeIpAddresses: news.nodeIpAddresses,
        nodeHostname: news.nodeHostname,
        nodePort: news.nodePort,
        primaryNodeUrl: news.primaryNodeUrl,
        primaryNodeMgmtUrl: news.primaryNodeMgmtUrl,
        primaryNodeIpAddress: news.primaryNodeIpAddress,
        primaryNodeUsername: news.primaryNodeUsername,
        primaryNodePassword: news.primaryNodePassword,
        ignoreCertificateErrors: news.ignoreCertificateErrors,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }

  async delete(_id: string, props: TechnitiumClusterSecondaryOutputs): Promise<void> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };
    await forceLeaveCluster(client);
  }

  async read(
    id: string,
    props: TechnitiumClusterSecondaryOutputs,
  ): Promise<pulumi.dynamic.ReadResult<TechnitiumClusterSecondaryOutputs>> {
    const client: TechnitiumClientConfig = {
      serverUrl: props.serverUrl,
      adminPassword: props.adminPassword,
    };

    const state = await getClusterState(client);
    const secondaryNode = state.nodes?.find(
      n => n.nodeDomain === props.nodeHostname || n.nodeIpAddresses.includes(props.nodeIpAddresses),
    );

    return {
      id,
      props: {
        serverUrl: props.serverUrl,
        adminPassword: props.adminPassword,
        nodeIpAddresses: secondaryNode?.nodeIpAddresses.join(",") ?? props.nodeIpAddresses,
        nodeHostname: secondaryNode?.nodeDomain ?? props.nodeHostname,
        nodePort: props.nodePort,
        primaryNodeUrl: props.primaryNodeUrl,
        primaryNodeMgmtUrl: props.primaryNodeMgmtUrl,
        primaryNodeIpAddress: props.primaryNodeIpAddress,
        primaryNodeUsername: props.primaryNodeUsername,
        primaryNodePassword: props.primaryNodePassword,
        ignoreCertificateErrors: props.ignoreCertificateErrors,
        providerVersion: PROVIDER_VERSION,
      },
    };
  }
}

export class TechnitiumClusterSecondary extends pulumi.dynamic.Resource {
  public readonly nodeIpAddresses!: pulumi.Output<string>;
  public readonly primaryNodeUrl!: pulumi.Output<string>;

  constructor(
    name: string,
    args: TechnitiumClusterSecondaryResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new TechnitiumClusterSecondaryProvider(), name, { ...args }, opts, "technitium", "ClusterSecondary");
  }
}
