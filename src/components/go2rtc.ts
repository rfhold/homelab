import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";
import { createYAMLDocumentOutput } from "../utils/yaml";

export interface Go2RTCStreamConfig {
  [streamName: string]: string[] | string;
}

export interface Go2RTCHLSConfig {
  enabled: boolean;
  segment?: number;
  count?: number;
  part?: number;
}

export interface Go2RTCHardwareConfig {
  type?: "intel" | "nvidia" | "rockchip";
  devicePath?: pulumi.Input<string>;
  renderGroup?: number;
  nvidiaVisibleDevices?: pulumi.Input<string>;
}

export interface Go2RTCApiConfig {
  username?: pulumi.Input<string>;
  password?: pulumi.Input<string>;
}

export interface Go2RTCRtspConfig {
  username?: pulumi.Input<string>;
  password?: pulumi.Input<string>;
}

// WebRTC configuration for go2rtc
// iceServers (STUN/TURN servers) are optional and only needed for external WebRTC access
// through NAT/firewalls. For local network access, they can be omitted for a cleaner config.
export interface Go2RTCWebRTCConfig {
  candidates?: pulumi.Input<string[]>;
  iceServers?: pulumi.Input<Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>>;
}



export interface Go2RTCArgs {
  namespace: pulumi.Input<string>;

  image?: {
    variant?: "standard" | "hardware" | "rockchip";
    tag?: pulumi.Input<string>;
  };

  deploymentMode?: "deployment" | "daemonset";
  
  networkMode?: "host" | "standard";

  streams: pulumi.Input<Go2RTCStreamConfig>;

  hls?: Go2RTCHLSConfig;

  hardware?: Go2RTCHardwareConfig;

  api?: Go2RTCApiConfig;

  rtsp?: Go2RTCRtspConfig;

  webrtc?: Go2RTCWebRTCConfig;

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

  replicas?: pulumi.Input<number>;

  service?: {
    type?: pulumi.Input<string>;
    annotations?: pulumi.Input<{[key: string]: string}>;
  };

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{[key: string]: string}>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };
}

export class Go2RTC extends pulumi.ComponentResource {
  public readonly workload: k8s.apps.v1.Deployment | k8s.apps.v1.DaemonSet;
  public readonly service?: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;
  private readonly ingressConfig?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{[key: string]: string}>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };

  constructor(name: string, args: Go2RTCArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Go2RTC", name, {}, opts);

    this.ingressConfig = args.ingress;

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "go2rtc",
      component: name,
    };

    const imageVariantMap = {
      standard: DOCKER_IMAGES.GO2RTC.image,
      hardware: DOCKER_IMAGES.GO2RTC_HARDWARE.image,
      rockchip: DOCKER_IMAGES.GO2RTC_ROCKCHIP.image,
    };

    const imageTag = args.image?.tag || "";
    const imageVariant = args.image?.variant || "standard";
    
    const image = imageTag 
      ? `docker.io/alexxit/go2rtc:${imageTag}`
      : imageVariantMap[imageVariant];

    if (args.storage) {
      this.pvc = createPVC(`${name}-config-pvc`, {
        ...args.storage,
        namespace: args.namespace,
      }, defaultResourceOptions);
    }

    const go2rtcConfig = pulumi.all([
      args.api?.username || "",
      args.api?.password || "",
      args.rtsp?.username || "admin",
      args.rtsp?.password || "secret",
      args.webrtc?.candidates || [],
      args.webrtc?.iceServers,
      args.streams,
    ]).apply(([
      apiUsername, apiPassword,
      rtspUsername, rtspPassword,
      webrtcCandidates, webrtcIceServers,
      streams,
    ]) => {
      const webrtcConfig: any = {
        listen: ":8555/tcp",
        candidates: webrtcCandidates,
      };

      if (webrtcIceServers && Array.isArray(webrtcIceServers) && webrtcIceServers.length > 0) {
        webrtcConfig.ice_servers = webrtcIceServers;
      }

      const config: any = {
        api: {
          listen: ":1984",
          username: apiUsername,
          password: apiPassword,
        },
        rtsp: {
          listen: ":8554",
          username: rtspUsername,
          password: rtspPassword,
        },
        webrtc: webrtcConfig,
        log: {
          level: "info",
          format: "color",
        },
        streams: streams,
      };

      if (args.hls?.enabled) {
        config.hls = {
          segment: args.hls.segment || 2,
          count: args.hls.count || 6,
          part: args.hls.part || 1,
        };
      }

      return config;
    });

    const configYaml = createYAMLDocumentOutput(
      go2rtcConfig,
      "go2rtc configuration",
      { indent: 2, lineWidth: -1 }
    );

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      data: {
        "go2rtc.yaml": configYaml,
      },
    }, defaultResourceOptions);

    const baseEnvironment = [
      {
        name: "TZ",
        value: "UTC",
      },
    ];

    const nvidiaEnvVars = args.hardware?.type === "nvidia" ? [{
      name: "NVIDIA_VISIBLE_DEVICES",
      value: args.hardware.nvidiaVisibleDevices || "all",
    }] : [];

    const environment = [...baseEnvironment, ...nvidiaEnvVars];

    const volumeMounts = [
      {
        name: "config",
        mountPath: "/config",
        readOnly: false,
      },
    ];

    const volumes: any[] = [
      {
        name: "go2rtc-config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
    ];

    if (this.pvc) {
      volumes.push({
        name: "config",
        persistentVolumeClaim: {
          claimName: this.pvc.metadata.name,
        },
      });
    } else {
      volumes.push({
        name: "config",
        emptyDir: {},
      });
    }

    const ports = [
      {
        containerPort: 1984,
        name: "api",
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
    ];

    const securityContext = args.hardware?.type === "intel" ? {
      fsGroup: args.hardware.renderGroup || 109,
    } : {};

    const containerSecurityContext: any = {
      runAsUser: 1000,
      runAsGroup: 1000,
      runAsNonRoot: true,
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: false,
      capabilities: {
        drop: ["ALL"],
      },
    };

    if (args.networkMode === "host") {
      containerSecurityContext.capabilities.add = ["NET_BIND_SERVICE"];
    }

    if (args.hardware?.type === "intel" && args.hardware.devicePath) {
      volumeMounts.push({
        name: "dri-device",
        mountPath: "/dev/dri",
        readOnly: false,
      });
      volumes.push({
        name: "dri-device",
        hostPath: {
          path: args.hardware.devicePath,
        },
      });
    }

    const podSpec = {
      securityContext,
      hostNetwork: args.networkMode === "host",
      dnsPolicy: args.networkMode === "host" ? ("ClusterFirstWithHostNet" as const) : ("ClusterFirst" as const),
      initContainers: [{
        name: "copy-config",
        image: DOCKER_IMAGES.BUSYBOX.image,
        command: ["sh", "-c"],
        args: ["cp /configmap/go2rtc.yaml /config/go2rtc.yaml && chown 1000:1000 /config/go2rtc.yaml"],
        volumeMounts: [
          {
            name: "config",
            mountPath: "/config",
          },
          {
            name: "go2rtc-config",
            mountPath: "/configmap",
          },
        ],
        securityContext: {
          runAsUser: 0,
          runAsNonRoot: false,
        },
      }],
      containers: [{
        name: "go2rtc",
        image,
        imagePullPolicy: "IfNotPresent" as const,
        ports,
        env: environment,
        volumeMounts,
        securityContext: containerSecurityContext,
        resources: {
          requests: {
            memory: args.resources?.requests?.memory || "128Mi",
            cpu: args.resources?.requests?.cpu || "100m",
          },
          limits: {
            memory: args.resources?.limits?.memory || "512Mi",
            cpu: args.resources?.limits?.cpu || "1000m",
          },
        },
        livenessProbe: {
          tcpSocket: {
            port: 1984,
          },
          initialDelaySeconds: 30,
          periodSeconds: 30,
          timeoutSeconds: 10,
          failureThreshold: 3,
        },
        readinessProbe: {
          tcpSocket: {
            port: 1984,
          },
          initialDelaySeconds: 10,
          periodSeconds: 10,
          timeoutSeconds: 5,
          failureThreshold: 3,
        },
      }],
      volumes,
    };

    if (args.deploymentMode === "daemonset") {
      this.workload = new k8s.apps.v1.DaemonSet(`${name}-daemonset`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
        },
        spec: {
          selector: {
            matchLabels: labels,
          },
          template: {
            metadata: {
              labels: labels,
            },
            spec: podSpec,
          },
        },
      }, defaultResourceOptions);
    } else {
      this.workload = new k8s.apps.v1.Deployment(`${name}-deployment`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
        },
        spec: {
          replicas: args.replicas || 1,
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
            spec: podSpec,
          },
        },
      }, defaultResourceOptions);
    }

    if (args.networkMode !== "host") {
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
              port: 1984,
              targetPort: 1984,
              protocol: "TCP",
              name: "api",
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
                    number: 1984,
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
    }

    this.registerOutputs({
      workload: this.workload,
      service: this.service,
      configMap: this.configMap,
      pvc: this.pvc,
      ingress: this.ingress,
    });
  }

  public getWebUIEndpoint(): pulumi.Output<string> {
    if (this.ingressConfig?.enabled && this.ingressConfig.host) {
      return pulumi.all([this.ingressConfig.enabled, this.ingressConfig.host, this.ingressConfig.tls?.enabled]).apply(([enabled, host, tlsEnabled]) => {
        if (enabled) {
          const protocol = tlsEnabled ? "https" : "http";
          return `${protocol}://${host}`;
        }
        if (this.service) {
          return `http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984`;
        }
        return "http://localhost:1984";
      });
    }
    if (this.service) {
      return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984`;
    }
    return pulumi.output("http://localhost:1984");
  }

  public getApiEndpoint(): pulumi.Output<string> {
    if (this.ingressConfig?.enabled && this.ingressConfig.host) {
      return pulumi.all([this.ingressConfig.enabled, this.ingressConfig.host, this.ingressConfig.tls?.enabled]).apply(([enabled, host, tlsEnabled]) => {
        if (enabled) {
          const protocol = tlsEnabled ? "https" : "http";
          return `${protocol}://${host}/api`;
        }
        if (this.service) {
          return `http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984/api`;
        }
        return "http://localhost:1984/api";
      });
    }
    if (this.service) {
      return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984/api`;
    }
    return pulumi.output("http://localhost:1984/api");
  }

  public getRtspEndpoint(): pulumi.Output<string> {
    if (this.service) {
      return pulumi.interpolate`rtsp://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8554`;
    }
    return pulumi.output("rtsp://localhost:8554");
  }

  public getWebRTCEndpoint(): pulumi.Output<string> {
    if (this.service) {
      return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8555`;
    }
    return pulumi.output("localhost:8555");
  }

  public getServiceName(): pulumi.Output<string> | undefined {
    return this.service?.metadata.name;
  }
}