import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { GitModule, GitImplementation } from "../../src/modules/git";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("git", {
  metadata: {
    name: "git",
  },
});

const git = new GitModule("git-service", {
  namespace: namespace.metadata.name,
  implementation: GitImplementation.GITEA,

  domain: config.get("domain") || "git.homelab.local",

  admin: {
    username: config.get("admin-username") || "admin",
    email: config.get("admin-email") || "admin@homelab.local",
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
    },
  },

  ssh: {
    enabled: true,
    serviceType: "LoadBalancer",
    loadBalancerIP: config.get("ssh-load-balancer-ip") || "172.16.4.60",
    port: 22,
    annotations: {
      "metallb.io/allow-shared-ip": "local-ingress",
    },
  },

  storage: {
    size: config.get("storage-size") || "200Gi",
    storageClass: config.get("storage-class"),
  },

  database: {
    storage: {
      size: config.get("database-storage-size") || "20Gi",
      storageClass: config.get("storage-class"),
    },
  },

  cache: {
    storage: {
      size: config.get("cache-storage-size") || "5Gi",
      storageClass: config.get("storage-class"),
    },
  },

  resources: {
    requests: {
      memory: config.get("memory-request") || "512Mi",
      cpu: config.get("cpu-request") || "250m",
    },
    limits: {
      memory: config.get("memory-limit") || "2Gi",
      cpu: config.get("cpu-limit") || "1000m",
    },
  },
}, {
  dependsOn: [namespace],
});

export const gitNamespace = namespace.metadata.name;
export const gitServiceUrl = git.getServiceUrl();
export const adminPassword = git.getAdminPassword();
export const postgresPassword = git.getPostgresPassword();
export const valkeyPassword = git.getValkeyPassword();
