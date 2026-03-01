import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { GitModule } from "../../src/modules/git";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("forgejo", {
  metadata: {
    name: "forgejo",
  },
});

const sshLoadBalancerIP = config.get("ssh-load-balancer-ip");

const git = new GitModule("forgejo", {
  namespace: namespace.metadata.name,

  domain: config.get("domain") || "forgejo.homelab.local",

  admin: {
    username: config.get("admin-username") || "rfhold",
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

  ...(sshLoadBalancerIP && {
    ssh: {
      enabled: true,
      serviceType: "LoadBalancer",
      loadBalancerIP: sshLoadBalancerIP,
      port: 22,
      annotations: {
        "metallb.io/allow-shared-ip": "local-ingress",
      },
    },
  }),

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

  webhook: {
    allowedHostList: config.get("webhook-allowed-hosts"),
  },

  migrations: {
    allowedDomains: config.get("migrations-allowed-domains"),
  },
}, {
  dependsOn: [namespace],
});

export const forgejoNamespace = namespace.metadata.name;
export const forgejoServiceUrl = git.getServiceUrl();
export const adminPassword = git.getAdminPassword();
