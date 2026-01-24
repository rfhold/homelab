import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface NvidiaDcgmExporterArgs {
  namespace: pulumi.Input<string>;
  
  metricsConfig?: pulumi.Input<string>;
  
  collectionInterval?: pulumi.Input<number>;
  devices?: pulumi.Input<string>;
  
  image?: pulumi.Input<string>;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
  runtimeClassName?: pulumi.Input<string>;
  
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

export class NvidiaDcgmExporter extends pulumi.ComponentResource {
  public readonly daemonSet: k8s.apps.v1.DaemonSet;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap?: k8s.core.v1.ConfigMap;

  constructor(name: string, args: NvidiaDcgmExporterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:NvidiaDcgmExporter", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = {
      app: "dcgm-exporter",
      "app.kubernetes.io/name": "dcgm-exporter",
      component: name,
    };

    const volumes: pulumi.Input<k8s.types.input.core.v1.Volume>[] = [
      {
        name: "pod-gpu-resources",
        hostPath: {
          path: "/var/lib/kubelet/pod-resources",
        },
      },
    ];

    const volumeMounts: pulumi.Input<k8s.types.input.core.v1.VolumeMount>[] = [
      {
        name: "pod-gpu-resources",
        mountPath: "/var/lib/kubelet/pod-resources",
        readOnly: true,
      },
    ];

    const containerArgs: pulumi.Input<string>[] = [];

    if (args.metricsConfig) {
      this.configMap = new k8s.core.v1.ConfigMap(`${name}-metrics-config`, {
        metadata: {
          namespace: args.namespace,
          labels: labels,
        },
        data: {
          "metrics.csv": args.metricsConfig,
        },
      }, defaultResourceOptions);

      volumes.push({
        name: "metrics-config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      });

      volumeMounts.push({
        name: "metrics-config",
        mountPath: "/etc/dcgm-exporter/metrics.csv",
        subPath: "metrics.csv",
      });

      containerArgs.push("-f", "/etc/dcgm-exporter/metrics.csv");
    }

    const env: pulumi.Input<k8s.types.input.core.v1.EnvVar>[] = [
      { name: "DCGM_EXPORTER_KUBERNETES", value: "true" },
      { name: "DCGM_EXPORTER_LISTEN", value: ":9400" },
      {
        name: "NODE_NAME",
        valueFrom: { fieldRef: { fieldPath: "spec.nodeName" } },
      },
    ];

    if (args.collectionInterval) {
      env.push({
        name: "DCGM_EXPORTER_INTERVAL",
        value: pulumi.interpolate`${args.collectionInterval}`,
      });
    }

    if (args.devices) {
      env.push({
        name: "DCGM_EXPORTER_DEVICES_STR",
        value: args.devices,
      });
    }

    const defaultNodeSelector = {
      "nvidia.com/gpu.present": "true",
    };

    const finalNodeSelector = args.nodeSelector || defaultNodeSelector;

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
            nodeSelector: finalNodeSelector,
            ...(args.tolerations && { tolerations: args.tolerations }),
            ...(args.runtimeClassName && { runtimeClassName: args.runtimeClassName }),
            containers: [{
              name: "dcgm-exporter",
              image: args.image || DOCKER_IMAGES.NVIDIA_DCGM_EXPORTER.image,
              imagePullPolicy: "IfNotPresent",
              ports: [{
                name: "metrics",
                containerPort: 9400,
                protocol: "TCP",
              }],
              env: env,
              ...(containerArgs.length > 0 && { args: containerArgs }),
              volumeMounts: volumeMounts,
              securityContext: {
                runAsUser: 0,
                runAsNonRoot: false,
                capabilities: {
                  add: ["SYS_ADMIN"],
                },
              },
              livenessProbe: {
                httpGet: { path: "/health", port: 9400 },
                initialDelaySeconds: 45,
                periodSeconds: 5,
                timeoutSeconds: 5,
              },
              readinessProbe: {
                httpGet: { path: "/health", port: 9400 },
                initialDelaySeconds: 45,
                periodSeconds: 5,
                timeoutSeconds: 5,
              },
              resources: args.resources || {
                requests: {
                  memory: "256Mi",
                  cpu: "100m",
                },
                limits: {
                  memory: "512Mi",
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
      "k8s.grafana.com/job": "dcgm-exporter",
      "k8s.grafana.com/metrics.portNumber": "9400",
      "k8s.grafana.com/metrics.path": "/metrics",
      "k8s.grafana.com/metrics.scheme": "http",
      "k8s.grafana.com/metrics.scrapeInterval": "15s",
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
          port: 9400,
          targetPort: 9400,
          protocol: "TCP",
        }],
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      daemonSet: this.daemonSet,
      service: this.service,
      configMap: this.configMap,
    });
  }

  public getMetricsEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:9400/metrics`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:9400`;
  }
}
