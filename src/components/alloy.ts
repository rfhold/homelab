import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { Certificate } from "./certificate";

export interface AlloyArgs {
  namespace: pulumi.Input<string>;

  config?: pulumi.Input<string>;

  clustering?: {
    enabled?: boolean;
    name?: pulumi.Input<string>;
  };

  replicas?: number;

  controllerType?: "daemonset" | "deployment" | "statefulset";

  telemetryEndpoints?: {
    mimir?: {
      queryFrontend: pulumi.Input<string>;
      distributor: pulumi.Input<string>;
    };
    loki?: {
      gateway: pulumi.Input<string>;
    };
    tempo?: {
      distributor: pulumi.Input<string>;
    };
    pyroscope?: {
      write: pulumi.Input<string>;
    };
  };

  tenantId?: pulumi.Input<string>;

  service?: {
    type?: "ClusterIP" | "LoadBalancer" | "NodePort";
    loadBalancerIP?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
  };

  certificate?: {
    enabled?: boolean;
    hostname: pulumi.Input<string>;
    issuerRef: pulumi.Input<string>;
    secretName?: pulumi.Input<string>;
  };

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    hostname?: pulumi.Input<string>;
    tls?: {
      secretName?: pulumi.Input<string>;
    };
  };

  resources?: {
    requests?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
    limits?: {
      cpu?: pulumi.Input<string>;
      memory?: pulumi.Input<string>;
    };
  };

  serviceAccount?: {
    annotations?: Record<string, pulumi.Input<string>>;
  };

  mounts?: {
    varlog?: boolean;
    dockercontainers?: boolean;
  };

  extraPorts?: Array<{
    name: string;
    port: number;
    targetPort: number;
    protocol?: string;
  }>;

  extraEnv?: Array<{
    name: string;
    value?: pulumi.Input<string>;
    valueFrom?: any;
  }>;

  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;

  httpRoute?: {
    hostname: pulumi.Input<string>;
    gatewayName?: pulumi.Input<string>;
    gatewayNamespace?: pulumi.Input<string>;
  };
}

export class Alloy extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly namespace: pulumi.Output<string>;
  public readonly serviceEndpoint: pulumi.Output<string>;
  public readonly profilingEndpoint: pulumi.Output<string>;
  public readonly certificate?: Certificate;

  private readonly chartReleaseName: string;
  private readonly httpRouteHostname?: pulumi.Input<string>;

  constructor(name: string, args: AlloyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Alloy", name, args, opts);

    const chartConfig = HELM_CHARTS.ALLOY;
    this.chartReleaseName = `${name}-chart`;
    this.namespace = pulumi.output(args.namespace);
    this.httpRouteHostname = args.httpRoute?.hostname;

    if (args.certificate?.enabled) {
      const secretName = args.certificate.secretName || `${name}-tls`;
      this.certificate = new Certificate(
        `${name}-cert`,
        {
          namespace: args.namespace,
          name: `${name}-certificate`,
          secretName: secretName,
          dnsNames: [args.certificate.hostname],
          issuerRef: args.certificate.issuerRef,
        },
        { parent: this }
      );
    }

    const telemetryPorts = [
      { name: "otlp-grpc", port: 4317, targetPort: 4317, protocol: "TCP" },
      { name: "otlp-http", port: 4318, targetPort: 4318, protocol: "TCP" },
      { name: "loki-push", port: 3100, targetPort: 3100, protocol: "TCP" },
      { name: "prom-write", port: 9090, targetPort: 9090, protocol: "TCP" },
      { name: "faro", port: 12347, targetPort: 12347, protocol: "TCP" },
      { name: "pyroscope", port: 4040, targetPort: 4040, protocol: "TCP" },
    ];

    const certSecretName = args.certificate?.enabled ? (args.certificate.secretName || `${name}-tls`) : undefined;

    const configContent = args.telemetryEndpoints
      ? this.generateRiverConfig(
          args.telemetryEndpoints,
          pulumi.output(args.tenantId || "0"),
          certSecretName ? true : false
        )
      : args.config || "";

    const extraVolumes = [];
    const extraVolumeMounts = [];
    
    if (certSecretName) {
      extraVolumes.push({
        name: "tls-certs",
        secret: {
          secretName: certSecretName,
        },
      });
      extraVolumeMounts.push({
        name: "tls-certs",
        mountPath: "/etc/alloy/tls",
        readOnly: true,
      });
    }

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(chartConfig, args.namespace),
        values: {
          alloy: {
            configMap: {
              create: true,
              content: configContent,
            },

            ...(args.clustering && {
              clustering: {
                enabled: args.clustering.enabled ?? false,
                ...(args.clustering.name && { name: args.clustering.name }),
              },
            }),

            stabilityLevel: "generally-available",

            enableReporting: false,

            extraPorts: [...telemetryPorts, ...(args.extraPorts || [])],

            ...(args.extraEnv && { extraEnv: args.extraEnv }),

            mounts: {
              ...(args.mounts || {}),
              ...(extraVolumeMounts.length > 0 && { extra: extraVolumeMounts }),
            },

            ...(args.resources && { resources: args.resources }),
          },

          controller: {
            type: args.telemetryEndpoints ? "deployment" : args.controllerType ?? "daemonset",
            ...(args.replicas && { replicas: args.replicas }),
            ...(!args.replicas && args.telemetryEndpoints && { replicas: 1 }),
            
            ...(certSecretName && {
              podAnnotations: {
                "secret.reloader.stakater.com/reload": certSecretName,
              },
            }),

            ...(extraVolumes.length > 0 && {
              volumes: {
                extra: extraVolumes,
              },
            }),
          },

          ...(args.serviceAccount?.annotations && {
            serviceAccount: {
              create: true,
              annotations: args.serviceAccount.annotations,
            },
          }),

          service: {
            enabled: true,
            type: args.service?.type || "ClusterIP",
            ...(args.service?.loadBalancerIP && { loadBalancerIP: args.service.loadBalancerIP }),
            annotations: {
              ...(args.service?.annotations || {}),
              "k8s.grafana.com/scrape": "true",
              "k8s.grafana.com/job": "alloy/alloy",
              "k8s.grafana.com/metrics.path": "/metrics",
              "k8s.grafana.com/metrics.portNumber": "12345",
              "k8s.grafana.com/metrics.scheme": "http",
              "k8s.grafana.com/metrics.scrapeInterval": "60s",
            },
          },

          serviceMonitor: {
            enabled: false,
          },

          ...(args.tolerations && { tolerations: args.tolerations }),

          ...(args.ingress && {
            ingress: {
              enabled: args.ingress.enabled ?? false,
              ...(args.ingress.className && { ingressClassName: args.ingress.className }),
              annotations: args.ingress.annotations ?? {},
              hosts: args.ingress.hostname ? [args.ingress.hostname] : [],
              tls: args.ingress.tls
                ? [
                    {
                      secretName: args.ingress.tls.secretName,
                      hosts: args.ingress.hostname ? [args.ingress.hostname] : [],
                    },
                  ]
                : [],
            },
          }),
        },
      },
      { parent: this }
    );

    this.serviceEndpoint = args.certificate?.enabled
      ? pulumi.interpolate`https://${args.certificate.hostname}`
      : pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:12345`;

    this.profilingEndpoint = args.certificate?.enabled
      ? pulumi.interpolate`https://${args.certificate.hostname}:4040`
      : pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:4040`;

    if (args.httpRoute && args.telemetryEndpoints?.loki) {
      new k8s.apiextensions.CustomResource(`${name}-faro-httproute`, {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
          name: `${name}-faro`,
          namespace: args.namespace,
        },
        spec: {
          parentRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: args.httpRoute.gatewayName ?? "default-gateway",
            namespace: args.httpRoute.gatewayNamespace ?? "ingress",
          }],
          hostnames: [args.httpRoute.hostname],
          rules: [{
            matches: [{ path: { type: "Exact", value: "/collect" } }],
            backendRefs: [{
              name: this.chartReleaseName,
              port: 12347,
            }],
          }],
        },
      }, { parent: this, dependsOn: [this.chart] });

      new k8s.apiextensions.CustomResource(`${name}-faro-cors`, {
        apiVersion: "gateway.kgateway.dev/v1alpha1",
        kind: "TrafficPolicy",
        metadata: {
          name: `${name}-faro-cors`,
          namespace: args.namespace,
        },
        spec: {
          targetRefs: [{
            group: "gateway.networking.k8s.io",
            kind: "HTTPRoute",
            name: `${name}-faro`,
          }],
          cors: {
            allowOrigins: ["*"],
            allowMethods: ["POST", "OPTIONS"],
            allowHeaders: ["Content-Type", "x-faro-session-id", "x-api-key", "traceparent", "tracestate", "baggage"],
            maxAge: 86400,
          },
        },
      }, { parent: this, dependsOn: [this.chart] });
    }

    this.registerOutputs({
      chart: this.chart,
      namespace: this.namespace,
      serviceEndpoint: this.serviceEndpoint,
      profilingEndpoint: this.profilingEndpoint,
      certificate: this.certificate,
    });
  }

  private generateRiverConfig(
    endpoints: NonNullable<AlloyArgs["telemetryEndpoints"]>,
    tenantId: pulumi.Output<string>,
    enableTLS: boolean = false
  ): pulumi.Output<string> {
    return pulumi
        .all({
          mimirQueryFrontend: endpoints.mimir?.queryFrontend,
          mimirDistributor: endpoints.mimir?.distributor,
          lokiGateway: endpoints.loki?.gateway,
          tempoDistributor: endpoints.tempo?.distributor,
          pyroscopeWrite: endpoints.pyroscope?.write,
          tenant: tenantId,
        })
      .apply(({ mimirQueryFrontend, mimirDistributor, lokiGateway, tempoDistributor, pyroscopeWrite, tenant }) => {
        const config: string[] = [];

        const traceOutputs: string[] = [];
        if (tempoDistributor) {
          traceOutputs.push("      otelcol.processor.batch.default.input,");
        }
        if (mimirDistributor) {
          traceOutputs.push("      otelcol.processor.transform.strip_resource_attrs.input,");
        }

        const tlsConfig = enableTLS ? `
    tls {
      cert_file = "/etc/alloy/tls/tls.crt"
      key_file  = "/etc/alloy/tls/tls.key"
    }` : "";

        config.push(`otelcol.receiver.otlp "default" {
  grpc {
    endpoint = "0.0.0.0:4317"${tlsConfig}
  }

  http {
    endpoint = "0.0.0.0:4318"${tlsConfig}
  }

  output {
    metrics = [otelcol.processor.batch.default.input]
    logs    = [otelcol.processor.batch.default.input]${traceOutputs.length > 0 ? `
    traces  = [
${traceOutputs.join("\n")}
    ]` : ""}
  }
}`);

        if (lokiGateway) {
          config.push(`loki.source.api "native" {
  http {
    listen_address = "0.0.0.0"
    listen_port    = 3100
  }

  forward_to = [loki.write.loki.receiver]
}`);
        }

        if (mimirDistributor) {
          config.push(`prometheus.receive_http "native" {
  http {
    listen_address = "0.0.0.0"
    listen_port    = 9090
  }

  forward_to = [prometheus.remote_write.mimir.receiver]
}`);
        }

        const batchOutputs: string[] = [];
        if (mimirDistributor) {
          batchOutputs.push("    metrics = [otelcol.exporter.otlphttp.mimir.input]");
        }
        if (lokiGateway) {
          batchOutputs.push("    logs    = [otelcol.exporter.otlphttp.loki.input]");
        }
        if (tempoDistributor) {
          batchOutputs.push("    traces  = [otelcol.exporter.otlp.tempo.input]");
        }

        if (batchOutputs.length > 0) {
          config.push(`otelcol.processor.batch "default" {
  send_batch_size     = 8192
  send_batch_max_size = 16384
  timeout             = "2s"

  output {
${batchOutputs.join("\n")}
  }
}`);
        }

        if (mimirDistributor) {
          config.push(`otelcol.processor.transform "strip_resource_attrs" {
  error_mode = "ignore"

  trace_statements {
    context    = "resource"
    statements = [\`keep_keys(attributes, ["service.name"])\`]
  }

  output {
    traces = [
      otelcol.connector.spanmetrics.default.input,
      otelcol.connector.servicegraph.default.input,
    ]
  }
}`);

          config.push(`otelcol.connector.spanmetrics "default" {
  histogram {
    explicit {
      buckets = ["1ms", "10ms", "100ms", "1s", "10s"]
    }
  }

  output {
    metrics = [otelcol.exporter.otlphttp.mimir.input]
  }
}`);

          config.push(`otelcol.connector.servicegraph "default" {
  latency_histogram_buckets = ["1ms", "10ms", "100ms", "1s", "10s"]

  output {
    metrics = [otelcol.exporter.otlphttp.mimir.input]
  }
}`);
        }

        if (mimirDistributor) {
          config.push(`otelcol.exporter.otlphttp "mimir" {
  client {
    endpoint = "${mimirDistributor}/otlp"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }
    tls {
      insecure = true
    }
    compression = "gzip"
  }
}`);
        }

        if (lokiGateway) {
          config.push(`otelcol.exporter.otlphttp "loki" {
  client {
    endpoint = "${lokiGateway}/otlp"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }
    tls {
      insecure = true
    }
    compression = "gzip"
  }
}`);
        }

        if (tempoDistributor) {
          config.push(`otelcol.exporter.otlp "tempo" {
  client {
    endpoint = "${tempoDistributor}"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }
    tls {
      insecure = true
    }
    compression = "gzip"
  }
}`);
        }

        if (lokiGateway) {
          const faroTraceOutput = tempoDistributor
            ? `\n    traces = [otelcol.exporter.otlp.tempo.input]`
            : "";

          config.push(`faro.receiver "default" {
  extra_log_labels = {
    app  = "",
    kind = "",
  }

  server {
    listen_address = "0.0.0.0"
    listen_port    = 12347
    max_allowed_payload_size = "5MiB"

    rate_limiting {
      enabled    = true
      strategy   = "global"
      rate       = 50
      burst_size = 100
    }
  }

  sourcemaps {
    download = false
  }

  output {
    logs   = [loki.process.faro.receiver]${faroTraceOutput}
  }
}`);

          config.push(`loki.process "faro" {
  forward_to = [loki.write.loki.receiver]

  stage.logfmt {
    mapping = {
      "kind"         = "",
      "service_name" = "",
      "app"          = "app_name",
    }
  }

  stage.labels {
    values = {
      "kind"         = "kind",
      "service_name" = "service_name",
      "app"          = "app",
    }
  }
}`);
        }

        if (lokiGateway) {
          config.push(`loki.write "loki" {
  endpoint {
    url = "${lokiGateway}/loki/api/v1/push"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }

  }
}`);
        }

        if (mimirDistributor) {
          config.push(`prometheus.remote_write "mimir" {
  endpoint {
    url = "${mimirDistributor}/api/v1/push"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }

    queue_config {
      max_samples_per_send = 500
      max_shards           = 10
    }
  }
}`);
        }

        if (pyroscopeWrite) {
          config.push(`pyroscope.receive_http "default" {
  http {
    listen_address = "0.0.0.0"
    listen_port    = 4040${tlsConfig}
  }

  forward_to = [pyroscope.write.default.receiver]
}`);

          config.push(`pyroscope.write "default" {
  endpoint {
    url = "${pyroscopeWrite}"
    headers = {
      "X-Scope-OrgID" = "${tenant}",
    }
  }
}`);
        }

        return config.join("\n\n");
      });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.serviceEndpoint;
  }

  public getOtlpGrpcEndpoint(): pulumi.Output<string> {
    if (this.certificate) {
      return this.certificate.getDnsNames().apply((names) => `${names[0]}:4317`);
    }
    return pulumi.interpolate`${this.chartReleaseName}-alloy.${this.namespace}:4317`;
  }

  public getOtlpHttpEndpoint(): pulumi.Output<string> {
    if (this.certificate) {
      return this.certificate.getDnsNames().apply((names) => `https://${names[0]}:4318`);
    }
    return pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:4318`;
  }

  public getLokiPushEndpoint(): pulumi.Output<string> {
    if (this.certificate) {
      return this.certificate.getDnsNames().apply((names) => `https://${names[0]}:3100`);
    }
    return pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:3100`;
  }

  public getPrometheusRemoteWriteEndpoint(): pulumi.Output<string> {
    if (this.certificate) {
      return this.certificate.getDnsNames().apply((names) => `https://${names[0]}:9090`);
    }
    return pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:9090`;
  }

  public getFaroCollectEndpoint(): pulumi.Output<string> {
    if (this.httpRouteHostname) {
      return pulumi.output(this.httpRouteHostname).apply((h) => `https://${h}/collect`);
    }
    if (this.certificate) {
      return this.certificate.getDnsNames().apply((names) => `https://${names[0]}:12347/collect`);
    }
    return pulumi.interpolate`http://${this.chartReleaseName}-alloy.${this.namespace}:12347/collect`;
  }

  public getProfilingEndpoint(): pulumi.Output<string> {
    return this.profilingEndpoint;
  }
}
