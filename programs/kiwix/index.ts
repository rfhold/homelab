import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { KiwixComponent } from "../../src/components/kiwix";

const config = new pulumi.Config();
const kiwixConfig = config.requireObject<{
  enabled: boolean;
  zimFiles?: string[];
  storage?: {
    size?: string;
    storageClass?: string;
  };
  resources?: {
    requests?: {
      memory?: string;
      cpu?: string;
    };
    limits?: {
      memory?: string;
      cpu?: string;
    };
  };
  ingress?: {
    enabled?: boolean;
    className?: string;
    host?: string;
    tls?: {
      enabled?: boolean;
      secretName?: string;
    };
  };
}>("kiwix");

const namespace = new k8s.core.v1.Namespace("kiwix", {
  metadata: {
    name: "kiwix",
  },
});

let kiwix: KiwixComponent | undefined;

if (kiwixConfig.enabled) {
  kiwix = new KiwixComponent("kiwix", {
    namespace: "kiwix",
    zimFiles: kiwixConfig.zimFiles,
    storage: kiwixConfig.storage,
    resources: kiwixConfig.resources,
    ingress:
      kiwixConfig.ingress?.enabled && kiwixConfig.ingress.host
        ? {
            enabled: true,
            className: kiwixConfig.ingress.className,
            host: kiwixConfig.ingress.host,
            tls: kiwixConfig.ingress.tls,
          }
        : undefined,
  });
}

export const kiwixUrl = kiwix?.url;
export const kiwixInternalUrl = kiwix
  ? pulumi.interpolate`http://${kiwix.service.metadata.name}.kiwix.svc.cluster.local:80`
  : undefined;
