import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { HELM_CHARTS, createHelmChartArgs } from "../helm-charts";
import { createConnectionSafePassword } from "../adapters/postgres";
import { StorageConfig, createPVC } from "../adapters/storage";
import { Argon2Hash } from "../providers/argon2";

export interface VaultwardenArgs {
  namespace: pulumi.Input<string>;

  domain: pulumi.Input<string>;

  adminToken?: pulumi.Input<string>;

  storage?: StorageConfig;



  externalDatabase?: {
    connectionString?: pulumi.Input<string>;
    existingSecret?: {
      name: pulumi.Input<string>;
      key: pulumi.Input<string>;
    };
  };

  smtp?: {
    enabled?: boolean;
    host?: pulumi.Input<string>;
    from?: pulumi.Input<string>;
    fromName?: pulumi.Input<string>;
    username?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
    port?: pulumi.Input<number>;
    security?: "starttls" | "force_tls" | "off";
    acceptInvalidHostnames?: boolean;
    acceptInvalidCerts?: boolean;
  };

  ingress?: {
    enabled?: boolean;
    className?: pulumi.Input<string>;
    annotations?: Record<string, pulumi.Input<string>>;
    tls?: {
      secretName?: pulumi.Input<string>;
    };
  };

  memoryLimit?: pulumi.Input<string>;
  cpuLimit?: pulumi.Input<string>;
  memoryRequest?: pulumi.Input<string>;
  cpuRequest?: pulumi.Input<string>;
}

export class Vaultwarden extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v4.Chart;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly adminToken: ReturnType<typeof createConnectionSafePassword>;
  public readonly adminTokenHash: Argon2Hash;

  private readonly chartReleaseName: string;
  private readonly namespace: pulumi.Input<string>;
  private readonly finalAdminToken: pulumi.Output<string>;

  constructor(name: string, args: VaultwardenArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Vaultwarden", name, args, opts);

    this.chartReleaseName = `${name}-chart`;
    this.namespace = args.namespace;

    this.adminToken = createConnectionSafePassword(`${name}-admin-token`, 48, { parent: this });
    this.finalAdminToken = pulumi.all([this.adminToken.result, args.adminToken]).apply(([token, providedToken]) => {
      // Use provided token if available, otherwise use generated token
      return providedToken || token;
    });
    this.adminTokenHash = new Argon2Hash(`${name}-admin-token-hash`, {
      password: this.finalAdminToken,
    }, { parent: this });

    const storageConfig: StorageConfig = {
      size: args.storage?.size || "10Gi",
      storageClass: args.storage?.storageClass,
      accessModes: args.storage?.accessModes || ["ReadWriteOnce"],
      volumeMode: args.storage?.volumeMode,
      namespace: args.storage?.namespace,
      labels: args.storage?.labels,
      annotations: args.storage?.annotations,
      selector: args.storage?.selector,
      dataSource: args.storage?.dataSource,
    };

    this.pvc = createPVC(`${name}-data-pvc`, {
      ...storageConfig,
      namespace: args.namespace,
    }, { parent: this });

    const values: any = {
      domain: pulumi.interpolate`https://${args.domain}`,

      adminToken: {
        value: this.adminTokenHash.hash,
      },

      signupsAllowed: false,
      invitationsAllowed: true,
      showPassHint: "false",
      webVaultEnabled: "true",

      storage: {
        existingVolumeClaim: {
          claimName: this.pvc.metadata.name,
          dataPath: "/data",
          attachmentsPath: "/data/attachments",
        },
      },

      ingress: {
        enabled: args.ingress?.enabled || false,
        class: args.ingress?.className,
        additionalAnnotations: args.ingress?.annotations || {},
        hostname: args.domain,
        tls: args.ingress?.tls ? true : false,
        tlsSecret: args.ingress?.tls?.secretName,
      },

      resources: {
        limits: {
          memory: args.memoryLimit,
          cpu: args.cpuLimit,
        },
        requests: {
          memory: args.memoryRequest || "256Mi",
          cpu: args.cpuRequest || "100m",
        },
      },

      securityContext: {
        runAsNonRoot: true,
        runAsUser: 65534,
        runAsGroup: 65534,
        readOnlyRootFilesystem: false,
        allowPrivilegeEscalation: false,
        capabilities: {
          drop: ["ALL"],
        },
      },

      initContainers: [
        {
          name: "fix-permissions",
          image: "busybox:1.35",
          command: ["chown", "-R", "65534:65534", "/data"],
          volumeMounts: [
            {
              name: "vaultwarden-data",
              mountPath: "/data",
            },
          ],
          securityContext: {
            runAsUser: 0,
            runAsGroup: 0,
          },
        },
      ],
    };

    if (args.externalDatabase?.existingSecret) {
      values.database = {
        type: "postgresql",
        existingSecret: args.externalDatabase.existingSecret.name,
        existingSecretKey: args.externalDatabase.existingSecret.key,
      };
    } else if (args.externalDatabase?.connectionString) {
      values.database = {
        type: "postgresql",
        uriOverride: args.externalDatabase.connectionString,
      };
    }

    if (args.smtp?.enabled) {
      values.smtp = {
        host: args.smtp.host,
        from: args.smtp.from,
        fromName: args.smtp.fromName,
        username: {
          value: args.smtp.username,
        },
        password: {
          value: args.smtp.password,
        },
        port: args.smtp.port || 587,
        security: args.smtp.security || "starttls",
        acceptInvalidHostnames: args.smtp.acceptInvalidHostnames?.toString() || "false",
        acceptInvalidCerts: args.smtp.acceptInvalidCerts?.toString() || "false",
      };
    }

    this.chart = new k8s.helm.v4.Chart(
      this.chartReleaseName,
      {
        ...createHelmChartArgs(HELM_CHARTS.VAULTWARDEN, args.namespace),
        values,
      },
      { parent: this }
    );

    this.registerOutputs({
      chart: this.chart,
      pvc: this.pvc,
      adminToken: this.adminToken,
      adminTokenHash: this.adminTokenHash,
    });
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.chartReleaseName}-vaultwarden.${this.namespace}:80`;
  }

  public getAdminToken(): pulumi.Output<string> {
    return this.finalAdminToken;
  }

  public getAdminTokenHash(): pulumi.Output<string> {
    return this.adminTokenHash.hash;
  }

  public getPostgresPassword(): pulumi.Output<string> {
    throw new Error("PostgreSQL password not available when using external database");
  }
}
