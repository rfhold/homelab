# Index

| Path | Info |
| --- | --- |
| [`../opencode.jsonc`](../opencode.jsonc) | Project OpenCode configuration and permission policy |
| [`../docs/quality/testing.md`](../docs/quality/testing.md) | External access and evidence boundaries |

# Boundaries

- OpenCode configuration, agent and command prompts, skills, plugins, and permission rules are functional behavior surfaces, even when represented as Markdown.
- Edit project behavior here or in `opencode.jsonc`; do not hand-edit `node_modules/` or generated catalogs.

# Contracts

- Preserve the repository's approval gates. Tool availability, an allow rule, or a command template is capability, not authorization to deploy, dispatch, publish, commit, push, or mutate an external system.
- Commands and agents must request explicit authorization for external mutations rather than encode unattended bypasses. Read-only external access still requires the target and access authorized by the root guidance.
- Do not weaken sharing, tool, or permission restrictions without explicit approval, and never place tokens or resolved secret values in configuration or prompts.
- Validate configuration changes against the schema referenced by `opencode.jsonc`. OpenCode loads project configuration at startup, so use a restarted session for runtime validation.
- This repository has no local OpenCode plugin package. Reintroducing one requires an approved plugin source, package manifest, and Bun lockfile reviewed together.

# Hints

- Use the `customize-opencode` skill for configuration, agents, commands, skills, plugins, MCP servers, and permission rules.
- Use Bun for any approved package operations, following the repository-wide package-manager policy.
