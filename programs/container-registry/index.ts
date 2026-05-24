import * as pulumi from "@pulumi/pulumi";
import { DockerRegistryModule, ProxyRegistryConfig, DockerRegistryModuleArgs } from "../../src/modules/docker-registry";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config("container-registry");

const namespace = config.require("namespace");
const workloadLabels = config.getObject<Record<string, Record<string, string>>>("workloadLabels") ?? {};

const privateRegistryConfig = config.getObject<{
  enabled?: boolean;
  objectStoreStack: string;
  objectStoreName?: string;
  bucket: string;
  user: string;
  region?: string;
  rootDirectory?: string;
  serviceType?: string;
  serviceAnnotations?: { [key: string]: string };
  tls?: {
    secretName?: string;
    dnsNames?: string[];
    issuerRef?: string;
    duration?: string;
    renewBefore?: string;
  };
  resources?: {
    requests?: {
      memory?: string;
      cpu?: string;
    };
    limits?: {
      memory?: string;
      cpu?: string;
    };
  };
}>("private-registry");

const proxyRegistriesConfig = config.getObject<ProxyRegistryConfig[]>("proxy-registries") || [];

const zotRegistryConfig = config.getObject<{
  enabled?: boolean;
  objectStoreStack: string;
  objectStoreName?: string;
  bucket: string;
  user: string;
  region?: string;
  rootDirectory?: string;
  serviceType?: string;
  serviceAnnotations?: { [key: string]: string };
  tls?: {
    secretName?: string;
    dnsNames?: string[];
    issuerRef?: string;
    duration?: string;
    renewBefore?: string;
  };
  resources?: {
    requests?: { memory?: string; cpu?: string };
    limits?: { memory?: string; cpu?: string };
  };
}>("zot-registry");

const proxyPasswordStashes = new Map<string, pulumi.Stash>();
for (const proxy of proxyRegistriesConfig as any[]) {
  const passwordSecretKey = proxy.passwordSecretKey as string | undefined;
  if (!passwordSecretKey || proxyPasswordStashes.has(passwordSecretKey)) {
    continue;
  }

  const stashName = `proxy-password-${passwordSecretKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  proxyPasswordStashes.set(
    passwordSecretKey,
    new pulumi.Stash(stashName, {
      input: pulumi.secret(process.env[passwordSecretKey] ?? ""),
    })
  );
}

const dockerHubPasswordStash = new pulumi.Stash("zot-dockerhub-password", {
  input: pulumi.secret(process.env["DOCKERHUB_PASSWORD"] ?? ""),
});

const githubTokenStash = new pulumi.Stash("zot-github-token", {
  input: pulumi.secret(process.env["GITHUB_TOKEN"] ?? ""),
});

let privateRegistryArgs: DockerRegistryModuleArgs["privateRegistry"] | undefined;

if (privateRegistryConfig && privateRegistryConfig.enabled !== false) {
  const objectStoreName = privateRegistryConfig.objectStoreName || "default";
  const userName = privateRegistryConfig.user;
  const stackRef = privateRegistryConfig.objectStoreStack;
  const [org, project, stack] = stackRef.split("/");

  const objectStores = getStackOutput(
    {
      organization: org,
      project: project,
      stack: stack,
    },
    "objectStores"
  );

  const objectStoreData = objectStores.apply((stores: any) => {
    const store = stores[objectStoreName];
    const user = store.users[userName];
    return {
      endpoint: store.endpoint,
      accessKey: user.accessKey,
      secretKey: user.secretKey,
    };
  });

  privateRegistryArgs = {
    s3: {
      endpoint: objectStoreData.apply(d => d.endpoint),
      bucket: privateRegistryConfig.bucket,
      accessKey: objectStoreData.apply(d => d.accessKey),
      secretKey: objectStoreData.apply(d => d.secretKey),
      region: privateRegistryConfig.region || "us-east-1",
      rootDirectory: privateRegistryConfig.rootDirectory,
    },
    serviceType: privateRegistryConfig.serviceType,
    serviceAnnotations: privateRegistryConfig.serviceAnnotations,
    tls: privateRegistryConfig.tls,
    resources: privateRegistryConfig.resources,
  };
}

const proxyRegistriesWithSecrets = proxyRegistriesConfig.map((proxy: any) => {
  const result = { ...proxy };
  if (proxy.passwordSecretKey) {
    const stash = proxyPasswordStashes.get(proxy.passwordSecretKey);
    result.password = stash?.output.apply(v => String(v));
    delete result.passwordSecretKey;
  }
  return result;
});

let zotRegistryArgs: DockerRegistryModuleArgs["zotRegistry"] | undefined;

if (zotRegistryConfig && zotRegistryConfig.enabled !== false) {
  const objectStoreName = zotRegistryConfig.objectStoreName || "default";
  const userName = zotRegistryConfig.user;
  const stackRef = zotRegistryConfig.objectStoreStack;
  const [org, project, stack] = stackRef.split("/");

  const objectStores = getStackOutput(
    {
      organization: org,
      project: project,
      stack: stack,
    },
    "objectStores"
  );

  const objectStoreData = objectStores.apply((stores: any) => {
    const store = stores[objectStoreName];
    const user = store.users[userName];
    return {
      endpoint: store.endpoint,
      accessKey: user.accessKey,
      secretKey: user.secretKey,
    };
  });

  zotRegistryArgs = {
    s3: {
      endpoint: objectStoreData.apply(d => d.endpoint),
      bucket: zotRegistryConfig.bucket,
      accessKey: objectStoreData.apply(d => d.accessKey),
      secretKey: objectStoreData.apply(d => d.secretKey),
      region: zotRegistryConfig.region || "us-east-1",
      rootDirectory: zotRegistryConfig.rootDirectory,
    },
    sync: {
      dockerHub: {
        username: "rfhold",
        password: dockerHubPasswordStash.output.apply(v => String(v)),
      },
      github: {
        username: "token",
        password: githubTokenStash.output.apply(v => String(v)),
      },
    },
    serviceType: zotRegistryConfig.serviceType,
    serviceAnnotations: zotRegistryConfig.serviceAnnotations,
    tls: zotRegistryConfig.tls,
    resources: zotRegistryConfig.resources,
  };
}

const registryModule = new DockerRegistryModule("container-registry", {
  namespace: namespace,
  workloadLabels: workloadLabels["container-registry"],
  privateRegistry: privateRegistryArgs,
  proxyRegistries: proxyRegistriesWithSecrets,
  zotRegistry: zotRegistryArgs,
});

export const namespaceName = registryModule.namespace.metadata.name;
export const privateRegistryEndpoint = registryModule.privateRegistryEndpoint;
export const proxyRegistryEndpoints = registryModule.proxyRegistryEndpoints;
export const zotRegistryEndpoint = registryModule.zotRegistryEndpoint;
