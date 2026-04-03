---
name: technitium-dns
description: Manage Technitium DNS Server via its HTTP API. Use when working with DNS zones, records, blocked domains, query logs, or DNS resolution through Technitium. Trigger phrases: "technitium", "dns zone", "dns record", "blocked domain", "query log", "dns log", "resolve domain", "block list", "A record", "CNAME record", "MX record", "technitium API".
metadata:
  author: rfhold
  category: dns
  version: "2.0"
---

# Technitium DNS

Manage zones, records, blocked domains, query logs, clustering, and DNS resolution via the Technitium DNS Server HTTP API.

## Connection

- Primary: `http://primary.dns.holdenitdown.net:5380` (`172.16.4.8`) — authoritative for `holdenitdown.net`, `rholden.dev`, `rholden.me`
- Secondary: `http://secondary.dns.holdenitdown.net:5380` (`172.16.3.8`) — replicates from primary via catalog zone
- Auth: pass `token=<api-token>` as a query parameter on every request
- All endpoints accept GET or POST. POST uses `Content-Type: application/x-www-form-urlencoded`.
- Responses are JSON with a `status` field: `ok`, `error`, `invalid-token`, `2fa-required`.

CRITICAL: Never log or echo API tokens. Pass them only as query parameters in API calls.

CRITICAL: When using curl, always use `--data-urlencode` for the `pass` parameter (and any param that may contain special characters). The admin password contains special characters that break requests if not URL-encoded.

## Workflow

1. Obtain a token via `/api/user/login` using `--data-urlencode` for the password:
   ```
   curl -s "http://172.16.4.8:5380/api/user/login" \
     --data-urlencode "user=admin" \
     --data-urlencode "pass=$TECHNITIUM_ADMIN_PASSWORD" | jq -r '.token'
   ```
2. For zone operations, call `/api/zones/list` first to confirm zone names.
3. For record operations, call `/api/zones/records/get` with `listZone=true` to see all records before modifying.
4. For query logs, use `/api/logs/query` with `name=Query Logs (Sqlite)` and `classPath=QueryLogsSqlite.App`.
5. For DNS resolution, use `/api/dnsClient/resolve` with `server=this-server`.
6. For cluster diagnostics, use `/api/admin/cluster/state` (note the `/api/admin/` prefix).

## Authentication

| Endpoint | Params | Notes |
|---|---|---|
| `/api/user/login` | `user`, `pass`, `includeInfo` | Returns session token (expires after 30 min inactivity) |
| `/api/user/createToken` | `user`, `pass`, `tokenName` | Returns persistent API token |
| `/api/user/logout` | `token` | Invalidates session token |
| `/api/user/session/get` | `token` | Returns session info, permissions, server version |

## Zones

| Endpoint | Params | Notes |
|---|---|---|
| `/api/zones/list` | `pageNumber`, `zonesPerPage` | Omit pagination params to get all zones |
| `/api/zones/create` | `zone`, `type` | `type`: Primary, Secondary, Stub, Forwarder, Catalog, SecondaryCatalog |
| `/api/zones/delete` | `zone` | |
| `/api/zones/enable` | `zone` | |
| `/api/zones/disable` | `zone` | |
| `/api/zones/options/get` | `zone` | Returns zone config (ACLs, TSIG, notify, catalog membership) |
| `/api/zones/options/set` | `zone`, ... | Set zone config options |
| `/api/zones/resync` | `zone` | Resync Secondary/Stub/SecondaryCatalog zones only |
| `/api/zones/import` | `zone`, `overwrite` | POST with zone file text in body |
| `/api/zones/export` | `zone` | Returns text/plain zone file |
| `/api/zones/clone` | `zone` (new), `sourceZone` | |
| `/api/zones/convert` | `zone`, `type` | |

## Clustering

All cluster endpoints use the `/api/admin/cluster/` prefix.

| Endpoint | Params | Notes |
|---|---|---|
| `/api/admin/cluster/state` | — | Returns cluster nodes, state, heartbeat intervals |
| `/api/admin/cluster/init` | `ipAddresses`, `clusterDomain`, `clusterNodeDomain`, `port` | Initialize primary cluster node |
| `/api/admin/cluster/initJoin` | `ipAddresses`, `primaryNodeUrl`, `primaryNodeIpAddress`, `ignoreCertErrors`, `primaryUser`, `primaryPass` | Join as secondary |
| `/api/admin/cluster/updateIpAddresses` | `ipAddresses` | Update node's cluster IP addresses |
| `/api/admin/cluster/primary/deleteSecondary` | `nodeId` | Remove a secondary node from primary |
| `/api/admin/cluster/primary/updateSecondary` | `nodeId`, `nodeUrl`, `ipAddresses`, `tlsaCertificateBase64Url` | Update secondary node TLSA |
| `/api/admin/cluster/secondary/leave` | `forceLeave` | Leave cluster (`forceLeave=true` to force) |

### Cluster State Response

```json
{
  "response": {
    "version": "14.3",
    "dnsServerDomain": "primary.dns.holdenitdown.net",
    "clusterInitialized": true,
    "clusterDomain": "dns.holdenitdown.net",
    "clusterNodes": [
      {
        "id": 1788556654,
        "name": "primary.dns.holdenitdown.net",
        "type": "Primary",
        "state": "Self",
        "ipAddresses": ["172.16.4.8"]
      },
      {
        "id": 953674965,
        "name": "secondary.dns.holdenitdown.net",
        "type": "Secondary",
        "state": "Connected",
        "ipAddresses": ["172.16.3.8"],
        "lastSeen": "2026-03-31T16:19:58Z"
      }
    ]
  }
}
```

Node `state` values: `Self`, `Connected`, `Disconnected`, `Failed`.

### Cluster Diagnostics Workflow

When investigating clustering issues:

1. **Check cluster state on both nodes** via `/api/admin/cluster/state`. Verify both show `Connected` / `Self`.
2. **Compare zone lists** on primary and secondary via `/api/zones/list`. The secondary should have all non-internal zones as `Secondary` type.
3. **Check the catalog zone** (`cluster-catalog.<clusterDomain>`). Both servers should have identical PTR records under `*.zones.cluster-catalog...` pointing to each managed zone.
4. **Compare SOA serials** for each replicated zone on both servers. Mismatched serials indicate sync lag.
5. **Check `notifyFailed`** in zone options on the primary. If `notifyFailed: true`, the primary cannot reach the secondary for that zone.
6. **If a zone is missing on the secondary** but present in the catalog, resync the catalog zone on the secondary:
   ```
   /api/zones/resync?token=x&zone=cluster-catalog.dns.holdenitdown.net
   ```
   This forces the secondary to re-process catalog members and recreate missing zones.
7. **Verify resolution** on both servers using `/api/dnsClient/resolve?server=this-server&domain=<test>&type=A`. Both should return authoritative answers.

## Records

### Get Records

```
GET /api/zones/records/get?token=x&domain=example.com&zone=example.com&listZone=true
```

| Param | Required | Notes |
|---|---|---|
| `domain` | Yes | Domain name to query |
| `zone` | No | Auto-detected if omitted |
| `listZone` | No | `true` to list all records in the zone |

### Add Record

```
GET /api/zones/records/add?token=x&domain=www.example.com&type=A&ipAddress=192.168.1.1&ttl=3600
```

Common params: `domain`, `type`, `ttl`, `overwrite`, `comments`, `expiryTtl`. The `zone` param is optional (auto-detected).

Type-specific params:

| Type | Params |
|---|---|
| A / AAAA | `ipAddress`, `ptr`, `createPtrZone` |
| CNAME | `cname` |
| MX | `exchange`, `preference` |
| TXT | `text`, `splitText` |
| SRV | `priority`, `weight`, `port`, `target` |
| NS | `nameServer`, `glue` |
| PTR | `ptrName` |
| CAA | `flags`, `tag`, `value` |
| ANAME | `aname` |
| FWD | `protocol`, `forwarder`, `forwarderPriority`, `dnssecValidation` |
| SOA | `primaryNameServer`, `responsiblePerson`, `serial`, `refresh`, `retry`, `expire`, `minimum` |

### Update Record

```
GET /api/zones/records/update?token=x&domain=www.example.com&type=A&ipAddress=1.2.3.4&newIpAddress=5.6.7.8&ttl=7200
```

CRITICAL: You must provide the current values to identify the record, plus `new*` values for what to change.

Common params: `domain`, `type`, `newDomain`, `ttl`, `disable`, `comments`, `expiryTtl`.

| Type | Identify with | Update with |
|---|---|---|
| A / AAAA | `ipAddress` | `newIpAddress` |
| NS | `nameServer` | `newNameServer`, `glue` |
| CNAME | — | `cname` |
| PTR | `ptrName` | `newPtrName` |
| MX | `preference`, `exchange` | `newPreference`, `newExchange` |
| TXT | `text` | `newText` |
| SRV | `priority`, `weight`, `port`, `target` | `newPriority`, `newWeight`, `newPort`, `newTarget` |
| CAA | `flags`, `tag`, `value` | `newFlags`, `newTag`, `newValue` |
| SOA | — | `primaryNameServer`, `responsiblePerson`, `serial`, `refresh`, `retry`, `expire`, `minimum` |

### Delete Record

```
GET /api/zones/records/delete?token=x&domain=www.example.com&type=A&ipAddress=192.168.1.1
```

Must identify the record by its current values:

| Type | Identification Params |
|---|---|
| A / AAAA | `ipAddress` |
| NS | `nameServer` |
| CNAME | (none) |
| PTR | `ptrName` |
| MX | `preference`, `exchange` |
| TXT | `text`, `splitText` |
| SRV | `priority`, `weight`, `port`, `target` |
| CAA | `flags`, `tag`, `value` |
| ANAME | `aname` |
| FWD | `protocol`, `forwarder` |

## Blocked / Allowed Domains

| Endpoint | Params | Notes |
|---|---|---|
| `/api/blocked/list` | `domain`, `direction` | Browse block tree. `direction`: `up` or `down` |
| `/api/blocked/add` | `domain` | Block a domain |
| `/api/blocked/delete` | `domain` | Unblock a domain |
| `/api/blocked/flush` | — | Clear all blocked entries |
| `/api/blocked/import` | POST body: `blockedZones=d1,d2` | Bulk import |
| `/api/blocked/export` | — | Download as text |
| `/api/allowed/list` | `domain`, `direction` | Same pattern as blocked |
| `/api/allowed/add` | `domain` | Allow a domain |
| `/api/allowed/delete` | `domain` | Remove from allowed |
| `/api/settings/temporaryDisableBlocking` | `minutes` | Temporarily disable all blocking |
| `/api/settings/forceUpdateBlockLists` | — | Force re-download block list URLs |

## Query Logs

Requires the "Query Logs (Sqlite)" DNS App installed.

```
GET /api/logs/query?token=x&name=Query%20Logs%20(Sqlite)&classPath=QueryLogsSqlite.App&pageNumber=1&entriesPerPage=25&descendingOrder=true
```

| Param | Required | Notes |
|---|---|---|
| `name` | Yes | `Query Logs (Sqlite)` |
| `classPath` | Yes | `QueryLogsSqlite.App` |
| `pageNumber` | No | Default: 1 |
| `entriesPerPage` | No | Default: 15 |
| `descendingOrder` | No | `true` for newest first |
| `start` | No | ISO 8601: `yyyy-MM-dd HH:mm:ss` |
| `end` | No | ISO 8601: `yyyy-MM-dd HH:mm:ss` |
| `clientIpAddress` | No | Filter by client IP |
| `protocol` | No | `Udp`, `Tcp`, `Tls`, `Https`, `Quic` |
| `responseType` | No | `Authoritative`, `Recursive`, `Cached`, `Blocked`, `UpstreamBlocked`, `CacheBlocked` |
| `rcode` | No | `NoError`, `NxDomain`, `ServerFailure`, `Refused` |
| `qname` | No | Supports wildcards: `*.example.com` |
| `qtype` | No | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SOA`, `SRV`, `PTR`, `ANY` |
| `qclass` | No | Typically `IN` |

Response entry fields: `rowNumber`, `timestamp`, `clientIpAddress`, `protocol`, `responseType`, `responseRtt`, `rcode`, `qname`, `qtype`, `qclass`, `answer`.

Export logs as CSV:

```
GET /api/logs/export?token=x&name=Query%20Logs%20(Sqlite)&classPath=QueryLogsSqlite.App&start=...&end=...
```

Same filter params as `/api/logs/query` (without pagination). Returns `text/csv`.

## DNS Client / Resolution

```
GET /api/dnsClient/resolve?token=x&server=this-server&domain=example.com&type=A
```

| Param | Required | Notes |
|---|---|---|
| `server` | Yes | `this-server`, `recursive-resolver`, `system-dns`, or an IP/domain |
| `domain` | Yes | Domain to resolve |
| `type` | Yes | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SOA`, `SRV`, `PTR`, `ANY`, `AXFR` |
| `protocol` | No | `Udp` (default), `Tcp`, `Tls`, `Https`, `Quic` |
| `dnssec` | No | `true` for DNSSEC validation |
| `import` | No | `true` to import response into an authoritative zone |

Server address formats: `1.1.1.1`, `8.8.8.8:53`, `dns.quad9.net:853`, `https://cloudflare-dns.com/dns-query`, `cloudflare-dns.com (1.1.1.1)`.

## Dashboard Stats

| Endpoint | Params | Notes |
|---|---|---|
| `/api/dashboard/stats/get` | `type`, `utc`, `start`, `end` | `type`: LastHour, LastDay, LastWeek, LastMonth, LastYear, Custom |
| `/api/dashboard/stats/getTop` | `type`, `statsType`, `limit` | `statsType`: TopClients, TopDomains, TopBlockedDomains |

## DNS Cache

| Endpoint | Params | Notes |
|---|---|---|
| `/api/cache/list` | `domain`, `direction` | Browse cached zones |
| `/api/cache/delete` | `domain` | Delete cached entry |
| `/api/cache/flush` | — | Flush entire cache |

## DNS Apps

| Endpoint | Params | Notes |
|---|---|---|
| `/api/apps/list` | — | List installed apps (use to discover `name` + `classPath` for query logs) |
| `/api/apps/config/get` | `name` | Get app config |
| `/api/apps/config/set` | `name`, POST body: `config=...` | Set app config |
| `/api/apps/uninstall` | `name` | Uninstall app |

## Troubleshooting

- `invalid-token`: Token expired or invalid. Re-authenticate or use a persistent API token.
- `error` with `errorMessage`: Check the message. Common causes: zone not found, record not found (wrong identification params), permission denied.
- **Auth fails with correct password**: Use `--data-urlencode` for the `pass` param. Special characters in the password break plain query string encoding.
- Query logs return empty: Verify the Query Logs app is installed via `/api/apps/list`. Check that `name` and `classPath` match exactly.
- Record update fails: You must provide the exact current values to identify the record. Fetch records first with `/api/zones/records/get`.
- **Zone missing on secondary**: Check if the zone exists in the catalog zone records. If present in catalog but missing as a zone, resync the catalog: `/api/zones/resync?zone=cluster-catalog.dns.holdenitdown.net`
- **`notifyFailed: true` on primary**: The primary cannot send NOTIFY to the listed secondary IPs. Often caused by the secondary not having the zone (see above). After fixing, the flag clears on the next successful notify cycle.
- **`/api/zones/resync` returns error about zone type**: This endpoint only works on Secondary, Stub, SecondaryForwarder, and SecondaryCatalog zones. It cannot be used on Primary zones.

For full parameter details per record type, see `references/api-reference.md`.
