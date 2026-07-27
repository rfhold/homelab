# Firecrawl v2.6.0 Self-Hosting Evidence

This is a non-authoritative evaluation record. It does not establish that Firecrawl, its images, dependencies, LLM integration, search integration, or endpoints are currently deployed or healthy.

## Provenance

- The evaluation was explicitly scoped to Firecrawl `v2.6.0` and recorded three repository-built images at that tag. No research or retrieval date was recorded.
- Consulted sources: [self-hosting documentation](https://docs.firecrawl.dev/contributing/self-host), [SELF_HOST.md](https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md), [v2.6.0 release](https://github.com/firecrawl/firecrawl/releases/tag/v2.6.0), and [pull request 1193](https://github.com/firecrawl/firecrawl/pull/1193).

## Evidence Retained

- The evaluated topology required an API service, Playwright service, Redis, and NUQ PostgreSQL.
- Basic scraping, crawling, and SearXNG-backed search were distinguished from extraction and structured outputs requiring an OpenAI-compatible LLM.
- SearXNG JSON output and repository-built version-matched images were concrete integration findings.
- Self-hosted limitations included no Fire-engine capability, unsupported Supabase configuration, manual proxy setup, and experimental Ollama support.

## Repository Relevance

This is genuine versioned build and integration evidence, but not proof those private registry images still exist or are deployed. Credentials, default database values, and full Compose configuration were removed.

## Disposition

No canonical Firecrawl workload contract exists. Current tracked workload behavior belongs in [Kubernetes workloads](../kubernetes-workloads/README.md); image build and delivery behavior belongs in [deployment](../deployment/README.md).
