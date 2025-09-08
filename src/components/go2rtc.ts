import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";
import { marshalYAML } from "../utils/yaml";

export interface Go2rtcStreamConfig {
  [streamName: string]: (string | { [key: string]: any })[];
}

export interface Go2rtcArgs {
  namespace: pulumi.Input<string>;

  api?: {
    listen?: pulumi.Input<string>;
    basePath?: pulumi.Input<string>;
    staticDir?: pulumi.Input<string>;
    origin?: pulumi.Input<string>;
  };

  rtsp?: {
    listen?: pulumi.Input<string>;
    defaultQuery?: pulumi.Input<string>;
  };

  webrtc?: {
    listen?: pulumi.Input<string>;
    candidates?: pulumi.Input<string[]>;
    iceServers?: pulumi.Input<{ urls: string[] }[]>;
  };

  streams?: Go2rtcStreamConfig;

  ffmpeg?: {
    bin?: pulumi.Input<string>;
    global?: pulumi.Input<string>;
    h264?: pulumi.Input<string>;
  };

  log?: {
    level?: pulumi.Input<string>;
    output?: pulumi.Input<string>;
    format?: pulumi.Input<string>;
  };

  credentials?: {
    rtspUser?: pulumi.Input<string>;
    rtspPassword?: pulumi.Input<string>;
    mqttUser?: pulumi.Input<string>;
    mqttPassword?: pulumi.Input<string>;
  };

  environment?: {
    timezone?: pulumi.Input<string>;
    configFile?: pulumi.Input<string>;
    customEnvVars?: { name: string; value: pulumi.Input<string> }[];
  };

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

  deployment?: {
    app?: pulumi.Input<string>;
    environment?: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    replicas?: pulumi.Input<number>;
    nodeSelector?: pulumi.Input<{ [key: string]: string }>;
  };

  service?: {
    annotations?: pulumi.Input<{ [key: string]: string }>;
  };

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    hostname?: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };
}

export class Go2rtc extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly pvc?: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret?: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: Go2rtcArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Go2rtc", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: args.deployment?.app || "go2rtc",
      component: name,
      version: "1.9.9",
      environment: args.deployment?.environment || "production",
    };

    let pvc: k8s.core.v1.PersistentVolumeClaim | undefined;
    if (args.storage?.size) {
      const storageConfig: StorageConfig = {
        size: args.storage.size,
        storageClass: args.storage.storageClass,
        accessModes: args.storage.accessModes || ["ReadWriteOnce"],
        volumeMode: args.storage.volumeMode,
        namespace: args.storage.namespace,
        labels: args.storage.labels,
        annotations: args.storage.annotations,
        selector: args.storage.selector,
        dataSource: args.storage.dataSource,
      };

      pvc = createPVC(`${name}-config-pvc`, {
        ...storageConfig,
        namespace: args.namespace,
      }, defaultResourceOptions);
      
      this.pvc = pvc;
    }

    let secret: k8s.core.v1.Secret | undefined;
    if (args.credentials?.rtspUser || args.credentials?.rtspPassword || 
        args.credentials?.mqttUser || args.credentials?.mqttPassword) {
      const secretData: { [key: string]: pulumi.Input<string> } = {};
      
      if (args.credentials.rtspUser) {
        secretData["RTSP_USER"] = pulumi.output(args.credentials.rtspUser).apply(user => 
          Buffer.from(user).toString("base64"));
      }
      if (args.credentials.rtspPassword) {
        secretData["RTSP_PASSWORD"] = pulumi.output(args.credentials.rtspPassword).apply(pass => 
          Buffer.from(pass).toString("base64"));
      }
      if (args.credentials.mqttUser) {
        secretData["MQTT_USER"] = pulumi.output(args.credentials.mqttUser).apply(user => 
          Buffer.from(user).toString("base64"));
      }
      if (args.credentials.mqttPassword) {
        secretData["MQTT_PASSWORD"] = pulumi.output(args.credentials.mqttPassword).apply(pass => 
          Buffer.from(pass).toString("base64"));
      }

      secret = new k8s.core.v1.Secret(`${name}-credentials`, {
        metadata: {
          name: `${name}-credentials`,
          namespace: args.namespace,
          labels: labels,
        },
        type: "Opaque",
        data: secretData,
      }, defaultResourceOptions);

      this.secret = secret;
    }

    const config = {
      api: {
        listen: args.api?.listen || ":1984",
        ...(args.api?.basePath && { base_path: args.api.basePath }),
        ...(args.api?.staticDir && { static_dir: args.api.staticDir }),
        origin: args.api?.origin || "*",
      },
      rtsp: {
        listen: args.rtsp?.listen || ":8554",
        default_query: args.rtsp?.defaultQuery || "video&audio",
      },
      webrtc: {
        listen: args.webrtc?.listen || ":8555",
        ...(args.webrtc?.candidates && { candidates: args.webrtc.candidates }),
        ice_servers: args.webrtc?.iceServers || [{ urls: ["stun:stun.l.google.com:19302"] }],
      },
      ...(args.streams && { streams: args.streams }),
      ffmpeg: {
        bin: args.ffmpeg?.bin || "ffmpeg",
        global: args.ffmpeg?.global || "-hide_banner",
        h264: args.ffmpeg?.h264 || "-c:v libx264 -g 30 -preset superfast -tune zerolatency",
      },
      log: {
        level: args.log?.level || "info",
        output: args.log?.output || "stdout",
        format: args.log?.format || "text",
      },
    };

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels: labels,
      },
      data: {
        "go2rtc.yaml": marshalYAML(config),
      },
    }, defaultResourceOptions);

    const environment: k8s.types.input.core.v1.EnvVar[] = [
      {
        name: "GO2RTC_CONFIG_FILE",
        value: args.environment?.configFile || "/config/go2rtc.yaml",
      },
      {
        name: "TZ",
        value: args.environment?.timezone || "UTC",
      },
      {
        name: "GO2RTC_API",
        value: args.api?.listen || ":1984",
      },
      {
        name: "GO2RTC_RTSP", 
        value: args.rtsp?.listen || ":8554",
      },
      {
        name: "GO2RTC_WEBRTC",
        value: args.webrtc?.listen || ":8555",
      },
      ...(args.environment?.customEnvVars || []),
    ].filter(env => env.value !== undefined);

    if (secret) {
      const secretEnvVars: k8s.types.input.core.v1.EnvVar[] = [
        {
          name: "RTSP_USER",
          valueFrom: {
            secretKeyRef: {
              name: secret.metadata.name,
              key: "RTSP_USER",
              optional: true,
            },
          },
        },
        {
          name: "RTSP_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: secret.metadata.name,
              key: "RTSP_PASSWORD", 
              optional: true,
            },
          },
        },
        {
          name: "MQTT_USER",
          valueFrom: {
            secretKeyRef: {
              name: secret.metadata.name,
              key: "MQTT_USER",
              optional: true,
            },
          },
        },
        {
          name: "MQTT_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: secret.metadata.name,
              key: "MQTT_PASSWORD",
              optional: true,
            },
          },
        },
      ];
      
      environment.push(...secretEnvVars);
    }

    const volumes: k8s.types.input.core.v1.Volume[] = [
      {
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
    ];

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
      {
        name: "config",
        mountPath: "/config",
        readOnly: true,
      },
    ];

    if (pvc) {
      volumes.push({
        name: "data",
        persistentVolumeClaim: {
          claimName: pvc.metadata.name,
        },
      });
      volumeMounts.push({
        name: "data",
        mountPath: "/data",
      });
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
        annotations: args.deployment?.annotations,
      },
      spec: {
        replicas: args.deployment?.replicas || 1,
        strategy: {
          type: "RollingUpdate",
          rollingUpdate: {
            maxUnavailable: 1,
            maxSurge: 1,
          },
        },
        selector: {
          matchLabels: {
            app: labels.app,
            component: labels.component,
          },
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            securityContext: {
              fsGroup: 1000,
              runAsUser: 1000,
              runAsGroup: 1000,
              runAsNonRoot: true,
            },
            nodeSelector: args.deployment?.nodeSelector,
            containers: [{
              name: "go2rtc",
              image: DOCKER_IMAGES.GO2RTC.image,
              ports: [
                {
                  containerPort: 1984,
                  name: "http-api",
                  protocol: "TCP",
                },
                {
                  containerPort: 8554,
                  name: "rtsp",
                  protocol: "TCP",
                },
                {
                  containerPort: 8555,
                  name: "webrtc-tcp",
                  protocol: "TCP",
                },
                {
                  containerPort: 8555,
                  name: "webrtc-udp",
                  protocol: "UDP",
                },
              ],
              env: environment,
              volumeMounts: volumeMounts,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "64Mi",
                  cpu: args.resources?.requests?.cpu || "100m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "256Mi",
                  cpu: args.resources?.limits?.cpu || "500m",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/api",
                  port: 1984,
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
                timeoutSeconds: 10,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/api",
                  port: 1984,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              startupProbe: {
                httpGet: {
                  path: "/api",
                  port: 1984,
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 12,
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: {
                  drop: ["ALL"],
                },
                readOnlyRootFilesystem: false,
                runAsNonRoot: true,
                runAsUser: 1000,
                runAsGroup: 1000,
              },
            }],
            volumes: volumes,
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
        annotations: {
          "prometheus.io/scrape": "false",
          ...args.service?.annotations,
        },
      },
      spec: {
        type: "ClusterIP",
        selector: {
          app: labels.app,
          component: labels.component,
        },
        ports: [
          {
            port: 1984,
            targetPort: 1984,
            protocol: "TCP",
            name: "http-api",
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
        host: args.ingress.hostname,
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
        hosts: args.ingress.hostname ? [args.ingress.hostname] : [],
        secretName: args.ingress.tls.secretName,
      }] : undefined;

      const ingressAnnotations = {
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-send-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-connect-timeout": "60",
        "nginx.ingress.kubernetes.io/enable-websocket": "true",
        "nginx.ingress.kubernetes.io/upstream-hash-by": "$remote_addr",
        ...args.ingress.annotations,
      };

      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: labels,
          annotations: ingressAnnotations,
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
      pvc: this.pvc,
      secret: this.secret,
      ingress: this.ingress,
    });
  }

  public getApiEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984`;
  }

  public getRtspEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`rtsp://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8554`;
  }

  public getWebRtcEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8555`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getStreamUrl(streamName: string): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984/api/stream.mjpeg?src=${streamName}`;
  }

  public getSnapshotUrl(streamName: string): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1984/api/frame.jpeg?src=${streamName}`;
  }
}