import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import * as path from "path";
import * as yaml from "yaml";
import { DOCKER_IMAGES } from "../docker-images";

const TEKTON_VERSIONS = {
  pipelines: "v1.10.1",
  triggers: "v0.35.0",
  dashboard: "v0.66.0",
  pac: "v0.43.0",
} as const;

const TEKTON_RELEASE_BASE =
  "https://objectstorage.us-ashburn-1.oraclecloud.com/n/idvmneyfvsey/b/tekton-releases/o";
const PAC_RELEASE_BASE =
  "https://github.com/openshift-pipelines/pipelines-as-code/releases/download";

export interface IngressConfig {
  enabled: boolean;
  className?: string;
  host: string;
  annotations?: Record<string, string>;
  tls?: {
    enabled: boolean;
    secretName?: string;
  };
}

export interface ClusterProviderConfig {
  name: string;
  provider: k8s.Provider;
  server: string;
  caData: string;
}

export interface TektonArgs {
  versions?: Partial<typeof TEKTON_VERSIONS>;
  dashboard?: {
    ingress?: IngressConfig;
    resources?: {
      requests?: { memory?: string; cpu?: string };
      limits?: { memory?: string; cpu?: string };
    };
  };
  pac?: {
    ingress?: IngressConfig;
    git?: {
      host: string;
      token: pulumi.Input<string>;
      repositories?: string[];
    };
    globalParams?: {
      buildkitAmd64Addr: string;
      buildkitArm64Addr: string;
      containerRegistry: string;
      gitUrl: string;
    };
    androidKeystore?: {
      jks: pulumi.Input<string>;
      password: pulumi.Input<string>;
      alias: string;
    };
    pulumiCredentials?: {
      passphrase: pulumi.Input<string>;
      backendUrl: pulumi.Input<string>;
      accessKeyId: pulumi.Input<string>;
      secretAccessKey: pulumi.Input<string>;
    };
    authentikCredentials?: {
      url: pulumi.Input<string>;
      token: pulumi.Input<string>;
    };
  };
  clusters?: ClusterProviderConfig[];
}

export class Tekton extends pulumi.ComponentResource {
  public readonly pipelinesNamespace: pulumi.Output<string>;
  public readonly pacNamespace: pulumi.Output<string>;
  public readonly dashboardUrl?: pulumi.Output<string>;
  public readonly pacWebhookUrl?: pulumi.Output<string>;
  public readonly pacWebhookSecret?: pulumi.Output<string>;
  public readonly pacIncomingSecret?: pulumi.Output<string>;
  public readonly clusterProviders: Record<string, k8s.Provider>;
  public readonly kubeconfigSecret?: pulumi.Output<string>;

  constructor(
    name: string,
    args: TektonArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:Tekton", name, {}, opts);

    const versions = { ...TEKTON_VERSIONS, ...args.versions };

    const pipelines = new k8s.yaml.ConfigFile(
      `${name}-pipelines`,
      {
        file: `${TEKTON_RELEASE_BASE}/pipeline/previous/${versions.pipelines}/release.yaml`,
      },
      { parent: this }
    );

    const triggers = new k8s.yaml.ConfigFile(
      `${name}-triggers`,
      {
        file: `${TEKTON_RELEASE_BASE}/triggers/previous/${versions.triggers}/release.yaml`,
      },
      { parent: this, dependsOn: [pipelines] }
    );

    new k8s.yaml.ConfigFile(
      `${name}-triggers-interceptors`,
      {
        file: `${TEKTON_RELEASE_BASE}/triggers/previous/${versions.triggers}/interceptors.yaml`,
      },
      { parent: this, dependsOn: [triggers] }
    );

    const dashboard = new k8s.yaml.ConfigFile(
      `${name}-dashboard`,
      {
        file: `${TEKTON_RELEASE_BASE}/dashboard/previous/${versions.dashboard}/release.yaml`,
      },
      { parent: this, dependsOn: [pipelines] }
    );

    const pac = new k8s.yaml.ConfigFile(
      `${name}-pac`,
      {
        file: `${PAC_RELEASE_BASE}/${versions.pac}/release.k8s.yaml`,
        transformations: [
          (obj: any) => {
            if (obj.kind === "ConfigMap" && obj.metadata?.name === "pipelines-as-code") {
              obj.metadata.annotations = obj.metadata.annotations || {};
              obj.metadata.annotations["pulumi.com/patchForce"] = "true";
              obj.data = obj.data || {};
              obj.data["application-name"] = "Tekton CI";
              if (args.dashboard?.ingress?.host) {
                obj.data["tekton-dashboard-url"] = `https://${args.dashboard.ingress.host}`;
              }
            }
            if (
              obj.kind === "Deployment" &&
              obj.metadata?.name === "pipelines-as-code-controller" &&
              args.dashboard?.ingress?.host
            ) {
              const containers = obj.spec?.template?.spec?.containers ?? [];
              for (const container of containers) {
                if (container.name === "pac-controller") {
                  container.env = container.env ?? [];
                  container.env.push({
                    name: "PAC_TEKTON_DASHBOARD_URL",
                    value: `https://${args.dashboard.ingress.host}`,
                  });
                }
              }
            }
            if (obj.kind === "Namespace" && obj.metadata?.name === "pipelines-as-code") {
              obj.metadata.labels = obj.metadata.labels || {};
              obj.metadata.labels["pod-security.kubernetes.io/enforce"] = "privileged";
              obj.metadata.labels["pod-security.kubernetes.io/audit"] = "privileged";
              obj.metadata.labels["pod-security.kubernetes.io/warn"] = "privileged";
            }
          },
        ],
      },
      { parent: this, dependsOn: [pipelines, triggers] }
    );

    this.pipelinesNamespace = pulumi.output("tekton-pipelines");
    this.pacNamespace = pulumi.output("pipelines-as-code");

    this.clusterProviders = {};
    if (args.clusters && args.clusters.length > 0) {
      const clusterKubeconfigs = args.clusters.map(cluster => {
        this.clusterProviders[cluster.name] = cluster.provider;
        return this.provisionClusterAccess(name, cluster, { parent: this });
      });

      this.kubeconfigSecret = this.assembleKubeconfig(
        name,
        clusterKubeconfigs,
        { parent: this, dependsOn: [pipelines] }
      );
    }

    if (args.dashboard?.ingress?.enabled) {
      this.createIngress(
        `${name}-dashboard-ingress`,
        {
          namespace: "tekton-pipelines",
          serviceName: "tekton-dashboard",
          servicePort: 9097,
          ...args.dashboard.ingress,
        },
        { parent: this, dependsOn: [dashboard] }
      );
      this.dashboardUrl = pulumi.interpolate`https://${args.dashboard.ingress.host}`;
    }

    if (args.pac?.ingress?.enabled) {
      this.createIngress(
        `${name}-pac-ingress`,
        {
          namespace: "pipelines-as-code",
          serviceName: "pipelines-as-code-controller",
          servicePort: 8080,
          ...args.pac.ingress,
        },
        { parent: this, dependsOn: [pac] }
      );
      this.pacWebhookUrl = pulumi.interpolate`https://${args.pac.ingress.host}`;
    }

    if (args.pac?.git) {
      const secrets = this.createPacGitConfig(
        name,
        args.pac.git,
        args.pac.globalParams,
        args.pac.androidKeystore,
        args.pac.pulumiCredentials,
        args.pac.authentikCredentials,
        { parent: this, dependsOn: [pac] }
      );
      this.pacWebhookSecret = secrets.webhookSecret;
      this.pacIncomingSecret = secrets.incomingSecret;
    }

    this.createPruner(name, { parent: this, dependsOn: [pac] });

    this.createClusterTasks(name, { parent: this, dependsOn: [pipelines] });

    new k8s.core.v1.PersistentVolumeClaim(
      `${name}-pulumi-plugin-cache`,
      {
        metadata: {
          name: "pulumi-plugin-cache",
          namespace: "pipelines-as-code",
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          resources: {
            requests: { storage: "2Gi" },
          },
        },
      },
      { parent: this, dependsOn: [pac] }
    );

    new k8s.core.v1.PersistentVolumeClaim(
      `${name}-cargo-cache`,
      {
        metadata: {
          name: "cargo-cache",
          namespace: "pipelines-as-code",
        },
        spec: {
          accessModes: ["ReadWriteMany"],
          resources: {
            requests: { storage: "20Gi" },
          },
        },
      },
      { parent: this, dependsOn: [pac] }
    );

    this.registerOutputs({
      pipelinesNamespace: this.pipelinesNamespace,
      pacNamespace: this.pacNamespace,
      dashboardUrl: this.dashboardUrl,
      pacWebhookUrl: this.pacWebhookUrl,
      pacWebhookSecret: this.pacWebhookSecret,
      pacIncomingSecret: this.pacIncomingSecret,
      clusterProviders: this.clusterProviders,
      kubeconfigSecret: this.kubeconfigSecret,
    });
  }

  private createIngress(
    name: string,
    config: {
      namespace: string;
      serviceName: string;
      servicePort: number;
      host: string;
      className?: string;
      annotations?: Record<string, string>;
      tls?: {
        enabled: boolean;
        secretName?: string;
      };
    },
    opts: pulumi.CustomResourceOptions
  ): k8s.networking.v1.Ingress {
    return new k8s.networking.v1.Ingress(
      name,
      {
        metadata: {
          name: name,
          namespace: config.namespace,
          annotations: config.annotations,
        },
        spec: {
          ingressClassName: config.className ?? "traefik",
          rules: [
            {
              host: config.host,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: config.serviceName,
                        port: { number: config.servicePort },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: config.tls?.enabled
            ? [
                {
                  hosts: [config.host],
                  secretName: config.tls.secretName ?? `${name}-tls`,
                },
              ]
            : undefined,
        },
      },
      opts
    );
  }

  private createPacGitConfig(
    name: string,
    git: NonNullable<NonNullable<TektonArgs["pac"]>["git"]>,
    globalParams: NonNullable<TektonArgs["pac"]>["globalParams"],
    androidKeystore: NonNullable<TektonArgs["pac"]>["androidKeystore"],
    pulumiCredentials: NonNullable<TektonArgs["pac"]>["pulumiCredentials"],
    authentikCredentials: NonNullable<TektonArgs["pac"]>["authentikCredentials"],
    opts: pulumi.CustomResourceOptions
  ): { webhookSecret: pulumi.Output<string>; incomingSecret: pulumi.Output<string> } {
    const webhookSecret = new random.RandomPassword(
      `${name}-pac-webhook-secret`,
      {
        length: 32,
        special: false,
      },
      { parent: this }
    );

    new k8s.core.v1.Secret(
      `${name}-git-token`,
      {
        metadata: {
          name: "git-pac-token",
          namespace: "pipelines-as-code",
        },
        stringData: {
          token: git.token,
        },
      },
      opts
    );

    new k8s.core.v1.Secret(
      `${name}-webhook-secret`,
      {
        metadata: {
          name: "git-pac-webhook",
          namespace: "pipelines-as-code",
        },
        stringData: {
          secret: webhookSecret.result,
        },
      },
      opts
    );

    const incomingSecret = new random.RandomPassword(
      `${name}-pac-incoming-secret`,
      {
        length: 32,
        special: false,
      },
      { parent: this }
    );

    new k8s.core.v1.Secret(
      `${name}-incoming-secret`,
      {
        metadata: {
          name: "pac-incoming-secret",
          namespace: "pipelines-as-code",
        },
        stringData: {
          secret: incomingSecret.result,
        },
      },
      opts
    );

    if (androidKeystore) {
      new k8s.core.v1.Secret(
        `${name}-android-keystore`,
        {
          metadata: {
            name: "android-keystore",
            namespace: "pipelines-as-code",
          },
          data: {
            "keystore.jks": androidKeystore.jks,
          },
          stringData: {
            "keystore-password": androidKeystore.password,
            "key-alias": androidKeystore.alias,
            "key-password": androidKeystore.password,
          },
        },
        opts
      );
    }

    if (pulumiCredentials) {
      new k8s.core.v1.Secret(
        `${name}-pulumi-credentials`,
        {
          metadata: {
            name: "pulumi-credentials",
            namespace: "pipelines-as-code",
          },
          stringData: {
            PULUMI_CONFIG_PASSPHRASE: pulumiCredentials.passphrase,
            PULUMI_BACKEND_URL: pulumiCredentials.backendUrl,
            AWS_ACCESS_KEY_ID: pulumiCredentials.accessKeyId,
            AWS_SECRET_ACCESS_KEY: pulumiCredentials.secretAccessKey,
          },
        },
        opts
      );
    }

    if (authentikCredentials) {
      new k8s.core.v1.Secret(
        `${name}-authentik-credentials`,
        {
          metadata: {
            name: "authentik-credentials",
            namespace: "pipelines-as-code",
          },
          stringData: {
            AUTHENTIK_URL: authentikCredentials.url,
            AUTHENTIK_TOKEN: authentikCredentials.token,
          },
        },
        opts
      );
    }

    const globalRepo = new k8s.apiextensions.CustomResource(
      `${name}-pac-global-repo`,
      {
        apiVersion: "pipelinesascode.tekton.dev/v1alpha1",
        kind: "Repository",
        metadata: {
          name: "global-git-config",
          namespace: "pipelines-as-code",
        },
        spec: {
          git_provider: {
            type: "gitea",
            url: `https://${git.host}`,
            secret: {
              name: "git-pac-token",
              key: "token",
            },
            webhook_secret: {
              name: "git-pac-webhook",
              key: "secret",
            },
          },
          params: globalParams ? [
            { name: "BUILDKIT_AMD64_ADDR", value: globalParams.buildkitAmd64Addr },
            { name: "BUILDKIT_ARM64_ADDR", value: globalParams.buildkitArm64Addr },
            { name: "CONTAINER_REGISTRY", value: globalParams.containerRegistry },
            { name: "GIT_URL", value: globalParams.gitUrl },
          ] : undefined,
        },
      },
      opts
    );

    const repos = git.repositories ?? [];
    for (const repoPath of repos) {
      const repoName = repoPath.replace(/\//g, "-").toLowerCase();
      new k8s.apiextensions.CustomResource(
        `${name}-pac-repo-${repoName}`,
        {
          apiVersion: "pipelinesascode.tekton.dev/v1alpha1",
          kind: "Repository",
          metadata: {
            name: `pac-${repoName}`,
            namespace: "pipelines-as-code",
          },
            spec: {
              url: `https://${git.host}/${repoPath}`,
              git_provider: {
                type: "gitea",
                url: `https://${git.host}`,
                secret: {
                  name: "git-pac-token",
                  key: "token",
                },
                webhook_secret: {
                  name: "git-pac-webhook",
                  key: "secret",
                },
              },
              params: globalParams ? [
                { name: "BUILDKIT_AMD64_ADDR", value: globalParams.buildkitAmd64Addr },
                { name: "BUILDKIT_ARM64_ADDR", value: globalParams.buildkitArm64Addr },
                { name: "CONTAINER_REGISTRY", value: globalParams.containerRegistry },
                { name: "GIT_URL", value: globalParams.gitUrl },
              ] : undefined,
              incoming: [
                {
                  targets: ["main"],
                  secret: {
                    name: "pac-incoming-secret",
                    key: "secret",
                  },
                  type: "webhook-url",
                },
              ],
          },
        },
        { ...opts, dependsOn: [globalRepo] }
      );
    }

    return { webhookSecret: webhookSecret.result, incomingSecret: incomingSecret.result };
  }

  private provisionClusterAccess(
    name: string,
    cluster: ClusterProviderConfig,
    opts: pulumi.ComponentResourceOptions
  ): pulumi.Output<{ name: string; server: string; caData: string; token: string }> {
    const ns = new k8s.core.v1.Namespace(
      `${name}-${cluster.name}-tekton-deploy-ns`,
      {
        metadata: { name: "tekton-deploy" },
      },
      { ...opts, provider: cluster.provider }
    );

    const clusterRole = new k8s.rbac.v1.ClusterRole(
      `${name}-${cluster.name}-tekton-deployer-role`,
      {
        metadata: { name: "tekton-deployer" },
        rules: [
          {
            apiGroups: [""],
            resources: [
              "namespaces",
              "configmaps",
              "secrets",
              "services",
              "serviceaccounts",
              "persistentvolumeclaims",
              "pods",
              "pods/log",
            ],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["apps"],
            resources: ["deployments", "statefulsets", "daemonsets"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["batch"],
            resources: ["jobs"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["networking.k8s.io"],
            resources: ["ingresses"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["gateway.networking.k8s.io"],
            resources: ["httproutes", "grpcroutes"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["traefik.io"],
            resources: ["tlsoptions"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["objectbucket.io"],
            resources: ["objectbucketclaims"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["rbac.authorization.k8s.io"],
            resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: ["tekton.dev"],
            resources: ["pipelineruns", "taskruns", "pipelines", "tasks"],
            verbs: ["get", "list", "watch"],
          },
          {
            apiGroups: ["pipelinesascode.tekton.dev"],
            resources: ["repositories"],
            verbs: ["get", "list"],
          },
        ],
      },
      { ...opts, provider: cluster.provider }
    );

    const sa = new k8s.core.v1.ServiceAccount(
      `${name}-${cluster.name}-tekton-deployer-sa`,
      {
        metadata: {
          name: "tekton-deployer",
          namespace: "tekton-deploy",
        },
      },
      { ...opts, provider: cluster.provider, dependsOn: [ns] }
    );

    new k8s.rbac.v1.ClusterRoleBinding(
      `${name}-${cluster.name}-tekton-deployer-binding`,
      {
        metadata: { name: "tekton-deployer" },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "ClusterRole",
          name: "tekton-deployer",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: "tekton-deployer",
            namespace: "tekton-deploy",
          },
        ],
      },
      { ...opts, provider: cluster.provider, dependsOn: [clusterRole, sa] }
    );

    const tokenSecret = new k8s.core.v1.Secret(
      `${name}-${cluster.name}-tekton-deployer-token`,
      {
        metadata: {
          name: "tekton-deployer-token",
          namespace: "tekton-deploy",
          annotations: {
            "kubernetes.io/service-account.name": "tekton-deployer",
          },
        },
        type: "kubernetes.io/service-account-token",
      },
      { ...opts, provider: cluster.provider, dependsOn: [sa] }
    );

    return tokenSecret.data.apply(tokenData => ({
      name: cluster.name,
      server: cluster.server,
      caData: cluster.caData,
      token: Buffer.from(tokenData["token"], "base64").toString("utf-8"),
    }));
  }

  private createPruner(
    name: string,
    opts: pulumi.CustomResourceOptions
  ): void {
    const labels = { app: `${name}-pruner`, component: "pac-pruner" };

    const sa = new k8s.core.v1.ServiceAccount(
      `${name}-pruner-sa`,
      {
        metadata: {
          name: "pac-pruner",
          namespace: "pipelines-as-code",
          labels,
        },
      },
      opts
    );

    const role = new k8s.rbac.v1.Role(
      `${name}-pruner-role`,
      {
        metadata: {
          name: "pac-pruner",
          namespace: "pipelines-as-code",
          labels,
        },
        rules: [
          {
            apiGroups: ["tekton.dev"],
            resources: ["pipelineruns", "taskruns"],
            verbs: ["list", "delete"],
          },
        ],
      },
      opts
    );

    new k8s.rbac.v1.RoleBinding(
      `${name}-pruner-rolebinding`,
      {
        metadata: {
          name: "pac-pruner",
          namespace: "pipelines-as-code",
          labels,
        },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "Role",
          name: "pac-pruner",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: "pac-pruner",
            namespace: "pipelines-as-code",
          },
        ],
      },
      { ...opts, dependsOn: [sa, role] }
    );

    new k8s.batch.v1.CronJob(
      `${name}-pruner`,
      {
        metadata: {
          name: "pac-pruner",
          namespace: "pipelines-as-code",
          labels,
        },
        spec: {
          schedule: "0 3 * * *",
          concurrencyPolicy: "Forbid",
          successfulJobsHistoryLimit: 3,
          failedJobsHistoryLimit: 3,
          jobTemplate: {
            spec: {
              template: {
                metadata: { labels },
                spec: {
                  serviceAccountName: "pac-pruner",
                  restartPolicy: "OnFailure",
                  containers: [
                    {
                      name: "pruner",
                      image: DOCKER_IMAGES.TKN_PRUNER.image,
                      command: ["tkn"],
                      args: [
                        "pr",
                        "rm",
                        "--all",
                        "--keep-since",
                        "1440",
                        "-n",
                        "pipelines-as-code",
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      { ...opts, dependsOn: [sa, role] }
    );
  }

  private createClusterTasks(
    name: string,
    opts: pulumi.CustomResourceOptions
  ): void {
    const tasksDir = path.join(__dirname, "tekton-tasks");
    new k8s.kustomize.Directory(
      `${name}-cluster-tasks`,
      { directory: tasksDir },
      opts
    );
  }

  private assembleKubeconfig(
    name: string,
    clusterConfigs: pulumi.Output<{ name: string; server: string; caData: string; token: string }>[],
    opts: pulumi.ComponentResourceOptions
  ): pulumi.Output<string> {
    const merged = pulumi.all(clusterConfigs).apply(configs => {
      const kubeconfig = {
        apiVersion: "v1",
        kind: "Config",
        "current-context": configs[0]?.name,
        clusters: configs.map(c => ({
          name: c.name,
          cluster: {
            server: c.server,
            "certificate-authority-data": c.caData,
          },
        })),
        contexts: configs.map(c => ({
          name: c.name,
          context: {
            cluster: c.name,
            user: `tekton-deployer-${c.name}`,
          },
        })),
        users: configs.map(c => ({
          name: `tekton-deployer-${c.name}`,
          user: {
            token: c.token,
          },
        })),
      };
      return yaml.stringify(kubeconfig);
    });

    const secret = new k8s.core.v1.Secret(
      `${name}-cluster-kubeconfig`,
      {
        metadata: {
          name: "tekton-cluster-kubeconfig",
          namespace: "pipelines-as-code",
        },
        stringData: {
          kubeconfig: merged,
        },
      },
      opts
    );

    return secret.metadata.name;
  }
}
