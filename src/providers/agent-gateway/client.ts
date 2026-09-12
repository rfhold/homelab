export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface AgentGatewayConfigResourceRecord {
  id: string;
  value: JsonValue;
}

export interface AgentGatewayConfigResourceEnvelope extends AgentGatewayConfigResourceRecord {
  kind: string;
  revision: string | number;
  createdAt: string;
  updatedAt: string;
}

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export interface AgentGatewayClientOptions {
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  retryDelaysMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

export class AgentGatewayApiError extends Error {
  public readonly status: number;

  constructor(operation: string, status: number) {
    super(`Agent Gateway config API ${operation} failed with HTTP ${status}`);
    this.name = "AgentGatewayApiError";
    this.status = status;
  }
}

class AgentGatewayResponseError extends Error {}

const DEFAULT_RETRY_DELAYS_MS = [100, 500] as const;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export class AgentGatewayClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(baseUrl: string, options: AgentGatewayClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  public async list(kind: string): Promise<AgentGatewayConfigResourceEnvelope[]> {
    return this.request(
      "list resources",
      this.collectionPath(kind),
      { method: "GET" },
      (response) => this.parseEnvelopes(response, "list resources", kind),
    );
  }

  public async upsert(
    kind: string,
    resources: AgentGatewayConfigResourceRecord[],
  ): Promise<AgentGatewayConfigResourceEnvelope[]> {
    const envelopes = await this.request(
      "upsert resources",
      this.collectionPath(kind),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resources: resources.map(({ value }) => ({ value })) }),
      },
      (response) => this.parseEnvelopes(response, "upsert resources", kind),
    );
    const desiredById = new Map(resources.map((resource) => [resource.id, resource]));
    const returnedIds = new Set(envelopes.map(({ id }) => id));
    const missingIds = resources.map(({ id }) => id).filter((id) => !returnedIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Agent Gateway config API upsert response omitted expected IDs: ${missingIds.join(", ")}`);
    }
    const mismatchedIds = [...new Set(envelopes.filter((returned) => {
      const desired = desiredById.get(returned.id);
      return desired !== undefined && canonicalJson(returned.value) !== canonicalJson(desired.value);
    }).map(({ id }) => id))];
    if (mismatchedIds.length > 0) {
      throw new Error(`Agent Gateway config API upsert response returned unexpected values for IDs: ${mismatchedIds.join(", ")}`);
    }
    return envelopes;
  }

  public async delete(kind: string, id: string): Promise<void> {
    await this.request<void>(
      "delete resource",
      `${this.collectionPath(kind)}/${this.encodePathSegment(id)}`,
      { method: "DELETE" },
      async () => undefined,
      new Set([404]),
    );
  }

  private collectionPath(kind: string): string {
    return `/api/config/resources/${this.encodePathSegment(kind)}`;
  }

  private encodePathSegment(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }

  private async request<T>(
    operation: string,
    path: string,
    init: RequestInit,
    consume: (response: Response) => Promise<T>,
    acceptedStatuses: ReadonlySet<number> = new Set(),
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
        if (response.ok || acceptedStatuses.has(response.status)) return await consume(response);
        if (!RETRYABLE_STATUSES.has(response.status) || attempt >= this.retryDelaysMs.length) {
          throw new AgentGatewayApiError(operation, response.status);
        }
      } catch (error) {
        if (error instanceof AgentGatewayApiError
          || error instanceof AgentGatewayResponseError
          || attempt >= this.retryDelaysMs.length) {
          if (error instanceof AgentGatewayApiError || error instanceof AgentGatewayResponseError) throw error;
          throw new Error(`Agent Gateway config API ${operation} failed after ${attempt + 1} attempts`);
        }
      } finally {
        clearTimeout(timeout);
      }
      await this.sleep(this.retryDelaysMs[attempt]);
    }
  }

  private async parseEnvelopes(
    response: Response,
    operation: string,
    kind: string,
  ): Promise<AgentGatewayConfigResourceEnvelope[]> {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new AgentGatewayResponseError(`Agent Gateway config API ${operation} returned invalid JSON`);
    }
    const resources = Array.isArray(body)
      ? body
      : this.isObject(body) && Array.isArray(body.resources) ? body.resources : undefined;
    if (!resources || !resources.every((resource) => this.isEnvelope(resource))) {
      throw new AgentGatewayResponseError(`Agent Gateway config API ${operation} returned an invalid resource envelope`);
    }
    if (resources.some((resource) => resource.kind !== kind)) {
      throw new AgentGatewayResponseError(`Agent Gateway config API ${operation} returned a resource envelope for an unexpected kind`);
    }
    return resources;
  }

  private isEnvelope(value: unknown): value is AgentGatewayConfigResourceEnvelope {
    return this.isObject(value)
      && typeof value.kind === "string"
      && typeof value.id === "string"
      && "value" in value
      && (typeof value.revision === "string" || typeof value.revision === "number")
      && typeof value.createdAt === "string"
      && typeof value.updatedAt === "string";
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
