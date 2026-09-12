import assert = require("node:assert/strict");
import { afterEach, describe, it } from "node:test";
import {
  AgentGatewayConfigResourceSetOutputs,
  AgentGatewayConfigResourceSetProvider,
  canonicalJson,
} from "./config-resource-set";
import { AgentGatewayConfigResourceEnvelope } from "./client";

const originalFetch = globalThis.fetch;

function envelope(id: string, value: Record<string, unknown> = { name: id }): AgentGatewayConfigResourceEnvelope {
  return {
    kind: "traffic.route",
    id,
    value,
    revision: 3,
    createdAt: "2026-09-11T00:00:00Z",
    updatedAt: "2026-09-11T00:01:00Z",
  } as AgentGatewayConfigResourceEnvelope;
}

function state(...resources: AgentGatewayConfigResourceEnvelope[]): AgentGatewayConfigResourceSetOutputs {
  return { endpoint: "http://agent-gateway", kind: "traffic.route", resources };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AgentGatewayConfigResourceSetProvider", () => {
  it("preserves unrelated UI records when creating an explicit set", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "PUT") {
        return Response.json([envelope("pulumi-route", { name: "pulumi-route", backend: "$BACKEND_URL" })]);
      }
      return Response.json([envelope("ui-route")]);
    }) as typeof fetch;

    const result = await new AgentGatewayConfigResourceSetProvider().create({
      endpoint: "http://agent-gateway",
      kind: "traffic.route",
      resources: [{ id: "pulumi-route", value: { name: "pulumi-route", backend: "$BACKEND_URL" } }],
    });
    assert.deepEqual(methods, ["GET", "PUT"]);
    assert.deepEqual(result.outs?.resources.map(({ id }) => id), ["pulumi-route"]);
  });

  it("recovers an ambiguous create when all declared IDs already match", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return Response.json([
        envelope("route-a", { nested: { a: 1, b: 2 }, name: "route-a" }),
        envelope("route-b"),
        envelope("ui-route"),
      ]);
    }) as typeof fetch;

    const result = await new AgentGatewayConfigResourceSetProvider().create({
      endpoint: "http://agent-gateway",
      kind: "traffic.route",
      resources: [
        { id: "route-a", value: { name: "route-a", nested: { b: 2, a: 1 } } },
        { id: "route-b", value: { name: "route-b" } },
      ],
    });
    assert.deepEqual(methods, ["GET", "PUT"]);
    assert.deepEqual(result.outs?.resources.map(({ id }) => id), ["route-a", "route-b"]);
  });

  it("recovers a partial exact create by upserting the complete declared set", async () => {
    let putBody: unknown;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putBody = JSON.parse(String(init.body));
        return Response.json([envelope("route-a"), envelope("route-b")]);
      }
      return Response.json([envelope("route-a"), envelope("ui-route")]);
    }) as typeof fetch;

    await new AgentGatewayConfigResourceSetProvider().create({
      endpoint: "http://agent-gateway",
      kind: "traffic.route",
      resources: [
        { id: "route-a", value: { name: "route-a" } },
        { id: "route-b", value: { name: "route-b" } },
      ],
    });
    assert.deepEqual(putBody, {
      resources: [{ value: { name: "route-a" } }, { value: { name: "route-b" } }],
    });
  });

  it("rejects differing-value create conflicts without overwriting", async () => {
    let puts = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") puts += 1;
      return Response.json([envelope("pulumi-route", { name: "pulumi-route", weight: 1 })]);
    }) as typeof fetch;

    await assert.rejects(
      new AgentGatewayConfigResourceSetProvider().create({
        endpoint: "http://agent-gateway",
        kind: "traffic.route",
        resources: [{ id: "pulumi-route", value: { name: "pulumi-route", weight: 2 } }],
      }),
      /exist with differing values; import or choose different IDs: pulumi-route/,
    );
    assert.equal(puts, 0);
  });

  it("keeps partial remote deletion repairable and reports complete deletion", async () => {
    const provider = new AgentGatewayConfigResourceSetProvider();
    const props = state(envelope("route-a"), envelope("route-b"));
    globalThis.fetch = (async () => Response.json([envelope("ui-route"), envelope("route-a")])) as typeof fetch;
    const partial = await provider.read("traffic.route", props);
    assert.equal(partial.id, "traffic.route");
    assert.deepEqual(partial.props?.resources.map(({ id }) => id), ["route-a"]);
    assert.equal((await provider.diff("traffic.route", partial.props!, {
      endpoint: props.endpoint,
      kind: props.kind,
      resources: props.resources,
    })).changes, true);

    globalThis.fetch = (async () => Response.json([envelope("ui-route")])) as typeof fetch;
    const deleted = await provider.read("traffic.route", props);
    assert.equal(deleted.id, undefined);
    assert.equal(deleted.props, undefined);
  });

  it("upserts additions and changes before deleting removed owned IDs", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${String(url)}`);
      if (method === "GET") return Response.json([envelope("ui-route")]);
      if (method === "PUT") {
        assert.deepEqual(JSON.parse(String(init?.body)), {
          resources: [{ value: { name: "route-a", weight: 2 } }, { value: { name: "route-c" } }],
        });
        return Response.json([envelope("route-a", { name: "route-a", weight: 2 }), envelope("route-c")]);
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const result = await new AgentGatewayConfigResourceSetProvider().update(
      "traffic.route",
      state(envelope("route-a", { name: "route-a", weight: 1 }), envelope("route-b")),
      {
        endpoint: "http://agent-gateway",
        kind: "traffic.route",
        resources: [
          { id: "route-a", value: { name: "route-a", weight: 2 } },
          { id: "route-c", value: { name: "route-c" } },
        ],
      },
    );
    assert.equal(calls[0], "GET http://agent-gateway/api/config/resources/traffic.route");
    assert.equal(calls[1], "PUT http://agent-gateway/api/config/resources/traffic.route");
    assert.equal(calls[2], "DELETE http://agent-gateway/api/config/resources/traffic.route/route-b");
    assert.deepEqual(result.outs?.resources.map(({ id }) => id), ["route-a", "route-c"]);
  });

  it("rejects a conflicting newly acquired ID before upsert or deletion", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return Response.json([envelope("route-c", { name: "route-c", weight: 1 }), envelope("ui-route")]);
    }) as typeof fetch;

    await assert.rejects(new AgentGatewayConfigResourceSetProvider().update(
      "traffic.route",
      state(envelope("route-a"), envelope("route-b")),
      {
        endpoint: "http://agent-gateway",
        kind: "traffic.route",
        resources: [
          { id: "route-a", value: { name: "route-a", weight: 2 } },
          { id: "route-c", value: { name: "route-c", weight: 2 } },
        ],
      },
    ), /exist with differing values; import or choose different IDs: route-c/);
    assert.deepEqual(methods, ["GET"]);
  });

  it("safely adopts an exact newly acquired ID before reconciling the set", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      methods.push(method);
      if (method === "GET") {
        return Response.json([envelope("route-c", { nested: { a: 1, b: 2 }, name: "route-c" }), envelope("ui-route")]);
      }
      return Response.json([
        envelope("route-a", { name: "route-a", weight: 2 }),
        envelope("route-c", { name: "route-c", nested: { b: 2, a: 1 } }),
      ]);
    }) as typeof fetch;

    await new AgentGatewayConfigResourceSetProvider().update(
      "traffic.route",
      state(envelope("route-a")),
      {
        endpoint: "http://agent-gateway",
        kind: "traffic.route",
        resources: [
          { id: "route-a", value: { name: "route-a", weight: 2 } },
          { id: "route-c", value: { name: "route-c", nested: { b: 2, a: 1 } } },
        ],
      },
    );
    assert.deepEqual(methods, ["GET", "PUT"]);
  });

  it("does not delete removed IDs when the upsert acknowledgement has a mismatched value", async () => {
    const methods: string[] = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      methods.push(method);
      if (method === "GET") return Response.json([]);
      return Response.json([envelope("route-a", { name: "route-a", weight: 3 })]);
    }) as typeof fetch;

    await assert.rejects(new AgentGatewayConfigResourceSetProvider().update(
      "traffic.route",
      state(envelope("route-a"), envelope("route-b")),
      {
        endpoint: "http://agent-gateway",
        kind: "traffic.route",
        resources: [{ id: "route-a", value: { name: "route-a", weight: 2 } }],
      },
    ), /returned unexpected values for IDs: route-a/);
    assert.deepEqual(methods, ["PUT"]);
  });

  it("deletes only owned IDs and accepts 404 for each", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(null, { status: 404 });
    }) as typeof fetch;
    await new AgentGatewayConfigResourceSetProvider().delete(
      "traffic.route",
      state(envelope("route-a"), envelope("route-b")),
    );
    assert.deepEqual(urls, [
      "http://agent-gateway/api/config/resources/traffic.route/route-a",
      "http://agent-gateway/api/config/resources/traffic.route/route-b",
    ]);
  });

  it("marks endpoint and kind replacement intentionally destructive and separately previewable", async () => {
    const provider = new AgentGatewayConfigResourceSetProvider();
    const old = state(envelope("route-a", { name: "route-a", nested: { b: 2, a: 1 } }));
    assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
    assert.equal((await provider.diff("traffic.route", old, {
      endpoint: old.endpoint,
      kind: old.kind,
      resources: [{ id: "route-a", value: { nested: { a: 1, b: 2 }, name: "route-a" } }],
    })).changes, false);
    const changed = await provider.diff("traffic.route", old, {
      endpoint: "http://replacement",
      kind: "traffic.policy",
      resources: [{ id: "route-a", value: { name: "route-a" } }],
    });
    assert.equal(changed.changes, true);
    assert.deepEqual(changed.replaces, ["endpoint", "kind"]);
    assert.equal(changed.deleteBeforeReplace, true);
  });
});
