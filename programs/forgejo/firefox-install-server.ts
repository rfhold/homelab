const route = /^\/install\/firefox\/([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)\.xpi$/;
const stableVersion = /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/;
const prereleaseVersion = /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/;
const maxFeedBytes = 64 * 1024;
const maxXpiBytes = 16 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readBytes(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing upstream body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Upstream body exceeds limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function release(feed: unknown): Record<string, unknown> | undefined {
  if (!record(feed) || !record(feed.addons)) throw new Error("Invalid Firefox feed");
  const addons = Object.values(feed.addons);
  if (addons.length !== 1 || !record(addons[0]) || !Array.isArray(addons[0].updates)) {
    throw new Error("Expected one Firefox add-on per repository");
  }
  const versions = new Set<string>();
  let newest: Record<string, unknown> | undefined;
  let best = -1n;
  for (const update of addons[0].updates) {
    if (!record(update) || typeof update.version !== "string") {
      throw new Error("Invalid Firefox release version");
    }
    if (prereleaseVersion.test(update.version)) continue;
    if (!stableVersion.test(update.version) || versions.has(update.version)) {
      throw new Error("Invalid or duplicate Firefox release version");
    }
    versions.add(update.version);
    const score = update.version.split(".").reduce((value, part) => value * 1000000000n + BigInt(part), 0n);
    if (score > best) {
      best = score;
      newest = update;
    }
  }
  return newest;
}

type UpstreamFetch = (url: URL, init: RequestInit) => Promise<Response>;

export function firefoxInstaller(
  publicOrigin: string,
  backendOrigin: string,
  requestUpstream: UpstreamFetch = fetch,
): (request: Request) => Promise<Response> {
  let active = 0;
  const miss = () => new Response("No Firefox extension release found\n", { status: 404, headers: { "Cache-Control": "no-store" } });
  return async (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/healthz") return new Response("ok\n");
    const slug = route.exec(pathname)?.[1];
    if (!slug || slug.length > 63) return miss();
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    if (active >= 4) return new Response(null, { status: 503, headers: { "Retry-After": "1" } });
    active++;
    const signal = AbortSignal.timeout(10000);
    const upstream = (path: string) => requestUpstream(new URL(path, backendOrigin), { redirect: "manual", signal });
    try {
      const feed = await upstream(`/rfhold/${slug}/raw/branch/main/packaging/firefox/updates.json`);
      if (feed.status === 404) {
        await feed.body?.cancel();
        return miss();
      }
      if (feed.status !== 200) {
        await feed.body?.cancel();
        throw new Error("Could not read Firefox feed");
      }
      const update = release(JSON.parse(new TextDecoder().decode(await readBytes(feed, maxFeedBytes))));
      if (!update) return miss();
      const version = update.version;
      const filename = `${slug}-firefox-${version}.xpi`;
      const artifactPath = `/api/packages/rfhold/generic/${slug}-firefox/${version}/${filename}`;
      const expectedHash = typeof update.update_hash === "string"
        ? /^sha256:([a-f0-9]{64})$/i.exec(update.update_hash)?.[1].toLowerCase()
        : undefined;
      if (update.update_link !== new URL(artifactPath, publicOrigin).href || !expectedHash) {
        throw new Error("Firefox artifact is outside the repository package contract");
      }
      const artifact = await upstream(artifactPath);
      if (artifact.status !== 200) {
        await artifact.body?.cancel();
        throw new Error("Could not read Firefox artifact");
      }
      const bytes = await readBytes(artifact, maxXpiBytes);
      const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      if (!bytes.length || digest !== expectedHash) throw new Error("Firefox artifact checksum mismatch");
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: {
          "Content-Type": "application/x-xpinstall",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("Firefox release unavailable\n", { status: 502, headers: { "Cache-Control": "no-store" } });
    } finally {
      active--;
    }
  };
}

if (import.meta.main) {
  const { FORGEJO_PUBLIC_ORIGIN, FORGEJO_BACKEND_ORIGIN } = process.env;
  if (!FORGEJO_PUBLIC_ORIGIN || !FORGEJO_BACKEND_ORIGIN) throw new Error("Forgejo origins are required");
  Bun.serve({
    hostname: "0.0.0.0",
    port: 8080,
    fetch: firefoxInstaller(new URL(FORGEJO_PUBLIC_ORIGIN).origin, new URL(FORGEJO_BACKEND_ORIGIN).origin),
  });
}
