import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DnsModule } from "../../src/modules/dns";

const config = new pulumi.Config();

// Read the encrypted origin password from config
const syncOriginPassword = config.requireSecret("sync-origin-password");

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
  password: string;
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

new DnsModule("dns", {
  namespace: "dns",

  adguardHome: {
    adminUsername: adguardHomeConfig.adminUsername,
    service: adguardHomeConfig.service,
    storage: adguardHomeConfig.storage,
    resources: adguardHomeConfig.resources,
  },

  sync: {
    enabled: syncConfig.enabled,
    mode: syncConfig.mode,
    origin: {
      ...syncConfig.origin,
      password: syncOriginPassword,
    },
    syncInterval: syncConfig.syncInterval,
    syncFeatures: syncConfig.syncFeatures,
    resources: syncConfig.resources,
  },
}, {
  dependsOn: [namespace],
});
