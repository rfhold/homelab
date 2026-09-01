# Kuri Faro Adoption

This guide defines Kuri client adoption for the tracked Faro contract. It does not prove deployment, reachability, ingestion, or backend health.

Deployment or any credentialed live check requires separate authorization for the exact target and action.

## Current Client Selection

The package selection verified on 2026-08-31 is:

| Package | Selected version |
| --- | --- |
| `@grafana/faro-web-sdk` | `2.11.0` |
| `@grafana/faro-web-tracing` | `2.11.0` |

Use `https://faro.holdenitdown.net/collect` as the collector endpoint.

The suggested application names are `kuri-spa` for the browser application and `kuri-tauri` for the Tauri application.

Treat these versions as the current selection, not as a permanent latest-version claim. Review compatibility before any package update.

## Client Onboarding

Install the selected packages with Bun:

```bash
bun add @grafana/faro-web-sdk@2.11.0 @grafana/faro-web-tracing@2.11.0
```

Initialize Faro with the 2.11.0 public API:

```typescript
import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

const applicationName = "kuri-spa";

initializeFaro({
  url: "https://faro.holdenitdown.net/collect",
  app: {
    name: applicationName,
  },
  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation(),
  ],
});
```

Call `initializeFaro` exactly once per browser or webview runtime. Use `kuri-spa` for the hosted browser and `kuri-tauri` for the Tauri webview.

Keep release and environment metadata in their dedicated application fields. Do not append either value to the application name.

The same web transport applies to Tauri because the approved receiver CORS accepts its webview origin. This behavior remains unverified until deployment and smoke verification.

The client must apply privacy filters before transmission. This guide does not prescribe source paths or framework integration because `../kuri` was not inspected.

## Client Boundaries

- Keep `app_name` stable and bounded to the application class.
- Do not place user, release, machine, device, or session identities in `app_name`.
- Exclude credentials, tokens, personal data, user content, and sensitive URL or request values from telemetry.
- Apply event, error, console, span, and attribute filters before transmission.
- Do not configure remote source-map retrieval. The receiver disables it until trusted releases and origins have an allowlist contract.

The route accepts every CORS origin because Kuri SPA and Tauri webviews can use distinct origins on the internal network. This policy does not relax client privacy or data-minimization duties.

## Local And Source Validation

These checks need no collector access:

1. Confirm that the lockfile selects both Faro packages at `2.11.0`.
2. Confirm that each client uses the `/collect` endpoint and its assigned stable application name.
3. Review instrumentation filters against the privacy boundaries in this guide.
4. Run the Kuri type, test, and production-build checks that apply to each client.
5. Confirm that source configuration contains no collector credentials or remote source-map URL.

Local validation proves client source consistency only. It does not prove collector reachability or telemetry ingestion.

## Credentialed Smoke Verification

Run these checks only after a separately authorized deployment. Use approved observability access and a fixed five-minute query window.

1. Submit one synthetic client event and one synthetic trace without personal or secret data.
2. Inspect Faro receiver metrics for accepted requests and any rate-limit, payload, parse, or export failures.
3. Query Loki for the assigned `app` label and confirm only the expected synthetic record.
4. Query Tempo for the synthetic trace and confirm its application identity and bounded test attributes.
5. Stop after the bounded sample. Record failures without repeated traffic or broader queries.

Absence from Loki or Tempo does not identify the failed layer. Correlate receiver metrics with client network errors before any new action.
