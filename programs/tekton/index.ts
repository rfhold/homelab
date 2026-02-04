import * as pulumi from "@pulumi/pulumi";
import { Tekton } from "../../src/components/tekton";

const config = new pulumi.Config("tekton");

interface IngressConfig {
  enabled: boolean;
  className: string;
  host: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName: string;
  };
}

interface GiteaConfig {
  host: string;
  repositories?: string[];
}

const dashboardIngress = config.requireObject<IngressConfig>("dashboardIngress");
const pacIngress = config.requireObject<IngressConfig>("pacIngress");
const giteaConfig = config.requireObject<GiteaConfig>("gitea");
const giteaToken = config.requireSecret("giteaToken");

const tekton = new Tekton("tekton", {
  dashboard: {
    ingress: dashboardIngress,
  },
  pac: {
    ingress: pacIngress,
    gitea: {
      host: giteaConfig.host,
      token: giteaToken,
      repositories: giteaConfig.repositories,
    },
  },
});

export const dashboardUrl = tekton.dashboardUrl;
export const pacWebhookUrl = tekton.pacWebhookUrl;
export const pacWebhookSecret = tekton.pacWebhookSecret;
