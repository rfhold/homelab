import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { GatewayReverseProxy } from "../../src/components/gateway-reverse-proxy";

const config = new pulumi.Config("reverse-proxy");

const namespaceName = config.require("namespace");
const hostname = config.require("hostname");
const backendHost = config.require("backendHost");
const backendPort = config.requireNumber("backendPort");
const gatewayName = config.require("gatewayName");
const gatewayNamespace = config.require("gatewayNamespace");
const requestTimeout = config.get("requestTimeout") || "3600s";
const websocketSupport = config.getBoolean("websocketSupport") ?? true;

const namespace = new k8s.core.v1.Namespace(namespaceName, {
  metadata: {
    name: namespaceName,
  },
});

const proxy = new GatewayReverseProxy("reverse-proxy", {
  namespace: namespace.metadata.name,
  hostname: hostname,
  backend: {
    host: backendHost,
    port: backendPort,
  },
  gatewayRef: {
    name: gatewayName,
    namespace: gatewayNamespace,
  },
  requestTimeout: requestTimeout,
  websocketSupport: websocketSupport,
});

export const proxyHostname = proxy.getHostname();
export const backendUrl = proxy.getBackendUrl();
