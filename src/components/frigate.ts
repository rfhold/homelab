import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";
import { createYAMLDocumentOutput } from "../utils/yaml";

export interface SimpleCameraConfig {
  streamUrl: pulumi.Input<string>;
  detect?: {
    width: number;
    height: number;
    fps?: number;
  };
  retention?: {
    recordDays?: number;
    snapshotDays?: number;
  };
  detectEnabled?: boolean;
  objects?: string[];
  enabled?: boolean;
}

export interface FrigateArgs {
  namespace: pulumi.Input<string>;

  image?: pulumi.Input<string>;

  cameras: Record<string, SimpleCameraConfig>;

  mqtt: {
    host: pulumi.Input<string>;
    port?: number;
    username: pulumi.Input<string>;
    password: pulumi.Input<string>;
  };

  retention: {
    recordDays: number;
    snapshotDays: number;
  };

  hardwareAcceleration?: {
    type: "intel" | "nvidia";
    devicePath?: string;
    renderGroup?: number;
  };

  rtspRestream?: {
    enabled: boolean;
    password?: pulumi.Input<string>;
    webrtcCandidates?: string[];
    iceServers?: {
      urls: pulumi.Input<string>[];
      username?: pulumi.Input<string>;
      credential?: pulumi.Input<string>;
    }[];
  };

  timezone?: pulumi.Input<string>;

  configStorage: StorageConfig;

  mediaStorage?: StorageConfig;

  sharedMemorySize?: pulumi.Input<string>;

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
}

export class Frigate extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly configPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly mediaPvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: FrigateArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Frigate", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "frigate",
      component: name,
    };

    const image = args.image || DOCKER_IMAGES.FRIGATE.image;

    this.configPvc = createPVC(`${name}-config-pvc`, {
      ...args.configStorage,
      namespace: args.namespace,
    }, defaultResourceOptions);

    if (args.mediaStorage) {
      this.mediaPvc = createPVC(`${name}-media-pvc`, {
        ...args.mediaStorage,
        namespace: args.namespace,
      }, defaultResourceOptions);
    }

    const sanitizeStreamName = (cameraName: string): string => {
      return cameraName.replace(/[^a-zA-Z0-9_]/g, '_');
    };

    const transformedData = pulumi.output(args.cameras).apply(cameras => {
      const internalCameras: Record<string, any> = {};
      const go2rtcStreams: Record<string, pulumi.Output<string>> = {};

      Object.entries(cameras).forEach(([cameraName, cameraConfig]) => {
        const streamName = sanitizeStreamName(cameraName);
        const enabled = cameraConfig.enabled !== false;

        if (enabled) {
          go2rtcStreams[streamName] = pulumi.output(cameraConfig.streamUrl);
        }

        const detectWidth = cameraConfig.detect?.width || 640;
        const detectHeight = cameraConfig.detect?.height || 480;
        const detectFps = cameraConfig.detect?.fps || 5;
        const recordDays = cameraConfig.retention?.recordDays ?? args.retention.recordDays;
        const snapshotDays = cameraConfig.retention?.snapshotDays ?? args.retention.snapshotDays;
        const objects = cameraConfig.objects || ["person", "cat"];
        const detectEnabled = cameraConfig.detectEnabled ?? true;

        internalCameras[cameraName] = {
          enabled,
          ffmpeg: {
            inputs: [{
              path: `rtsp://127.0.0.1:8554/${streamName}`,
              roles: ["detect", "record"],
            }],
            output_args: {
              record: "preset-record-generic",
            },
          },
          detect: {
            width: detectWidth,
            height: detectHeight,
            fps: detectFps,
            enabled: detectEnabled,
          },
          record: {
            enabled: true,
            retain: {
              days: recordDays,
              mode: "motion",
            },
          },
          snapshots: {
            enabled: true,
            retain: {
              default: snapshotDays,
            },
          },
          objects: {
            track: objects,
            filters: {},
          },
        };
      });

      return pulumi.all(go2rtcStreams).apply(resolvedStreams => ({
        cameras: internalCameras,
        streams: resolvedStreams,
      }));
    });

    const detectorConfig = args.hardwareAcceleration?.type === "intel" ? {
      openvino: {
        type: "openvino",
        device: "GPU",
        model: {
          path: "/models/yolov9/yolov9-m-640.onnx",
          model_type: "yolo-generic",
          input_dtype: "float",
          input_tensor: "nchw",
          labelmap_path: "/labelmap/coco-80.txt",
          height: 640,
          width: 640,
        },
      },
    } : {
      cpu: {
        type: "cpu",
        num_threads: 2,
      },
    };

    const modelConfig = args.hardwareAcceleration?.type === "intel" ? {
      path: "/models/yolov9/yolov9-m-640.onnx",
      model_type: "yolo-generic",
      labelmap_path: "/labelmap/coco-80.txt",
      input_tensor: "nchw",
      input_dtype: "float",
      width: 640,
      height: 640,
    } : {
      path: "/cpu_model.tflite",
      input_tensor: "nhwc",
      input_pixel_format: "bgr",
      width: 320,
      height: 320,
    };

    const rtspPassword = args.rtspRestream?.password || "password";

    const configYaml = transformedData.apply(data =>
      createYAMLDocumentOutput(
        {
          mqtt: {
            enabled: true,
            host: args.mqtt.host,
            port: args.mqtt.port || 1883,
            topic_prefix: "frigate",
            client_id: "frigate",
            user: args.mqtt.username,
            password: args.mqtt.password,
            stats_interval: 60,
          },
          database: {
            path: "/config/frigate.db",
          },
          model: modelConfig,
          detectors: detectorConfig,
          cameras: data.cameras,
          go2rtc: {
            streams: data.streams,
            webrtc: {
              ...(args.rtspRestream?.webrtcCandidates && {
                candidates: args.rtspRestream.webrtcCandidates,
              }),
              ...(args.rtspRestream?.iceServers && {
                ice_servers: args.rtspRestream.iceServers,
              }),
            },
          },
          snapshots: {
            enabled: true,
            timestamp: false,
            bounding_box: true,
            crop: false,
            retain: {
              default: args.retention.snapshotDays,
            },
          },
          record: {
            enabled: true,
            retain: {
              days: args.retention.recordDays,
              mode: "motion",
            },
            alerts: {
              retain: {
                days: 30,
                mode: "active_objects",
              },
            },
            detections: {
              retain: {
                days: 30,
                mode: "active_objects",
              },
            },
          },
          objects: {
            track: ["person", "cat"],
          },
          motion: {
            threshold: 25,
            contour_area: 30,
            delta_alpha: 0.2,
            frame_alpha: 0.2,
            frame_height: 50,
          },
        },
        "Frigate NVR Configuration",
        { indent: 2, lineWidth: -1 }
      )
    );

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        namespace: args.namespace,
        labels: labels,
      },
      data: {
        "config.yml": configYaml,
      },
    }, defaultResourceOptions);

    const baseEnvironment = [
      {
        name: "TZ",
        value: args.timezone || "UTC",
      },
      {
        name: "FRIGATE_RTSP_PASSWORD",
        value: rtspPassword,
      },
    ];

    const hardwareEnvVars: Array<{ name: string, value: string }> = [];

    if (args.hardwareAcceleration?.type === "intel") {
      hardwareEnvVars.push({
        name: "LIBVA_DRIVER_NAME",
        value: "iHD",
      });
      hardwareEnvVars.push({
        name: "OPENVINO_DEVICE",
        value: "GPU",
      });
    }

    const environment = [...baseEnvironment, ...hardwareEnvVars];

    const volumeMounts = [
      {
        name: "config",
        mountPath: "/config",
        readOnly: false,
      },
      {
        name: "frigate-config",
        mountPath: "/config/config.yml",
        subPath: "config.yml",
        readOnly: true,
      },
      {
        name: "cache",
        mountPath: "/tmp/cache",
        readOnly: false,
      },
    ];

    if (this.mediaPvc) {
      volumeMounts.push({
        name: "media",
        mountPath: "/media/frigate",
        readOnly: false,
      });
    }

    const volumes: any[] = [
      {
        name: "frigate-config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
      {
        name: "config",
        persistentVolumeClaim: {
          claimName: this.configPvc.metadata.name,
        },
      },
      {
        name: "cache",
        emptyDir: {
          sizeLimit: "1Gi",
        },
      },
    ];

    if (this.mediaPvc) {
      volumes.push({
        name: "media",
        persistentVolumeClaim: {
          claimName: this.mediaPvc.metadata.name,
        },
      });
    }

    if (args.sharedMemorySize) {
      volumeMounts.push({
        name: "shm",
        mountPath: "/dev/shm",
        readOnly: false,
      });
      volumes.push({
        name: "shm",
        emptyDir: {
          medium: "Memory",
          sizeLimit: args.sharedMemorySize,
        },
      });
    }

    const ports = [
      {
        containerPort: 5000,
        name: "http",
        protocol: "TCP" as const,
      },
      {
        containerPort: 8554,
        name: "rtsp",
        protocol: "TCP" as const,
      },
      {
        containerPort: 8555,
        name: "webrtc-tcp",
        protocol: "TCP" as const,
      },
      {
        containerPort: 8555,
        name: "webrtc-udp",
        protocol: "UDP" as const,
      },
      {
        containerPort: 8971,
        name: "go2rtc",
        protocol: "TCP" as const,
      },
    ];

    let podSecurityContext: any = {};

    if (args.hardwareAcceleration?.type === "intel") {
      podSecurityContext = {
        fsGroup: args.hardwareAcceleration.renderGroup || 109,
      };
    }

    const containerSecurityContext: any = {
      privileged: true,
    };

    if (args.hardwareAcceleration?.type === "intel") {
      volumeMounts.push({
        name: "dri-device",
        mountPath: "/dev/dri",
        readOnly: false,
      });
      volumes.push({
        name: "dri-device",
        hostPath: {
          path: "/dev/dri",
          type: "Directory",
        },
      });
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: "Recreate",
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            securityContext: podSecurityContext,
            containers: [{
              name: "frigate",
              image,
              imagePullPolicy: "IfNotPresent" as const,
              ports,
              env: environment,
              volumeMounts,
              securityContext: containerSecurityContext,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "2Gi",
                  cpu: args.resources?.requests?.cpu || "2000m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "4Gi",
                  cpu: args.resources?.limits?.cpu || "4000m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/api/version",
                  port: 5000,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/api/version",
                  port: 5000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/api/version",
                  port: 5000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 12,
              },
            }],
            volumes,
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
        annotations: args.service?.annotations,
      },
      spec: {
        type: args.service?.type || "ClusterIP",
        selector: labels,
        ports: [
          {
            port: 5000,
            targetPort: 5000,
            protocol: "TCP",
            name: "http",
          },
          {
            port: 8554,
            targetPort: 8554,
            protocol: "TCP",
            name: "rtsp",
          },
          {
            port: 8555,
            targetPort: 8555,
            protocol: "TCP",
            name: "webrtc-tcp",
          },
          {
            port: 8555,
            targetPort: 8555,
            protocol: "UDP",
            name: "webrtc-udp",
          },
          {
            port: 8971,
            targetPort: 8971,
            protocol: "TCP",
            name: "go2rtc",
          },
        ],
      },
    }, defaultResourceOptions);

    if (args.ingress?.enabled) {
      const ingressRules = [{
        host: args.ingress.host,
        http: {
          paths: [{
            path: "/",
            pathType: "Prefix" as const,
            backend: {
              service: {
                name: this.service.metadata.name,
                port: {
                  number: 5000,
                },
              },
            },
          }],
        },
      }];

      const ingressTls = args.ingress.tls?.enabled ? [{
        hosts: [args.ingress.host],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          rules: ingressRules,
          tls: ingressTls,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      configPvc: this.configPvc,
      mediaPvc: this.mediaPvc,
      ingress: this.ingress,
    });
  }

  public getWebUIEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:5000`;
  }

  public getApiEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:5000/api`;
  }

  public getRtspEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`rtsp://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8554`;
  }

  public getGo2RTCEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8971`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }
}
