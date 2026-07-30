# BuildKit Placement And Maintenance

The Pantheon BuildKit builders MUST:

- run the amd64 builder on `kubernetes.io/hostname=artemis` with node-local cache path `/var/lib/buildkit-cache/amd64`;
- run the arm64 builder on `kubernetes.io/hostname=mars` with node-local cache path `/var/lib/buildkit-cache/arm64`; and
- preserve the existing architecture-specific service identities used by clients.

Before restarting K3s on Artemis or Mars, operators MUST stop the builder pinned to that node and confirm its `buildkitd.lock` is not actively held. The builder MAY restart only after K3s and the node are ready. Recovery MUST preserve the node-local cache and MUST target only a runtime task or process whose identity is verified as the affected BuildKit pod.
