## Change Overview

Why: `rfhold/kokoro` and `rfhold/whisperx` need Tekton Pipelines as Code repository resources so their repository workflows can be discovered and run.

Impact: The Tekton stack configuration will include both repositories in the PAC repository list.

Non-goals: This change does not alter Forgejo webhook cleanup, org-level webhook behavior, or PAC global provider configuration.

Rollback: Remove `rfhold/kokoro` and `rfhold/whisperx` from the Tekton PAC repository list.

## ADDED Requirements

### Requirement: Kokoro And Whisperx PAC Repository Enrollment

The system MUST configure Tekton Pipelines as Code to manage repository resources for `rfhold/kokoro` and `rfhold/whisperx`.

#### Scenario: Kokoro repository is configured

Given the Tekton stack configuration is rendered
When the PAC repository list is evaluated
Then the system MUST include `rfhold/kokoro`

#### Scenario: Whisperx repository is configured

Given the Tekton stack configuration is rendered
When the PAC repository list is evaluated
Then the system MUST include `rfhold/whisperx`
