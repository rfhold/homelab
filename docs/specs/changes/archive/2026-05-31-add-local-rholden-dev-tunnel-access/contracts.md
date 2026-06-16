# Contract Changes: add-local-rholden-dev-tunnel-access

This file is required because the change expands shared Pulumi component and stack configuration surfaces used to render HTTPRoute hostnames.

## Scope

- **Requirements covered**: `kubernetes-workloads` ADDED Requirement: `Multi-Hostname HTTPRoute Configuration`; `edge-networking` ADDED Requirements: `Local Tunnel Alias Resolution`, `Local Tunnel Alias Certificate Coverage`
- **Contract surfaces**: `programs/media-server/service.ts`, `programs/media-server/index.ts`, `src/components/gateway-reverse-proxy.ts`, `programs/reverse-proxy/index.ts`, `programs/media-server/Pulumi.prod.yaml`, `programs/reverse-proxy/Pulumi.home-assistant.yaml`, `programs/ingress/Pulumi.pantheon.yaml`
- **Non-contract implementation excluded**: HTTPRoute rendering behavior, Cloudflare Tunnel resources, ExternalDNS deployment behavior, service backend behavior

## Exact Changes

### `programs/media-server/service.ts`

- **Change type**: modify
- **Symbols/objects**: `ServiceArgs.httpRoute`
- **Exact target shape**:
  ```ts
  httpRoute?: {
    gateway: {
      name: pulumi.Input<string>;
      namespace: pulumi.Input<string>;
    },
    hostname: pulumi.Input<string>;
    hostnames?: pulumi.Input<string>[];
    servicePort: pulumi.Input<number>;
  },
  ```
- **Compatibility/migration notes**: Existing callers keep using `hostname`; aliases are added through optional `hostnames`.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `programs/media-server/index.ts`

- **Change type**: modify
- **Symbols/objects**: `ServiceConfig.httpRoute`
- **Exact target shape**:
  ```ts
  httpRoute?: {
    hostname: string;
    hostnames?: string[];
  },
  ```
- **Compatibility/migration notes**: Existing stack YAML keeps `hostname`; tunnel aliases are declared under `hostnames`.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `src/components/gateway-reverse-proxy.ts`

- **Change type**: modify
- **Symbols/objects**: `GatewayReverseProxyArgs`
- **Exact target shape**:
  ```ts
  hostname: pulumi.Input<string>;

  hostnames?: pulumi.Input<string>[];
  ```
- **Compatibility/migration notes**: Existing callers keep using `hostname`; aliases are added through optional `hostnames`.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `programs/reverse-proxy/index.ts`

- **Change type**: modify
- **Symbols/objects**: reverse-proxy stack config contract
- **Exact target shape**:
  ```ts
  const hostnames = config.getObject<string[]>("hostnames") ?? [];
  ```
- **Compatibility/migration notes**: Existing stack YAML keeps `hostname`; alias hostnames are optional.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `programs/media-server/Pulumi.prod.yaml`

- **Change type**: modify
- **Symbols/objects**: `media-server:overseerr.httpRoute`
- **Exact target shape**:
  ```yaml
  httpRoute:
    hostname: overseerr.holdenitdown.net
    hostnames:
      - overseerr.rholden.dev
  ```
- **Compatibility/migration notes**: `overseerr.holdenitdown.net` remains the primary hostname.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `programs/reverse-proxy/Pulumi.home-assistant.yaml`

- **Change type**: modify
- **Symbols/objects**: `reverse-proxy:hostnames`
- **Exact target shape**:
  ```yaml
  reverse-proxy:hostnames:
    - home.rholden.dev
  ```
- **Compatibility/migration notes**: `reverse-proxy:hostname: home.holdenitdown.net` remains the primary hostname.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

### `programs/ingress/Pulumi.pantheon.yaml`

- **Change type**: modify
- **Symbols/objects**: `ingress:gateway.defaultGateway.hostnames`
- **Exact target shape**:
  ```yaml
  hostnames: ["*.holdenitdown.net", "*.pantheon.holdenitdown.net", "*.rholden.dev"]
  ```
- **Compatibility/migration notes**: Existing Pantheon gateway listener configuration remains unchanged; `*.rholden.dev` is added to the default gateway hostname list so local alias HTTPRoutes can attach to the gateway.
- **Generated output expected**: none
- **Allowed compile-required stubs**: none

## Validation

- **Contract stage verification**: `bun run typecheck` must pass after the contract surfaces are updated and before behavior/config rendering is completed.
- **Implementation unlock condition**: Stage 1 complete and evidence shows the changed contract surfaces match this file.
