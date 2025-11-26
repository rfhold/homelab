import * as pulumi from "@pulumi/pulumi";
import { Valkey } from "../components/bitnami-valkey";
import { SearXNG } from "../components/searxng";
import { createValkeyConnectionString } from "../adapters/redis";

export interface AIWorkspaceModuleArgs {
  namespace: pulumi.Input<string>;

  searxng?: {
    enabled?: pulumi.Input<boolean>;
    replicas?: pulumi.Input<number>;
    baseUrl?: pulumi.Input<string>;
    instanceName?: pulumi.Input<string>;

    limiter?: {
      enabled?: pulumi.Input<boolean>;
    };

    search?: {
      safeSearch?: pulumi.Input<number>;
      autocomplete?: pulumi.Input<string>;
      favicon?: pulumi.Input<string>;
      formats?: pulumi.Input<string[]>;
    };

    ui?: {
      infiniteScroll?: pulumi.Input<boolean>;
      theme?: pulumi.Input<string>;
      style?: pulumi.Input<string>;
      hotkeys?: pulumi.Input<string>;
    };

    engines?: pulumi.Input<string[]>;

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
  };
}

export class AIWorkspaceModule extends pulumi.ComponentResource {
  private readonly valkey?: Valkey;
  public readonly searxng?: SearXNG;

  constructor(name: string, args: AIWorkspaceModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:AIWorkspace", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    if (args.searxng?.enabled) {
      this.valkey = new Valkey(`${name}-searxng-cache`, {
        namespace: args.namespace,
        storage: {
          size: "2Gi",
        },
        memoryLimit: "256Mi",
        cpuLimit: "100m",
      }, defaultResourceOptions);

      const valkeyConfig = this.valkey.getConnectionConfig();
      const valkeyUrl = createValkeyConnectionString(valkeyConfig);

      this.searxng = new SearXNG(`${name}-searxng`, {
        namespace: args.namespace,
        baseUrl: args.searxng.baseUrl,
        instanceName: args.searxng.instanceName,
        limiter: args.searxng.limiter,
        search: args.searxng.search,
        ui: args.searxng.ui,
        valkey: {
          url: valkeyUrl,
        },
        engines: args.searxng.engines,
        resources: args.searxng.resources,
        ingress: args.searxng.ingress,
      }, {
        dependsOn: [this.valkey],
        ...defaultResourceOptions,
      });
    }

    this.registerOutputs({
      searxng: this.searxng,
    });
  }
}
