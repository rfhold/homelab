import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import { DOCKER_IMAGES } from "../docker-images";
import { Certificate } from "./certificate";

export interface CoturnCertificateConfig {
  dnsNames: pulumi.Input<pulumi.Input<string>[]>;
  issuerRef: pulumi.Input<string>;
  duration?: pulumi.Input<string>;
  renewBefore?: pulumi.Input<string>;
}

export interface CoturnTlsConfig {
  enabled?: pulumi.Input<boolean>;
  secretName?: pulumi.Input<string>;
  certificate?: CoturnCertificateConfig;
}

export interface CoturnArgs {
  namespace: pulumi.Input<string>;

  realm: pulumi.Input<string>;

  externalIp?: pulumi.Input<string>;

  authSecret?: pulumi.Input<string>;

  tls?: CoturnTlsConfig;

  minPort?: pulumi.Input<number>;
  maxPort?: pulumi.Input<number>;

  networkMode?: "host" | "standard";

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

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;

  service?: {
    type?: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    loadBalancerIP?: pulumi.Input<string>;
  };
}

export class Coturn extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service?: k8s.core.v1.Service;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly secret: k8s.core.v1.Secret;
  public readonly authSecret: pulumi.Output<string>;
  public readonly certificate?: Certificate;

  constructor(name: string, args: CoturnArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Coturn", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "coturn",
      component: name,
    };

    const minPort = args.minPort || 49152;
    const maxPort = args.maxPort || 65535;

    const generatedSecret = new random.RandomPassword(`${name}-auth-secret`, {
      length: 64,
      special: false,
    }, defaultResourceOptions);

    this.authSecret = args.authSecret 
      ? pulumi.output(args.authSecret)
      : generatedSecret.result;

    this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
      metadata: {
        name: `${name}-secret`,
        namespace: args.namespace,
        labels,
      },
      stringData: {
        "auth-secret": this.authSecret,
      },
    }, defaultResourceOptions);

    const tlsSecretName = args.tls?.certificate
      ? `${name}-tls`
      : args.tls?.secretName;

    if (args.tls?.certificate) {
      this.certificate = new Certificate(`${name}-cert`, {
        namespace: args.namespace,
        name: `${name}-tls`,
        secretName: tlsSecretName!,
        dnsNames: args.tls.certificate.dnsNames,
        issuerRef: args.tls.certificate.issuerRef,
        duration: args.tls.certificate.duration,
        renewBefore: args.tls.certificate.renewBefore,
      }, defaultResourceOptions);
    }

    const configContent = pulumi.all([
      args.realm,
      args.externalIp,
      minPort,
      maxPort,
      args.tls?.enabled,
    ]).apply(([realm, externalIp, min, max, tlsEnabled]) => {
      const lines = [
        "listening-port=3478",
        "listening-ip=0.0.0.0",
        "relay-ip=0.0.0.0",
        `min-port=${min}`,
        `max-port=${max}`,
        `realm=${realm}`,
        "",
        "lt-cred-mech",
        "use-auth-secret",
        "",
        "fingerprint",
        "stale-nonce=600",
        "no-cli",
        "no-loopback-peers",
        "no-multicast-peers",
        "no-tcp-relay",
        "",
        "denied-peer-ip=10.0.0.0-10.255.255.255",
        "denied-peer-ip=172.16.0.0-172.31.255.255",
        "denied-peer-ip=192.168.0.0-192.168.255.255",
        "denied-peer-ip=100.64.0.0-100.127.255.255",
        "denied-peer-ip=169.254.0.0-169.254.255.255",
        "",
        "verbose",
      ];

      if (externalIp) {
        lines.splice(4, 0, `external-ip=${externalIp}`);
      }

      if (tlsEnabled) {
        lines.splice(1, 0, "tls-listening-port=5349");
        lines.push("");
        lines.push("cert=/etc/coturn/certs/tls.crt");
        lines.push("pkey=/etc/coturn/certs/tls.key");
        lines.push("cipher-list=ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384");
        lines.push("no-tlsv1");
        lines.push("no-tlsv1_1");
      }

      return lines.join("\n");
    });

    this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      data: {
        "turnserver.conf": configContent,
      },
    }, defaultResourceOptions);

    const volumes: k8s.types.input.core.v1.Volume[] = [
      {
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      },
      {
        name: "secret",
        secret: {
          secretName: this.secret.metadata.name,
        },
      },
    ];

    const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
      {
        name: "config",
        mountPath: "/etc/coturn/turnserver.conf",
        subPath: "turnserver.conf",
        readOnly: true,
      },
      {
        name: "secret",
        mountPath: "/etc/coturn/secret",
        readOnly: true,
      },
    ];

    if (args.tls?.enabled && tlsSecretName) {
      volumes.push({
        name: "tls-certs",
        secret: {
          secretName: tlsSecretName,
        },
      });
      volumeMounts.push({
        name: "tls-certs",
        mountPath: "/etc/coturn/certs",
        readOnly: true,
      });
    }

    const containerPorts: k8s.types.input.core.v1.ContainerPort[] = [
      {
        containerPort: 3478,
        name: "stun-tcp",
        protocol: "TCP",
      },
      {
        containerPort: 3478,
        name: "stun-udp",
        protocol: "UDP",
      },
    ];

    if (args.tls?.enabled) {
      containerPorts.push({
        containerPort: 5349,
        name: "turns-tcp",
        protocol: "TCP",
      });
      containerPorts.push({
        containerPort: 5349,
        name: "turns-udp",
        protocol: "UDP",
      });
    }

    const containerSecurityContext: k8s.types.input.core.v1.SecurityContext = {
      runAsNonRoot: true,
      runAsUser: 65534,
      runAsGroup: 65534,
      readOnlyRootFilesystem: false,
      capabilities: {
        drop: ["ALL"],
        add: ["NET_BIND_SERVICE"],
      },
    };

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
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
            labels,
          },
          spec: {
            hostNetwork: args.networkMode === "host",
            dnsPolicy: args.networkMode === "host" ? "ClusterFirstWithHostNet" : "ClusterFirst",
            nodeSelector: args.nodeSelector,
            tolerations: args.tolerations,
            securityContext: {},
            containers: [{
              name: "coturn",
              image: DOCKER_IMAGES.COTURN.image,
              imagePullPolicy: "IfNotPresent",
              args: [
                "-c", "/etc/coturn/turnserver.conf",
                "--static-auth-secret=$(cat /etc/coturn/secret/auth-secret)",
                "--log-file=stdout",
              ],
              ports: containerPorts,
              env: [{
                name: "DETECT_EXTERNAL_IP",
                value: args.externalIp ? "no" : "yes",
              }],
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
                  port: 3478,
                },
                initialDelaySeconds: 10,
                periodSeconds: 30,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                tcpSocket: {
                  port: 3478,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            }],
            volumes,
          },
        },
      },
    }, defaultResourceOptions);

    if (args.networkMode !== "host") {
      const servicePorts: k8s.types.input.core.v1.ServicePort[] = [
        {
          port: 3478,
          targetPort: 3478,
          protocol: "TCP",
          name: "stun-tcp",
        },
        {
          port: 3478,
          targetPort: 3478,
          protocol: "UDP",
          name: "stun-udp",
        },
      ];

      if (args.tls?.enabled) {
        servicePorts.push({
          port: 5349,
          targetPort: 5349,
          protocol: "TCP",
          name: "turns-tcp",
        });
        servicePorts.push({
          port: 5349,
          targetPort: 5349,
          protocol: "UDP",
          name: "turns-udp",
        });
      }

      this.service = new k8s.core.v1.Service(`${name}-service`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels,
          annotations: args.service?.annotations,
        },
        spec: {
          type: args.service?.type || "ClusterIP",
          externalTrafficPolicy: args.service?.type === "LoadBalancer" ? "Local" : undefined,
          loadBalancerIP: args.service?.loadBalancerIP,
          selector: labels,
          ports: servicePorts,
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      secret: this.secret,
      authSecret: this.authSecret,
      certificate: this.certificate,
    });
  }

  public getStunUrl(host?: pulumi.Input<string>): pulumi.Output<string> {
    if (host) {
      return pulumi.interpolate`stun:${host}:3478`;
    }
    if (this.service) {
      return pulumi.interpolate`stun:${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:3478`;
    }
    return pulumi.output("stun:localhost:3478");
  }

  public getTurnUrl(host?: pulumi.Input<string>): pulumi.Output<string> {
    if (host) {
      return pulumi.interpolate`turn:${host}:3478`;
    }
    if (this.service) {
      return pulumi.interpolate`turn:${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:3478`;
    }
    return pulumi.output("turn:localhost:3478");
  }

  public getTurnsUrl(host?: pulumi.Input<string>): pulumi.Output<string> {
    if (host) {
      return pulumi.interpolate`turns:${host}:5349`;
    }
    if (this.service) {
      return pulumi.interpolate`turns:${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:5349`;
    }
    return pulumi.output("turns:localhost:5349");
  }

  public getServiceName(): pulumi.Output<string> | undefined {
    return this.service?.metadata.name;
  }
}
