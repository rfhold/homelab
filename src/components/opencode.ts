import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as command from "@pulumi/command";
import { DOCKER_IMAGES } from "../docker-images";
import { getIngressUrl } from "../utils/kubernetes";

export interface OpenCodeArgs {
  namespace: pulumi.Input<string>;

  replicas?: pulumi.Input<number>;

  image?: pulumi.Input<string>;

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

  docker?: {
    enabled?: pulumi.Input<boolean>;
    image?: pulumi.Input<string>;
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

    const dockerEnabled = args.docker?.enabled ?? false;
    const dindImage = args.docker?.image ?? "docker:dind-rootless";
    const dockerSocketPath = `/run/user/${userUid}/docker.sock`;

    const initContainers: k8s.types.input.core.v1.Container[] = dockerEnabled ? [
      {
        name: "init-dind-rootless",
        image: dindImage,
        command: [
          "sh",
          "-c",
          pulumi.interpolate`set -ex
cp -a /etc/. /dind-etc/
echo '${userName}:x:${userUid}:${userGid}:${userName}:/home/${userName}:/bin/sh' >> /dind-etc/passwd
echo '${userName}:x:${userGid}:' >> /dind-etc/group
echo '${userName}:100000:65536' >> /dind-etc/subgid
echo '${userName}:100000:65536' >> /dind-etc/subuid
chmod 755 /dind-etc
chmod u=rwx,g=rx+s,o=rx /dind-home
chown ${userUid}:${userGid} /dind-home`,
        ],
        securityContext: {
          runAsUser: 0,
        },
        volumeMounts: [
          { name: "dind-etc", mountPath: "/dind-etc" },
          { name: "dind-home", mountPath: "/dind-home" },
        ],
      },
    ] : [];

    const dindSidecar: k8s.types.input.core.v1.Container[] = dockerEnabled ? [
      {
        name: "dind",
        image: dindImage,
        args: [
          "dockerd",
          `--host=unix://${dockerSocketPath}`,
          `--group=${userGid}`,
        ],
        securityContext: {
          privileged: true,
          runAsUser: 0,
          runAsGroup: 0,
        },
        env: [
          { name: "HOME", value: pulumi.interpolate`/home/${userName}` },
          { name: "XDG_RUNTIME_DIR", value: pulumi.interpolate`/run/user/${userUid}` },
          { name: "DOCKER_HOST", value: `unix://${dockerSocketPath}` },
        ],
        volumeMounts: [
          { name: "dind-sock", mountPath: pulumi.interpolate`/run/user/${userUid}` },
          { name: "dind-etc", mountPath: "/etc" },
          { name: "dind-home", mountPath: pulumi.interpolate`/home/${userName}` },
          { name: "dind-data", mountPath: pulumi.interpolate`/home/${userName}/.local/share/docker` },
        ],
        resources: {
          requests: {
            memory: "256Mi",
            cpu: "100m",
          },
          limits: {
            memory: "2Gi",
            cpu: "2000m",
          },
        },
      },
    ] : [];

    const dindVolumes: k8s.types.input.core.v1.Volume[] = dockerEnabled ? [
      { name: "dind-sock", emptyDir: {} },
      { name: "dind-etc", emptyDir: {} },
      { name: "dind-home", emptyDir: {} },
      { name: "dind-data", emptyDir: {} },
    ] : [];

    const mainContainerDockerMounts: k8s.types.input.core.v1.VolumeMount[] = dockerEnabled ? [
      { name: "dind-sock", mountPath: pulumi.interpolate`/run/user/${userUid}` },
    ] : [];

    const mainContainerDockerEnv: k8s.types.input.core.v1.EnvVar[] = dockerEnabled ? [
      { name: "DOCKER_HOST", value: `unix://${dockerSocketPath}` },
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
            securityContext: {
              runAsUser: userUid,
              runAsGroup: userGid,
              fsGroup: userGid,
            },
            nodeSelector: args.nodeSelector,
            tolerations: args.tolerations,
            initContainers: initContainers.length > 0 ? initContainers : undefined,
            containers: [
              {
                name: "opencode",
                image: args.image || DOCKER_IMAGES.OPENCODE_DOT.image,
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
                  ...mainContainerDockerEnv,
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
                  ...mainContainerDockerMounts,
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
              ...dindSidecar,
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
              ...dindVolumes,
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
