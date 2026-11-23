import { expect, test } from "bun:test";
import { firefoxInstaller } from "./firefox-install-server";

const origin = "https://git.example.test";
const backend = "http://forgejo.forgejo:3000";
const slug = "browser-use";
const path = `/install/firefox/${slug}.xpi`;
const feedPath = `/rfhold/${slug}/raw/branch/main/packaging/firefox/updates.json`;
const body = new Uint8Array([80, 75, 3, 4]);
const digest = new Bun.CryptoHasher("sha256").update(body).digest("hex");

function update(version: string) {
  return {
    version,
    update_link: `${origin}/api/packages/rfhold/generic/${slug}-firefox/${version}/${slug}-firefox-${version}.xpi`,
    update_hash: `sha256:${digest}`,
  };
}

function fixture(updates: unknown[], artifact = () => new Response(body)) {
  const calls: string[] = [];
  const fetcher = async (upstream: URL, init: RequestInit): Promise<Response> => {
    expect(init.redirect).toBe("manual");
    expect(init.headers).toBeUndefined();
    expect(upstream.origin).toBe(backend);
    calls.push(upstream.pathname);
    return upstream.pathname === feedPath
      ? Response.json({ addons: { "test@example.test": { updates } } })
      : artifact();
  };
  return { calls, fetch: firefoxInstaller(origin, backend, fetcher) };
}

test("serves the latest promoted package with install headers and no credential forwarding", async () => {
  const latest = update("1.10.0");
  const f = fixture([update("1.9.9"), latest, update("0.20.0"), update("2.0.0-beta.1")]);
  const response = await f.fetch(new Request(`${origin}${path}`, {
    headers: { Cookie: "session=fixture", Authorization: "Bearer fixture" },
  }));
  expect(f.calls).toEqual([feedPath, new URL(latest.update_link).pathname]);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/x-xpinstall");
  expect(response.headers.get("content-disposition")).toBe('inline; filename="browser-use-firefox-1.10.0.xpi"');
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
});

test("HEAD verifies the same artifact and returns no body", async () => {
  const f = fixture([update("0.1.0")]);
  const response = await f.fetch(new Request(`${origin}${path}`, { method: "HEAD" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-length")).toBe(String(body.length));
  expect(await response.text()).toBe("");
});

test("empty feeds return 404 and invalid paths or methods never reach Forgejo", async () => {
  const f = fixture([]);
  expect((await f.fetch(new Request(`${origin}/install/firefox/%2fsecret.xpi`))).status).toBe(404);
  expect((await f.fetch(new Request(`${origin}${path}`, { method: "PUT" }))).status).toBe(405);
  expect(f.calls).toEqual([]);
  expect((await f.fetch(new Request(`${origin}${path}`))).status).toBe(404);
  expect(f.calls).toEqual([feedPath]);
});

test("missing feeds return 404 without an artifact lookup", async () => {
  const missing = firefoxInstaller(origin, backend, async url => {
    expect(url.pathname).toBe(feedPath);
    return new Response(null, { status: 404 });
  });
  expect((await missing(new Request(`${origin}${path}`))).status).toBe(404);
});

test("supports repository slugs with dots and underscores", async () => {
  const alternate = firefoxInstaller(origin, backend, async url => {
    expect(url.pathname).toBe("/rfhold/my_addon.example/raw/branch/main/packaging/firefox/updates.json");
    return new Response(null, { status: 404 });
  });
  expect((await alternate(new Request(`${origin}/install/firefox/my_addon.example.xpi`))).status).toBe(404);
});

test("rejects feeds that point off-contract or omit the digest", async () => {
  for (const value of [
    { ...update("0.1.0"), update_link: "https://elsewhere.example.test/addon.xpi" },
    { ...update("0.1.0"), update_hash: undefined },
  ]) {
    const f = fixture([value]);
    expect((await f.fetch(new Request(`${origin}${path}`))).status).toBe(502);
    expect(f.calls).toEqual([feedPath]);
  }
});

test("rejects altered, oversized, or redirected artifacts", async () => {
  for (const artifact of [
    () => new Response("not the approved file"),
    () => new Response(new Uint8Array(16 * 1024 * 1024 + 1)),
    () => Response.redirect("https://elsewhere.example.test/addon.xpi"),
  ]) {
    const f = fixture([update("0.1.0")], artifact);
    const response = await f.fetch(new Request(`${origin}${path}`));
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).not.toBe("application/x-xpinstall");
  }
});
