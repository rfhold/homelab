import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";
import { StorageConfig, createPVC } from "../adapters/storage";

export interface OctoPrintArgs {
  namespace: pulumi.Input<string>;

  config?: {
    enableMjpgStreamer?: pulumi.Input<boolean>;
    cameraDevice?: pulumi.Input<string>;
    mjpgStreamerInput?: pulumi.Input<string>;
    autoMigrate?: pulumi.Input<boolean>;
    debug?: pulumi.Input<boolean>;
    baseUrl?: pulumi.Input<string>;
    timezone?: pulumi.Input<string>;
  };

  bambuLab?: {
    enabled?: pulumi.Input<boolean>;
    printerType?: pulumi.Input<string>;
    serialNumber?: pulumi.Input<string>;
    accessCode?: pulumi.Input<string>;
    host?: pulumi.Input<string>;
    x1plus?: {
      enabled?: pulumi.Input<boolean>;
      sshUser?: pulumi.Input<string>;
      enhancedApi?: pulumi.Input<boolean>;
    };
  };

  mqtt?: {
    enabled?: pulumi.Input<boolean>;
    host?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    clientId?: pulumi.Input<string>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      caCert?: pulumi.Input<string>;
      clientCert?: pulumi.Input<string>;
      clientKey?: pulumi.Input<string>;
    };
  };

  camera?: {
    go2rtcEndpoint?: pulumi.Input<string>;
    streamUrl?: pulumi.Input<string>;
    snapshotUrl?: pulumi.Input<string>;
    webrtcEnabled?: pulumi.Input<boolean>;
  };

  ssh?: {
    privateKey?: pulumi.Input<string>;
    knownHosts?: pulumi.Input<string>;
  };

  devices?: {
    printerDevice?: pulumi.Input<string>;
    cameraDevice?: pulumi.Input<string>;
    additionalDevices?: pulumi.Input<string[]>;
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

export class OctoPrint extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly configMap?: k8s.core.v1.ConfigMap;
  public readonly secret?: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: OctoPrintArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OctoPrint", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "4Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    this.pvc = createPVC(`${name}-data-pvc`, {
      ...storageConfig,
      namespace: args.namespace,
    }, defaultResourceOptions);

    const labels = {
      app: args.deployment?.app || "octoprint",
      component: name,
      version: "1.11.2",
      environment: args.deployment?.environment || "production",
    };

    if (args.ssh?.privateKey || args.ssh?.knownHosts) {
      const secretData: { [key: string]: pulumi.Input<string> } = {};
      if (args.ssh?.privateKey) {
        secretData["id_rsa"] = pulumi.output(args.ssh.privateKey).apply(key => Buffer.from(key).toString("base64"));
      }
      if (args.ssh?.knownHosts) {
        secretData["known_hosts"] = pulumi.output(args.ssh.knownHosts).apply(hosts => Buffer.from(hosts).toString("base64"));
      }

      this.secret = new k8s.core.v1.Secret(`${name}-ssh-secret`, {
        metadata: {
          name: `${name}-ssh`,
          namespace: args.namespace,
          labels: labels,
        },
        type: "Opaque",
        data: secretData,
      }, defaultResourceOptions);
    }

    const bambuConfig = args.bambuLab?.enabled ? {
      printer_type: args.bambuLab.printerType || "X1 Carbon",
      serial_number: args.bambuLab.serialNumber || "",
      access_code: args.bambuLab.accessCode || "",
      host: args.bambuLab.host || "",
      x1plus: {
        enabled: args.bambuLab.x1plus?.enabled || false,
        ssh_user: args.bambuLab.x1plus?.sshUser || "root",
        enhanced_api: args.bambuLab.x1plus?.enhancedApi || false,
      },
    } : null;

    const mqttConfig = args.mqtt?.enabled ? {
      host: args.mqtt.host || "",
      port: args.mqtt.port || 1883,
      username: args.mqtt.username || "bblp",
      password: args.mqtt.password || "",
      client_id: args.mqtt.clientId || `octoprint-${Math.random().toString(36).substring(2, 10)}`,
      tls: {
        enabled: args.mqtt.tls?.enabled || false,
      },
    } : null;

    const cameraConfig = args.camera ? {
      go2rtc_endpoint: args.camera.go2rtcEndpoint || "",
      stream_url: args.camera.streamUrl || "",
      snapshot_url: args.camera.snapshotUrl || "",
      webrtc_enabled: args.camera.webrtcEnabled || false,
    } : null;

    if (bambuConfig || mqttConfig || cameraConfig) {
      this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
        metadata: {
          name: `${name}-config`,
          namespace: args.namespace,
          labels: labels,
        },
        data: {
          ...(bambuConfig ? { "bambu-config.json": JSON.stringify(bambuConfig) } : {}),
          ...(mqttConfig ? { "mqtt-config.json": JSON.stringify(mqttConfig) } : {}),
          ...(cameraConfig ? { "camera-config.json": JSON.stringify(cameraConfig) } : {}),
        },
      }, defaultResourceOptions);
    }

    const environment = [
      {
        name: "ENABLE_MJPG_STREAMER",
        value: (args.config?.enableMjpgStreamer || false).toString(),
      },
      {
        name: "CAMERA_DEV",
        value: args.config?.cameraDevice || "/dev/video0",
      },
      {
        name: "MJPG_STREAMER_INPUT",
        value: args.config?.mjpgStreamerInput || "-n -r 640x480",
      },
      {
        name: "AUTOMIGRATE",
        value: (args.config?.autoMigrate || false).toString(),
      },
      {
        name: "OCTOPRINT_PORT",
        value: "5000",
      },
      {
        name: "TZ",
        value: args.config?.timezone || "UTC",
      },
      ...(args.config?.debug ? [{
        name: "OCTOPRINT_DEBUG",
        value: "true",
      }] : []),
      ...(args.config?.baseUrl ? [{
        name: "OCTOPRINT_BASE_URL",
        value: args.config.baseUrl,
      }] : []),
      ...(args.bambuLab?.enabled ? [{
        name: "BAMBU_ENABLED",
        value: "true",
      }] : []),
      ...(args.mqtt?.enabled ? [{
        name: "MQTT_ENABLED",
        value: "true",
      }] : []),
      ...(args.camera?.go2rtcEndpoint ? [{
        name: "GO2RTC_ENDPOINT",
        value: args.camera.go2rtcEndpoint,
      }] : []),
    ].filter(env => env.value !== undefined);

    const containerPorts = [
      {
        containerPort: 5000,
        name: "http",
        protocol: "TCP" as const,
      },
      ...(args.config?.enableMjpgStreamer ? [{
        containerPort: 8080,
        name: "mjpg-stream",
        protocol: "TCP" as const,
      }] : []),
      ...(args.mqtt?.enabled ? [{
        containerPort: 1883,
        name: "mqtt",
        protocol: "TCP" as const,
      }] : []),
      ...(args.mqtt?.tls?.enabled ? [{
        containerPort: 8883,
        name: "mqtt-tls",
        protocol: "TCP" as const,
      }] : []),
    ];

    const volumes: k8s.types.input.core.v1.Volume[] = [
      {
        name: "octoprint-data",
        persistentVolumeClaim: {
          claimName: this.pvc.metadata.name,
        },
      },
    ];

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
      {
        name: "octoprint-data",
        mountPath: "/octoprint",
      },
    ];

    if (this.configMap) {
      volumes.push({
        name: "config-volume",
        configMap: {
          name: this.configMap.metadata.name,
        },
      });
      volumeMounts.push({
        name: "config-volume",
        mountPath: "/etc/octoprint/config",
        readOnly: true,
      });
    }

    if (this.secret) {
      volumes.push({
        name: "ssh-keys",
        secret: {
          secretName: this.secret.metadata.name,
          defaultMode: 0o600,
        },
      });
      volumeMounts.push({
        name: "ssh-keys",
        mountPath: "/home/octoprint/.ssh",
        readOnly: true,
      });
    }

    if (args.devices?.printerDevice) {
      volumes.push({
        name: "printer-device",
        hostPath: {
          path: args.devices.printerDevice,
          type: "CharDevice",
        },
      });
      volumeMounts.push({
        name: "printer-device",
        mountPath: args.devices.printerDevice,
      });
    }

    if (args.devices?.cameraDevice && args.config?.enableMjpgStreamer) {
      volumes.push({
        name: "camera-device",
        hostPath: {
          path: args.devices.cameraDevice,
          type: "CharDevice",
        },
      });
      volumeMounts.push({
        name: "camera-device",
        mountPath: args.devices.cameraDevice,
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
          type: "Recreate",
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
              name: "octoprint",
              image: DOCKER_IMAGES.OCTOPRINT.image,
              ports: containerPorts,
              env: environment,
              volumeMounts: volumeMounts,
              resources: {
                requests: {
                  memory: args.resources?.requests?.memory || "256Mi",
                  cpu: args.resources?.requests?.cpu || "500m",
                },
                limits: {
                  memory: args.resources?.limits?.memory || "1Gi",
                  cpu: args.resources?.limits?.cpu || "2",
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

    const servicePorts = [
      {
        port: 80,
        targetPort: 5000,
        protocol: "TCP",
        name: "http",
      },
      ...(args.config?.enableMjpgStreamer ? [{
        port: 8080,
        targetPort: 8080,
        protocol: "TCP" as const,
        name: "mjpg-stream",
      }] : []),
      ...(args.mqtt?.enabled ? [{
        port: 1883,
        targetPort: 1883,
        protocol: "TCP" as const,
        name: "mqtt",
      }] : []),
      ...(args.mqtt?.tls?.enabled ? [{
        port: 8883,
        targetPort: 8883,
        protocol: "TCP" as const,
        name: "mqtt-tls",
      }] : []),
    ];

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
        ports: servicePorts,
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
                  number: 80,
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
        "nginx.ingress.kubernetes.io/proxy-body-size": "50m",
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-send-timeout": "300",
        "nginx.ingress.kubernetes.io/proxy-connect-timeout": "60",
        "nginx.ingress.kubernetes.io/enable-websocket": "true",
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
      pvc: this.pvc,
      configMap: this.configMap,
      secret: this.secret,
      ingress: this.ingress,
    });
  }

  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getWebcamEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8080`;
  }

  public getMqttEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1883`;
  }

  public getMqttTlsEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8883`;
  }
}