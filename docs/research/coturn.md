# Coturn Research Evidence

This is a non-authoritative research record. It does not establish that Coturn is selected, configured, deployed, or reachable in the homelab.

## Provenance

- No Coturn version, research date, or retrieval date was recorded.
- Consulted sources: [Coturn repository](https://github.com/coturn/coturn), [configuration example](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf), [container guidance](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md), [performance notes](https://github.com/coturn/coturn/wiki/TURN-Performance-and-Load-Balance), and [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).

## Evidence Retained

- Coturn was evaluated for STUN and TURN relay support for WebRTC and voice traffic.
- The evaluation identified public address mapping, broad UDP relay ranges, TLS, time-limited credentials, private-peer restrictions, and file-descriptor capacity as operational concerns.
- Host networking and direct firewall changes appeared only as generic options, not approved homelab decisions.

## Repository Relevance

The topic is relevant to real-time media and voice connectivity, but the research recorded no repository-specific selection or deployment evidence.

## Disposition

No canonical Coturn feature contract exists. [Edge networking](../edge-networking/README.md) remains authoritative for implemented ingress, DNS, certificates, and tunnels; [voice satellites](../voice-satellites/README.md) records the current voice scope and gaps.
