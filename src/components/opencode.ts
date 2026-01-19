import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as command from "@pulumi/command";
import { DOCKER_IMAGES } from "../docker-images";
import { getIngressUrl } from "../utils/kubernetes";

export interface OpenCodeArgs {
  namespace: pulumi.Input<string>;

  replicas?: pulumi.Input<number>;

  image?: pulumi.Input<string>;
  imagePullPolicy?: pulumi.Input<string>;

  secrets: {
    serverPassword?: pulumi.Input<string>;
    sshPublicKey: pulumi.Input<string>;
    sshPrivateKey: pulumi.Input<string>;
  };

  githubUsername?: pulumi.Input<string>;

  storage: {
    opencode: {
      size: pulumi.Input<string>;
      storageClass: pulumi.Input<string>;
    };
    repos: {
      size: pulumi.Input<string>;
      storageClass: pulumi.Input<string>;
    };
  };

  resources?: {
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  };

  ingress?: {
    enabled?: pulumi.Input<boolean>;
    className?: pulumi.Input<string>;
    host: pulumi.Input<string>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
    tls?: {
      enabled?: pulumi.Input<boolean>;
      secretName?: pulumi.Input<string>;
    };
  };

  ssh?: {
    enabled?: pulumi.Input<boolean>;
    port?: pulumi.Input<number>;
    annotations?: pulumi.Input<{ [key: string]: string }>;
  };

  buildkit?: {
    amd64Host?: pulumi.Input<string>;
    arm64Host?: pulumi.Input<string>;
  };

  user?: {
    name: pulumi.Input<string>;
    uid: pulumi.Input<number>;
    gid: pulumi.Input<number>;
  };

  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  tolerations?: pulumi.Input<k8s.types.input.core.v1.Toleration[]>;
}

export class OpenCode extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly sshService?: k8s.core.v1.Service;
  public readonly opencodePvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly reposPvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly secret: k8s.core.v1.Secret;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly podReaderClusterRole: k8s.rbac.v1.ClusterRole;
  public readonly podReaderClusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
  public readonly deploymentRestartRole: k8s.rbac.v1.Role;
  public readonly deploymentRestartRoleBinding: k8s.rbac.v1.RoleBinding;

  constructor(name: string, args: OpenCodeArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:OpenCode", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const labels = { app: "opencode", component: name };

    const userName = args.user?.name || "rfhold";
    const userUid = args.user?.uid || 1000;
    const userGid = args.user?.gid || 1000;
    const githubUsername = args.githubUsername || "rfhold";

    const githubKeys = new command.local.Command(`${name}-github-keys`, {
      create: pulumi.interpolate`curl -sfL https://github.com/${githubUsername}.keys`,
    }, defaultResourceOptions);

    const secretStringData: { [key: string]: pulumi.Input<string> } = {
      "id_ed25519": args.secrets.sshPrivateKey,
      "id_ed25519.pub": args.secrets.sshPublicKey,
      "authorized_keys": githubKeys.stdout,
    };
    if (args.secrets.serverPassword) {
      secretStringData["OPENCODE_SERVER_PASSWORD"] = args.secrets.serverPassword;
    }

    this.secret = new k8s.core.v1.Secret(`${name}-secrets`, {
      metadata: {
        name: `${name}-secrets`,
        namespace: args.namespace,
        labels,
      },
      type: "Opaque",
      stringData: secretStringData,
    }, defaultResourceOptions);

    this.serviceAccount = new k8s.core.v1.ServiceAccount(`${name}-sa`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
    }, defaultResourceOptions);

    this.podReaderClusterRole = new k8s.rbac.v1.ClusterRole(`${name}-pod-reader`, {
      metadata: {
        name: `${name}-pod-reader`,
        labels,
      },
      rules: [{
        apiGroups: [""],
        resources: ["pods"],
        verbs: ["get", "list", "watch"],
      }],
    }, defaultResourceOptions);

    this.podReaderClusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(`${name}-pod-reader`, {
      metadata: {
        name: `${name}-pod-reader`,
        labels,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: this.podReaderClusterRole.metadata.name,
      },
      subjects: [{
        kind: "ServiceAccount",
        name: this.serviceAccount.metadata.name,
        namespace: args.namespace,
      }],
    }, defaultResourceOptions);

    this.deploymentRestartRole = new k8s.rbac.v1.Role(`${name}-deployment-restart`, {
      metadata: {
        name: `${name}-deployment-restart`,
        namespace: args.namespace,
        labels,
      },
      rules: [{
        apiGroups: ["apps"],
        resources: ["deployments"],
        resourceNames: [name],
        verbs: ["get", "patch"],
      }],
    }, defaultResourceOptions);

    this.deploymentRestartRoleBinding = new k8s.rbac.v1.RoleBinding(`${name}-deployment-restart`, {
      metadata: {
        name: `${name}-deployment-restart`,
        namespace: args.namespace,
        labels,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: this.deploymentRestartRole.metadata.name,
      },
      subjects: [{
        kind: "ServiceAccount",
        name: this.serviceAccount.metadata.name,
        namespace: args.namespace,
      }],
    }, defaultResourceOptions);

    this.opencodePvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-opencode-data`, {
      metadata: {
        name: `${name}-opencode-data`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: args.storage.opencode.storageClass,
        resources: {
          requests: {
            storage: args.storage.opencode.size,
          },
        },
      },
    }, defaultResourceOptions);

    this.reposPvc = new k8s.core.v1.PersistentVolumeClaim(`${name}-repos`, {
      metadata: {
        name: `${name}-repos`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: args.storage.repos.storageClass,
        resources: {
          requests: {
            storage: args.storage.repos.size,
          },
        },
      },
    }, defaultResourceOptions);

    const buildkitEnabled = !!(args.buildkit?.amd64Host || args.buildkit?.arm64Host);

    const homeInitContainer: k8s.types.input.core.v1.Container = {
      name: "init-home",
      image: "alpine:latest",
      command: [
        "sh",
        "-c",
        `set -ex
mkdir -p /home-init/.local/bin
mkdir -p /home-init/.local/share
mkdir -p /home-init/.cache
mkdir -p /home-init/.config`,
      ],
      volumeMounts: [
        { name: "home-local", mountPath: "/home-init/.local" },
        { name: "home-cache", mountPath: "/home-init/.cache" },
        { name: "home-config", mountPath: "/home-init/.config" },
      ],
    };

    const buildkitInitContainer: k8s.types.input.core.v1.Container | undefined = buildkitEnabled ? {
      name: "init-buildx",
      image: "alpine:latest",
      securityContext: {
        runAsUser: userUid,
        runAsGroup: userGid,
      },
      command: [
        "sh",
        "-c",
        pulumi.all([args.buildkit?.amd64Host, args.buildkit?.arm64Host]).apply(([amd64Host, arm64Host]) => {
          const nodes: string[] = [];
          let nodeIndex = 0;
          if (amd64Host) {
            nodes.push(`{"Name":"multi${nodeIndex++}","Endpoint":"${amd64Host}","Platforms":[],"DriverOpts":null,"Flags":null,"Files":null}`);
          }
          if (arm64Host) {
            nodes.push(`{"Name":"multi${nodeIndex++}","Endpoint":"${arm64Host}","Platforms":null,"DriverOpts":null,"Flags":null,"Files":null}`);
          }
          return `set -ex
mkdir -p /buildx/instances /buildx/activity
cat > /buildx/instances/multi << 'EOFCONFIG'
{"Name":"multi","Driver":"remote","Nodes":[${nodes.join(",")}],"Dynamic":false}
EOFCONFIG
cat > /buildx/current << 'EOFCURRENT'
{"Key":"unix:///var/run/docker.sock","Name":"multi","Global":false}
EOFCURRENT
printf '%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /buildx/activity/multi
touch /buildx/.lock`;
        }),
      ],
      volumeMounts: [
        { name: "buildx-config", mountPath: "/buildx" },
      ],
    } : undefined;

    const buildkitVolumes: k8s.types.input.core.v1.Volume[] = buildkitEnabled ? [
      { name: "buildx-config", emptyDir: {} },
    ] : [];

    const buildkitMounts: k8s.types.input.core.v1.VolumeMount[] = buildkitEnabled ? [
      { name: "buildx-config", mountPath: pulumi.interpolate`/home/${userName}/.docker/buildx` },
    ] : [];

    const buildkitEnv: k8s.types.input.core.v1.EnvVar[] = buildkitEnabled ? [
      { name: "DOCKER_BUILDKIT", value: "1" },
      { name: "BUILDX_BUILDER", value: "multi" },
    ] : [];

    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name: name,
        namespace: args.namespace,
        labels,
      },
      spec: {
        replicas: args.replicas || 1,
        strategy: {
          type: "Recreate",
        },
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels,
          },
          spec: {
            serviceAccountName: this.serviceAccount.metadata.name,
            securityContext: {
              runAsUser: userUid,
              runAsGroup: userGid,
              fsGroup: userGid,
            },
            nodeSelector: args.nodeSelector,
            tolerations: args.tolerations,
            initContainers: [
              homeInitContainer,
              ...(buildkitInitContainer ? [buildkitInitContainer] : []),
            ],
            containers: [
              {
                name: "opencode",
                image: args.image || DOCKER_IMAGES.OPENCODE_DOT.image,
                imagePullPolicy: args.imagePullPolicy || "IfNotPresent",
                args: ["opencode", "web", "--port", "4096", "--hostname", "0.0.0.0"],
                ports: [
                  {
                    containerPort: 4096,
                    name: "http",
                  },
                  {
                    containerPort: 22,
                    name: "ssh",
                  },
                ],
                env: [
                  ...(args.secrets.serverPassword ? [{
                    name: "OPENCODE_SERVER_PASSWORD",
                    valueFrom: {
                      secretKeyRef: {
                        name: this.secret.metadata.name,
                        key: "OPENCODE_SERVER_PASSWORD",
                      },
                    },
                  }] : []),
                  { name: "HOME", value: pulumi.interpolate`/home/${userName}` },
                  ...buildkitEnv,
                ],
                volumeMounts: [
                  {
                    name: "opencode-data",
                    mountPath: pulumi.interpolate`/home/${userName}/.local/share/opencode`,
                  },
                  {
                    name: "repos",
                    mountPath: pulumi.interpolate`/home/${userName}/repos`,
                  },
                  {
                    name: "ssh-keys",
                    mountPath: pulumi.interpolate`/home/${userName}/.ssh-conf`,
                    readOnly: true,
                  },
                  ...buildkitMounts,
                  { name: "home-local", mountPath: pulumi.interpolate`/home/${userName}/.local` },
                  { name: "home-cache", mountPath: pulumi.interpolate`/home/${userName}/.cache` },
                  { name: "home-config", mountPath: pulumi.interpolate`/home/${userName}/.config` },
                ],
                resources: {
                  requests: {
                    memory: args.resources?.requests?.memory || "512Mi",
                    cpu: args.resources?.requests?.cpu || "100m",
                  },
                  limits: {
                    memory: args.resources?.limits?.memory || "2Gi",
                    cpu: args.resources?.limits?.cpu || "2000m",
                  },
                },
              },

            ],
            volumes: [
              {
                name: "opencode-data",
                persistentVolumeClaim: {
                  claimName: this.opencodePvc.metadata.name,
                },
              },
              {
                name: "repos",
                persistentVolumeClaim: {
                  claimName: this.reposPvc.metadata.name,
                },
              },
              {
                name: "ssh-keys",
                secret: {
                  secretName: this.secret.metadata.name,
                  defaultMode: 0o400,
                  items: [
                    {
                      key: "id_ed25519",
                      path: "id_ed25519",
                      mode: 0o400,
                    },
                    {
                      key: "id_ed25519.pub",
                      path: "id_ed25519.pub",
                      mode: 0o644,
                    },
                    {
                      key: "authorized_keys",
                      path: "authorized_keys",
                      mode: 0o644,
                    },
                  ],
                },
              },
              ...buildkitVolumes,
              { name: "home-local", emptyDir: {} },
              { name: "home-cache", emptyDir: {} },
              { name: "home-config", emptyDir: {} },
            ],
          },
        },
      },
    }, defaultResourceOptions);

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: `${name}-web`,
        namespace: args.namespace,
        labels,
      },
      spec: {
        type: "ClusterIP",
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 4096,
          protocol: "TCP",
          name: "http",
        }],
      },
    }, defaultResourceOptions);

    if (args.ssh?.enabled) {
      this.sshService = new k8s.core.v1.Service(`${name}-ssh-service`, {
        metadata: {
          name: `${name}-ssh`,
          namespace: args.namespace,
          labels,
          annotations: args.ssh.annotations,
        },
        spec: {
          type: "LoadBalancer",
          selector: labels,
          ports: [{
            port: args.ssh.port || 2200,
            targetPort: 22,
            protocol: "TCP",
            name: "ssh",
          }],
        },
      }, defaultResourceOptions);
    }

    if (args.ingress?.enabled) {
      this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels,
          annotations: args.ingress.annotations,
        },
        spec: {
          ingressClassName: args.ingress.className,
          tls: args.ingress.tls?.enabled ? [{
            hosts: [args.ingress.host],
            secretName: args.ingress.tls.secretName,
          }] : undefined,
          rules: [{
            host: args.ingress.host,
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix" as const,
                  backend: {
                    service: {
                      name: this.service.metadata.name,
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
              ],
            },
          }],
        },
      }, defaultResourceOptions);
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      sshService: this.sshService,
      opencodePvc: this.opencodePvc,
      reposPvc: this.reposPvc,
      secret: this.secret,
      ingress: this.ingress,
      serviceAccount: this.serviceAccount,
      podReaderClusterRole: this.podReaderClusterRole,
      podReaderClusterRoleBinding: this.podReaderClusterRoleBinding,
      deploymentRestartRole: this.deploymentRestartRole,
      deploymentRestartRoleBinding: this.deploymentRestartRoleBinding,
    });
  }

  public getUrl(): pulumi.Output<string> {
    if (this.ingress) {
      return getIngressUrl(this.ingress);
    }
    return pulumi.interpolate`http://${this.service.metadata.name}`;
  }

  public getServiceUrl(): pulumi.Output<string> {
    return pulumi.interpolate`http://${this.service.metadata.name}`;
  }
}
