# Technitium DNS API - Full Parameter Reference

Source: [APIDOCS.md](https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md)

## Request Format

- Base URL: `http://<server>:5380`
- Token: query parameter `token=` on every request (except login/createToken)
- GET or POST. POST body: `application/x-www-form-urlencoded`. File uploads: `multipart/form-data`.
- Response JSON: `{ "status": "ok"|"error"|"invalid-token"|"2fa-required", "response": {...}, "errorMessage": "..." }`

## Authentication

### POST /api/user/login

| Param | Required | Description |
|---|---|---|
| `user` | Yes | Username |
| `pass` | Yes | Password |
| `totp` | No | TOTP code if 2FA enabled |
| `includeInfo` | No | `true` to include version, permissions, dnsServerDomain |

Returns: `token` (session, expires after 30 min inactivity), `displayName`, `username`.

### POST /api/user/createToken

| Param | Required | Description |
|---|---|---|
| `user` | Yes | Username |
| `pass` | Yes | Password |
| `totp` | No | TOTP code if 2FA enabled |
| `tokenName` | Yes | Label for the token |

Returns: `token` (persistent, does not expire).

### POST /api/admin/sessions/createToken

| Param | Required | Description |
|---|---|---|
| `token` | Yes | Admin session token |
| `user` | Yes | Username to create token for |
| `tokenName` | Yes | Label for the token |

### POST /api/user/logout

| Param | Required | Description |
|---|---|---|
| `token` | Yes | Token to invalidate |

### GET /api/user/session/get

| Param | Required | Description |
|---|---|---|
| `token` | Yes | Token to inspect |

Returns: `displayName`, `username`, `info` (version, dnsServerDomain, defaultRecordTtl, permissions, uptimestamp).

## Zones

### GET /api/zones/list

| Param | Required | Description |
|---|---|---|
| `pageNumber` | No | Page number. Omit for all zones. |
| `zonesPerPage` | No | Default: 10 |

Zone object fields: `name`, `type` (Primary/Secondary/Stub/Forwarder/SecondaryForwarder/Catalog/SecondaryCatalog), `internal`, `dnssecStatus` (Unsigned/SignedWithNSEC/SignedWithNSEC3), `soaSerial`, `expiry`, `isExpired`, `syncFailed`, `notifyFailed`, `notifyFailedFor`, `lastModified`, `disabled`.

### POST /api/zones/create

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Domain name, IP, or CIDR (auto reverse zone) |
| `type` | Yes | Primary, Secondary, Stub, Forwarder, SecondaryForwarder, Catalog, SecondaryCatalog |
| `catalog` | No | Catalog zone name to register as member |
| `useSoaSerialDateScheme` | No | `true` for date-based SOA serial |
| `primaryNameServerAddresses` | No | Comma-separated IPs (Secondary/Stub/SecondaryForwarder) |
| `zoneTransferProtocol` | No | Tcp, Tls, Quic (Secondary types) |
| `tsigKeyName` | No | TSIG key name (Secondary types) |
| `validateZone` | No | `true` for ZONEMD validation (Secondary) |
| `initializeForwarder` | No | `true` (default) creates FWD record |
| `protocol` | No | Udp, Tcp, Tls, Https, Quic (Forwarder, default: Udp) |
| `forwarder` | No | Forwarder address. `this-server` for internal. |
| `dnssecValidation` | No | DNSSEC validation for forwarder |
| `proxyType` | No | NoProxy, DefaultProxy, Http, Socks5 |
| `proxyAddress` | No | Proxy address |
| `proxyPort` | No | Proxy port |
| `proxyUsername` | No | Proxy username |
| `proxyPassword` | No | Proxy password |

### POST /api/zones/delete

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |

### POST /api/zones/enable

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |

### POST /api/zones/disable

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |

### GET /api/zones/options/get

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |
| `includeAvailableCatalogZoneNames` | No | `true` |
| `includeAvailableTsigKeyNames` | No | `true` |

### POST /api/zones/options/set

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |
| `disabled` | No | `true`/`false` |
| `catalog` | No | Catalog zone name |
| `queryAccess` | No | Deny, Allow, AllowOnlyPrivateNetworks, AllowOnlyZoneNameServers, UseSpecifiedNetworkACL, AllowZoneNameServersAndUseSpecifiedNetworkACL |
| `queryAccessNetworkACL` | No | Network ACL entries |
| `zoneTransfer` | No | Same enum as queryAccess |
| `zoneTransferNetworkACL` | No | Network ACL entries |
| `zoneTransferTsigKeyNames` | No | TSIG key names |
| `notify` | No | None, ZoneNameServers, SpecifiedNameServers, BothZoneAndSpecifiedNameServers |
| `notifyNameServers` | No | Comma-separated NS addresses |
| `update` | No | Same enum as queryAccess |
| `updateNetworkACL` | No | Network ACL entries |
| `updateSecurityPolicies` | No | TSIG-based update policies |

### POST /api/zones/import

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |
| `overwrite` | No | `true` to overwrite existing records |
| `overwriteSoaSerial` | No | `true` to overwrite SOA serial |

Body: zone file text (RFC 1035 format).

### GET /api/zones/export

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |

Returns: `text/plain` zone file.

### POST /api/zones/clone

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | New zone name |
| `sourceZone` | Yes | Existing zone to clone |

### POST /api/zones/convert

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Zone domain name |
| `type` | Yes | Target zone type |

### POST /api/zones/resync

| Param | Required | Description |
|---|---|---|
| `zone` | Yes | Secondary/Stub zone to resync |

## Records

### GET /api/zones/records/get

| Param | Required | Description |
|---|---|---|
| `domain` | Yes | Domain name |
| `zone` | No | Auto-detected |
| `listZone` | No | `true` for all records in zone |

Record object fields: `disabled`, `name`, `type`, `ttl`, `rData` (type-specific object), `dnssecStatus`, `lastUsedOn`, `comments`, `expiryTtl`.

### POST /api/zones/records/add

Common params:

| Param | Required | Description |
|---|---|---|
| `domain` | Yes | FQDN |
| `zone` | No | Auto-detected |
| `type` | Yes | Record type |
| `ttl` | No | Default: server default (typically 3600) |
| `overwrite` | No | `true` replaces RRset, `false` (default) appends |
| `comments` | No | Comment text |
| `expiryTtl` | No | Auto-delete seconds since last modification |

#### A / AAAA

| Param | Required | Description |
|---|---|---|
| `ipAddress` | Yes | IP address. `request-ip-address` for dynamic DNS. |
| `ptr` | No | `true` to create reverse PTR |
| `createPtrZone` | No | `true` to auto-create reverse zone |
| `updateSvcbHints` | No | `true` to update SVCB/HTTPS hints |

#### NS

| Param | Required | Description |
|---|---|---|
| `nameServer` | Yes | NS domain name |
| `glue` | No | Comma-separated glue IPs |

#### CNAME

| Param | Required | Description |
|---|---|---|
| `cname` | Yes | Target domain |

#### PTR

| Param | Required | Description |
|---|---|---|
| `ptrName` | Yes | Target domain |

#### MX

| Param | Required | Description |
|---|---|---|
| `exchange` | Yes | Mail exchange domain |
| `preference` | Yes | Priority (lower = higher) |

#### TXT

| Param | Required | Description |
|---|---|---|
| `text` | Yes | Text data |
| `splitText` | No | `true` to split on newlines |

#### SRV

| Param | Required | Description |
|---|---|---|
| `priority` | Yes | Priority |
| `weight` | Yes | Weight |
| `port` | Yes | Port |
| `target` | Yes | Target hostname |

#### SOA (update only, auto-created with zone)

| Param | Required | Description |
|---|---|---|
| `primaryNameServer` | Yes | Primary NS |
| `responsiblePerson` | Yes | Email as domain (hostadmin.example.com) |
| `serial` | Yes | Serial number |
| `refresh` | Yes | Refresh seconds |
| `retry` | Yes | Retry seconds |
| `expire` | Yes | Expire seconds |
| `minimum` | Yes | Minimum/negative TTL seconds |
| `useSerialDateScheme` | No | `true` for date-based serial |

#### CAA

| Param | Required | Description |
|---|---|---|
| `flags` | Yes | Typically 0 |
| `tag` | Yes | issue, issuewild, iodef |
| `value` | Yes | CA domain or contact URI |

#### ANAME (proprietary)

| Param | Required | Description |
|---|---|---|
| `aname` | Yes | Target domain (resolved to A/AAAA at query time) |

#### FWD (proprietary - conditional forwarder)

| Param | Required | Description |
|---|---|---|
| `protocol` | Yes | Udp, Tcp, Tls, Https, Quic |
| `forwarder` | Yes | Address. `this-server` for internal. |
| `forwarderPriority` | No | Integer (lower = higher priority) |
| `dnssecValidation` | No | `true`/`false` |
| `proxyType` | No | NoProxy, DefaultProxy, Http, Socks5 |
| `proxyAddress` | No | Proxy address |
| `proxyPort` | No | Proxy port |
| `proxyUsername` | No | Proxy username |
| `proxyPassword` | No | Proxy password |

#### APP (proprietary - DNS app record)

| Param | Required | Description |
|---|---|---|
| `appName` | Yes | Installed DNS app name |
| `classPath` | Yes | App class path |
| `recordData` | No | App-specific data |

### POST /api/zones/records/update

Common params:

| Param | Required | Description |
|---|---|---|
| `domain` | Yes | Current domain name |
| `zone` | No | Auto-detected |
| `type` | Yes | Record type |
| `newDomain` | No | Rename/move record |
| `ttl` | No | New TTL |
| `disable` | No | `true` to disable |
| `comments` | No | Comment text |
| `expiryTtl` | No | Auto-delete seconds |

Type-specific identification + update params:

#### A / AAAA

| Param | Required | Description |
|---|---|---|
| `ipAddress` | Yes | Current IP (identifies record) |
| `newIpAddress` | No | New IP |
| `ptr` | No | `true` to update PTR |
| `createPtrZone` | No | `true` to create reverse zone |
| `updateSvcbHints` | No | `true` to update SVCB hints |

#### NS

| Param | Required | Description |
|---|---|---|
| `nameServer` | Yes | Current value |
| `newNameServer` | No | New value |
| `glue` | No | Comma-separated glue IPs |

#### CNAME

| Param | Required | Description |
|---|---|---|
| `cname` | Yes | New CNAME value |

#### PTR

| Param | Required | Description |
|---|---|---|
| `ptrName` | Yes | Current value |
| `newPtrName` | Yes | New value |

#### MX

| Param | Required | Description |
|---|---|---|
| `preference` | Yes | Current preference |
| `exchange` | Yes | Current exchange |
| `newPreference` | No | New preference |
| `newExchange` | Yes | New exchange |

#### TXT

| Param | Required | Description |
|---|---|---|
| `text` | Yes | Current text |
| `newText` | Yes | New text |
| `splitText` | No | Current split (default false) |
| `newSplitText` | No | New split |

#### SRV

| Param | Required | Description |
|---|---|---|
| `priority` | Yes | Current priority |
| `weight` | Yes | Current weight |
| `port` | Yes | Current port |
| `target` | Yes | Current target |
| `newPriority` | No | New priority |
| `newWeight` | No | New weight |
| `newPort` | No | New port |
| `newTarget` | No | New target |

#### CAA

| Param | Required | Description |
|---|---|---|
| `flags` | Yes | Current flags |
| `tag` | Yes | Current tag |
| `value` | Yes | Current value |
| `newFlags` | No | New flags |
| `newTag` | No | New tag |
| `newValue` | No | New value |

#### SOA

| Param | Required | Description |
|---|---|---|
| `primaryNameServer` | Yes | Primary NS |
| `responsiblePerson` | Yes | RP email as domain |
| `serial` | Yes | Serial number |
| `refresh` | Yes | Refresh seconds |
| `retry` | Yes | Retry seconds |
| `expire` | Yes | Expire seconds |
| `minimum` | Yes | Minimum TTL seconds |
| `useSerialDateScheme` | No | `true` for date serial |

### POST /api/zones/records/delete

Common params: `domain`, `zone` (optional), `type`.

Type-specific identification params:

| Type | Params |
|---|---|
| A / AAAA | `ipAddress` |
| NS | `nameServer` |
| CNAME | (none) |
| PTR | `ptrName` |
| MX | `preference`, `exchange` |
| TXT | `text`, `splitText` (default false) |
| SRV | `priority`, `weight`, `port`, `target` |
| CAA | `flags`, `tag`, `value` |
| ANAME | `aname` |
| FWD | `protocol` (default Udp), `forwarder` |

## Blocked / Allowed Zones

### GET /api/blocked/list

| Param | Required | Description |
|---|---|---|
| `domain` | No | Domain to browse (default: root) |
| `direction` | No | `up` or `down` (default: down) |

### POST /api/blocked/add

| Param | Required | Description |
|---|---|---|
| `domain` | Yes | Domain to block |

### POST /api/blocked/delete

| Param | Required | Description |
|---|---|---|
| `domain` | Yes | Domain to unblock |

### POST /api/blocked/flush

No params. Clears all blocked entries.

### POST /api/blocked/import

Body: `blockedZones=domain1.com,domain2.com`

### GET /api/blocked/export

Returns text/plain download.

### Allowed Zones

Same endpoints at `/api/allowed/*` with identical params. Import body key: `allowedZones`.

### Block List Settings

| Endpoint | Params | Notes |
|---|---|---|
| `/api/settings/forceUpdateBlockLists` | — | Re-download all block list URLs |
| `/api/settings/temporaryDisableBlocking` | `minutes` | Disable blocking temporarily |

## Query Logs

### GET /api/logs/query

| Param | Required | Description |
|---|---|---|
| `name` | Yes | Installed app name: `Query Logs (Sqlite)` |
| `classPath` | Yes | `QueryLogsSqlite.App` |
| `pageNumber` | No | Default: 1 |
| `entriesPerPage` | No | Default: 15 |
| `descendingOrder` | No | `true` for newest first |
| `start` | No | ISO 8601: `yyyy-MM-dd HH:mm:ss` |
| `end` | No | ISO 8601: `yyyy-MM-dd HH:mm:ss` |
| `clientIpAddress` | No | Filter by client IP |
| `protocol` | No | Udp, Tcp, Tls, Https, Quic |
| `responseType` | No | Authoritative, Recursive, Cached, Blocked, UpstreamBlocked, CacheBlocked |
| `rcode` | No | NoError, NxDomain, ServerFailure, Refused |
| `qname` | No | Wildcard supported: `*.example.com` |
| `qtype` | No | A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR, ANY |
| `qclass` | No | Typically IN |

Entry fields: `rowNumber`, `timestamp` (UTC), `clientIpAddress`, `protocol`, `responseType`, `responseRtt` (ms, Recursive only), `rcode`, `qname`, `qtype`, `qclass`, `answer`.

Known app identifiers:

| App Name | classPath |
|---|---|
| Query Logs (Sqlite) | QueryLogsSqlite.App |
| Query Logs (MySQL) | QueryLogsMySql.App |
| Query Logs (SQL Server) | QueryLogsSqlServer.App |

### GET /api/logs/export

Same filter params as `/api/logs/query` (without `pageNumber`, `entriesPerPage`, `descendingOrder`). Returns `text/csv`.

### Server Log Files

| Endpoint | Params | Notes |
|---|---|---|
| `/api/logs/list` | — | List log files (`fileName`, `size`) |
| `/api/logs/download` | `fileName`, `limit` (MB) | Download log file |
| `/api/logs/delete` | `log` (fileName) | Delete log file |
| `/api/logs/deleteAll` | — | Delete all log files |

## DNS Client

### GET /api/dnsClient/resolve

| Param | Required | Description |
|---|---|---|
| `server` | Yes | `this-server`, `recursive-resolver`, `system-dns`, or address |
| `domain` | Yes | Domain to query |
| `type` | Yes | A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR, ANY, AXFR |
| `protocol` | No | Udp (default), Tcp, Tls, Https, Quic |
| `dnssec` | No | `true` for DNSSEC validation |
| `eDnsClientSubnet` | No | EDNS Client Subnet address |
| `import` | No | `true` to import response into authoritative zone |

Server address formats:
- IP: `1.1.1.1`, `8.8.8.8:53`
- Domain: `dns.quad9.net:853`
- Domain+IP: `cloudflare-dns.com (1.1.1.1)`
- DoH: `https://cloudflare-dns.com/dns-query`
- DoH+IP: `https://cloudflare-dns.com/dns-query (1.1.1.1)`
- IPv6: `[2606:4700:4700::1111]:853`

## Dashboard

### GET /api/dashboard/stats/get

| Param | Required | Description |
|---|---|---|
| `type` | No | LastHour (default), LastDay, LastWeek, LastMonth, LastYear, Custom |
| `utc` | No | `true` for UTC chart labels |
| `start` | No | ISO 8601 (Custom type) |
| `end` | No | ISO 8601 (Custom type) |

Response `stats` fields: `totalQueries`, `totalNoError`, `totalServerFailure`, `totalNxDomain`, `totalRefused`, `totalAuthoritative`, `totalRecursive`, `totalCached`, `totalBlocked`, `totalDropped`, `totalClients`, `zones`, `cachedEntries`, `allowedZones`, `blockedZones`, `blockListZones`.

### GET /api/dashboard/stats/getTop

| Param | Required | Description |
|---|---|---|
| `type` | No | Same time range enum as stats/get |
| `statsType` | Yes | TopClients, TopDomains, TopBlockedDomains |
| `limit` | No | Default: 1000 |
| `noReverseLookup` | No | `true` to skip reverse DNS (TopClients) |
| `onlyRateLimitedClients` | No | `true` for rate-limited only (TopClients) |

## Clustering

All cluster endpoints use the `/api/admin/cluster/` prefix. These are admin-only endpoints.

### GET /api/admin/cluster/state

No params (besides `token`).

Response fields:

| Field | Description |
|---|---|
| `version` | Server version (e.g. `14.3`) |
| `dnsServerDomain` | This node's domain |
| `clusterInitialized` | `true` if this node is part of a cluster |
| `clusterDomain` | The cluster zone domain (e.g. `dns.holdenitdown.net`) |
| `heartbeatRefreshIntervalSeconds` | Heartbeat interval (default: 30) |
| `heartbeatRetryIntervalSeconds` | Heartbeat retry interval (default: 10) |
| `configRefreshIntervalSeconds` | Config sync interval (default: 900) |
| `configRetryIntervalSeconds` | Config retry interval (default: 60) |
| `clusterNodes` | Array of node objects |

Node object fields:

| Field | Description |
|---|---|
| `id` | Numeric node ID |
| `name` | Node domain name |
| `url` | Cluster endpoint URL (e.g. `https://primary.dns.holdenitdown.net:53443/`) |
| `ipAddresses` | Array of IP addresses |
| `type` | `Primary` or `Secondary` |
| `state` | `Self`, `Connected`, `Disconnected`, `Failed` |
| `upSince` | ISO 8601 timestamp of last startup |
| `lastSeen` | ISO 8601 timestamp of last heartbeat (not present for `Self`) |
| `configLastSynced` | ISO 8601 timestamp of last config sync (Secondary nodes only) |

### POST /api/admin/cluster/init

Initialize this node as the primary cluster node.

| Param | Required | Description |
|---|---|---|
| `ipAddresses` | Yes | Comma-separated IP addresses for this node |
| `clusterDomain` | Yes | Domain for the cluster zone |
| `clusterNodeDomain` | Yes | This node's domain within the cluster |
| `port` | No | Cluster port (default: 53443) |

### POST /api/admin/cluster/initJoin

Join an existing cluster as a secondary node.

| Param | Required | Description |
|---|---|---|
| `secondaryNodeIpAddresses` | Yes | Comma-separated IP addresses for this secondary node |
| `primaryNodeUrl` | Yes | Primary node's cluster URL |
| `primaryNodeIpAddress` | Yes | Primary node's IP address |
| `ignoreCertificateErrors` | No | `true` to skip TLS certificate validation |
| `primaryNodeUsername` | Yes | Username on the primary node |
| `primaryNodePassword` | Yes | Password on the primary node |

### POST /api/admin/cluster/updateIpAddresses

| Param | Required | Description |
|---|---|---|
| `ipAddresses` | Yes | Comma-separated new IP addresses for this node |

### POST /api/admin/cluster/primary/deleteSecondary

Remove a secondary node from the cluster (run on primary).

| Param | Required | Description |
|---|---|---|
| `secondaryNodeId` | Yes | Numeric ID of the secondary node to remove |

### POST /api/admin/cluster/primary/updateSecondary

Update a secondary node's connection info (run on primary).

| Param | Required | Description |
|---|---|---|
| `secondaryNodeId` | Yes | Numeric ID of the secondary node |
| `secondaryNodeUrl` | Yes | Secondary node's cluster URL |
| `secondaryNodeIpAddresses` | Yes | Comma-separated IP addresses |
| `secondaryNodeCertificate` | Yes | Base64url-encoded TLSA certificate |

### POST /api/admin/cluster/primary/delete

Delete the cluster configuration (run on primary). No params besides `token`. Destroys the entire cluster.

### POST /api/admin/cluster/secondary/leave

Leave the cluster (run on secondary).

| Param | Required | Description |
|---|---|---|
| `forceLeave` | No | `true` to force leave even if primary is unreachable |

## DNS Cache

| Endpoint | Params |
|---|---|
| `/api/cache/list` | `domain` (optional), `direction` (up/down) |
| `/api/cache/delete` | `domain` |
| `/api/cache/flush` | — |

## DNS Apps

| Endpoint | Method | Params |
|---|---|---|
| `/api/apps/list` | GET | — |
| `/api/apps/listStoreApps` | GET | — |
| `/api/apps/config/get` | GET | `name` |
| `/api/apps/config/set` | POST | `name`, body: `config=...` |
| `/api/apps/downloadAndInstall` | POST | URL-based install |
| `/api/apps/downloadAndUpdate` | POST | URL-based update |
| `/api/apps/install` | POST | Upload zip |
| `/api/apps/update` | POST | Upload zip |
| `/api/apps/uninstall` | GET | `name` |

The `/api/apps/list` response includes `name`, `version`, `classPaths` (array), and flags like `isQueryLogger` for each app.
