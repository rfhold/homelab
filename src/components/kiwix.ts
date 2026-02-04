import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

export interface KiwixArgs {
  namespace: pulumi.Input<string>;
  name?: string;

  zimFiles?: pulumi.Input<string>[];

  storage?: {
    size?: string;
    storageClass?: string;
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
}

export class KiwixComponent extends pulumi.ComponentResource {
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  public readonly service: k8s.core.v1.Service;
  public readonly pvc: k8s.core.v1.PersistentVolumeClaim;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly url: pulumi.Output<string>;

  constructor(
    name: string,
    args: KiwixArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("homelab:components:Kiwix", name, {}, opts);

    const componentName = args.name || name;
    const labels = { app: "kiwix", component: componentName };
    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    this.pvc = new k8s.core.v1.PersistentVolumeClaim(
      `${name}-data`,
      {
        metadata: {
          name: `${componentName}-data`,
          namespace: args.namespace,
          labels,
        },
        spec: {
          accessModes: ["ReadWriteOnce"],
          storageClassName: args.storage?.storageClass,
          resources: {
            requests: {
              storage: args.storage?.size || "500Gi",
            },
          },
        },
      },
      defaultResourceOptions
    );

    this.statefulSet = new k8s.apps.v1.StatefulSet(
      name,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          serviceName: componentName,
          replicas: 1,
          selector: {
            matchLabels: labels,
          },
          template: {
            metadata: {
              labels,
            },
            spec: {
              securityContext: {
                fsGroup: 0,
              },
              initContainers: args.zimFiles?.length
                ? [
                    {
                      name: "fix-permissions",
                      image: "alpine:latest",
                      command: ["/bin/sh", "-c"],
                      args: ["chmod 777 /data && chown -R nobody:nogroup /data"],
                      volumeMounts: [
                        {
                          name: "data",
                          mountPath: "/data",
                        },
                      ],
                      securityContext: {
                        runAsUser: 0,
                        runAsGroup: 0,
                      },
                    },
                    {
                      name: "download-zim",
                      image: "alpine:latest",
                      command: ["/bin/sh", "-c"],
                      args: [
                        pulumi
                          .output(args.zimFiles)
                          .apply((files) =>
                            `apk add --no-cache aria2 && ` +
                            files
                              .map(
                                (url) =>
                                  `filename=$(basename "${url}"); if [ -f "/data/$filename" ] && [ ! -f "/data/$filename.aria2" ]; then echo "$filename already complete, skipping..."; else echo "Downloading $filename..."; aria2c -x 4 -c -d /data -o "$filename" --max-tries=0 --retry-wait=10 --timeout=60 --connect-timeout=30 --auto-file-renaming=false "${url}"; fi`
                              )
                              .join(" && ")
                          ),
                      ],
                      volumeMounts: [
                        {
                          name: "data",
                          mountPath: "/data",
                        },
                      ],
                      securityContext: {
                        runAsUser: 0,
                        runAsGroup: 0,
                      },
                    },
                  ]
                : undefined,
              containers: [
                {
                  name: "kiwix-serve",
                  image: DOCKER_IMAGES.KIWIX_SERVE.image,
                  command: ["/bin/sh", "-c"],
                  args: [
                    `while true; do
                      files=$(find /data -name '*.zim' -type f 2>/dev/null)
                      if [ -n "$files" ]; then
                        echo "Found ZIM files, starting kiwix-serve..."
                        exec kiwix-serve --port=8080 $files
                      else
                        echo "No ZIM files found in /data, waiting..."
                        sleep 30
                      fi
                    done`,
                  ],
                  ports: [
                    {
                      containerPort: 8080,
                      name: "http",
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "data",
                      mountPath: "/data",
                    },
                  ],
                  resources: {
                    requests: {
                      memory: args.resources?.requests?.memory || "512Mi",
                      cpu: args.resources?.requests?.cpu || "100m",
                    },
                    limits: {
                      memory: args.resources?.limits?.memory || "4Gi",
                      cpu: args.resources?.limits?.cpu || "2000m",
                    },
                  },
                },
              ],
              volumes: [
                {
                  name: "data",
                  persistentVolumeClaim: {
                    claimName: this.pvc.metadata.name,
                  },
                },
              ],
            },
          },
        },
      },
      defaultResourceOptions
    );

    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: componentName,
          namespace: args.namespace,
          labels,
        },
        spec: {
          type: "ClusterIP",
          selector: labels,
          ports: [
            {
              port: 80,
              targetPort: 8080,
              protocol: "TCP",
              name: "http",
            },
          ],
        },
      },
      defaultResourceOptions
    );

    if (args.ingress?.enabled) {
      const ingressRules = [
        {
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
        },
      ];

      const ingressTls = args.ingress.tls?.enabled
        ? [
            {
              hosts: [args.ingress.host],
              secretName: args.ingress.tls.secretName,
            },
          ]
        : undefined;

      this.ingress = new k8s.networking.v1.Ingress(
        `${name}-ingress`,
        {
          metadata: {
            name: componentName,
            namespace: args.namespace,
            labels,
            annotations: args.ingress.annotations,
          },
          spec: {
            ingressClassName: args.ingress.className,
            rules: ingressRules,
            tls: ingressTls,
          },
        },
        defaultResourceOptions
      );
    }

    this.url = pulumi.interpolate`http://${this.service.metadata.name}:80`;

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      pvc: this.pvc,
      ingress: this.ingress,
      url: this.url,
    });
  }
}
