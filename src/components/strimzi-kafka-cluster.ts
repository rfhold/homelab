import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export const OBSERVABILITY_KAFKA_TOPICS = {
  mimirIngest: "mimir-ingest",
  tempoTraces: "tempo-traces",
} as const;

const KAFKA_METRICS_CONFIG = `lowercaseOutputName: true
rules:
  - pattern: kafka.server<type=(.+), name=(.+), clientId=(.+), topic=(.+), partition=(.*)><>Value
    name: kafka_server_$1_$2
    type: GAUGE
    labels:
      clientId: "$3"
      topic: "$4"
      partition: "$5"
  - pattern: kafka.server<type=(.+), name=(.+), clientId=(.+), brokerHost=(.+), brokerPort=(.+)><>Value
    name: kafka_server_$1_$2
    type: GAUGE
    labels:
      clientId: "$3"
      broker: "$4:$5"
  - pattern: kafka.server<type=(.+), cipher=(.+), protocol=(.+), listener=(.+), networkProcessor=(.+)><>connections
    name: kafka_server_$1_connections_tls_info
    type: GAUGE
    labels:
      cipher: "$2"
      protocol: "$3"
      listener: "$4"
      networkProcessor: "$5"
  - pattern: kafka.server<type=(.+), clientSoftwareName=(.+), clientSoftwareVersion=(.+), listener=(.+), networkProcessor=(.+)><>connections
    name: kafka_server_$1_connections_software
    type: GAUGE
    labels:
      clientSoftwareName: "$2"
      clientSoftwareVersion: "$3"
      listener: "$4"
      networkProcessor: "$5"
  - pattern: "kafka.server<type=(.+), listener=(.+), networkProcessor=(.+)><>(.+-total):"
    name: kafka_server_$1_$4
    type: COUNTER
    labels:
      listener: "$2"
      networkProcessor: "$3"
  - pattern: "kafka.server<type=(.+), listener=(.+), networkProcessor=(.+)><>(.+):"
    name: kafka_server_$1_$4
    type: GAUGE
    labels:
      listener: "$2"
      networkProcessor: "$3"
  - pattern: kafka.server<type=(.+), listener=(.+), networkProcessor=(.+)><>(.+-total)
    name: kafka_server_$1_$4
    type: COUNTER
    labels:
      listener: "$2"
      networkProcessor: "$3"
  - pattern: kafka.server<type=(.+), listener=(.+), networkProcessor=(.+)><>(.+)
    name: kafka_server_$1_$4
    type: GAUGE
    labels:
      listener: "$2"
      networkProcessor: "$3"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)Percent\\w*><>MeanRate
    name: kafka_$1_$2_$3_percent
    type: GAUGE
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)Percent\\w*><>Value
    name: kafka_$1_$2_$3_percent
    type: GAUGE
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)Percent\\w*, (.+)=(.+)><>Value
    name: kafka_$1_$2_$3_percent
    type: GAUGE
    labels:
      "$4": "$5"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)PerSec\\w*, (.+)=(.+), (.+)=(.+)><>Count
    name: kafka_$1_$2_$3_total
    type: COUNTER
    labels:
      "$4": "$5"
      "$6": "$7"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)PerSec\\w*, (.+)=(.+)><>Count
    name: kafka_$1_$2_$3_total
    type: COUNTER
    labels:
      "$4": "$5"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)PerSec\\w*><>Count
    name: kafka_$1_$2_$3_total
    type: COUNTER
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.+), (.+)=(.+)><>Value
    name: kafka_$1_$2_$3
    type: GAUGE
    labels:
      "$4": "$5"
      "$6": "$7"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.+)><>Value
    name: kafka_$1_$2_$3
    type: GAUGE
    labels:
      "$4": "$5"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)><>Value
    name: kafka_$1_$2_$3
    type: GAUGE
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.+), (.+)=(.+)><>Count
    name: kafka_$1_$2_$3_count
    type: COUNTER
    labels:
      "$4": "$5"
      "$6": "$7"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.*), (.+)=(.+)><>(\\d+)thPercentile
    name: kafka_$1_$2_$3
    type: GAUGE
    labels:
      "$4": "$5"
      "$6": "$7"
      quantile: "0.$8"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.+)><>Count
    name: kafka_$1_$2_$3_count
    type: COUNTER
    labels:
      "$4": "$5"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+), (.+)=(.*)><>(\\d+)thPercentile
    name: kafka_$1_$2_$3
    type: GAUGE
    labels:
      "$4": "$5"
      quantile: "0.$6"
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)><>Count
    name: kafka_$1_$2_$3_count
    type: COUNTER
  - pattern: kafka.(\\w+)<type=(.+), name=(.+)><>(\\d+)thPercentile
    name: kafka_$1_$2_$3
    type: GAUGE
    labels:
      quantile: "0.$4"
  - pattern: "kafka.server<type=raft-metrics><>(.+-total|.+-max):"
    name: kafka_server_raftmetrics_$1
    type: COUNTER
  - pattern: "kafka.server<type=raft-metrics><>(current-state): (.+)"
    name: kafka_server_raftmetrics_$1
    value: 1
    type: UNTYPED
    labels:
      $1: "$2"
  - pattern: "kafka.server<type=raft-metrics><>(.+):"
    name: kafka_server_raftmetrics_$1
    type: GAUGE
  - pattern: "kafka.server<type=raft-channel-metrics><>(.+-total|.+-max):"
    name: kafka_server_raftchannelmetrics_$1
    type: COUNTER
  - pattern: "kafka.server<type=raft-channel-metrics><>(.+):"
    name: kafka_server_raftchannelmetrics_$1
    type: GAUGE
  - pattern: "kafka.server<type=broker-metadata-metrics><>(.+):"
    name: kafka_server_brokermetadatametrics_$1
    type: GAUGE
`;

function metricsAnnotations(job: string, port: string): Record<string, string> {
  return {
    "k8s.grafana.com/scrape": "true",
    "k8s.grafana.com/job": job,
    "k8s.grafana.com/metrics.path": "/metrics",
    "k8s.grafana.com/metrics.portNumber": port,
    "k8s.grafana.com/metrics.scheme": "http",
    "k8s.grafana.com/metrics.scrapeInterval": "30s",
  };
}

export interface KafkaTopicConfig {
  name: string;
  partitions?: pulumi.Input<number>;
  replicas?: pulumi.Input<number>;
  config?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

export interface KafkaConnectionConfig {
  bootstrapServers: pulumi.Output<string>;
  topics: Record<string, string>;
}

export interface StrimziKafkaClusterArgs {
  namespace: pulumi.Input<string>;
  clusterName?: pulumi.Input<string>;
  nodePoolName?: pulumi.Input<string>;
  replicas?: pulumi.Input<number>;
  storage?: {
    size?: pulumi.Input<string>;
    class?: pulumi.Input<string>;
  };
  resources?: pulumi.Input<k8s.types.input.core.v1.ResourceRequirements>;
  jvmOptions?: {
    xms?: pulumi.Input<string>;
    xmx?: pulumi.Input<string>;
  };
  quorumTimeouts?: {
    electionMs?: pulumi.Input<number>;
    fetchMs?: pulumi.Input<number>;
    brokerSessionMs?: pulumi.Input<number>;
  };
  metrics?: {
    enabled?: boolean;
  };
  topics: Record<string, KafkaTopicConfig>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

export class StrimziKafkaCluster extends pulumi.ComponentResource {
  public readonly nodePool: k8s.apiextensions.CustomResource;
  public readonly cluster: k8s.apiextensions.CustomResource;
  public readonly metricsConfig?: k8s.core.v1.ConfigMap;
  public readonly topicOperatorMetricsService?: k8s.core.v1.Service;
  public readonly userOperatorMetricsService?: k8s.core.v1.Service;
  public readonly topics: Record<string, k8s.apiextensions.CustomResource>;
  public readonly connection: KafkaConnectionConfig;

  constructor(name: string, args: StrimziKafkaClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:StrimziKafkaCluster", name, args, opts);

    const clusterName = args.clusterName ?? `${name}-kafka`;
    const nodePoolName = args.nodePoolName ?? pulumi.interpolate`${clusterName}-pool`;
    const replicas = args.replicas ?? 3;
    const minInSyncReplicas = pulumi.output(replicas).apply(value => Math.max(1, value - 1));
    const metricsEnabled = args.metrics?.enabled ?? false;

    if (metricsEnabled) {
      this.metricsConfig = new k8s.core.v1.ConfigMap(`${name}-metrics`, {
        metadata: {
          name: pulumi.interpolate`${clusterName}-metrics`,
          namespace: args.namespace,
          labels: {
            app: "strimzi",
          },
        },
        data: {
          "kafka-metrics-config.yml": KAFKA_METRICS_CONFIG,
        },
      }, { parent: this });
    }

    this.nodePool = new k8s.apiextensions.CustomResource(
      `${name}-node-pool`,
      {
        apiVersion: "kafka.strimzi.io/v1beta2",
        kind: "KafkaNodePool",
        metadata: {
          name: nodePoolName,
          namespace: args.namespace,
          labels: {
            "strimzi.io/cluster": clusterName,
          },
        },
        spec: {
          replicas,
          roles: ["controller", "broker"],
          ...(args.resources && { resources: args.resources }),
          storage: {
            type: "jbod",
            volumes: [
              {
                id: 0,
                type: "persistent-claim",
                size: args.storage?.size ?? "100Gi",
                deleteClaim: false,
                ...(args.storage?.class && { class: args.storage.class }),
              },
            ],
          },
          ...((args.tolerations || args.nodeSelector) && {
            template: {
              pod: {
                ...(args.tolerations && { tolerations: args.tolerations }),
                ...(args.nodeSelector && { nodeSelector: args.nodeSelector }),
              },
            },
          }),
        },
      },
      {
        parent: this,
        deleteBeforeReplace: true,
      }
    );

    this.cluster = new k8s.apiextensions.CustomResource(
      `${name}-cluster`,
      {
        apiVersion: "kafka.strimzi.io/v1beta2",
        kind: "Kafka",
        metadata: {
          name: clusterName,
          namespace: args.namespace,
          annotations: {
            "pulumi.com/waitFor": "condition=Ready",
          },
        },
        spec: {
          kafka: {
            ...(args.jvmOptions && {
              jvmOptions: {
                ...(args.jvmOptions.xms && { "-Xms": args.jvmOptions.xms }),
                ...(args.jvmOptions.xmx && { "-Xmx": args.jvmOptions.xmx }),
              },
            }),
            listeners: [
              {
                name: "plain",
                port: 9092,
                type: "internal",
                tls: false,
              },
            ],
            config: {
              "offsets.topic.replication.factor": replicas,
              "transaction.state.log.replication.factor": replicas,
              "transaction.state.log.min.isr": minInSyncReplicas,
              "default.replication.factor": replicas,
              "min.insync.replicas": minInSyncReplicas,
              ...(args.quorumTimeouts?.electionMs && {
                "controller.quorum.election.timeout.ms": args.quorumTimeouts.electionMs,
              }),
              ...(args.quorumTimeouts?.fetchMs && {
                "controller.quorum.fetch.timeout.ms": args.quorumTimeouts.fetchMs,
              }),
              ...(args.quorumTimeouts?.brokerSessionMs && {
                "broker.session.timeout.ms": args.quorumTimeouts.brokerSessionMs,
              }),
            },
            ...(metricsEnabled && {
              metricsConfig: {
                type: "jmxPrometheusExporter",
                valueFrom: {
                  configMapKeyRef: {
                    name: this.metricsConfig!.metadata.name,
                    key: "kafka-metrics-config.yml",
                  },
                },
              },
              template: {
                pod: {
                  metadata: {
                    annotations: metricsAnnotations("strimzi-kafka", "9404"),
                  },
                },
              },
            }),
          },
          entityOperator: {
            topicOperator: {},
            userOperator: {},
          },
          ...(metricsEnabled && {
            kafkaExporter: {
              topicRegex: ".*",
              groupRegex: ".*",
              template: {
                pod: {
                  metadata: {
                    annotations: metricsAnnotations("strimzi-kafka-exporter", "9404"),
                  },
                },
              },
            },
          }),
        },
      },
      {
        parent: this,
        dependsOn: [
          this.nodePool,
          ...(this.metricsConfig ? [this.metricsConfig] : []),
        ],
      }
    );

    if (metricsEnabled) {
      const entityOperatorSelector = {
        "strimzi.io/cluster": clusterName,
        "strimzi.io/name": pulumi.interpolate`${clusterName}-entity-operator`,
      };

      this.topicOperatorMetricsService = new k8s.core.v1.Service(`${name}-topic-operator-metrics`, {
        metadata: {
          name: pulumi.interpolate`${clusterName}-topic-operator-metrics`,
          namespace: args.namespace,
          annotations: metricsAnnotations("strimzi-topic-operator", "8080"),
        },
        spec: {
          selector: entityOperatorSelector,
          ports: [{
            name: "metrics",
            port: 8080,
            targetPort: 8080,
          }],
        },
      }, { parent: this, dependsOn: [this.cluster] });

      this.userOperatorMetricsService = new k8s.core.v1.Service(`${name}-user-operator-metrics`, {
        metadata: {
          name: pulumi.interpolate`${clusterName}-user-operator-metrics`,
          namespace: args.namespace,
          annotations: metricsAnnotations("strimzi-user-operator", "8081"),
        },
        spec: {
          selector: entityOperatorSelector,
          ports: [{
            name: "metrics",
            port: 8081,
            targetPort: 8081,
          }],
        },
      }, { parent: this, dependsOn: [this.cluster] });
    }

    this.topics = Object.fromEntries(
      Object.entries(args.topics).map(([key, topic]) => [
        key,
        new k8s.apiextensions.CustomResource(
          `${name}-${key}-topic`,
          {
            apiVersion: "kafka.strimzi.io/v1beta2",
            kind: "KafkaTopic",
            metadata: {
              name: topic.name,
              namespace: args.namespace,
              labels: {
                "strimzi.io/cluster": clusterName,
              },
              annotations: {
                "pulumi.com/waitFor": "condition=Ready",
              },
            },
            spec: {
              partitions: topic.partitions ?? 12,
              replicas: topic.replicas ?? replicas,
              config: topic.config ?? {
                "retention.ms": "86400000",
                "segment.bytes": "1073741824",
              },
            },
          },
          { parent: this, dependsOn: [this.cluster] }
        ),
      ])
    );

    this.connection = {
      bootstrapServers: pulumi.interpolate`${clusterName}-kafka-bootstrap.${args.namespace}:9092`,
      topics: Object.fromEntries(Object.entries(args.topics).map(([key, topic]) => [key, topic.name])),
    };

    this.registerOutputs({
      cluster: this.cluster,
      nodePool: this.nodePool,
      metricsConfig: this.metricsConfig,
      topicOperatorMetricsService: this.topicOperatorMetricsService,
      userOperatorMetricsService: this.userOperatorMetricsService,
      topics: this.topics,
      connection: this.connection,
    });
  }
}
