# Authentik Research Evidence

This is a non-authoritative research record. It does not establish the current Authentik version, database, providers, applications, secrets, deployment, or live identity state.

## Provenance

- No Authentik or chart version, research date, or retrieval date was recorded.
- Consulted sources: [Authentik documentation](https://goauthentik.io/docs), [repository](https://github.com/goauthentik/authentik), [container image](https://hub.docker.com/r/goauthentik/authentik), and [Helm chart listing](https://artifacthub.io/packages/helm/goauthentik/authentik).

## Evidence Retained

- Authentik was evaluated for OIDC, OAuth2, SAML, LDAP, SCIM, customizable authentication flows, and external identity federation.
- PostgreSQL, durable encryption keys, email, reverse-proxy trust, backup-before-upgrade, sequential major upgrades, and server/outpost version alignment were identified as concerns.
- The evaluation recommended an external PostgreSQL service for a production Kubernetes deployment, but did not record an approved implementation decision.

## Repository Relevance

The research informed the identity provider and OIDC integration surfaces. Generic secret generation, credentials, values, and upgrade procedures were removed.

## Disposition

Use [secrets-management implementation](../secrets-management/implementation.md) for tracked Authentik integration and [secrets verification](../secrets-management/verification.md) for unresolved live state. No standalone Authentik deployment specification exists in this documentation hierarchy.
