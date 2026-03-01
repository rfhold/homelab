export interface TechnitiumClientConfig {
  serverUrl: string;
  adminPassword: string;
}

export interface TechnitiumApiResponse<T = unknown> {
  status: "ok" | "error" | "invalid-token";
  response?: T;
  errorMessage?: string;
}

export interface TechnitiumZoneInfo {
  name: string;
  type: string;
  disabled: boolean;
  dnssecStatus: string;
  soaSerial: number;
}

export interface TechnitiumTsigKeyInfo {
  keyName: string;
  sharedSecret: string;
  algorithmName: string;
}

export interface TechnitiumZoneOptionsInfo {
  name: string;
  type: string;
  disabled: boolean;
  update: string;
  updateNetworkACL: string[];
  updateSecurityPolicies: TechnitiumUpdateSecurityPolicy[];
}

export interface TechnitiumUpdateSecurityPolicy {
  tsigKeyName: string;
  domain: string;
  allowedTypes: string[];
}

interface LoginResponse {
  status: "ok" | "error" | "invalid-token";
  token?: string;
  errorMessage?: string;
}

async function login(config: TechnitiumClientConfig): Promise<string> {
  const url = new URL(`${config.serverUrl}/api/user/login`);
  url.searchParams.set("user", "admin");
  url.searchParams.set("pass", config.adminPassword);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`Technitium login HTTP ${resp.status}`);
  }

  const data = await resp.json() as LoginResponse;
  if (data.status !== "ok" || !data.token) {
    throw new Error(`Technitium login failed: ${data.errorMessage ?? data.status}`);
  }

  return data.token;
}

async function apiGet<T = unknown>(
  config: TechnitiumClientConfig,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const token = await login(config);

  const url = new URL(`${config.serverUrl}${path}`);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`Technitium API ${path} HTTP ${resp.status}`);
  }

  const data = await resp.json() as TechnitiumApiResponse<T>;
  if (data.status !== "ok") {
    throw new Error(`Technitium API ${path} error: ${data.errorMessage ?? data.status}`);
  }

  return data.response as T;
}

async function apiPost<T = unknown>(
  config: TechnitiumClientConfig,
  path: string,
  body: Record<string, string>,
): Promise<T> {
  const token = await login(config);

  const url = new URL(`${config.serverUrl}${path}`);
  const params = new URLSearchParams({ token, ...body });

  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    throw new Error(`Technitium API ${path} HTTP ${resp.status}`);
  }

  const data = await resp.json() as TechnitiumApiResponse<T>;
  if (data.status !== "ok") {
    throw new Error(`Technitium API ${path} error: ${data.errorMessage ?? data.status}`);
  }

  return data.response as T;
}

export async function createZone(
  config: TechnitiumClientConfig,
  zone: string,
  type: string,
): Promise<void> {
  await apiGet(config, "/api/zones/create", { zone, type });
}

export async function deleteZone(
  config: TechnitiumClientConfig,
  zone: string,
): Promise<void> {
  await apiGet(config, "/api/zones/delete", { zone });
}

export async function getZoneOptions(
  config: TechnitiumClientConfig,
  zone: string,
): Promise<TechnitiumZoneOptionsInfo> {
  return apiGet<TechnitiumZoneOptionsInfo>(config, "/api/zones/options/get", {
    zone,
    includeAvailableTsigKeyNames: "true",
  });
}

export async function setZoneOptions(
  config: TechnitiumClientConfig,
  zone: string,
  options: Record<string, string>,
): Promise<void> {
  await apiGet(config, "/api/zones/options/set", { zone, ...options });
}

export async function listTsigKeyNames(
  config: TechnitiumClientConfig,
): Promise<string[]> {
  const resp = await apiGet<{ tsigKeyNames: string[] }>(
    config,
    "/api/settings/getTsigKeyNames",
    {},
  );
  return resp?.tsigKeyNames ?? [];
}

export interface TechnitiumSettings {
  tsigKeys?: TechnitiumTsigKeyInfo[];
  blockListUrls?: string[];
  dnssecValidation?: boolean;
  dnsServerDomain?: string;
  notifyAllowedNetworks?: string[];
}

export async function getSettings(
  config: TechnitiumClientConfig,
): Promise<TechnitiumSettings> {
  return apiGet<TechnitiumSettings>(config, "/api/settings/get", {});
}

export async function setDnssecValidation(
  config: TechnitiumClientConfig,
  dnssecValidation: boolean,
): Promise<void> {
  await apiPost(config, "/api/settings/set", {
    dnssecValidation: dnssecValidation ? "true" : "false",
  });
}

export async function setDnsServerDomain(
  config: TechnitiumClientConfig,
  dnsServerDomain: string,
): Promise<void> {
  await apiPost(config, "/api/settings/set", { dnsServerDomain });
}

export async function setNotifyAllowedNetworks(
  config: TechnitiumClientConfig,
  networks: string[],
): Promise<void> {
  const token = await login(config);
  const url = new URL(`${config.serverUrl}/api/settings/set`);
  const params = new URLSearchParams({ token });
  if (networks.length === 0) {
    params.append("notifyAllowedNetworks", "false");
  } else {
    for (const network of networks) {
      params.append("notifyAllowedNetworks", network);
    }
  }
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!resp.ok) {
    throw new Error(`Technitium API /api/settings/set HTTP ${resp.status}`);
  }
  const data = await resp.json() as TechnitiumApiResponse;
  if (data.status !== "ok") {
    throw new Error(`Technitium API /api/settings/set error: ${data.errorMessage ?? data.status}`);
  }
}

export async function getBlockListUrls(
  config: TechnitiumClientConfig,
): Promise<string[]> {
  const settings = await getSettings(config);
  return settings?.blockListUrls ?? [];
}

export async function setBlockListUrls(
  config: TechnitiumClientConfig,
  urls: string[],
): Promise<void> {
  const blockListUrls = urls.length === 0 ? "false" : urls.join(",");
  await apiPost(config, "/api/settings/set", { blockListUrls });
}

export async function setTsigKeys(
  config: TechnitiumClientConfig,
  keys: TechnitiumTsigKeyInfo[],
): Promise<void> {
  const tsigKeys = keys.length === 0
    ? "false"
    : keys.map(k => `${k.keyName}|${k.sharedSecret}|${k.algorithmName}`).join("|");

  await apiPost(config, "/api/settings/set", { tsigKeys });
}

export interface TechnitiumClusterNode {
  nodeId: number;
  nodeDomain: string;
  nodeIpAddresses: string[];
}

export interface TechnitiumClusterState {
  clusterInitialized: boolean;
  clusterDomain?: string;
  primaryNodeUrl?: string;
  nodes?: TechnitiumClusterNode[];
}

interface TechnitiumClusterApiNode {
  id?: number;
  name?: string;
  url?: string;
  ipAddresses?: string[];
  type?: string;
  state?: string;
}

interface TechnitiumClusterApiResponse {
  clusterInitialized: boolean;
  clusterDomain?: string;
  clusterNodes?: TechnitiumClusterApiNode[];
}

export async function getClusterState(
  config: TechnitiumClientConfig,
): Promise<TechnitiumClusterState> {
  const raw = await apiGet<TechnitiumClusterApiResponse>(config, "/api/admin/cluster/state", {
    includeServerIpAddresses: "true",
  });

  const primaryNode = raw.clusterNodes?.find(n => n.type === "Primary");
  const secondaryNodes = raw.clusterNodes?.filter(n => n.type === "Secondary") ?? [];

  return {
    clusterInitialized: raw.clusterInitialized,
    clusterDomain: raw.clusterDomain,
    primaryNodeUrl: primaryNode?.url,
    nodes: secondaryNodes.map(n => ({
      nodeId: n.id ?? 0,
      nodeDomain: n.name ?? "",
      nodeIpAddresses: n.ipAddresses ?? [],
    })),
  };
}

export async function forceLeaveCluster(config: TechnitiumClientConfig): Promise<void> {
  await apiGet(config, "/api/admin/cluster/secondary/leave", { forceLeave: "true" });
}

export async function deleteSecondaryNode(
  config: TechnitiumClientConfig,
  secondaryNodeId: number,
): Promise<void> {
  await apiGet(config, "/api/admin/cluster/primary/deleteSecondary", {
    secondaryNodeId: String(secondaryNodeId),
  });
}

export async function updateSecondaryNode(
  config: TechnitiumClientConfig,
  secondaryNodeId: number,
  secondaryNodeUrl: string,
  secondaryNodeIpAddresses: string,
  secondaryNodeCertificate: string,
): Promise<void> {
  await apiGet(config, "/api/admin/cluster/primary/updateSecondary", {
    secondaryNodeId: String(secondaryNodeId),
    secondaryNodeUrl,
    secondaryNodeIpAddresses,
    secondaryNodeCertificate,
  });
}

export async function getServerCertificateBase64Url(
  host: string,
  port: number,
): Promise<string> {
  const tls = await import("tls");
  return new Promise<string>((resolve, reject) => {
    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(false);
      socket.destroy();
      if (!cert?.raw) {
        reject(new Error(`No certificate received from ${host}:${port}`));
        return;
      }
      const b64url = cert.raw.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      resolve(b64url);
    });
    socket.on("error", reject);
  });
}

export async function initCluster(
  config: TechnitiumClientConfig,
  clusterDomain: string,
  primaryNodeIpAddresses: string,
): Promise<void> {
  await apiGet(config, "/api/admin/cluster/init", {
    clusterDomain,
    primaryNodeIpAddresses,
  });
}

export async function deleteCluster(config: TechnitiumClientConfig): Promise<void> {
  await apiGet(config, "/api/admin/cluster/primary/delete", {});
}

export async function updateClusterNodeIpAddresses(
  config: TechnitiumClientConfig,
  ipAddresses: string,
): Promise<void> {
  await apiGet(config, "/api/admin/cluster/updateIpAddresses", { ipAddresses });
}

export async function initJoinCluster(
  config: TechnitiumClientConfig,
  secondaryNodeIpAddresses: string,
  primaryNodeUrl: string,
  primaryNodeIpAddress: string,
  ignoreCertificateErrors: boolean,
  primaryNodeUsername: string,
  primaryNodePassword: string,
): Promise<void> {
  await apiPost(config, "/api/admin/cluster/initJoin", {
    secondaryNodeIpAddresses,
    primaryNodeUrl,
    primaryNodeIpAddress,
    ignoreCertificateErrors: ignoreCertificateErrors ? "true" : "false",
    primaryNodeUsername,
    primaryNodePassword,
  });
}

export async function leaveCluster(config: TechnitiumClientConfig): Promise<void> {
  await apiGet(config, "/api/admin/cluster/secondary/leave", {});
}

export async function resyncZone(
  config: TechnitiumClientConfig,
  zone: string,
): Promise<void> {
  await apiGet(config, "/api/zones/resync", { zone });
}

export async function listZones(
  config: TechnitiumClientConfig,
): Promise<Array<{ name: string; type: string }>> {
  const resp = await apiGet<{ zones: Array<{ name: string; type: string }> }>(
    config,
    "/api/zones/list",
    {},
  );
  return resp?.zones ?? [];
}

export async function deleteZoneIfExists(
  config: TechnitiumClientConfig,
  zone: string,
): Promise<void> {
  const zones = await listZones(config);
  const exists = zones.some(z => z.name === zone);
  if (exists) {
    await deleteZone(config, zone);
  }
}

export interface TechnitiumCatalogZoneOptionsInfo {
  zoneTransfer: string;
  zoneTransferTsigKeyNames: string[];
}

export async function getCatalogZoneOptions(
  config: TechnitiumClientConfig,
  zone: string,
): Promise<TechnitiumCatalogZoneOptionsInfo> {
  const resp = await apiGet<{ zoneTransfer?: string; zoneTransferTsigKeyNames?: string[] }>(
    config,
    "/api/zones/options/get",
    { zone, includeAvailableTsigKeyNames: "true" },
  );
  return {
    zoneTransfer: resp?.zoneTransfer ?? "Deny",
    zoneTransferTsigKeyNames: resp?.zoneTransferTsigKeyNames ?? [],
  };
}

export async function setCatalogZoneOptions(
  config: TechnitiumClientConfig,
  zone: string,
  options: Record<string, string | string[]>,
): Promise<void> {
  const token = await login(config);
  const url = new URL(`${config.serverUrl}/api/zones/options/set`);
  const params = new URLSearchParams({ token, zone });
  for (const [k, v] of Object.entries(options)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        params.append(k, item);
      }
    } else {
      params.append(k, v);
    }
  }
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!resp.ok) {
    throw new Error(`Technitium API /api/zones/options/set HTTP ${resp.status}`);
  }
  const data = await resp.json() as TechnitiumApiResponse;
  if (data.status !== "ok") {
    throw new Error(`Technitium API /api/zones/options/set error: ${data.errorMessage ?? data.status}`);
  }
}
