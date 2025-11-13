import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { Grafana, GrafanaArgs } from "../components/grafana";
import { Mimir, MimirArgs } from "../components/mimir";
import { Loki, LokiArgs } from "../components/loki";
import { Alloy, AlloyArgs } from "../components/alloy";
import { RookCephObjectStoreUser } from "../components/rook-ceph-object-store-user";
import { RookCephBucket } from "../components/rook-ceph-bucket";

export enum ObjectStorageImplementation {
  CEPH = "ceph",
}

export interface GrafanaStackArgs {
  namespaces: {
    grafana: pulumi.Input<string>;
    mimir?: pulumi.Input<string>;
    loki?: pulumi.Input<string>;
    alloy?: pulumi.Input<string>;
  };

  objectStorage: {
    implementation: ObjectStorageImplementation;
    cluster: pulumi.Input<string>;
    storageClassName: pulumi.Input<string>;
    endpoint: pulumi.Input<string>;
    userNamespace?: pulumi.Input<string>;
  };

  grafana: Omit<GrafanaArgs, "namespace">;
  mimir?: Omit<MimirArgs, "namespace" | "s3">;
  loki?: Omit<LokiArgs, "namespace" | "s3">;
  alloy?: Omit<AlloyArgs, "namespace" | "telemetryEndpoints" | "tenantId">;
  tolerations?: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.Toleration>[]>;
}

export class GrafanaStack extends pulumi.ComponentResource {
  public readonly grafana: Grafana;
  public readonly mimir?: Mimir;
  public readonly loki?: Loki;
  public readonly alloy?: Alloy;


  private readonly mimirUser?: RookCephObjectStoreUser;
  private readonly lokiUser?: RookCephObjectStoreUser;
  private readonly mimirBlocksBucket?: RookCephBucket;
  private readonly mimirRulerBucket?: RookCephBucket;
  private readonly mimirAlertmanagerBucket?: RookCephBucket;
  private readonly lokiChunksBucket?: RookCephBucket;
  private readonly lokiRulerBucket?: RookCephBucket;
  private readonly lokiAdminBucket?: RookCephBucket;

  constructor(name: string, args: GrafanaStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:GrafanaStack", name, args, opts);

    let mimirS3Config;
    let mimirBuckets: RookCephBucket[] = [];

    let lokiS3Config;
    let lokiBuckets: RookCephBucket[] = [];

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
            insecureSkipVerify: true,
          };

          lokiBuckets = [this.lokiChunksBucket, this.lokiRulerBucket, this.lokiAdminBucket];
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

    const datasources: any[] = [];

    if (this.loki) {
      datasources.push({
        name: "Loki",
        type: "loki",
        url: this.loki.getGatewayUrl(),
        access: "proxy",
        isDefault: false,
        editable: false,
        orgId: 0,
        jsonData: {
          httpHeaderName1: "X-Scope-OrgID",
        },
        secureJsonData: {
          httpHeaderValue1: "0",
        },
      });
    }

    if (this.mimir) {
      datasources.push({
        name: "Mimir",
        type: "prometheus",
        url: pulumi.interpolate`${this.mimir.getNginxGatewayUrl()}/prometheus`,
        access: "proxy",
        isDefault: true,
        editable: false,
        orgId: 0,
        jsonData: {
          httpHeaderName1: "X-Scope-OrgID",
          prometheusType: "Mimir",
          manageAlerts: true,
          httpMethod: "POST",
        },
        secureJsonData: {
          httpHeaderValue1: "0",
        },
      });
    }

    this.grafana = new Grafana(`${name}-grafana`, {
      namespace: args.namespaces.grafana,
      ...args.grafana,
      ...(datasources.length > 0 && { datasources }),
    }, { parent: this });

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

      this.alloy = new Alloy(`${name}-alloy`, {
        namespace: args.namespaces.alloy!,
        ...args.alloy,
        telemetryEndpoints,
        tenantId: "0",
        ...(args.tolerations && { tolerations: args.tolerations }),
      }, { parent: this, dependsOn: [this.grafana, ...(this.mimir ? [this.mimir] : []), ...(this.loki ? [this.loki] : [])] });
    }

    this.registerOutputs({
      grafana: this.grafana,
      mimir: this.mimir,
      loki: this.loki,
      alloy: this.alloy,
      mimirUser: this.mimirUser,
      lokiUser: this.lokiUser,
      mimirBlocksBucket: this.mimirBlocksBucket,
      mimirRulerBucket: this.mimirRulerBucket,
      mimirAlertmanagerBucket: this.mimirAlertmanagerBucket,
      lokiChunksBucket: this.lokiChunksBucket,
      lokiRulerBucket: this.lokiRulerBucket,
      lokiAdminBucket: this.lokiAdminBucket,
    });
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
}
