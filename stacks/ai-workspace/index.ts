import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AIWorkspaceModule } from "../../src/modules/ai-workspace";

const config = new pulumi.Config();

const namespace = new k8s.core.v1.Namespace("ai-workspace", {
  metadata: {
    name: "ai-workspace",
  },
});

const aiWorkspace = new AIWorkspaceModule("ai-workspace", {
  namespace: namespace.metadata.name,
  searxng: {
    enabled: config.getBoolean("searxng.enabled") ?? true,
    baseUrl: config.get("searxng.baseUrl"),
    instanceName: config.get("searxng.instanceName") ?? "SearXNG",
    limiter: {
      enabled: config.getBoolean("searxng.limiter.enabled") ?? false,
    },
    search: {
      safeSearch: config.getNumber("searxng.search.safeSearch") ?? 0,
      autocomplete: config.get("searxng.search.autocomplete") ?? "duckduckgo",
      favicon: config.get("searxng.search.favicon") ?? "duckduckgo",
      formats: config.getObject<string[]>("searxng.search.formats") ?? ["html", "csv", "json", "rss"],
    },
    ui: {
      infiniteScroll: config.getBoolean("searxng.ui.infiniteScroll") ?? true,
      theme: config.get("searxng.ui.theme") ?? "simple",
      style: config.get("searxng.ui.style") ?? "dark",
      hotkeys: config.get("searxng.ui.hotkeys") ?? "vim",
    },
    engines: config.getObject<string[]>("searxng.engines"),
    resources: {
      requests: {
        memory: config.get("searxng.resources.requests.memory") ?? "256Mi",
        cpu: config.get("searxng.resources.requests.cpu") ?? "100m",
      },
      limits: {
        memory: config.get("searxng.resources.limits.memory") ?? "512Mi",
        cpu: config.get("searxng.resources.limits.cpu") ?? "500m",
      },
    },
    ingress: {
      enabled: config.getBoolean("searxng.ingress.enabled") ?? false,
      className: config.get("searxng.ingress.className"),
      host: config.require("searxng.ingress.host"),
      annotations: config.getObject<{[key: string]: string}>("searxng.ingress.annotations"),
      tls: {
        enabled: config.getBoolean("searxng.ingress.tls.enabled") ?? false,
        secretName: config.get("searxng.ingress.tls.secretName"),
      },
    },
  },
});

export const namespaceName = namespace.metadata.name;
export const searxngService = aiWorkspace.searxng?.service.metadata.name;