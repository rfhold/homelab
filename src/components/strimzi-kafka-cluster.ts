import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export const OBSERVABILITY_KAFKA_TOPICS = {
  mimirIngest: "mimir-ingest",
  tempoTraces: "tempo-traces",
} as const;

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
  replicas?: pulumi.Input<number>;
  storage?: {
    size?: pulumi.Input<string>;
    class?: pulumi.Input<string>;
  };
  topics: Record<string, KafkaTopicConfig>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
  nodeSelector?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

export class StrimziKafkaCluster extends pulumi.ComponentResource {
  public readonly cluster: k8s.apiextensions.CustomResource;
  public readonly topics: Record<string, k8s.apiextensions.CustomResource>;
  public readonly connection: KafkaConnectionConfig;

  constructor(name: string, args: StrimziKafkaClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:StrimziKafkaCluster", name, args, opts);

    const clusterName = args.clusterName ?? `${name}-kafka`;
    const replicas = args.replicas ?? 3;
    const minInSyncReplicas = pulumi.output(replicas).apply(value => Math.max(1, value - 1));

    new k8s.apiextensions.CustomResource(
      `${name}-node-pool`,
      {
        apiVersion: "kafka.strimzi.io/v1beta2",
        kind: "KafkaNodePool",
        metadata: {
          name: pulumi.interpolate`${clusterName}-pool`,
          namespace: args.namespace,
          labels: {
            "strimzi.io/cluster": clusterName,
          },
        },
        spec: {
          replicas,
          roles: ["controller", "broker"],
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
      { parent: this }
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
            },
          },
          entityOperator: {
            topicOperator: {},
            userOperator: {},
          },
        },
      },
      { parent: this }
    );

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
      topics: this.topics,
      connection: this.connection,
    });
  }
}
