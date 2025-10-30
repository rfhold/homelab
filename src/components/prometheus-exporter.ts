import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface PrometheusExporterArgs {
  namespace: pulumi.Input<string>;

  deployment: {
    image: pulumi.Input<string>;
    imagePullPolicy?: pulumi.Input<"Always" | "IfNotPresent" | "Never">;
    replicas?: number;

    containers?: pulumi.Input<k8s.types.input.core.v1.Container>[];
    volumes?: pulumi.Input<k8s.types.input.core.v1.Volume>[];
    volumeMounts?: pulumi.Input<k8s.types.input.core.v1.VolumeMount>[];
    nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
    tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
    securityContext?: pulumi.Input<k8s.types.input.core.v1.PodSecurityContext>;
    containerSecurityContext?: pulumi.Input<k8s.types.input.core.v1.SecurityContext>;
    serviceAccountName?: pulumi.Input<string>;
    hostNetwork?: pulumi.Input<boolean>;
    dnsPolicy?: pulumi.Input<string>;
    runtimeClassName?: pulumi.Input<string>;
    
    env?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.EnvVar>[]>;
    args?: pulumi.Input<pulumi.Input<string>[]>;
    command?: pulumi.Input<pulumi.Input<string>[]>;
    
    resources?: pulumi.Input<k8s.types.input.core.v1.ResourceRequirements>;
    
    livenessProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
    readinessProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
    startupProbe?: pulumi.Input<k8s.types.input.core.v1.Probe>;
  };

  metrics: {
    port: number;
    portName?: string;
    path?: string;
    scheme?: "http" | "https";
    scrapeInterval?: string;
  };

  service?: {
    type?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    labels?: Record<string, pulumi.Input<string>>;
    additionalPorts?: Array<{
      name: string;
      port: number;
      targetPort?: number;
      protocol?: string;
    }>;
  };

  configMap?: {
    data: Record<string, pulumi.Input<string>>;
    mountPath: string;
    subPath?: string;
  };

  secret?: {
    data: Record<string, pulumi.Input<string>>;
    mountPath: string;
    subPath?: string;
  };

  labels?: Record<string, pulumi.Input<string>>;
}

export class PrometheusExporter extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly configMap?: k8s.core.v1.ConfigMap;
  public readonly secret?: k8s.core.v1.Secret;

  constructor(name: string, args: PrometheusExporterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:PrometheusExporter", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const defaultLabels = {
      app: "prometheus-exporter",
      component: name,
    };

    const labels = {
      ...defaultLabels,
      ...args.labels,
    };

    if (args.configMap) {
      this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
        metadata: {
          namespace: args.namespace,
          labels: labels,
        },
        data: args.configMap.data,
      }, defaultResourceOptions);
    }

    if (args.secret) {
      this.secret = new k8s.core.v1.Secret(`${name}-secret`, {
        metadata: {
          namespace: args.namespace,
          labels: labels,
        },
        stringData: args.secret.data,
      }, defaultResourceOptions);
    }

    const volumes: pulumi.Input<k8s.types.input.core.v1.Volume>[] = args.deployment.volumes || [];
    const volumeMounts: pulumi.Input<k8s.types.input.core.v1.VolumeMount>[] = args.deployment.volumeMounts || [];

    if (this.configMap && args.configMap) {
      volumes.push({
        name: "config",
        configMap: {
          name: this.configMap.metadata.name,
        },
      });
      volumeMounts.push({
        name: "config",
        mountPath: args.configMap.mountPath,
        ...(args.configMap.subPath && { subPath: args.configMap.subPath }),
      });
    }

    if (this.secret && args.secret) {
      volumes.push({
        name: "secret",
        secret: {
          secretName: this.secret.metadata.name,
        },
      });
      volumeMounts.push({
        name: "secret",
        mountPath: args.secret.mountPath,
        ...(args.secret.subPath && { subPath: args.secret.subPath }),
      });
    }

    const metricsPortName = args.metrics.portName || "metrics";

    const mainContainer: k8s.types.input.core.v1.Container = {
      name: "exporter",
      image: args.deployment.image,
      imagePullPolicy: args.deployment.imagePullPolicy || "IfNotPresent",
      ports: [{
        name: metricsPortName,
        containerPort: args.metrics.port,
        protocol: "TCP",
      }],
      ...(volumeMounts.length > 0 && { volumeMounts }),
      ...(args.deployment.env && { env: args.deployment.env }),
      ...(args.deployment.args && { args: args.deployment.args }),
      ...(args.deployment.command && { command: args.deployment.command }),
      ...(args.deployment.resources && { resources: args.deployment.resources }),
      ...(args.deployment.containerSecurityContext && { securityContext: args.deployment.containerSecurityContext }),
      ...(args.deployment.livenessProbe && { livenessProbe: args.deployment.livenessProbe }),
      ...(args.deployment.readinessProbe && { readinessProbe: args.deployment.readinessProbe }),
      ...(args.deployment.startupProbe && { startupProbe: args.deployment.startupProbe }),
    };

    const containers: pulumi.Input<k8s.types.input.core.v1.Container>[] = [
      mainContainer,
      ...(args.deployment.containers || []),
    ];

    const deploymentSpec: any = {
      replicas: args.deployment.replicas || 1,
      selector: {
        matchLabels: labels,
      },
      template: {
        metadata: {
          labels: labels,
        },
        spec: {
          containers,
          ...(volumes.length > 0 && { volumes }),
          ...(args.deployment.nodeSelector && { nodeSelector: args.deployment.nodeSelector }),
          ...(args.deployment.tolerations && { tolerations: args.deployment.tolerations }),
          ...(args.deployment.securityContext && { securityContext: args.deployment.securityContext }),
          ...(args.deployment.serviceAccountName && { serviceAccountName: args.deployment.serviceAccountName }),
          ...(args.deployment.hostNetwork !== undefined && { hostNetwork: args.deployment.hostNetwork }),
          ...(args.deployment.dnsPolicy && { dnsPolicy: args.deployment.dnsPolicy }),
          ...(args.deployment.runtimeClassName && { runtimeClassName: args.deployment.runtimeClassName }),
        },
      },
    };

    if (args.deployment.hostNetwork) {
      deploymentSpec.strategy = {
        type: "Recreate",
      };
    }

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: labels,
      },
      spec: deploymentSpec,
    }, defaultResourceOptions);

    const grafanaAnnotations = {
      "k8s.grafana.com/scrape": "true",
      "k8s.grafana.com/job": name,
      "k8s.grafana.com/instance": name,
      "k8s.grafana.com/metrics.path": args.metrics.path || "/metrics",
      "k8s.grafana.com/metrics.portNumber": args.metrics.port.toString(),
      "k8s.grafana.com/metrics.scheme": args.metrics.scheme || "http",
      "k8s.grafana.com/metrics.scrapeInterval": args.metrics.scrapeInterval || "60s",
    };

    const serviceAnnotations = {
      ...grafanaAnnotations,
      ...args.service?.annotations,
    };

    const servicePorts: pulumi.Input<k8s.types.input.core.v1.ServicePort>[] = [
      {
        name: metricsPortName,
        port: args.metrics.port,
        targetPort: args.metrics.port,
        protocol: "TCP",
      },
    ];

    if (args.service?.additionalPorts) {
      for (const additionalPort of args.service.additionalPorts) {
        servicePorts.push({
          name: additionalPort.name,
          port: additionalPort.port,
          targetPort: additionalPort.targetPort || additionalPort.port,
          protocol: additionalPort.protocol || "TCP",
        });
      }
    }

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels: {
          ...labels,
          ...args.service?.labels,
        },
        annotations: serviceAnnotations,
      },
      spec: {
        type: args.service?.type || "ClusterIP",
        selector: labels,
        ports: servicePorts,
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      configMap: this.configMap,
      secret: this.secret,
    });
  }

  public getMetricsEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:${this.service.spec.ports[0].port}${this.service.metadata.annotations["k8s.grafana.com/metrics.path"]}`;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local:${this.service.spec.ports[0].port}`;
  }
}
