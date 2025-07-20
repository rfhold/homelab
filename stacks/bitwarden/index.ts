import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { BitwardenModule, BitwardenImplementation } from "../../src/modules/bitwarden";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("bitwarden", {
  metadata: {
    name: "bitwarden",
  },
});

const bitwarden = new BitwardenModule("bitwarden-service", {
  namespace: namespace.metadata.name,
  implementation: BitwardenImplementation.VAULTWARDEN,

  domain: config.get("domain") || "bitwarden.holdenitdown.net",

  admin: {
    token: config.get("admin-token"),
  },

  smtp: {
    enabled: config.getBoolean("smtp-enabled") || false,
    host: config.get("smtp-host"),
    from: config.get("smtp-from"),
    fromName: config.get("smtp-from-name") || "Vaultwarden",
    username: config.get("smtp-username"),
    password: config.get("smtp-password"),
    port: config.getNumber("smtp-port") || 587,
    security: (config.get("smtp-security") as "starttls" | "force_tls" | "off") || "starttls",
    acceptInvalidHostnames: config.getBoolean("smtp-accept-invalid-hostnames") || false,
    acceptInvalidCerts: config.getBoolean("smtp-accept-invalid-certs") || false,
  },

  ingress: {
    enabled: true,
    className: config.get("ingress-class") || "traefik",
    annotations: {
      "cert-manager.io/cluster-issuer": "letsencrypt-prod",
      "traefik.ingress.kubernetes.io/router.tls": "true",
    },
    tls: {
      enabled: true,
      secretName: config.get("tls-secret-name") || "bitwarden-tls",
    },
  },

  storage: {
    size: config.get("storage-size") || "10Gi",
    storageClass: config.get("storage-class"),
  },

  database: {
    storage: {
      size: config.get("database-storage-size") || "10Gi",
      storageClass: config.get("storage-class"),
    },
  },

  resources: {
    requests: {
      memory: config.get("memory-request") || "256Mi",
      cpu: config.get("cpu-request") || "100m",
    },
    limits: {
      memory: config.get("memory-limit") || "512Mi",
      cpu: config.get("cpu-limit") || "500m",
    },
  },
}, {
  dependsOn: [namespace],
});

export const bitwardenNamespace = namespace.metadata.name;
export const bitwardenServiceUrl = bitwarden.getServiceUrl();
export const adminToken = bitwarden.getAdminToken();
export const adminTokenHash = pulumi.secret(bitwarden.getAdminTokenHash());
export const postgresPassword = bitwarden.getPostgresPassword();
