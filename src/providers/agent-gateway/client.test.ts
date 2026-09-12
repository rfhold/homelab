import assert = require("node:assert/strict");
import { describe, it } from "node:test";
import { AgentGatewayApiError, AgentGatewayClient } from "./client";

function envelope(
  id: string,
  value: Record<string, unknown> = { name: id },
  kind = "traffic.route",
): Record<string, unknown> {
  return {
    kind,
    id,
    value,
    revision: 3,
    createdAt: "2026-09-11T00:00:00Z",
    updatedAt: "2026-09-11T00:01:00Z",
  };
}

describe("AgentGatewayClient", () => {
  it("uses collection upserts and verifies every explicit desired ID", async () => {
    let requestBody = "";
    const client = new AgentGatewayClient("http://agent-gateway/", {
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(String(url), "http://agent-gateway/api/config/resources/traffic.route");
        assert.equal(init?.method, "PUT");
        requestBody = String(init?.body);
        return Response.json({ resources: [envelope("route-a")] });
      }) as typeof fetch,
    });

    const result = await client.upsert("traffic.route", [{ id: "route-a", value: { name: "route-a" } }]);
    assert.equal(result[0].id, "route-a");
    assert.deepEqual(JSON.parse(requestBody), { resources: [{ value: { name: "route-a" } }] });

    const incomplete = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async () => Response.json([])) as typeof fetch,
    });
    await assert.rejects(
      incomplete.upsert("traffic.route", [{ id: "route-a", value: { name: "route-a" } }]),
      /omitted expected IDs: route-a/,
    );

    const mismatched = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async () => Response.json([envelope("route-a", { name: "route-a", weight: 2 })])) as typeof fetch,
    });
    await assert.rejects(
      mismatched.upsert("traffic.route", [{ id: "route-a", value: { name: "route-a", weight: 1 } }]),
      /returned unexpected values for IDs: route-a/,
    );
  });

  it("bounds retries for network failures and 502, 503, and 504", async () => {
    const statuses: Array<number | "network"> = ["network", 502, 503, 504, 200];
    const delays: number[] = [];
    let attempts = 0;
    const client = new AgentGatewayClient("http://agent-gateway", {
      retryDelaysMs: [1, 2, 3, 4],
      sleep: async (milliseconds) => { delays.push(milliseconds); },
      fetch: (async () => {
        const result = statuses[attempts++];
        if (result === "network") throw new TypeError("synthetic network failure");
        return result === 200 ? Response.json([envelope("route-a")]) : new Response(null, { status: result });
      }) as typeof fetch,
    });

    assert.equal((await client.list("traffic.route"))[0].id, "route-a");
    assert.equal(attempts, 5);
    assert.deepEqual(delays, [1, 2, 3, 4]);

    let boundedAttempts = 0;
    const bounded = new AgentGatewayClient("http://agent-gateway", {
      retryDelaysMs: [0, 0],
      sleep: async () => undefined,
      fetch: (async () => {
        boundedAttempts += 1;
        throw new TypeError("literal-sensitive-value");
      }) as typeof fetch,
    });
    await assert.rejects(bounded.list("traffic.route"), /failed after 3 attempts/);
    assert.equal(boundedAttempts, 3);
  });

  it("aborts each hanging request and retries within the configured bound", async () => {
    let attempts = 0;
    let aborts = 0;
    const client = new AgentGatewayClient("http://agent-gateway", {
      requestTimeoutMs: 5,
      retryDelaysMs: [0, 0],
      sleep: async () => undefined,
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        attempts += 1;
        return new Promise<Response>((_resolve, reject) => {
          assert.ok(init?.signal);
          init.signal.addEventListener("abort", () => {
            aborts += 1;
            reject(new DOMException("literal-sensitive-value", "AbortError"));
          }, { once: true });
        });
      }) as typeof fetch,
    });

    await assert.rejects(client.list("traffic.route"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /failed after 3 attempts/);
      assert.ok(!error.message.includes("literal-sensitive-value"));
      return true;
    });
    assert.equal(attempts, 3);
    assert.equal(aborts, 3);
  });

  it("keeps the timeout active while consuming a stalled response body", async () => {
    let attempts = 0;
    let aborts = 0;
    const client = new AgentGatewayClient("http://agent-gateway", {
      requestTimeoutMs: 5,
      retryDelaysMs: [0, 0],
      sleep: async () => undefined,
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        attempts += 1;
        return {
          ok: true,
          status: 200,
          json: () => new Promise((_resolve, reject) => {
            assert.ok(init?.signal);
            init.signal.addEventListener("abort", () => {
              aborts += 1;
              reject(new DOMException("literal-sensitive-value", "AbortError"));
            }, { once: true });
          }),
        } as Response;
      }) as typeof fetch,
    });

    await assert.rejects(client.list("traffic.route"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /failed after 3 attempts/);
      assert.ok(!error.message.includes("literal-sensitive-value"));
      return true;
    });
    assert.equal(attempts, 3);
    assert.equal(aborts, 3);
  });

  it("does not retry terminal statuses or expose response bodies", async () => {
    for (const status of [400, 403, 404, 409, 422]) {
      let attempts = 0;
      const client = new AgentGatewayClient("http://agent-gateway", {
        retryDelaysMs: [0, 0],
        sleep: async () => undefined,
        fetch: (async () => {
          attempts += 1;
          return new Response("literal-sensitive-value", { status });
        }) as typeof fetch,
      });
      await assert.rejects(client.list("traffic.route"), (error: unknown) => {
        assert.ok(error instanceof AgentGatewayApiError);
        assert.equal(error.status, status);
        assert.ok(!error.message.includes("literal-sensitive-value"));
        return true;
      });
      assert.equal(attempts, 1);
    }
  });

  it("rejects a wrong-kind list envelope without exposing its value", async () => {
    const client = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async () => Response.json([
        envelope("provider-a", { name: "provider-a", credential: "literal-sensitive-value" }, "llm.model"),
      ])) as typeof fetch,
    });
    await assert.rejects(client.list("llm.provider"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /unexpected kind/);
      assert.ok(!error.message.includes("literal-sensitive-value"));
      return true;
    });
  });

  it("rejects a wrong-kind upsert acknowledgement without exposing its value", async () => {
    const client = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async () => Response.json([
        envelope("model-a", { name: "model-a", credential: "literal-sensitive-value" }, "llm.provider"),
      ])) as typeof fetch,
    });
    await assert.rejects(
      client.upsert("llm.model", [{ id: "model-a", value: { name: "model-a", credential: "$MODEL_TOKEN" } }]),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /unexpected kind/);
        assert.ok(!error.message.includes("literal-sensitive-value"));
        assert.ok(!error.message.includes("$MODEL_TOKEN"));
        return true;
      },
    );
  });

  it("treats a repeated 404 delete as success", async () => {
    let attempts = 0;
    const client = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async () => {
        attempts += 1;
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });
    await client.delete("traffic.route", "route-a");
    assert.equal(attempts, 1);
  });

  it("strictly URL-encodes an llm.model ID containing slash and star", async () => {
    let requestedUrl = "";
    const client = new AgentGatewayClient("http://agent-gateway", {
      fetch: (async (url: string | URL | Request) => {
        requestedUrl = String(url);
        return new Response(null, { status: 204 });
      }) as typeof fetch,
    });
    await client.delete("llm.model", "vendor/model*");
    assert.equal(
      requestedUrl,
      "http://agent-gateway/api/config/resources/llm.model/vendor%2Fmodel%2A",
    );
  });
});
