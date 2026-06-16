# Contracts: add-gpt-oss-llama-cpp-strix-halo

## Contract Surfaces

### `src/components/llama-cpp.ts`

Add an optional `hostDevices` field to `LlamaCppArgs`:

```ts
hostDevices?: Array<{
  hostPath: pulumi.Input<string>;
  mountPath: pulumi.Input<string>;
  readOnly?: pulumi.Input<boolean>;
}>;
```

The field allows callers to declare host device paths that the llama.cpp Deployment will mount into the container.

### `programs/llama-cpp/index.ts`

Add an optional `hostDevices` field to `LlamaCppStackConfig`:

```ts
hostDevices?: Array<{
  hostPath: string;
  mountPath: string;
  readOnly?: boolean;
}>;
```

Pass `llamaCppConfig.hostDevices` through to the `LlamaCpp` component as `hostDevices`.

## Compatibility

- The new fields are optional.
- Existing llama.cpp stacks that omit `hostDevices` MUST render without AMD device mounts.
- Existing CUDA/NVIDIA runtime configuration remains stack-controlled through existing fields.
