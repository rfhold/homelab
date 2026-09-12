import * as pulumi from "@pulumi/pulumi";
import {
  AgentGatewayClient,
  AgentGatewayConfigResourceEnvelope,
  AgentGatewayConfigResourceRecord,
  canonicalJson,
  JsonValue,
} from "./client";

export { canonicalJson } from "./client";

export interface AgentGatewayConfigResourceInput {
  id: pulumi.Input<string>;
  value: pulumi.Input<JsonValue>;
}

export interface AgentGatewayConfigResourceSetArgs {
  endpoint: pulumi.Input<string>;
  kind: pulumi.Input<string>;
  resources: pulumi.Input<AgentGatewayConfigResourceInput[]>;
}

export interface AgentGatewayConfigResourceSetInputs {
  endpoint: string;
  kind: string;
  resources: AgentGatewayConfigResourceRecord[];
}

export interface AgentGatewayConfigResourceSetOutputs {
  endpoint: string;
  kind: string;
  resources: AgentGatewayConfigResourceEnvelope[];
}

function normalizedResources(resources: AgentGatewayConfigResourceRecord[]): string {
  return resources
    .map(({ id, value }) => ({ id, value: canonicalJson(value) }))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, value }) => `${JSON.stringify(id)}:${value}`)
    .join("|");
}

function validateResources(resources: AgentGatewayConfigResourceRecord[]): void {
  const ids = new Set<string>();
  for (const resource of resources) {
    if (!resource.id) throw new Error("Agent Gateway config resource IDs must not be empty");
    if (ids.has(resource.id)) throw new Error(`Duplicate Agent Gateway config resource ID: ${resource.id}`);
    ids.add(resource.id);
  }
}

function observedFor(
  desired: AgentGatewayConfigResourceRecord[],
  observed: AgentGatewayConfigResourceEnvelope[],
): AgentGatewayConfigResourceEnvelope[] {
  const desiredIds = new Set(desired.map(({ id }) => id));
  return observed.filter(({ id }) => desiredIds.has(id)).sort((left, right) => left.id.localeCompare(right.id));
}

export class AgentGatewayConfigResourceSetProvider implements pulumi.dynamic.ResourceProvider {
  public async create(
    inputs: AgentGatewayConfigResourceSetInputs,
  ): Promise<pulumi.dynamic.CreateResult<AgentGatewayConfigResourceSetOutputs>> {
    validateResources(inputs.resources);
    const client = new AgentGatewayClient(inputs.endpoint);
    const existingById = new Map((await client.list(inputs.kind)).map((resource) => [resource.id, resource]));
    const conflicts = inputs.resources.filter((desired) => {
      const existing = existingById.get(desired.id);
      return existing !== undefined && canonicalJson(existing.value) !== canonicalJson(desired.value);
    }).map(({ id }) => id);
    if (conflicts.length > 0) {
      throw new Error(`Agent Gateway config resource IDs exist with differing values; import or choose different IDs: ${conflicts.join(", ")}`);
    }
    const resources = await client.upsert(inputs.kind, inputs.resources);
    return {
      id: inputs.kind,
      outs: { endpoint: inputs.endpoint, kind: inputs.kind, resources: observedFor(inputs.resources, resources) },
    };
  }

  public async read(
    id: string,
    props: AgentGatewayConfigResourceSetOutputs,
  ): Promise<pulumi.dynamic.ReadResult<AgentGatewayConfigResourceSetOutputs>> {
    const resources = observedFor(props.resources, await new AgentGatewayClient(props.endpoint).list(props.kind));
    if (resources.length === 0) return { id: undefined, props: undefined };
    return { id, props: { endpoint: props.endpoint, kind: props.kind, resources } };
  }

  public async diff(
    _id: string,
    olds: AgentGatewayConfigResourceSetOutputs,
    news: AgentGatewayConfigResourceSetInputs,
  ): Promise<pulumi.dynamic.DiffResult> {
    validateResources(news.resources);
    const replaces = [
      ...(olds.endpoint !== news.endpoint ? ["endpoint"] : []),
      ...(olds.kind !== news.kind ? ["kind"] : []),
    ];
    return {
      changes: replaces.length > 0 || normalizedResources(olds.resources) !== normalizedResources(news.resources),
      replaces,
      deleteBeforeReplace: replaces.length > 0,
    };
  }

  public async update(
    _id: string,
    olds: AgentGatewayConfigResourceSetOutputs,
    news: AgentGatewayConfigResourceSetInputs,
  ): Promise<pulumi.dynamic.UpdateResult<AgentGatewayConfigResourceSetOutputs>> {
    validateResources(news.resources);
    const client = new AgentGatewayClient(news.endpoint);
    const ownedIds = new Set(olds.resources.map(({ id }) => id));
    const entering = news.resources.filter(({ id }) => !ownedIds.has(id));
    if (entering.length > 0) {
      const existingById = new Map((await client.list(news.kind)).map((resource) => [resource.id, resource]));
      const conflicts = entering.filter((desired) => {
        const existing = existingById.get(desired.id);
        return existing !== undefined && canonicalJson(existing.value) !== canonicalJson(desired.value);
      }).map(({ id }) => id);
      if (conflicts.length > 0) {
        throw new Error(`Agent Gateway config resource IDs exist with differing values; import or choose different IDs: ${conflicts.join(", ")}`);
      }
    }
    const resources = await client.upsert(news.kind, news.resources);
    const desiredIds = new Set(news.resources.map(({ id }) => id));
    for (const { id } of olds.resources) {
      if (!desiredIds.has(id)) await client.delete(olds.kind, id);
    }
    return { outs: { endpoint: news.endpoint, kind: news.kind, resources: observedFor(news.resources, resources) } };
  }

  public async delete(_id: string, props: AgentGatewayConfigResourceSetOutputs): Promise<void> {
    const client = new AgentGatewayClient(props.endpoint);
    for (const { id } of props.resources) await client.delete(props.kind, id);
  }
}

export class AgentGatewayConfigResourceSet extends pulumi.dynamic.Resource {
  public readonly endpoint!: pulumi.Output<string>;
  public readonly kind!: pulumi.Output<string>;
  public readonly resources!: pulumi.Output<AgentGatewayConfigResourceEnvelope[]>;

  constructor(
    name: string,
    args: AgentGatewayConfigResourceSetArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(new AgentGatewayConfigResourceSetProvider(), name, args, opts, "agent-gateway", "ConfigResourceSet");
  }
}
