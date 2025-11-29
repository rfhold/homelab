import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Frigate } from "../../src/components/frigate";
import { Coturn } from "../../src/components/coturn";

const config = new pulumi.Config("nvr");

interface CameraConfig {
  name: string;
  enabled: boolean;
  detectWidth: number;
  detectHeight: number;
  detectFps: number;
  recordEnabled: boolean;
  snapshotsEnabled: boolean;
  detectEnabled?: boolean;
  objects?: string[];
  retention?: {
    recordDays?: number;
    snapshotsDays?: number;
  };
}

interface IngressConfig {
  enabled: boolean;
  className: string;
  annotations?: { [key: string]: string };
}

interface ServiceConfig {
  type?: string;
  annotations?: { [key: string]: string };
}

interface ResourceConfig {
  requests: {
    memory: string;
    cpu: string;
  };
  limits: {
    memory: string;
    cpu: string;
  };
}

interface HardwareAccelerationConfig {
  intel: {
    enabled: boolean;
    devicePath: string;
    renderGroup?: number;
  };
}

interface RetentionConfig {
  global: {
    recordDays: number;
    snapshotsDays: number;
  };
}

interface FrigateStackConfig {
  hostname: string;
  timezone: string;
  configStorage: {
    storageClass: string;
    size: string;
  };
  mediaStorage: {
    nfs: {
      server: string;
      path: string;
      readOnly: boolean;
    };
    size: string;
  };
  cameras: CameraConfig[];
  ingress: IngressConfig;
  service?: ServiceConfig;
  resources: ResourceConfig;
  sharedMemorySize: string;
  hardwareAcceleration: HardwareAccelerationConfig;
  retention: RetentionConfig;
  go2rtc?: {
    webrtcCandidates?: string[];
  };
}

interface MqttConfig {
  host: string;
  port: number;
}

interface CoturnConfig {
  realm: string;
  hostname: string;
  tls?: {
    enabled?: boolean;
    clusterIssuer?: string;
  };
  service?: {
    type?: string;
    annotations?: { [key: string]: string };
    loadBalancerIP?: string;
  };
}

const frigateConfig = config.requireObject<FrigateStackConfig>("frigate");
const mqttConfig = config.requireObject<MqttConfig>("mqtt");
const coturnConfig = config.requireObject<CoturnConfig>("coturn");

const rtspPassword = config.requireSecret("secrets.rtspPassword");
const mqttUsername = config.requireSecret("secrets.mqttCredentials.username");
const mqttPassword = config.requireSecret("secrets.mqttCredentials.password");

const namespace = new k8s.core.v1.Namespace("nvr", {
  metadata: {
    name: "nvr",
  },
});

const coturn = new Coturn("coturn", {
  namespace: namespace.metadata.name,
  realm: coturnConfig.realm,
  tls: coturnConfig.tls?.enabled ? {
    enabled: true,
    certificate: {
      dnsNames: [coturnConfig.hostname],
      issuerRef: coturnConfig.tls.clusterIssuer!,
    },
  } : undefined,
  service: coturnConfig.service ? {
    type: coturnConfig.service.type,
    annotations: coturnConfig.service.annotations,
    loadBalancerIP: coturnConfig.service.loadBalancerIP,
  } : undefined,
}, {
  dependsOn: [namespace],
});

const cameras = frigateConfig.cameras.reduce((acc, camera) => {
  if (camera.enabled) {
    acc[camera.name] = {
      streamUrl: config.requireSecret(`secrets.cameras.${camera.name}.streamUrl`),
      detect: {
        width: camera.detectWidth,
        height: camera.detectHeight,
        fps: camera.detectFps,
      },
      retention: {
        recordDays: camera.retention?.recordDays,
        snapshotDays: camera.retention?.snapshotsDays,
      },
      detectEnabled: camera.detectEnabled,
      objects: camera.objects,
      enabled: true,
    };
  }
  return acc;
}, {} as Record<string, any>);

const frigate = new Frigate("frigate", {
  namespace: namespace.metadata.name,

  cameras,

  retention: {
    recordDays: frigateConfig.retention.global.recordDays,
    snapshotDays: frigateConfig.retention.global.snapshotsDays,
  },

  hardwareAcceleration: frigateConfig.hardwareAcceleration.intel.enabled ? {
    type: "intel" as const,
    devicePath: frigateConfig.hardwareAcceleration.intel.devicePath,
    renderGroup: frigateConfig.hardwareAcceleration.intel.renderGroup,
  } : undefined,

  mqtt: {
    host: mqttConfig.host,
    port: mqttConfig.port || 1883,
    username: mqttUsername,
    password: mqttPassword,
  },

  rtspRestream: {
    enabled: true,
    password: rtspPassword,
    webrtcCandidates: frigateConfig.go2rtc?.webrtcCandidates,
    iceServers: [
      {
        urls: ["stun:stun.l.google.com:19302"],
      },
      {
        urls: [`turn:${coturnConfig.hostname}:3478`, `turns:${coturnConfig.hostname}:5349`],
        username: "frigate",
        credential: coturn.authSecret,
      },
    ],
  },

  timezone: frigateConfig.timezone,

  configStorage: {
    size: frigateConfig.configStorage.size,
    storageClass: frigateConfig.configStorage.storageClass,
  },

  mediaStorage: {
    size: frigateConfig.mediaStorage.size,
    nfs: {
      server: frigateConfig.mediaStorage.nfs.server,
      path: frigateConfig.mediaStorage.nfs.path,
      readOnly: frigateConfig.mediaStorage.nfs.readOnly,
    },
  },

  sharedMemorySize: frigateConfig.sharedMemorySize,

  resources: frigateConfig.resources,

  ingress: frigateConfig.ingress.enabled ? {
    enabled: true,
    className: frigateConfig.ingress.className,
    host: frigateConfig.hostname,
    annotations: {
      ...frigateConfig.ingress.annotations,
    },
    tls: frigateConfig.ingress.annotations?.["cert-manager.io/cluster-issuer"] ? {
      enabled: true,
      secretName: "frigate-tls",
    } : undefined,
  } : undefined,

  service: frigateConfig.service ? {
    type: frigateConfig.service.type,
    annotations: frigateConfig.service.annotations,
  } : undefined,
}, {
  dependsOn: [namespace, coturn],
});

export const namespaceName = namespace.metadata.name;
export const frigateDeploymentName = frigate.deployment.metadata.name;
export const frigateServiceName = frigate.service.metadata.name;
export const frigateConfigMapName = frigate.configMap.metadata.name;
export const frigateConfigPvcName = frigate.configPvc.metadata.name;
export const frigateMediaPvcName = frigate.mediaPvc?.metadata.name;
export const frigateIngressName = frigate.ingress?.metadata.name;

export const serviceEndpoints = {
  webUI: frigate.getWebUIEndpoint(),
  api: frigate.getApiEndpoint(),
  rtsp: frigate.getRtspEndpoint(),
  go2rtc: frigate.getGo2RTCEndpoint(),
};

export const ingressUrl = frigateConfig.ingress.enabled ?
  pulumi.interpolate`https://${frigateConfig.hostname}` :
  undefined;

export const storageInfo = {
  configPvc: {
    name: frigate.configPvc.metadata.name,
    size: frigateConfig.configStorage.size,
    storageClass: frigateConfig.configStorage.storageClass,
  },
  mediaPvc: frigate.mediaPvc ? {
    name: frigate.mediaPvc.metadata.name,
    size: frigateConfig.mediaStorage.size,
    nfsServer: frigateConfig.mediaStorage.nfs.server,
    nfsPath: frigateConfig.mediaStorage.nfs.path,
  } : undefined,
};

export const cameraInfo = frigateConfig.cameras.map(camera => ({
  name: camera.name,
  enabled: camera.enabled,
  detectResolution: `${camera.detectWidth}x${camera.detectHeight}`,
  detectFps: camera.detectFps,
  recordEnabled: camera.recordEnabled,
  snapshotsEnabled: camera.snapshotsEnabled,
  retention: {
    recordDays: camera.retention?.recordDays ?? frigateConfig.retention.global.recordDays,
    snapshotsDays: camera.retention?.snapshotsDays ?? frigateConfig.retention.global.snapshotsDays,
  },
  streamName: camera.name.replace(/[^a-zA-Z0-9]/g, '_'),
}));

export const hardwareAcceleration = {
  enabled: frigateConfig.hardwareAcceleration.intel.enabled,
  devicePath: frigateConfig.hardwareAcceleration.intel.devicePath,
  renderGroup: frigateConfig.hardwareAcceleration.intel.renderGroup,
};

export const retentionConfig = {
  global: frigateConfig.retention.global,
};

export const coturnDeploymentName = coturn.deployment.metadata.name;
export const coturnServiceName = coturn.service?.metadata.name;
export const coturnStunUrl = coturn.getStunUrl(coturnConfig.hostname);
export const coturnTurnUrl = coturn.getTurnUrl(coturnConfig.hostname);
export const coturnTurnsUrl = coturnConfig.tls?.enabled ? coturn.getTurnsUrl(coturnConfig.hostname) : undefined;
