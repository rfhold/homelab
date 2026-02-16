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

interface GlobalParamsConfig {
  buildkitAmd64Addr: string;
  buildkitArm64Addr: string;
  containerRegistry: string;
  giteaUrl: string;
}

interface AndroidKeystoreConfig {
  jks: string;
  password: string;
  alias: string;
}

const dashboardIngress = config.requireObject<IngressConfig>("dashboardIngress");
const pacIngress = config.requireObject<IngressConfig>("pacIngress");
const giteaConfig = config.requireObject<GiteaConfig>("gitea");
const giteaToken = config.requireSecret("giteaToken");
const globalParams = config.getObject<GlobalParamsConfig>("globalParams");
const androidKeystoreJks = config.getSecret("androidKeystore.jks");
const androidKeystorePassword = config.getSecret("androidKeystore.password");
const androidKeystoreAlias = config.get("androidKeystore.alias");

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
    globalParams: globalParams,
    androidKeystore: androidKeystoreJks && androidKeystorePassword && androidKeystoreAlias ? {
      jks: androidKeystoreJks,
      password: androidKeystorePassword,
      alias: androidKeystoreAlias,
    } : undefined,
  },
});

export const dashboardUrl = tekton.dashboardUrl;
export const pacWebhookUrl = tekton.pacWebhookUrl;
export const pacWebhookSecret = tekton.pacWebhookSecret;
