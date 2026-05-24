import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as grafanaProvider from "@pulumiverse/grafana";
import { Grafana, GrafanaArgs } from "../components/grafana";
import { Mimir, MimirArgs } from "../components/mimir";
import { Loki, LokiArgs } from "../components/loki";
import { Tempo, TempoArgs } from "../components/tempo";
import { Alloy, AlloyArgs } from "../components/alloy";
import { Pyroscope, PyroscopeArgs } from "../components/pyroscope";
import { RookCephObjectStoreUser } from "../components/rook-ceph-object-store-user";
import { RookCephBucket } from "../components/rook-ceph-bucket";
import { PostgreSQLImplementation, PostgreSQLModule, PostgreSQLModuleArgs } from "./postgres";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export enum ObjectStorageImplementation {
  CEPH = "ceph",
}

export interface GrafanaStackArgs extends WorkloadLabelArgs {
  namespaces: {
    grafana: pulumi.Input<string>;
    mimir?: pulumi.Input<string>;
    loki?: pulumi.Input<string>;
    tempo?: pulumi.Input<string>;
    alloy?: pulumi.Input<string>;
    pyroscope?: pulumi.Input<string>;
  };

  objectStorage: {
    implementation: ObjectStorageImplementation;
    cluster: pulumi.Input<string>;
    storageClassName: pulumi.Input<string>;
    endpoint: pulumi.Input<string>;
    userNamespace?: pulumi.Input<string>;
  };

  database: {
    instances?: pulumi.Input<number>;
    resources?: PostgreSQLModuleArgs["resources"];
    storage: {
      size?: pulumi.Input<string>;
      storageClass: pulumi.Input<string>;
    };
  };

  grafana: Omit<GrafanaArgs, "namespace">;
  mimir?: Omit<MimirArgs, "namespace" | "s3">;
  loki?: Omit<LokiArgs, "namespace" | "s3">;
  tempo?: Omit<TempoArgs, "namespace" | "s3">;
  pyroscope?: Omit<PyroscopeArgs, "namespace" | "s3">;
  alloy?: Omit<AlloyArgs, "namespace" | "telemetryEndpoints" | "tenantId">;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
}

export class GrafanaStack extends pulumi.ComponentResource {
  public readonly grafana: Grafana;
  public readonly mimir?: Mimir;
  public readonly loki?: Loki;
  public readonly tempo?: Tempo;
  public readonly pyroscope?: Pyroscope;
  public readonly alloy?: Alloy;
  public readonly grafanaDatabase: PostgreSQLModule;

  private readonly grafanaProviderInstance: grafanaProvider.Provider;

  private readonly mimirUser?: RookCephObjectStoreUser;
  private readonly lokiUser?: RookCephObjectStoreUser;
  private readonly mimirBlocksBucket?: RookCephBucket;
  private readonly mimirRulerBucket?: RookCephBucket;
  private readonly mimirAlertmanagerBucket?: RookCephBucket;
  private readonly lokiChunksBucket?: RookCephBucket;
  private readonly lokiRulerBucket?: RookCephBucket;
  private readonly lokiAdminBucket?: RookCephBucket;
  private readonly tempoUser?: RookCephObjectStoreUser;
  private readonly tempoTracesBucket?: RookCephBucket;
  private readonly pyroscopeUser?: RookCephObjectStoreUser;
  private readonly pyroscopeBucket?: RookCephBucket;

  constructor(name: string, args: GrafanaStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:GrafanaStack", name, args, withWorkloadLabels(opts, args.workloadLabels));

    let mimirS3Config;
    let mimirBuckets: RookCephBucket[] = [];

    let lokiS3Config;
    let lokiBuckets: RookCephBucket[] = [];

    let tempoS3Config;
    let tempoBuckets: RookCephBucket[] = [];

    let pyroscopeS3Config;
    let pyroscopeBuckets: RookCephBucket[] = [];

    switch (args.objectStorage.implementation) {
      case ObjectStorageImplementation.CEPH:
        const endpoint = pulumi.output(args.objectStorage.endpoint);

        if (args.mimir) {
          this.mimirUser = new RookCephObjectStoreUser(`${name}-mimir-user`, {
            name: "grafana-mimir",
            namespace: args.objectStorage.userNamespace ?? args.namespaces.mimir!,
            store: args.objectStorage.cluster,
            displayName: "grafana-mimir",
          }, { parent: this });

          this.mimirBlocksBucket = new RookCephBucket(`${name}-mimir-blocks`, {
            name: `${name}-mimir-blocks`,
            bucketName: "mimir-blocks",
            namespace: args.namespaces.mimir!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-mimir"],
          }, { parent: this, dependsOn: [this.mimirUser] });

          this.mimirRulerBucket = new RookCephBucket(`${name}-mimir-ruler`, {
            name: `${name}-mimir-ruler`,
            bucketName: "mimir-ruler",
            namespace: args.namespaces.mimir!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-mimir"],
          }, { parent: this, dependsOn: [this.mimirUser] });

          this.mimirAlertmanagerBucket = new RookCephBucket(`${name}-mimir-alertmanager`, {
            name: `${name}-mimir-alertmanager`,
            bucketName: "mimir-alertmanager",
            namespace: args.namespaces.mimir!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-mimir"],
          }, { parent: this, dependsOn: [this.mimirUser] });

          mimirS3Config = {
            endpoint: endpoint,
            region: "us-east-1",
            bucketBlocks: this.mimirBlocksBucket.bucketName,
            bucketRuler: this.mimirRulerBucket.bucketName,
            bucketAlertmanager: this.mimirAlertmanagerBucket.bucketName,
            accessKeyId: this.mimirUser.accessKey,
            secretAccessKey: this.mimirUser.secretKey,
            insecureSkipVerify: true,
          };

          mimirBuckets = [this.mimirBlocksBucket, this.mimirRulerBucket, this.mimirAlertmanagerBucket];
        }

        if (args.loki) {
          this.lokiUser = new RookCephObjectStoreUser(`${name}-loki-user`, {
            name: "grafana-loki",
            namespace: args.objectStorage.userNamespace ?? args.namespaces.loki!,
            store: args.objectStorage.cluster,
            displayName: "grafana-loki",
          }, { parent: this });

          this.lokiChunksBucket = new RookCephBucket(`${name}-loki-chunks`, {
            name: `${name}-loki-chunks`,
            bucketName: "loki-chunks",
            namespace: args.namespaces.loki!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-loki"],
          }, { parent: this, dependsOn: [this.lokiUser] });

          this.lokiRulerBucket = new RookCephBucket(`${name}-loki-ruler`, {
            name: `${name}-loki-ruler`,
            bucketName: "loki-ruler",
            namespace: args.namespaces.loki!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-loki"],
          }, { parent: this, dependsOn: [this.lokiUser] });

          this.lokiAdminBucket = new RookCephBucket(`${name}-loki-admin`, {
            name: `${name}-loki-admin`,
            bucketName: "loki-admin",
            namespace: args.namespaces.loki!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-loki"],
          }, { parent: this, dependsOn: [this.lokiUser] });

          lokiS3Config = {
            region: "us-east-1",
            bucketChunks: this.lokiChunksBucket.bucketName,
            bucketRuler: this.lokiRulerBucket.bucketName,
            bucketAdmin: this.lokiAdminBucket.bucketName,
            accessKeyId: this.lokiUser.accessKey,
            secretAccessKey: this.lokiUser.secretKey,
            endpoint: endpoint,
            s3ForcePathStyle: true,
          };

          lokiBuckets = [this.lokiChunksBucket, this.lokiRulerBucket, this.lokiAdminBucket];
        }

        if (args.tempo) {
          this.tempoUser = new RookCephObjectStoreUser(`${name}-tempo-user`, {
            name: "grafana-tempo",
            namespace: args.objectStorage.userNamespace ?? args.namespaces.tempo!,
            store: args.objectStorage.cluster,
            displayName: "grafana-tempo",
          }, { parent: this });

          this.tempoTracesBucket = new RookCephBucket(`${name}-tempo-traces`, {
            name: `${name}-tempo-traces`,
            bucketName: "tempo-traces",
            namespace: args.namespaces.tempo!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-tempo"],
          }, { parent: this, dependsOn: [this.tempoUser] });

          tempoS3Config = {
            endpoint: endpoint,
            region: "us-east-1",
            bucket: this.tempoTracesBucket.bucketName,
            accessKeyId: this.tempoUser.accessKey,
            secretAccessKey: this.tempoUser.secretKey,
            insecureSkipVerify: true,
          };

          tempoBuckets = [this.tempoTracesBucket];
        }

        if (args.pyroscope) {
          this.pyroscopeUser = new RookCephObjectStoreUser(`${name}-pyroscope-user`, {
            name: "grafana-pyroscope",
            namespace: args.objectStorage.userNamespace ?? args.namespaces.pyroscope!,
            store: args.objectStorage.cluster,
            displayName: "grafana-pyroscope",
          }, { parent: this });

          this.pyroscopeBucket = new RookCephBucket(`${name}-pyroscope-profiles`, {
            name: `${name}-pyroscope-profiles`,
            bucketName: "pyroscope-profiles",
            namespace: args.namespaces.pyroscope!,
            storageClassName: args.objectStorage.storageClassName,
            writeUsers: ["grafana-pyroscope"],
          }, { parent: this, dependsOn: [this.pyroscopeUser] });

          pyroscopeS3Config = {
            endpoint: endpoint,
            region: "us-east-1",
            bucket: this.pyroscopeBucket.bucketName,
            accessKeyId: this.pyroscopeUser.accessKey,
            secretAccessKey: this.pyroscopeUser.secretKey,
            insecureSkipVerify: true,
          };

          pyroscopeBuckets = [this.pyroscopeBucket];
        }
        break;

      default:
        throw new Error(`Unknown implementation: ${args.objectStorage.implementation}`);
    }

    if (args.mimir && mimirS3Config) {
      this.mimir = new Mimir(`${name}-mimir`, {
        namespace: args.namespaces.mimir!,
        s3: mimirS3Config,
        ...args.mimir,
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: mimirBuckets });
    }

    if (args.loki && lokiS3Config) {
      this.loki = new Loki(`${name}-loki`, {
        namespace: args.namespaces.loki!,
        s3: lokiS3Config,
        ...args.loki,
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: lokiBuckets });
    }

    if (args.tempo && tempoS3Config) {
      const tempoMetricsGenerator = this.mimir ? {
        metricsGenerator: {
          remoteWriteUrl: this.mimir.getPrometheusRemoteWriteUrl(),
        },
      } : {};

      this.tempo = new Tempo(`${name}-tempo`, {
        namespace: args.namespaces.tempo!,
        s3: tempoS3Config,
        ...args.tempo,
        ...tempoMetricsGenerator,
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: [...tempoBuckets, ...(this.mimir ? [this.mimir] : [])] });
    }

    if (args.pyroscope && pyroscopeS3Config) {
      this.pyroscope = new Pyroscope(`${name}-pyroscope`, {
        namespace: args.namespaces.pyroscope!,
        s3: pyroscopeS3Config,
        ...args.pyroscope,
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: pyroscopeBuckets });
    }

    this.grafanaDatabase = new PostgreSQLModule(`${name}-grafana-postgres`, {
      namespace: args.namespaces.grafana,
      implementation: PostgreSQLImplementation.CLOUDNATIVE_PG,
      instances: args.database.instances,
      resources: args.database.resources,
      storage: args.database.storage,
      ...(args.tolerations && { tolerations: args.tolerations }),
    }, { parent: this });

    this.grafana = new Grafana(`${name}-grafana`, {
      namespace: args.namespaces.grafana,
      ...args.grafana,
      database: {
        host: `${name}-grafana-postgres-rw.grafana`,
        port: 5432,
        database: "app",
        username: "app",
        password: "unused",
        sslMode: "disable",
      },
      databaseSecret: {
        name: `${name}-grafana-postgres-app`,
      },
    }, { parent: this, dependsOn: [this.grafanaDatabase] });

    const adminUsername = pulumi.output(args.grafana.adminUsername ?? "admin");
    const adminPassword = this.grafana.getAdminPassword();
    const grafanaUrl = pulumi.interpolate`https://${args.grafana.ingress?.hostname}`;

    this.grafanaProviderInstance = new grafanaProvider.Provider(`${name}-grafana-provider`, {
      url: grafanaUrl,
      auth: pulumi.interpolate`${adminUsername}:${adminPassword}`,
      storeDashboardSha256: true,
    }, { parent: this, dependsOn: [this.grafana] });

    if (this.loki) {
      new grafanaProvider.oss.DataSource(`${name}-datasource-loki`, {
        name: "Loki",
        uid: "loki",
        type: "loki",
        url: this.loki.getGatewayUrl(),
        accessMode: "proxy",
        isDefault: false,
        httpHeaders: { "X-Scope-OrgID": "0" },
      }, { parent: this, provider: this.grafanaProviderInstance, dependsOn: [this.grafana] });
    }

    if (this.mimir) {
      new grafanaProvider.oss.DataSource(`${name}-datasource-mimir`, {
        name: "Mimir",
        uid: "mimir",
        type: "prometheus",
        url: pulumi.interpolate`${this.mimir.getGatewayUrl()}/prometheus`,
        accessMode: "proxy",
        isDefault: true,
        jsonDataEncoded: JSON.stringify({
          prometheusType: "Mimir",
          manageAlerts: true,
          httpMethod: "POST",
        }),
        httpHeaders: { "X-Scope-OrgID": "0" },
      }, { parent: this, provider: this.grafanaProviderInstance, dependsOn: [this.grafana] });
    }

    if (this.tempo) {
      new grafanaProvider.oss.DataSource(`${name}-datasource-tempo`, {
        name: "Tempo",
        uid: "tempo",
        type: "tempo",
        url: this.tempo.getQueryFrontendUrl(),
        accessMode: "proxy",
        isDefault: false,
        httpHeaders: { "X-Scope-OrgID": "0" },
      }, { parent: this, provider: this.grafanaProviderInstance, dependsOn: [this.grafana] });
    }

    if (this.pyroscope) {
      new grafanaProvider.oss.DataSource(`${name}-datasource-pyroscope`, {
        name: "Pyroscope",
        uid: "pyroscope",
        type: "grafana-pyroscope-datasource",
        url: this.pyroscope.getReadUrl(),
        accessMode: "proxy",
        isDefault: false,
        httpHeaders: { "X-Scope-OrgID": "0" },
      }, { parent: this, provider: this.grafanaProviderInstance, dependsOn: [this.grafana] });
    }

    if (args.alloy) {
      const telemetryEndpoints: AlloyArgs["telemetryEndpoints"] = {};

      if (this.mimir) {
        telemetryEndpoints.mimir = {
          queryFrontend: this.mimir.getQueryFrontendUrl(),
          distributor: this.mimir.getDistributorUrl(),
        };
      }

      if (this.loki) {
        telemetryEndpoints.loki = {
          gateway: this.loki.getGatewayUrl(),
        };
      }

      if (this.tempo) {
        telemetryEndpoints.tempo = {
          distributor: this.tempo.getDistributorUrl(),
        };
      }

      if (this.pyroscope) {
        telemetryEndpoints.pyroscope = {
          write: this.pyroscope.getWriteUrl(),
        };
      }

      this.alloy = new Alloy(`${name}-alloy`, {
        namespace: args.namespaces.alloy!,
        ...args.alloy,
        telemetryEndpoints,
        tenantId: "0",
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: [this.grafana, ...(this.mimir ? [this.mimir] : []), ...(this.loki ? [this.loki] : []), ...(this.tempo ? [this.tempo] : []), ...(this.pyroscope ? [this.pyroscope] : [])] });
    }

    this.registerOutputs({
      grafana: this.grafana,
      grafanaDatabase: this.grafanaDatabase,
      mimir: this.mimir,
      loki: this.loki,
      tempo: this.tempo,
      pyroscope: this.pyroscope,
      alloy: this.alloy,
      mimirUser: this.mimirUser,
      lokiUser: this.lokiUser,
      tempoUser: this.tempoUser,
      pyroscopeUser: this.pyroscopeUser,
      mimirBlocksBucket: this.mimirBlocksBucket,
      mimirRulerBucket: this.mimirRulerBucket,
      mimirAlertmanagerBucket: this.mimirAlertmanagerBucket,
      lokiChunksBucket: this.lokiChunksBucket,
      lokiRulerBucket: this.lokiRulerBucket,
      lokiAdminBucket: this.lokiAdminBucket,
      tempoTracesBucket: this.tempoTracesBucket,
      pyroscopeBucket: this.pyroscopeBucket,
    });
  }

  public getGrafanaProvider(): grafanaProvider.Provider {
    return this.grafanaProviderInstance;
  }

  public getObjectStorageConfig(): pulumi.Output<{
    mimir?: {
      user: {
        accessKey: string;
        secretKey: string;
      };
      buckets: {
        blocks: string;
        ruler: string;
        alertmanager: string;
      };
    };
    loki?: {
      user: {
        accessKey: string;
        secretKey: string;
      };
      buckets: {
        chunks: string;
        ruler: string;
        admin: string;
      };
    };
    tempo?: {
      user: {
        accessKey: string;
        secretKey: string;
      };
      buckets: {
        traces: string;
      };
    };
  }> {
    return pulumi.output({
      ...(this.mimirUser && this.mimirBlocksBucket && this.mimirRulerBucket && this.mimirAlertmanagerBucket ? {
        mimir: {
          user: {
            accessKey: this.mimirUser.accessKey,
            secretKey: this.mimirUser.secretKey,
          },
          buckets: {
            blocks: this.mimirBlocksBucket.bucketName,
            ruler: this.mimirRulerBucket.bucketName,
            alertmanager: this.mimirAlertmanagerBucket.bucketName,
          },
        },
      } : {}),
      ...(this.lokiUser && this.lokiChunksBucket && this.lokiRulerBucket && this.lokiAdminBucket ? {
        loki: {
          user: {
            accessKey: this.lokiUser.accessKey,
            secretKey: this.lokiUser.secretKey,
          },
          buckets: {
            chunks: this.lokiChunksBucket.bucketName,
            ruler: this.lokiRulerBucket.bucketName,
            admin: this.lokiAdminBucket.bucketName,
          },
        },
      } : {}),
      ...(this.tempoUser && this.tempoTracesBucket ? {
        tempo: {
          user: {
            accessKey: this.tempoUser.accessKey,
            secretKey: this.tempoUser.secretKey,
          },
          buckets: {
            traces: this.tempoTracesBucket.bucketName,
          },
        },
      } : {}),
    });
  }

  public getGrafanaServiceUrl(): pulumi.Output<string> {
    return this.grafana.getServiceUrl();
  }

  public getGrafanaAdminPassword(): pulumi.Output<string> {
    return this.grafana.getAdminPassword();
  }

  public getMimirQueryFrontendUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.mimir?.getQueryFrontendUrl());
  }

  public getMimirDistributorUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.mimir?.getDistributorUrl());
  }

  public getMimirPrometheusRemoteWriteUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.mimir?.getPrometheusRemoteWriteUrl());
  }

  public getLokiGatewayUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.loki?.getGatewayUrl());
  }

  public getLokiPushUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.loki?.getPushUrl());
  }

  public getLokiQueryUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.loki?.getQueryUrl());
  }

  public getAlloyOtlpGrpcEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getOtlpGrpcEndpoint());
  }

  public getAlloyOtlpHttpEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getOtlpHttpEndpoint());
  }

  public getAlloyLokiPushEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getLokiPushEndpoint());
  }

  public getAlloyPrometheusRemoteWriteEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getPrometheusRemoteWriteEndpoint());
  }

  public getAlloyFaroCollectEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getFaroCollectEndpoint());
  }

  public getAlloyProfilingEndpoint(): pulumi.Output<string | undefined> {
    return pulumi.output(this.alloy?.getProfilingEndpoint());
  }

  public getPyroscopeReadUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.pyroscope?.getReadUrl());
  }

  public getPyroscopeWriteUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.pyroscope?.getWriteUrl());
  }

  public getTempoQueryFrontendUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.tempo?.getQueryFrontendUrl());
  }

  public getTempoDistributorUrl(): pulumi.Output<string | undefined> {
    return pulumi.output(this.tempo?.getDistributorUrl());
  }
}
