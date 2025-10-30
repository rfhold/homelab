import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface SmartctlExporterArgs {
  namespace: pulumi.Input<string>;
  
  image?: pulumi.Input<string>;
  interval?: pulumi.Input<string>;
  rescan?: pulumi.Input<string>;
  deviceExclude?: pulumi.Input<string>;
  logLevel?: pulumi.Input<string>;
  
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
  
  resources?: pulumi.Input<{
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  }>;
}

export class SmartctlExporter extends pulumi.ComponentResource {
  public readonly daemonSet: k8s.apps.v1.DaemonSet;
  public readonly service: k8s.core.v1.Service;

  constructor(name: string, args: SmartctlExporterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:SmartctlExporter", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "smartctl-exporter",
      "app.kubernetes.io/name": "smartctl-exporter",
      component: name,
    };

    const volumes: pulumi.Input<k8s.types.input.core.v1.Volume>[] = [
      {
        name: "dev",
        hostPath: {
          path: "/dev",
        },
      },
      {
        name: "udev",
        hostPath: {
          path: "/run/udev",
        },
      },
    ];

    const volumeMounts: pulumi.Input<k8s.types.input.core.v1.VolumeMount>[] = [
      {
        name: "dev",
        mountPath: "/dev",
        readOnly: true,
      },
      {
        name: "udev",
        mountPath: "/run/udev",
        readOnly: true,
      },
    ];

    const containerArgs: pulumi.Input<string>[] = [
      "--web.listen-address=:9633",
    ];

    if (args.interval) {
      containerArgs.push(pulumi.interpolate`--smartctl.interval=${args.interval}`);
    } else {
      containerArgs.push("--smartctl.interval=60s");
    }

    if (args.rescan) {
      containerArgs.push(pulumi.interpolate`--smartctl.rescan=${args.rescan}`);
    } else {
      containerArgs.push("--smartctl.rescan=10m");
    }

    if (args.deviceExclude) {
      containerArgs.push(pulumi.interpolate`--smartctl.device-exclude=${args.deviceExclude}`);
    } else {
      containerArgs.push("--smartctl.device-exclude=^(loop|dm-|ram|zram|sr|rbd|nbd)");
    }

    if (args.logLevel) {
      containerArgs.push(pulumi.interpolate`--log.level=${args.logLevel}`);
    } else {
      containerArgs.push("--log.level=info");
    }

    this.daemonSet = new k8s.apps.v1.DaemonSet(`${name}-daemonset`, {
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
          spec: {
            ...(args.nodeSelector && { nodeSelector: args.nodeSelector }),
            ...(args.tolerations && { tolerations: args.tolerations }),
            containers: [{
              name: "smartctl-exporter",
              image: args.image || DOCKER_IMAGES.SMARTCTL_EXPORTER.image,
              imagePullPolicy: "IfNotPresent",
              ports: [{
                name: "metrics",
                containerPort: 9633,
                protocol: "TCP",
              }],
              args: containerArgs,
              env: [{
                name: "NODE_NAME",
                valueFrom: {
                  fieldRef: {
                    fieldPath: "spec.nodeName",
                  },
                },
              }],
              volumeMounts: volumeMounts,
              securityContext: {
                runAsUser: 0,
                runAsNonRoot: false,
                privileged: true,
              },
              livenessProbe: {
                httpGet: { path: "/metrics", port: 9633 },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: { path: "/metrics", port: 9633 },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              resources: args.resources || {
                requests: {
                  memory: "64Mi",
                  cpu: "100m",
                },
                limits: {
                  memory: "128Mi",
                  cpu: "500m",
                },
              },
            }],
            volumes: volumes,
          },
        },
      },
    }, defaultResourceOptions);

    const grafanaAnnotations = {
      "k8s.grafana.com/scrape": "true",
      "k8s.grafana.com/job": "smartctl-exporter",
      "k8s.grafana.com/metrics.portNumber": "9633",
      "k8s.grafana.com/metrics.path": "/metrics",
      "k8s.grafana.com/metrics.scheme": "http",
      "k8s.grafana.com/metrics.scrapeInterval": "60s",
      "k8s.grafana.com/metrics.instance": "__meta_kubernetes_pod_node_name",
    };

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
        annotations: grafanaAnnotations,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          name: "metrics",
          port: 9633,
          targetPort: 9633,
          protocol: "TCP",
        }],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      daemonSet: this.daemonSet,
      service: this.service,
    });
  }

  public getMetricsEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:9633/metrics`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:9633`;
  }
}
