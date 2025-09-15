import * as pulumi from "@pulumi/pulumi";
import { Go2RTC } from "../components/go2rtc";
import { OctoPrint } from "../components/octoprint";
import { StorageConfig } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface BambuRemoteModuleArgs {
  namespace: pulumi.Input<string>;

  printers: {
    printerIp: pulumi.Input<string>;
    accessCode: pulumi.Input<string>;
    printerName?: pulumi.Input<string>;
  }[];

  go2rtc?: {
    replicas?: pulumi.Input<number>;
    networkMode?: "host" | "standard";
    hardware?: {
      type?: "intel" | "nvidia" | "rockchip";
      devicePath?: pulumi.Input<string>;
      renderGroup?: number;
      nvidiaVisibleDevices?: pulumi.Input<string>;
    };
    resources?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    service?: {
      type?: pulumi.Input<string>;
      annotations?: pulumi.Input<{ [key: string]: string }>;
    };
    ingress?: {
      enabled?: pulumi.Input<boolean>;
      className?: pulumi.Input<string>;
      host: pulumi.Input<string>;
      annotations?: pulumi.Input<{ [key: string]: string }>;
      tls?: {
        enabled?: pulumi.Input<boolean>;
        secretName?: pulumi.Input<string>;
      };
    };
  };

  octoprint?: {
    enabled?: pulumi.Input<boolean>;
    storage?: StorageConfig;
    resources?: {
      requests?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
      limits?: {
        memory?: pulumi.Input<string>;
        cpu?: pulumi.Input<string>;
      };
    };
    config?: {
      enableMjpgStreamer?: pulumi.Input<boolean>;
      autoMigrate?: pulumi.Input<boolean>;
      timezone?: pulumi.Input<string>;
      serverHost?: pulumi.Input<string>;
      serverPort?: pulumi.Input<number>;
    };
    ingress?: {
      enabled?: pulumi.Input<boolean>;
      className?: pulumi.Input<string>;
      host: pulumi.Input<string>;
      annotations?: pulumi.Input<{ [key: string]: string }>;
      tls?: {
        enabled?: pulumi.Input<boolean>;
        secretName?: pulumi.Input<string>;
      };
    };
  };
}

export class BambuRemoteModule extends pulumi.ComponentResource {
  public readonly go2rtc: Go2RTC;
  public readonly octoprint?: OctoPrint;
  private readonly printers: {
    printerIp: pulumi.Input<string>;
    accessCode: pulumi.Input<string>;
    printerName?: pulumi.Input<string>;
  }[];

  constructor(name: string, args: BambuRemoteModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:BambuRemote", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };
    this.printers = args.printers;

    const streams = pulumi.all(args.printers).apply(printers => {
      const streamConfig: { [streamName: string]: string[] } = {};

      printers.forEach((printer, index) => {
        const printerName = printer.printerName || `bambu_printer_${index + 1}`;
        const rtspUrl = `rtsps://bblp:${printer.accessCode}@${printer.printerIp}:322/streaming/live/1`;
        streamConfig[printerName] = [rtspUrl];
      });

      return streamConfig;
    });

    this.go2rtc = new Go2RTC(`${name}-go2rtc`, {
      namespace: args.namespace,
      streams: streams,

      hls: {
        enabled: true,
        segment: 2,
        count: 6,
        part: 1,
      },

      api: {
        username: "",
        password: "",
      },

      webrtc: {
        candidates: ["localhost:8555"],
      },

      networkMode: args.go2rtc?.networkMode || "standard",
      replicas: args.go2rtc?.replicas || 1,
      hardware: args.go2rtc?.hardware,
      resources: args.go2rtc?.resources || {
        requests: {
          memory: "256Mi",
          cpu: "200m",
        },
        limits: {
          memory: "1Gi",
          cpu: "1000m",
        },
      },
      service: args.go2rtc?.service,
      ingress: args.go2rtc?.ingress,
    }, defaultResourceOptions);

    if (args.octoprint?.enabled !== false) {
      const storageConfig: StorageConfig = args.octoprint?.storage || {
        size: "15Gi",
        accessModes: ["ReadWriteOnce"],
      };

      this.octoprint = new OctoPrint(`${name}-octoprint`, {
        namespace: args.namespace,
        image: DOCKER_IMAGES.OCTOPRINT_BAMBU.image,
        storage: storageConfig,
        resources: args.octoprint?.resources || {
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
          enableMjpgStreamer: args.octoprint?.config?.enableMjpgStreamer !== false,
          autoMigrate: args.octoprint?.config?.autoMigrate || false,
          timezone: args.octoprint?.config?.timezone || "UTC",
          serverHost: args.octoprint?.config?.serverHost,
          serverPort: args.octoprint?.config?.serverPort || 80,
        },
        ingress: args.octoprint?.ingress,
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      go2rtc: this.go2rtc,
      octoprint: this.octoprint,
    });
  }

  public getHlsStreamUrl(printerName?: string): pulumi.Output<string> {
    const streamName = printerName || "bambu_printer_1";
    return pulumi.interpolate`${this.go2rtc.getApiEndpoint()}/stream.m3u8?src=${streamName}`;
  }

  public getWebRTCViewerUrl(printerName?: string): pulumi.Output<string> {
    const streamName = printerName || "bambu_printer_1";
    return pulumi.interpolate`${this.go2rtc.getWebUIEndpoint()}/stream.html?src=${streamName}`;
  }

  public getApiEndpoint(): pulumi.Output<string> {
    return this.go2rtc.getApiEndpoint();
  }

  public getWebRTCEndpoint(): pulumi.Output<string> {
    return this.go2rtc.getWebRTCEndpoint();
  }

  public getMjpegStreamUrl(printerName?: string): pulumi.Output<string> {
    const streamName = printerName || "bambu_printer_1";
    return pulumi.interpolate`${this.go2rtc.getApiEndpoint()}/stream.mjpeg?src=${streamName}`;
  }

  public getSnapshotUrl(printerName?: string): pulumi.Output<string> {
    const streamName = printerName || "bambu_printer_1";
    return pulumi.interpolate`${this.go2rtc.getApiEndpoint()}/frame.jpeg?src=${streamName}`;
  }

  public getStreamList(): pulumi.Output<string[]> {
    return pulumi.all([this.printers]).apply(([printers]) => {
      return printers.map((printer: any, index: number) => printer.printerName || `bambu_printer_${index + 1}`);
    });
  }

  public getOctoPrintWebInterface(): pulumi.Output<string> | undefined {
    if (!this.octoprint) {
      return undefined;
    }
    return this.octoprint.getServiceEndpoint();
  }

  public getOctoPrintMjpegStream(): pulumi.Output<string | undefined> | undefined {
    if (!this.octoprint) {
      return undefined;
    }
    return this.octoprint.getMjpgStreamerEndpoint();
  }

  public getOctoPrintServiceName(): pulumi.Output<string> | undefined {
    if (!this.octoprint) {
      return undefined;
    }
    return this.octoprint.getServiceName();
  }

  public configureWebcamStream(printerName?: string): pulumi.Output<string> | undefined {
    if (!this.octoprint) {
      return undefined;
    }
    const streamUrl = this.getMjpegStreamUrl(printerName);
    return pulumi.interpolate`Configuration URL for webcam: ${streamUrl}`;
  }
}
