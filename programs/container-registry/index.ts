import * as pulumi from "@pulumi/pulumi";
import { DockerRegistryModule, ProxyRegistryConfig, DockerRegistryModuleArgs } from "../../src/modules/docker-registry";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config("container-registry");
const envStack = config.get("envStack") || "organization/environment/dev";

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

const [envOrg, envProject, envStackName] = envStack.split("/");
const envSecrets = getStackOutput(
  {
    organization: envOrg,
    project: envProject,
    stack: envStackName,
  },
  "secrets"
);

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
    result.password = envSecrets.apply((secrets: any) => secrets[proxy.passwordSecretKey]);
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
