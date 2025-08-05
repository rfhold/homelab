import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DnsModule } from "../../src/modules/dns";

const config = new pulumi.Config();

interface AdguardHomeServiceConfig {
  type: string;
  annotations?: { [key: string]: string };
  ports: {
    dns: number;
    dnsUdp: number;
    webUi: number;
  };
}



interface AdguardHomeStorageConfig {
  size: string;
  storageClass?: string;
}

interface AdguardHomeResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface AdguardHomeSyncOriginConfig {
  url: string;
  username: string;
  passwordSecret: string;
}

interface AdguardHomeSyncFeaturesConfig {
  generalSettings: boolean;
  filters: boolean;
  dhcp: boolean;
  clients: boolean;
  queryLogConfig: boolean;
  statsConfig: boolean;
  accessLists: boolean;
  rewrites: boolean;
}

// Parse structured configuration
const adguardHomeConfig = config.requireObject<{
  adminUsername: string;
  adminPasswordSecret: string;
  service: AdguardHomeServiceConfig;
  storage: AdguardHomeStorageConfig;
  resources: AdguardHomeResourceConfig;
}>("adguardHome");

const syncConfig = config.requireObject<{
  enabled: boolean;
  mode: "origin" | "target";
  origin: AdguardHomeSyncOriginConfig;
  syncInterval: string;
  syncFeatures: AdguardHomeSyncFeaturesConfig;
  resources: AdguardHomeResourceConfig;
}>("sync");

const namespace = new k8s.core.v1.Namespace("dns", {
  metadata: {
    name: "dns",
  },
});

new DnsModule("dns-infrastructure", {
  namespace: "dns",
  
  adguardHome: {
    adminUsername: adguardHomeConfig.adminUsername,
    adminPasswordSecret: adguardHomeConfig.adminPasswordSecret,
    service: adguardHomeConfig.service,
    storage: adguardHomeConfig.storage,
    resources: adguardHomeConfig.resources,
  },
  
  sync: {
    enabled: syncConfig.enabled,
    mode: syncConfig.mode,
    origin: syncConfig.origin,
    syncInterval: syncConfig.syncInterval,
    syncFeatures: syncConfig.syncFeatures,
    resources: syncConfig.resources,
  },
}, {
  dependsOn: [namespace],
});