import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface GatewayReverseProxyArgs {
  namespace: pulumi.Input<string>;

  hostname: pulumi.Input<string>;

  backend: {
    host: pulumi.Input<string>;
    port: pulumi.Input<number>;
  };

  gatewayRef: {
    name: pulumi.Input<string>;
    namespace: pulumi.Input<string>;
  };

  requestTimeout?: pulumi.Input<string>;

  websocketSupport?: pulumi.Input<boolean>;
}

export class GatewayReverseProxy extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;
  public readonly endpoints: k8s.core.v1.Endpoints;
  public readonly httpRoute: k8s.apiextensions.CustomResource;

  constructor(name: string, args: GatewayReverseProxyArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:GatewayReverseProxy", name, args, opts);

    const websocketSupport = args.websocketSupport ?? false;

    const serviceSpec: any = {
      ports: [{
        port: args.backend.port,
        targetPort: args.backend.port,
        protocol: "TCP",
      }],
    };

    if (websocketSupport) {
      serviceSpec.ports[0].appProtocol = "kubernetes.io/ws";
    }

    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name: `${name}-backend`,
        namespace: args.namespace,
      },
      spec: serviceSpec,
    }, { parent: this });

    this.endpoints = new k8s.core.v1.Endpoints(`${name}-endpoints`, {
      metadata: {
        name: `${name}-backend`,
        namespace: args.namespace,
      },
      subsets: [{
        addresses: [{
          ip: args.backend.host,
        }],
        ports: [{
          port: args.backend.port,
          protocol: "TCP",
        }],
      }],
    }, { parent: this });

    const timeouts: any = {};
    if (args.requestTimeout) {
      timeouts.request = args.requestTimeout;
    }

    this.httpRoute = new k8s.apiextensions.CustomResource(`${name}-httproute`, {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: {
        name: `${name}-route`,
        namespace: args.namespace,
      },
      spec: {
        parentRefs: [{
          name: args.gatewayRef.name,
          namespace: args.gatewayRef.namespace,
        }],
        hostnames: [args.hostname],
        rules: [{
          backendRefs: [{
            name: pulumi.interpolate`${name}-backend`,
            kind: "Service",
            port: args.backend.port,
          }],
          ...(Object.keys(timeouts).length > 0 && { timeouts }),
        }],
      },
    }, { parent: this, dependsOn: [this.service, this.endpoints] });

    this.registerOutputs({
      service: this.service,
      endpoints: this.endpoints,
      httpRoute: this.httpRoute,
    });
  }

  public getHostname(): pulumi.Output<string> {
    return pulumi.output(this.httpRoute).apply((route: any) => route.spec?.hostnames?.[0] || "") as pulumi.Output<string>;
  }

  public getBackendUrl(): pulumi.Output<string> {
    return pulumi.output(this.httpRoute).apply((route: any) => {
      const hostname = route.spec?.hostnames?.[0] || "";
      return pulumi.interpolate`https://${hostname}`;
    });
  }
}
