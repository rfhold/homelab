# Versionless Firefox install URLs

The Romulus Forgejo stack defines an installer at
`https://git.holdenitdown.net/install/firefox/<repo>.xpi`. The installer uses the
Forgejo host and TLS configuration. It needs no per-repository settings,
credentials, or persistent storage. The stack setting is `firefox-install-enabled`.
Set `firefox-install-backend-origin` to the Forgejo HTTP Service origin for that stack.

## Promote an extension

1. Publish the signed XPI as a public `rfhold` generic package. For repository
   `<repo>` and stable version `<version>`, use package `<repo>-firefox` and
   filename `<repo>-firefox-<version>.xpi`.
2. Install the downloaded XPI by file in a test profile. Verify the extension
   before you promote it.
3. Add the version, exact public package URL, and `sha256:<hex>` digest to
   `packaging/firefox/updates.json` on the repository's `main` branch.
4. Open the versionless URL in Firefox or LibreWolf. Confirm that the browser
   offers to install the extension instead of downloading it as a file.

Use a lowercase repository name of at most 63 characters. It can contain
letters, digits, hyphens, underscores, and dots, with a letter or digit at each end.
The feed must describe one add-on. The installer selects the greatest numeric
`major.minor.patch` version and skips prereleases. It does not use the newest
package in the registry. A feed with no stable versions returns `404`, as does
an absent feed. An invalid feed, missing artifact, or checksum mismatch returns
`502`. The installer does not follow redirects or forward user credentials.
It verifies the bytes before it responds with `application/x-xpinstall`.
Firefox still verifies Mozilla's signature.

CI uploads alone do not change the installer. To stop offering a version,
remove its feed entry. That does not downgrade clients that already updated.
To disable the route, turn off the stack setting and apply the approved
Forgejo stack change. No live checks or deployment are implied by this runbook.
