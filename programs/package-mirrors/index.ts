import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { RookCephBucket } from "../../src/components/rook-ceph-bucket";
import { Athens } from "../../src/components/athens";
import { Verdaccio } from "../../src/components/verdaccio";
import { Kellnr } from "../../src/components/kellnr";
import { AptProxy } from "../../src/components/apt-proxy";
import { Pacoloco } from "../../src/components/pacoloco";
import { StorageConfig } from "../../src/adapters/storage";

const config = new pulumi.Config("package-mirrors");

const gatewayRef = config.requireObject<{ name: string; namespace: string }>("gatewayRef");
const hostname = config.require("hostname");
const aptHostname = config.require("aptHostname");
const bucketStorageClass = config.require("bucketStorageClass");

const kellnrConfig = config.requireObject<{
  dbStorage: StorageConfig;
}>("kellnr");

const aptProxyConfig = config.requireObject<{
  storage: StorageConfig;
}>("aptProxy");

const pacolocoConfig = config.requireObject<{
  storage: StorageConfig;
  repos: Record<string, { urls: string[] }>;
}>("pacoloco");

const ns = new k8s.core.v1.Namespace("package-mirrors", {
  metadata: { name: "package-mirrors" },
});
const namespaceName = ns.metadata.name;

const athensGoBucket = new RookCephBucket("athens-go", {
  name: "athens-go",
  namespace: namespaceName,
  storageClassName: bucketStorageClass,
  generateBucketName: "athens-go",
}, { dependsOn: [ns] });

const verdaccioNpmBucket = new RookCephBucket("verdaccio-npm", {
  name: "verdaccio-npm",
  namespace: namespaceName,
  storageClassName: bucketStorageClass,
  generateBucketName: "verdaccio-npm",
}, { dependsOn: [ns] });

const kellnrCratesBucket = new RookCephBucket("kellnr-crates", {
  name: "kellnr-crates",
  namespace: namespaceName,
  storageClassName: bucketStorageClass,
  generateBucketName: "kellnr-crates",
}, { dependsOn: [ns] });

const kellnrCratesIoBucket = new RookCephBucket("kellnr-cratesio", {
  name: "kellnr-cratesio",
  namespace: namespaceName,
  storageClassName: bucketStorageClass,
  generateBucketName: "kellnr-cratesio",
}, { dependsOn: [ns] });

const athens = new Athens("athens", {
  namespace: namespaceName,
  bucket: athensGoBucket,
  pathPrefix: "/go",
}, { dependsOn: [ns] });

const verdaccio = new Verdaccio("verdaccio", {
  namespace: namespaceName,
  bucket: verdaccioNpmBucket,
  urlPrefix: "/npm",
}, { dependsOn: [ns] });

const kellnr = new Kellnr("kellnr", {
  namespace: namespaceName,
  cratesBucket: kellnrCratesBucket,
  cratesIoBucket: kellnrCratesIoBucket,
  dbStorage: kellnrConfig.dbStorage,
  originPath: "/cargo",
}, { dependsOn: [ns] });

const aptProxy = new AptProxy("apt-proxy", {
  namespace: namespaceName,
  storage: aptProxyConfig.storage,
  gatewayRef,
  hostname: aptHostname,
}, { dependsOn: [ns] });

const pacoloco = new Pacoloco("pacoloco", {
  namespace: namespaceName,
  storage: pacolocoConfig.storage,
  repos: pacolocoConfig.repos,
}, { dependsOn: [ns] });

const mirrorsRoute = new k8s.apiextensions.CustomResource("mirrors-route", {
  apiVersion: "gateway.networking.k8s.io/v1",
  kind: "HTTPRoute",
  metadata: {
    name: "mirrors-route",
    namespace: namespaceName,
  },
  spec: {
    parentRefs: [{
      name: gatewayRef.name,
      namespace: gatewayRef.namespace,
    }],
    hostnames: [hostname],
    rules: [
      {
        matches: [{ path: { type: "PathPrefix", value: "/go" } }],
        backendRefs: [{
          name: athens.service.metadata.name,
          kind: "Service",
          port: 3000,
        }],
      },
      {
        matches: [{ path: { type: "PathPrefix", value: "/npm" } }],
        filters: [{
          type: "URLRewrite",
          urlRewrite: {
            path: {
              type: "ReplacePrefixMatch",
              replacePrefixMatch: "/",
            },
          },
        }],
        backendRefs: [{
          name: verdaccio.service.metadata.name,
          kind: "Service",
          port: 4873,
        }],
      },
      {
        matches: [{ path: { type: "PathPrefix", value: "/cargo" } }],
        backendRefs: [{
          name: kellnr.service.metadata.name,
          kind: "Service",
          port: 8000,
        }],
      },
      {
        matches: [{ path: { type: "PathPrefix", value: "/pacman" } }],
        filters: [{
          type: "URLRewrite",
          urlRewrite: {
            path: {
              type: "ReplacePrefixMatch",
              replacePrefixMatch: "/",
            },
          },
        }],
        backendRefs: [{
          name: pacoloco.service.metadata.name,
          kind: "Service",
          port: 9129,
        }],
      },
    ],
  },
}, { dependsOn: [athens.service, verdaccio.service, kellnr.service, pacoloco.service] });

export const namespace = namespaceName;
export const mirrorsHostname = hostname;
export const aptMirrorsHostname = aptHostname;
