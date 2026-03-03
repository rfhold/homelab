import * as pulumi from "@pulumi/pulumi";
import { DockerRegistryModule, ProxyRegistryConfig, DockerRegistryModuleArgs } from "../../src/modules/docker-registry";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config("container-registry");

const namespace = config.require("namespace");

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

const proxyPasswordStashes = new Map<string, pulumi.Stash>();
for (const proxy of proxyRegistriesConfig as any[]) {
  const passwordSecretKey = proxy.passwordSecretKey as string | undefined;
  if (!passwordSecretKey || proxyPasswordStashes.has(passwordSecretKey)) {
    continue;
  }

  const envValue = process.env[passwordSecretKey];
  if (envValue === undefined) {
    throw new Error(`Environment variable ${passwordSecretKey} is not set`);
  }

  const stashName = `proxy-password-${passwordSecretKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  proxyPasswordStashes.set(
    passwordSecretKey,
    new pulumi.Stash(stashName, {
      input: pulumi.secret(envValue),
    })
  );
}

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
    if (!stash) {
      throw new Error(`No stash found for passwordSecretKey ${proxy.passwordSecretKey}`);
    }
    result.password = stash.output.apply(v => String(v));
    delete result.passwordSecretKey;
  }
  return result;
});

const registryModule = new DockerRegistryModule("container-registry", {
  namespace: namespace,
  privateRegistry: privateRegistryArgs,
  proxyRegistries: proxyRegistriesWithSecrets,
});

export const namespaceName = registryModule.namespace.metadata.name;
export const privateRegistryEndpoint = registryModule.privateRegistryEndpoint;
export const proxyRegistryEndpoints = registryModule.proxyRegistryEndpoints;
