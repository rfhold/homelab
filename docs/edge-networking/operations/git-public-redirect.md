# Public Git Redirect

Public HTTPS requests to `git.holdenitdown.net` redirect to GitHub mirrors. Internal DNS directs local clients to Forgejo.

Cloudflare owns the public redirect outside this repository. This runbook does not configure repository mirrors.

## Configuration

Cloudflare DNS and redirect changes require explicit authorization. Preserve the internal DNS override before any public change.

1. Create a proxied public A record for `git.holdenitdown.net` with placeholder address `192.0.2.1`.
2. In Cloudflare, open **Rules → Redirect Rules → Single Redirects**.
3. Match hostname `git.holdenitdown.net`.
4. Set the dynamic destination expression:

   ```text
   concat("https://github.com", http.request.uri.path)
   ```

5. Select status **302**.
6. Enable **Preserve query string**.

Keep 302 so clients do not cache a permanent redirect. A CNAME alone cannot provide GitHub service under this hostname.

## Constraints

- GitHub mirrors must use the same owner and repository names.
- Private mirrors require separate GitHub authorization.
- HTTPS Git clients generally follow the redirect; SSH remotes do not.
- Forgejo-specific paths and APIs do not translate to GitHub equivalents.
- The redirect affects every public request for this hostname, not just Git requests.
- External clients receive mirror contents, which can lag Forgejo.

## Verification

Check the Git endpoint through internal DNS:

```bash
curl --silent --show-error --max-time 20 --output /dev/null --dump-header - \
  'https://git.holdenitdown.net/rfhold/screenroom.git/info/refs?service=git-upload-pack'
```

Expect HTTP 200 from Forgejo without a redirect.

Find a public Cloudflare address:

```bash
dig @1.1.1.1 git.holdenitdown.net A +short
```

Substitute that address for `PUBLIC_IP` to bypass internal DNS:

```bash
curl --silent --show-error --max-time 20 \
  --resolve 'git.holdenitdown.net:443:PUBLIC_IP' \
  --output /dev/null --dump-header - \
  'https://git.holdenitdown.net/rfhold/screenroom.git/info/refs?service=git-upload-pack'
```

Expect HTTP 302 with this destination:

```text
https://github.com/rfhold/screenroom.git/info/refs?service=git-upload-pack
```

Repeat with `--location` to confirm that GitHub returns HTTP 200. These checks do not prove a complete clone or mirror freshness.

## Recovery

If internal requests redirect, restore the internal DNS override. If public destinations fail, check mirror visibility and repository names.

Disable the Cloudflare redirect only with explicit authorization. The placeholder DNS address cannot serve Forgejo after the redirect stops.
