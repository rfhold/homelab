import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { K8sMonitoring } from "../../src/components/k8s-monitoring";
import { Mktxp } from "../../src/components/mktxp";
import { NvidiaDcgmExporter } from "../../src/components/nvidia-dcgm-exporter";

const config = new pulumi.Config("monitoring");

export const namespaceName = "collectors";

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const telemetryEndpoint = config.require("telemetryEndpoint");
const clusterName = config.require("clusterName");

interface AnnotationAutodiscoveryConfig {
  enabled: boolean;
  scrapeInterval?: string;
  scrapeTimeout?: string;
  pods?: {
    enabled?: boolean;
  };
  services?: {
    enabled?: boolean;
  };
}

interface PrometheusOperatorObjectsConfig {
  enabled: boolean;
  crds?: {
    deploy?: boolean;
  };
  serviceMonitors?: {
    enabled?: boolean;
    scrapeInterval?: string;
  };
  podMonitors?: {
    enabled?: boolean;
    scrapeInterval?: string;
  };
  probes?: {
    enabled?: boolean;
    scrapeInterval?: string;
  };
}

interface IntegrationInstance {
  name: string;
  namespaces?: string[];
  labelSelectors?: Record<string, string | string[]>;
}

interface IntegrationsConfig {
  grafana?: IntegrationInstance[];
  loki?: IntegrationInstance[];
  alloy?: IntegrationInstance[];
  mimir?: IntegrationInstance[];
}

const annotationAutodiscoveryConfig = config.getObject<AnnotationAutodiscoveryConfig>("annotationAutodiscovery") || {
  enabled: true,
  scrapeInterval: "60s",
  scrapeTimeout: "10s",
  pods: {
    enabled: true,
  },
  services: {
    enabled: true,
  },
};

const prometheusOperatorObjectsConfig = config.getObject<PrometheusOperatorObjectsConfig>("prometheusOperatorObjects") || {
  enabled: true,
  crds: {
    deploy: true,
  },
  serviceMonitors: {
    enabled: true,
    scrapeInterval: "60s",
  },
  podMonitors: {
    enabled: true,
    scrapeInterval: "60s",
  },
  probes: {
    enabled: true,
    scrapeInterval: "60s",
  },
};

const integrationsConfig = config.getObject<IntegrationsConfig>("integrations");

const alloyMetricsResources = config.getObject<{
  requests?: {
    cpu?: string;
    memory?: string;
  };
  limits?: {
    cpu?: string;
    memory?: string;
  };
}>("alloyMetricsResources");

const alloyLogsResources = config.getObject<{
  requests?: {
    cpu?: string;
    memory?: string;
  };
  limits?: {
    cpu?: string;
    memory?: string;
  };
}>("alloyLogsResources");

const alloyLogsExtraVolumes = config.getObject<Array<{
  name: string;
  hostPath: {
    path: string;
    type?: string;
  };
}>>("alloyLogsExtraVolumes");

const alloyLogsExtraMounts = config.getObject<Array<{
  name: string;
  mountPath: string;
  readOnly?: boolean;
}>>("alloyLogsExtraMounts");

const k8sMonitoring = new K8sMonitoring(
  "k8s-monitoring",
  {
    namespace: namespace.metadata.name,
    clusterName: clusterName,
    destinations: [
      {
        name: "otlp",
        type: "otlp",
        url: `http://${telemetryEndpoint}:4317`,
        protocol: "grpc",
      },
      {
        name: "prometheus",
        type: "prometheus",
        url: `http://${telemetryEndpoint}:9090/api/v1/metrics/write`,
      },
      {
        name: "loki",
        type: "loki",
        url: `http://${telemetryEndpoint}:3100/loki/api/v1/push`,
      },
    ],
    annotationAutodiscovery: annotationAutodiscoveryConfig,
    prometheusOperatorObjects: prometheusOperatorObjectsConfig,
    integrations: integrationsConfig,
    ...(alloyMetricsResources && { alloyMetricsResources }),
    ...(alloyLogsResources && { alloyLogsResources }),
    ...(alloyLogsExtraVolumes && { alloyLogsExtraVolumes }),
    ...(alloyLogsExtraMounts && { alloyLogsExtraMounts }),
  },
  { dependsOn: [namespace] }
);

interface MktxpRouterConfig {
  name: string;
  hostname: string;
  port?: number;
  username: string;
  poe?: boolean;
}

interface NvidiaDcgmExporterConfig {
  enabled?: boolean;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<{
    key?: string;
    operator?: string;
    value?: string;
    effect?: string;
  }>;
  runtimeClassName?: string;
  collectionInterval?: number;
  devices?: string;
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
}

const mktxpConfig = config.getObject<{
  enabled?: boolean;
  nodeSelector?: Record<string, string>;
  hostNetwork?: boolean;
  routers?: MktxpRouterConfig[];
}>("mktxp");

const nvidiaDcgmConfig = config.getObject<NvidiaDcgmExporterConfig>("nvidiaDcgm");

if (mktxpConfig?.enabled) {
  const mktxp = new Mktxp("mktxp", {
    namespace: namespace.metadata.name,
    routers: (mktxpConfig.routers || []).map(router => ({
      name: router.name,
      hostname: router.hostname,
      port: router.port || 8728,
      username: router.username,
      password: config.requireSecret(`mktxp.router.${router.name}.password`),
      dhcp: true,
      dhcpLease: true,
      wireless: true,
      capsman: true,
      capsmanClients: true,
      firewall: true,
      interface: true,
      routes: true,
      health: true,
      installedPackages: true,
      poe: router.poe ?? true,
      pool: true,
      monitor: true,
      netwatch: true,
      publicIp: true,
      user: true,
      dns: true,
      neighbor: true,
      connectionStats: true,
      addressList: "*",
      kidControlAssigned: true,
      checkForUpdates: true,
    })),
    nodeSelector: mktxpConfig.nodeSelector,
    hostNetwork: mktxpConfig.hostNetwork ?? true,
    dnsPolicy: mktxpConfig.hostNetwork ? "ClusterFirstWithHostNet" : undefined,
  }, { dependsOn: [namespace] });
}

if (nvidiaDcgmConfig?.enabled) {
  const dcgmExporter = new NvidiaDcgmExporter("dcgm-exporter", {
    namespace: namespace.metadata.name,
    nodeSelector: nvidiaDcgmConfig.nodeSelector,
    tolerations: nvidiaDcgmConfig.tolerations,
    runtimeClassName: nvidiaDcgmConfig.runtimeClassName,
    collectionInterval: nvidiaDcgmConfig.collectionInterval,
    devices: nvidiaDcgmConfig.devices,
    resources: nvidiaDcgmConfig.resources,
  }, { dependsOn: [namespace] });
}
