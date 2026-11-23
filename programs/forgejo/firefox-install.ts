import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

interface FirefoxInstallArgs {
  namespace: pulumi.Input<string>;
  domain: string;
  backendOrigin: pulumi.Input<string>;
  ingressClassName: string;
  tlsSecretName: string;
}

export function createFirefoxInstall(args: FirefoxInstallArgs): k8s.networking.v1.Ingress {
  const name = "firefox-install";
  const labels = { "app.kubernetes.io/name": name };
  const source = readFileSync(join(__dirname, "firefox-install-server.ts"), "utf8");
  const entrypoint = "firefox-install-server.ts";
  const config = new k8s.core.v1.ConfigMap(name, {
    metadata: { name, namespace: args.namespace },
    data: { [entrypoint]: source },
  });
  const deployment = new k8s.apps.v1.Deployment(name, {
    metadata: { name, namespace: args.namespace, labels },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: {
          labels,
          annotations: { "checksum/config": createHash("sha256").update(source).digest("hex") },
        },
        spec: {
          automountServiceAccountToken: false,
          securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, seccompProfile: { type: "RuntimeDefault" } },
          containers: [{
            name,
            image: "docker.io/oven/bun:1.3.5",
            command: ["bun", `/app/${entrypoint}`],
            env: [
              { name: "FORGEJO_PUBLIC_ORIGIN", value: `https://${args.domain}` },
              { name: "FORGEJO_BACKEND_ORIGIN", value: args.backendOrigin },
            ],
            ports: [{ name: "http", containerPort: 8080 }],
            readinessProbe: { httpGet: { path: "/healthz", port: "http" } },
            livenessProbe: { httpGet: { path: "/healthz", port: "http" } },
            securityContext: {
              allowPrivilegeEscalation: false,
              readOnlyRootFilesystem: true,
              capabilities: { drop: ["ALL"] },
            },
            resources: { requests: { cpu: "25m", memory: "32Mi" }, limits: { memory: "256Mi" } },
            volumeMounts: [{ name: "source", mountPath: "/app", readOnly: true }],
          }],
          volumes: [{ name: "source", configMap: { name: config.metadata.name } }],
        },
      },
    },
  });
  const service = new k8s.core.v1.Service(name, {
    metadata: { name, namespace: args.namespace, labels },
    spec: { selector: labels, ports: [{ name: "http", port: 80, targetPort: "http" }] },
  }, { dependsOn: [deployment] });
  return new k8s.networking.v1.Ingress(name, {
    metadata: {
      name,
      namespace: args.namespace,
      annotations: { "traefik.ingress.kubernetes.io/router.tls": "true" },
    },
    spec: {
      ingressClassName: args.ingressClassName,
      tls: [{ hosts: [args.domain], secretName: args.tlsSecretName }],
      rules: [{
        host: args.domain,
        http: {
          paths: [{
            path: "/install/firefox",
            pathType: "Prefix",
            backend: { service: { name: service.metadata.name, port: { number: 80 } } },
          }],
        },
      }],
    },
  });
}
