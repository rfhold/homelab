import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { DOCKER_IMAGES } from "../docker-images";

/**
 * Configuration for the whoami component
 */
export interface WhoamiArgs {
  /** Kubernetes namespace to deploy the whoami server into */
  namespace: pulumi.Input<string>;
  /** Name of the whoami deployment */
  name?: pulumi.Input<string>;
  /** Docker image to use for the whoami server */
  image?: pulumi.Input<string>;
  /** Number of replicas */
  replicas?: pulumi.Input<number>;
  /** Service port */
  port?: pulumi.Input<number>;
  /** Service type (ClusterIP, NodePort, LoadBalancer) */
  serviceType?: pulumi.Input<string>;
  /** Ingress configuration */
  ingress?: {
    /** Whether to create an ingress */
    enabled: pulumi.Input<boolean>;
    /** Hostname for the ingress */
    hostname: pulumi.Input<string>;
    /** TLS secret name (optional) */
    tlsSecretName?: pulumi.Input<string>;
    /** Ingress class name (optional) */
    ingressClassName?: pulumi.Input<string>;
    /** Additional annotations */
    annotations?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  };
}

/**
 * Whoami component - deploys a simple whoami server for testing ingress functionality
 * 
 * @example
 * ```typescript
 * import { Whoami } from "../components/whoami";
 * 
 * const whoami = new Whoami("whoami", {
 *   namespace: "ingress-system",
 *   name: "whoami",
 *   ingress: {
 *     enabled: true,
 *     hostname: "whoami.example.com",
 *     tlsSecretName: "default-tls-secret",
 *   },
 * });
 * ```
 */
export class Whoami extends pulumi.ComponentResource {
  /** The Deployment resource */
  public readonly deployment: k8s.apps.v1.Deployment;

  /** The Service resource */
  public readonly service: k8s.core.v1.Service;

  /** The Ingress resource (if enabled) */
  public readonly ingress?: k8s.networking.v1.Ingress;

  constructor(name: string, args: WhoamiArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Whoami", name, args, opts);

    const appName = args.name || "whoami";
    const image = args.image || DOCKER_IMAGES.WHOAMI.image;
    const replicas = args.replicas || 1;
    const port = args.port || 80;
    const serviceType = args.serviceType || "ClusterIP";

    // Create deployment
    this.deployment = new k8s.apps.v1.Deployment(
      `${name}-deployment`,
      {
        metadata: {
          name: appName,
          namespace: args.namespace,
        },
        spec: {
          replicas: replicas,
          selector: {
            matchLabels: {
              app: appName,
            },
          },
          template: {
            metadata: {
              labels: {
                app: appName,
              },
            },
            spec: {
              containers: [
                {
                  name: "whoami",
                  image: image,
                  ports: [
                    {
                      containerPort: port,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      { parent: this }
    );

    // Create service
    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: appName,
          namespace: args.namespace,
        },
        spec: {
          type: serviceType,
          selector: {
            app: appName,
          },
          ports: [
            {
              port: port,
              targetPort: port,
            },
          ],
        },
      },
      { parent: this }
    );

    // Create ingress if enabled
    if (args.ingress?.enabled) {
      const ingressSpec: any = {
        rules: [
          {
            host: args.ingress.hostname,
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: appName,
                      port: {
                        number: port,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      // Add TLS if secret is provided
      if (args.ingress.tlsSecretName) {
        ingressSpec.tls = [
          {
            hosts: [args.ingress.hostname],
            secretName: args.ingress.tlsSecretName,
          },
        ];
      }

      this.ingress = new k8s.networking.v1.Ingress(
        `${name}-ingress`,
        {
          metadata: {
            name: appName,
            namespace: args.namespace,
            annotations: args.ingress.annotations,
          },
          spec: {
            ingressClassName: args.ingress.ingressClassName,
            ...ingressSpec,
          },
        },
        { parent: this }
      );
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      ingress: this.ingress,
    });
  }

  /**
   * Get the service name
   */
  public getServiceName(): pulumi.Output<string> {
    return this.service.metadata.name;
  }

  /**
   * Get the service endpoint
   */
  public getServiceEndpoint(): pulumi.Output<string> {
    return pulumi.interpolate`${this.service.metadata.name}.${this.service.metadata.namespace}.svc.cluster.local`;
  }
} 