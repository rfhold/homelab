# Index

| Path | Info |
| --- | --- |
| [`../docs/deployment/README.md`](../docs/deployment/README.md) | Container-image and delivery contracts |
| [`../.tekton/`](../.tekton/) | Tekton publication pipelines used by CI and thin derived images |
| [`../.github/workflows/`](../.github/workflows/) | Manual publication workflows used by selected application images |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | Local and external validation boundaries |

# Boundaries

- This subtree owns repository Dockerfiles and their build contexts. Publication automation lives in `.tekton/` or `.github/workflows/` according to the image class.
- Select companion files from the image's purpose and validation needs; no single directory shape applies to every image.

# Contracts

| Image class | Expected material |
| --- | --- |
| CI or toolchain image | A Dockerfile can be the complete context. Add or update a matching Tekton pipeline when the repository publishes it; README and Compose files are optional. |
| Thin derived runtime image | Keep only the Dockerfile and files required to add the derived capability. Add a publication pipeline only when automated publication is part of the image contract. |
| Service or extension image | Document build arguments, runtime expectations, and functional verification. Add an image-specific harness when needed; Compose is one possible harness, not a requirement. Add a workflow only when publication is part of the contract. |
| Hardware or named variant image | Document target assumptions and map each supported Dockerfile variant to its purpose. Use target-specific validation rather than imposing a generic harness. |

- Follow neighboring images in the same class, not an unrelated directory with a different purpose.
- Validate the capability the image adds. A successful build or container start is insufficient when the image promises a tool, extension, service, or hardware-specific behavior.
- Keep Docker context paths, Dockerfile names, image tags, architectures, and matching pipeline or workflow parameters aligned.
- Never bake credentials into an image or build context. Docker builds can fetch and execute remote content, and registry pushes mutate external systems; either action requires explicit authorization.

# Hints

- Inspect the complete build context before adding files, and add `.dockerignore` entries when the context could include irrelevant or sensitive material.
- Record hardware- or service-dependent validation as not run when the required environment is unavailable or unauthorized.
