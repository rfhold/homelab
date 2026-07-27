# Index

| Path | Info |
| --- | --- |
| [`Pulumi.yaml`](Pulumi.yaml) | Authentik bridge source, version, and parameterization input |
| [`sdks/authentik/README.md`](sdks/authentik/README.md) | Generated SDK upstream attribution |
| [`../../package.json`](../../package.json) | Root dependency on the generated local SDK |

# Boundaries

- `Pulumi.yaml` is the hand-authored provider-generation input.
- `sdks/authentik/` is generated Pulumi SDK output, identified by generated-file headers and `.gitattributes`; do not hand-edit it.
- Consumer-specific infrastructure behavior belongs in `programs/` or `src/`, not in generated provider files.

# Contracts

- Change provider source, version, or parameterization at the generation input, then regenerate the SDK as one controlled change only when generation is explicitly authorized.
- Generation and installation can contact external registries, execute dependency hooks, and replace many files. Review the complete generated diff and keep package metadata and the root local dependency aligned.
- Preserve generated warnings, upstream attribution, and generated formatting. Do not apply repository source-style cleanup to generated output.
- Never include provider credentials, generated install output containing secrets, or decrypted stack data in the repository or review evidence.

# Hints

- If a defect belongs to the upstream provider or generator, record that ownership rather than patching the generated SDK locally.
