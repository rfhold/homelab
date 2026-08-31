# Operations

Runbooks describe guarded procedures and required authorization. They do not prove that a procedure has run or that a live system is healthy.

| Document                                                                                                                           | Covers                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`openbao.md`](openbao.md)                                                                                                         | Pantheon bootstrap, OIDC, Transit, quorum maintenance, and legacy-Romulus safety boundaries            |
| [`kuri-release-secret-bootstrap.md`](kuri-release-secret-bootstrap.md)                                                             | Kuri Android signing and Forgejo publication secret import, rotation, and recovery                      |
| [`speech-service-extraction.md`](speech-service-extraction.md)                                                                     | WhisperX and Kokoro ownership cutover, retained-cache boundary, and rollback                           |
| [`../edge-networking/operations/technitium-secondary-recovery.md`](../edge-networking/operations/technitium-secondary-recovery.md) | Pantheon Technitium secondary diagnosis, persisted-config recovery, cluster rejoin, and catalog resync |
