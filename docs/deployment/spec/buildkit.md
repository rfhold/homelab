# BuildKit Placement

The Pantheon amd64 BuildKit builder MUST:

- select `kubernetes.io/hostname=artemis`;
- mount its node-local cache from `/var/lib/buildkit-cache/amd64`; and
- preserve the existing amd64 BuildKit service identity used by clients.

Moving the builder does not require copying a prior node-local cache or changing the arm64 builder.
