# Gemma Serving Backend

- Status: historical decision evidence
- Live-state authority: none

## Context

A standalone vLLM experiment was configured for `unsloth/gemma-4-E2B-it-GGUF:Q6_K` with tokenizer `google/gemma-4-E2B-it`. Historical preview evidence established only that Pulumi could render the resources.

The later llama.cpp change records the operational failure: vLLM could not map the Gemma GGUF vision-tower parameters. That failure motivated a llama.cpp-native server path rather than an attempt to repair vLLM compatibility in the same change.

Historical provenance is retained in Git at conversion base `316959090d82d223693858ad8690f4d6f1561f4c` through the Gemma vLLM experiment and later llama.cpp serving change records.

## Decision Evidence

The historical decision used the standalone llama.cpp configuration and the Agent Gateway alias `gemma-4-e2b`. Generic tokenizer support remains part of the reusable vLLM configuration because it is independently useful and source-backed.

The tracked vLLM Gemma stack is experimental residue, not evidence of an active backend. Source currently contains both [`the vLLM experiment`](../../../programs/vllm/Pulumi.gemma-4-e2b.yaml) and [`the llama.cpp stack`](../../../programs/llama-cpp/Pulumi.gemma-4-e2b.yaml). Current [`Agent Gateway configuration`](../../../programs/agent-gateway/Pulumi.pantheon.yaml) does not advertise Gemma or target either Gemma Service.

## Consequences

- Do not advertise the vLLM Gemma stack as active or healthy without new live evidence.
- Preserve optional vLLM tokenizer plumbing independently of the failed experiment.
- Treat removal or revival of the vLLM Gemma stack as a separately approved source change.
- Treat the prior Agent Gateway Gemma route as historical evidence, not a current source or live-state claim.

See [runtime verification](../verification.md) for the unresolved live and cleanup questions.
