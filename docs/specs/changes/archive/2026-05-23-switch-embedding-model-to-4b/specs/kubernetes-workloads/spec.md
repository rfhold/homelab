## Change Overview

### Why

The homelab served embedding model is `Qwen/Qwen3-Embedding-4B`, but source-controlled references across sibling repositories may still name the retired 8B model.

### Impact

All source-controlled embedding model references and filenames under sibling repositories are aligned to `Qwen/Qwen3-Embedding-4B`, including active configuration, documentation, tests, benchmark files, and archived history.

### Non-goals

- Changing unrelated embedding terminology that does not identify the retired 8B model.
- Changing non-embedding model routing.
- Preserving the retired 8B model as an advertised served embedding model.

### Rollback

Rollback is performed by reverting the affected repository changes and restoring retired 8B references only if the 8B embedding model is served again.

## ADDED Requirements

### Requirement: Source-Controlled Embedding Model Reference Alignment
The system MUST align source-controlled embedding model references and filenames to the served `Qwen/Qwen3-Embedding-4B` model.

#### Scenario: retired embedding model references are replaced
Given sibling repositories contain source-controlled references to the retired 8B model
When the embedding model reference alignment is performed
Then the system MUST replace those references with `Qwen/Qwen3-Embedding-4B`
And the system MUST NOT leave the retired 8B model advertised as a served embedding model

#### Scenario: embedding benchmark filenames are aligned
Given sibling repositories contain source-controlled filenames that include the retired embedding model identifier
When the embedding model reference alignment is performed
Then the system MUST rename those files to use the `4B` embedding model identifier
And the renamed files MUST continue to describe the same benchmark or documentation purpose

#### Scenario: archived references are included
Given archived specs, archived tasks, documentation, examples, tests, prompts, configuration, or benchmark files contain retired 8B references
When the embedding model reference alignment is performed
Then the system MUST update those source-controlled references to `Qwen/Qwen3-Embedding-4B`
