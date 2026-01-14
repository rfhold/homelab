import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

export interface NanoMQArgs {
  namespace: pulumi.Input<string>;

  image?: {
    variant?: "slim" | "full";
    tag?: pulumi.Input<string>;
  };

  http?: {
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
  };

  mqtt?: {
    allowAnonymous?: pulumi.Input<boolean>;
    maxPacketSize?: pulumi.Input<string>;
    maxMqueueLen?: pulumi.Input<number>;
    retryInterval?: pulumi.Input<string>;
    keepaliveMultiplier?: pulumi.Input<number>;
  };

  persistence?: {
    enabled?: pulumi.Input<boolean>;
    storage?: StorageConfig;
    sqlite?: {
      diskCacheSize?: pulumi.Input<number>;
      flushMemThreshold?: pulumi.Input<number>;
      resendInterval?: pulumi.Input<number>;
    };
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

  bridge?: {
    name?: pulumi.Input<string>;
    server: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    clientId?: pulumi.Input<string>;
    keepalive?: pulumi.Input<string>;
    cleanStart?: pulumi.Input<boolean>;
    protoVer?: pulumi.Input<4 | 5>;
    forwards?: pulumi.Input<pulumi.Input<string>[]>;
    subscription?: {
      topic: pulumi.Input<string>;
      qos?: pulumi.Input<0 | 1 | 2>;
    }[];
    ssl?: {
      enabled?: pulumi.Input<boolean>;
      certSecret?: pulumi.Input<string>;
      keyPath?: pulumi.Input<string>;
      certPath?: pulumi.Input<string>;
      caPath?: pulumi.Input<string>;
    };
  };
}

export class NanoMQ extends pulumi.ComponentResource {
  public readonly workload: k8s.apps.v1.StatefulSet | k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly secret: k8s.core.v1.Secret;

  constructor(name: string, args: NanoMQArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:NanoMQ", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "nanomq",
      component: name,
    };

    const defaultImage = DOCKER_IMAGES.NANOMQ.image;
    const imageVariant = args.image?.variant || "slim";
    let image: string;
    if (args.image?.tag) {
      image = `emqx/nanomq:${args.image.tag}`;
    } else if (imageVariant === "full") {
      image = defaultImage.replace("-slim", "-full");
    } else {
      image = defaultImage;
    }

    const httpUsername = args.http?.username || "admin";
    const httpPassword = args.http?.password || pulumi.output("public");

    const secretData: Record<string, pulumi.Input<string>> = {
      "http-username": httpUsername,
      "http-password": httpPassword,
    };

    if (args.bridge?.username) {
      secretData["bridge-username"] = args.bridge.username;
    }
    if (args.bridge?.password) {
      secretData["bridge-password"] = args.bridge.password;
    }

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
        labels,
      },
      stringData: secretData,
    }, defaultResourceOptions);

    const bridgeName = args.bridge?.name || "remote";
    const bridgeForwards = args.bridge?.forwards || [];
    const bridgeSubscriptions = args.bridge?.subscription || [];

    const configData = pulumi.all([
      args.mqtt?.maxPacketSize || "256MB",
      args.mqtt?.maxMqueueLen || 2048,
      args.mqtt?.retryInterval || "10s",
      args.mqtt?.keepaliveMultiplier || 1.25,
      args.mqtt?.allowAnonymous ?? true,
      args.persistence?.enabled ?? false,
      args.persistence?.sqlite?.diskCacheSize || 102400,
      args.persistence?.sqlite?.flushMemThreshold || 100,
      args.persistence?.sqlite?.resendInterval || 5000,
      args.bridge?.server,
      args.bridge?.clientId || `nanomq-bridge-${name}`,
      args.bridge?.keepalive || "60s",
      args.bridge?.cleanStart ?? true,
      args.bridge?.protoVer || 4,
      bridgeForwards,
      args.bridge?.ssl?.enabled ?? false,
      args.bridge?.ssl?.keyPath || "/etc/bridge-certs/tls.key",
      args.bridge?.ssl?.certPath || "/etc/bridge-certs/tls.crt",
      args.bridge?.ssl?.caPath || "/etc/bridge-certs/ca.crt",
    ]).apply(([
      maxPacketSize,
      maxMqueueLen,
      retryInterval,
      keepaliveMultiplier,
      allowAnonymous,
      persistenceEnabled,
      diskCacheSize,
      flushMemThreshold,
      resendInterval,
      bridgeServer,
      bridgeClientId,
      bridgeKeepalive,
      bridgeCleanStart,
      bridgeProtoVer,
      forwards,
      bridgeSslEnabled,
      bridgeSslKeyPath,
      bridgeSslCertPath,
      bridgeSslCaPath,
    ]) => {
      let config = `mqtt {
    property_size = 32
    max_packet_size = ${maxPacketSize}
    max_mqueue_len = ${maxMqueueLen}
    retry_interval = ${retryInterval}
    keepalive_multiplier = ${keepaliveMultiplier}
}

listeners.tcp {
    bind = "0.0.0.0:1883"
}

listeners.ws {
    bind = "0.0.0.0:8083/mqtt"
}

http_server {
    port = 8081
    limit_conn = 32
    username = "$HTTP_USERNAME"
    password = "$HTTP_PASSWORD"
    auth_type = basic
}

log {
    to = [console]
    level = info
}

auth {
    allow_anonymous = ${allowAnonymous}
    no_match = allow
    deny_action = ignore
}

system {
    num_taskq_thread = 0
    max_taskq_thread = 0
    parallel = 0
}`;

      if (persistenceEnabled) {
        config += `

sqlite {
    disk_cache_size = ${diskCacheSize}
    mounted_file_path = "/data/"
    flush_mem_threshold = ${flushMemThreshold}
    resend_interval = ${resendInterval}
}`;
      }

      if (bridgeServer) {
        const forwardsArray = forwards as string[];
        const forwardsConfig = forwardsArray.length > 0
          ? `forwards = [${forwardsArray.map(f => `"${f}"`).join(", ")}]`
          : "";

        const subscriptionsConfig = bridgeSubscriptions.length > 0
          ? bridgeSubscriptions.map((sub, i) => `
    subscription {
        topic = "${sub.topic}"
        qos = ${sub.qos ?? 1}
    }`).join("")
          : "";

        let sslConfig = "";
        if (bridgeSslEnabled) {
          sslConfig = `
    ssl {
        key_password = "$BRIDGE_KEY_PASSWORD"
        keyfile = "${bridgeSslKeyPath}"
        certfile = "${bridgeSslCertPath}"
        cacertfile = "${bridgeSslCaPath}"
    }`;
        }

        config += `

bridges.mqtt.${bridgeName} {
    server = "${bridgeServer}"
    proto_ver = ${bridgeProtoVer}
    clientid = "${bridgeClientId}"
    keepalive = ${bridgeKeepalive}
    clean_start = ${bridgeCleanStart}
    username = "$BRIDGE_USERNAME"
    password = "$BRIDGE_PASSWORD"
    ${forwardsConfig}${subscriptionsConfig}${sslConfig}
}`;
      }

      return config;
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: `${name}-config`,
        namespace: args.namespace,
        labels,
      },
      data: {
        "nanomq.conf": configData,
      },
    }, defaultResourceOptions);

    const authHeaderValue = pulumi.all([httpUsername, httpPassword]).apply(
      ([u, p]) => Buffer.from(`${u}:${p}`).toString("base64")
    );

    const env: k8s.types.input.core.v1.EnvVar[] = [
      {
        name: "NANOMQ_BROKER_URL",
        value: "nmq-tcp://0.0.0.0:1883",
      },
      {
        name: "NANOMQ_HTTP_SERVER_ENABLE",
        value: "true",
      },
      {
        name: "NANOMQ_LOG_LEVEL",
        value: "info",
      },
      {
        name: "NANOMQ_LOG_TO",
        value: "console",
      },
      {
        name: "HTTP_USERNAME",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "http-username",
          },
        },
      },
      {
        name: "HTTP_PASSWORD",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "http-password",
          },
        },
      },
    ];

    if (args.bridge?.username) {
      env.push({
        name: "BRIDGE_USERNAME",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "bridge-username",
          },
        },
      });
    }

    if (args.bridge?.password) {
      env.push({
        name: "BRIDGE_PASSWORD",
        valueFrom: {
          secretKeyRef: {
            name: this.secret.metadata.name,
            key: "bridge-password",
          },
        },
      });
    }

    const ports = [
      { containerPort: 1883, name: "mqtt", protocol: "TCP" as const },
      { containerPort: 8883, name: "mqtts", protocol: "TCP" as const },
      { containerPort: 8083, name: "ws", protocol: "TCP" as const },
      { containerPort: 8081, name: "http", protocol: "TCP" as const },
    ];

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
      {
        name: "config",
        mountPath: "/etc/nanomq.conf",
        subPath: "nanomq.conf",
      },
    ];

    const volumes: k8s.types.input.core.v1.Volume[] = [
      {
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
    ];

    if (args.bridge?.ssl?.enabled && args.bridge.ssl.certSecret) {
      volumes.push({
        name: "bridge-certs",
        secret: {
          secretName: args.bridge.ssl.certSecret,
        },
      });
      volumeMounts.push({
        name: "bridge-certs",
        mountPath: "/etc/bridge-certs",
        readOnly: true,
      });
    }

    const containerSpec: k8s.types.input.core.v1.Container = {
      name: "nanomq",
      image,
      imagePullPolicy: "IfNotPresent",
      ports,
      env,
      volumeMounts,
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
          path: "/api/v4/brokers",
          port: 8081,
          httpHeaders: [{
            name: "Authorization",
            value: pulumi.interpolate`Basic ${authHeaderValue}`,
          }],
        },
        initialDelaySeconds: 10,
        periodSeconds: 30,
        failureThreshold: 3,
      },
      readinessProbe: {
        httpGet: {
          path: "/api/v4/brokers",
          port: 8081,
          httpHeaders: [{
            name: "Authorization",
            value: pulumi.interpolate`Basic ${authHeaderValue}`,
          }],
        },
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
    };

    const podSpec: k8s.types.input.core.v1.PodSpec = {
      containers: [containerSpec],
      volumes,
    };

    if (args.persistence?.enabled) {
      volumeMounts.push({
        name: "data",
        mountPath: "/data",
      });

      const storageConfig: StorageConfig = {
        size: args.persistence.storage?.size || "1Gi",
        storageClass: args.persistence.storage?.storageClass,
        accessModes: args.persistence.storage?.accessModes || ["ReadWriteOnce"],
      };

      this.workload = new k8s.apps.v1.StatefulSet(name, {
        metadata: {
          name,
          namespace: args.namespace,
          labels,
        },
        spec: {
          serviceName: name,
          replicas: 1,
          selector: {
            matchLabels: labels,
          },
          template: {
            metadata: { labels },
            spec: podSpec,
          },
          volumeClaimTemplates: [{
            metadata: {
              name: "data",
            },
            spec: createPVCSpec(storageConfig),
          }],
        },
      }, defaultResourceOptions);
    } else {
      this.workload = new k8s.apps.v1.Deployment(name, {
        metadata: {
          name,
          namespace: args.namespace,
          labels,
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: labels,
          },
          template: {
            metadata: { labels },
            spec: podSpec,
          },
        },
      }, defaultResourceOptions);
    }

    this.service = new k8s.core.v1.Service(name, {
      metadata: {
        name,
        namespace: args.namespace,
        labels,
        annotations: {
          ...args.service?.annotations,
          "k8s.grafana.com/scrape": "true",
          "k8s.grafana.com/job": name,
          "k8s.grafana.com/metrics.path": "/api/v4/prometheus",
          "k8s.grafana.com/metrics.portNumber": "8081",
          "k8s.grafana.com/metrics.scheme": "http",
          "k8s.grafana.com/metrics.scrapeInterval": "60s",
        },
      },
      spec: {
        type: args.service?.type || "ClusterIP",
        selector: labels,
        ports: [
          { port: 1883, targetPort: 1883, protocol: "TCP", name: "mqtt" },
          { port: 8883, targetPort: 8883, protocol: "TCP", name: "mqtts" },
          { port: 8083, targetPort: 8083, protocol: "TCP", name: "ws" },
          { port: 8081, targetPort: 8081, protocol: "TCP", name: "http" },
        ],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      workload: this.workload,
      service: this.service,
      configMap: this.configMap,
      secret: this.secret,
    });
  }

  public getMqttEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`mqtt://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:1883`;
  }

  public getWebSocketEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`ws://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8083/mqtt`;
  }

  public getHttpEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:8081`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }
}
