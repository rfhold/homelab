import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {
  LiteLLM,
  LiteLLMProviderConfig,
  LiteLLMVllmConfig,
} from "../../src/components/litellm";

const config = new pulumi.Config("litellm");

const namespace = config.require("namespace");
const replicas = config.getNumber("replicas") ?? 1;

const httpRouteConfig = config.getObject<{
  enabled?: boolean;
  hostname: string;
  gatewayRef: {
    name: string;
    namespace: string;
  };
  requestTimeout?: string;
  annotations?: Record<string, string>;
}>("httpRoute");

const metricsConfig = config.getObject<{
  enabled?: boolean;
  scrapeInterval?: string;
}>("metrics");

const providersConfig = config.getObject<{
  openai?: Omit<LiteLLMProviderConfig, "apiKey">;
  anthropic?: Omit<LiteLLMProviderConfig, "apiKey">;
  cerebras?: Omit<LiteLLMProviderConfig, "apiKey">;
  chutes?: Omit<LiteLLMProviderConfig, "apiKey">;
}>("providers");

const vllmConfig = config.getObject<LiteLLMVllmConfig[]>("vllm");

const openaiKeyStash = new pulumi.Stash("openai-api-key", {
  input: pulumi.secret(process.env.OPENAI_API_KEY ?? ""),
});

const anthropicKeyStash = new pulumi.Stash("anthropic-api-key", {
  input: pulumi.secret(process.env.ANTHROPIC_API_KEY ?? ""),
});

const cerebrasKeyStash = new pulumi.Stash("cerebras-api-key", {
  input: pulumi.secret(process.env.CEREBRAS_API_KEY ?? ""),
});

const chutesKeyStash = new pulumi.Stash("chutes-api-key", {
  input: pulumi.secret(process.env.CHUTES_API_KEY ?? ""),
});

const masterKeyStash = process.env.LITELLM_MASTER_KEY
  ? new pulumi.Stash("litellm-master-key", {
      input: pulumi.secret(process.env.LITELLM_MASTER_KEY),
    })
  : undefined;

const ns = new k8s.core.v1.Namespace("litellm-namespace", {
  metadata: { name: namespace },
});

const litellm = new LiteLLM(
  "litellm",
  {
    namespace: ns.metadata.name,
    masterKey: masterKeyStash?.output,
    replicas,
    providers: {
      openai: providersConfig?.openai
        ? {
            ...providersConfig.openai,
            apiKey: openaiKeyStash.output,
          }
        : undefined,
      anthropic: providersConfig?.anthropic
        ? {
            ...providersConfig.anthropic,
            apiKey: anthropicKeyStash.output,
          }
        : undefined,
      cerebras: providersConfig?.cerebras
        ? {
            ...providersConfig.cerebras,
            apiKey: cerebrasKeyStash.output,
          }
        : undefined,
      chutes: providersConfig?.chutes
        ? {
            ...providersConfig.chutes,
            apiKey: chutesKeyStash.output,
          }
        : undefined,
    },
    vllm: vllmConfig,
    httpRoute: httpRouteConfig,
    metrics: metricsConfig,
  },
  { dependsOn: [ns] }
);

export const apiUrl = litellm.getApiUrl();
export const httpRouteUrl = litellm.getHttpRouteUrl();
export const serviceName = litellm.service.metadata.name;
