import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { BambuRemoteModule } from "../../src/modules/bambu-remote";

// This program deploys a complete 3D printer management solution using Bambu Lab X1 Carbon
// The BambuRemoteModule integrates go2rtc for streaming the printer's RTSP feed and 
// OctoPrint for comprehensive print management, monitoring, and control
// Configuration required:
// - x1-host: IP address of the Bambu printer
// - x1-access-code: Printer access code
// - x1-serial-number: Printer serial number
// - ingress: Ingress configuration for accessing OctoPrint web interface
// - storage: Storage configuration for persistent volumes (OctoPrint data and go2rtc cache)
// - deployment: Node selector and placement configuration
// - x1plus: X1 Plus integration configuration

const config = new pulumi.Config("3d-printer");

interface IngressConfig {
  enabled: boolean;
  className: string;
  octoprintHostname: string;
  go2rtcHostname?: string;
  annotations?: { [key: string]: string };
  tls?: {
    enabled: boolean;
    secretName: string;
  };
}

interface StorageConfig {
  octoprintSize: string;
  go2rtcSize?: string;
  storageClass?: string;
}

interface DeploymentConfig {
  nodeSelector?: { [key: string]: string };
}

interface X1PlusConfig {
  enabled: boolean;
  privateKey?: string;
  knownHosts?: string;
}

const x1Host = config.requireSecret("x1-host");
const x1AccessCode = config.requireSecret("x1-access-code");

const ingressConfig = config.requireObject<IngressConfig>("ingress");
const storageConfig = config.requireObject<StorageConfig>("storage");

const namespace = new k8s.core.v1.Namespace("3d-printer", {
  metadata: {
    name: "3d-printer",
    labels: {
      name: "3d-printer",
      "app.kubernetes.io/name": "3d-printer",
    },
  },
});

const x1Carbon = new BambuRemoteModule("x1-carbon", {
  namespace: namespace.metadata.name,
  printers: [{
    printerIp: x1Host,
    accessCode: x1AccessCode,
    printerName: "x1_carbon",
  }],
  go2rtc: {
    replicas: 1,
    networkMode: "standard",
    resources: {
      requests: {
        memory: "256Mi",
        cpu: "200m",
      },
      limits: {
        memory: "1Gi",
        cpu: "1000m",
      },
    },
    ingress: ingressConfig.go2rtcHostname ? {
      enabled: true,
      className: ingressConfig.className,
      host: ingressConfig.go2rtcHostname,
      annotations: ingressConfig.annotations,
      tls: ingressConfig.tls?.enabled ? {
        enabled: ingressConfig.tls.enabled,
        secretName: "bambu-rtc-tls",
      } : undefined,
    } : undefined,
  },
  octoprint: {
    enabled: true,
    storage: {
      size: storageConfig.octoprintSize,
      storageClass: storageConfig.storageClass,
      accessModes: ["ReadWriteOnce"],
    },
    resources: {
      requests: {
        memory: "512Mi",
        cpu: "500m",
      },
      limits: {
        memory: "2Gi",
        cpu: "2000m",
      },
    },
    config: {
      enableMjpgStreamer: false,
      autoMigrate: false,
      timezone: "UTC",
      serverPort: 80,
    },
    ingress: {
      enabled: true,
      className: ingressConfig.className,
      host: ingressConfig.octoprintHostname,
      annotations: ingressConfig.annotations,
      tls: ingressConfig.tls,
    },
  },
}, {
  dependsOn: [namespace],
});

export const namespaceName = namespace.metadata.name;
export const hlsStreamUrl = x1Carbon.getHlsStreamUrl("x1_carbon");
export const webRTCViewerUrl = x1Carbon.getWebRTCViewerUrl("x1_carbon");
export const snapshotUrl = x1Carbon.getSnapshotUrl("x1_carbon");
export const mp4StreamUrl = pulumi.interpolate`${x1Carbon.getApiEndpoint()}/stream.mp4?src=x1_carbon`;
export const mjpegStreamUrl = x1Carbon.getMjpegStreamUrl("x1_carbon");
export const apiEndpoint = x1Carbon.getApiEndpoint();

export const octoprintWebInterface = x1Carbon.getOctoPrintWebInterface();
export const octoprintMjpegStream = x1Carbon.getOctoPrintMjpegStream();
export const octoprintServiceName = x1Carbon.getOctoPrintServiceName();
export const webcamStreamConfig = x1Carbon.configureWebcamStream("x1_carbon");
