# Firecrawl v2 Self-Hosting

Self-hosting Firecrawl v2.6.0 with custom LLM API and SearXNG integration.

## Pre-Built Images

- `git.holdenitdown.net/rfhold/firecrawl:v2.6.0` - Main API
- `git.holdenitdown.net/rfhold/firecrawl-playwright:v2.6.0` - Playwright service
- `git.holdenitdown.net/rfhold/firecrawl-nuq-postgres:v2.6.0` - PostgreSQL for NUQ

## Required Services

- API Service - Main Firecrawl API (port 3002)
- Playwright Service - Browser automation for JS-rendered pages (port 3000 internal)
- Redis - Job queue and caching (port 6379)
- NUQ PostgreSQL - Queue system database (port 5432)

## Environment Variables

### Core Configuration

```bash
PORT=3002
HOST=0.0.0.0
USE_DB_AUTHENTICATION=false
BULL_AUTH_KEY=<secure-random-key>
```

### Service URLs

```bash
REDIS_URL=redis://redis:6379
REDIS_RATE_LIMIT_URL=redis://redis:6379
PLAYWRIGHT_MICROSERVICE_URL=http://playwright-service:3000/scrape
NUQ_DATABASE_URL=postgres://postgres:postgres@nuq-postgres:5432/postgres
```

## Custom LLM Configuration

### OpenAI-Compatible API (vLLM, LiteLLM)

```bash
OPENAI_BASE_URL=http://your-llm-api:8000/v1
OPENAI_API_KEY=your-key-or-dummy-value
MODEL_NAME=meta-llama/Llama-3-8b-instruct
```

### Ollama (Experimental)

```bash
OLLAMA_BASE_URL=http://ollama:11434/api
MODEL_NAME=llama3:8b
MODEL_EMBEDDING_NAME=nomic-embed-text
```

### Features Requiring LLM

- `/v2/extract` endpoint for structured data extraction
- JSON format in `/v2/scrape` with schema
- `/map` endpoint with search parameter
- Summary format in scrape requests

Basic scraping, crawling, and search work without LLM configuration.

## SearXNG Integration

### Firecrawl Configuration

```bash
SEARXNG_ENDPOINT=http://searxng:8080
SEARXNG_ENGINES=google,duckduckgo,bing
SEARXNG_CATEGORIES=general
```

### SearXNG Requirements

Your SearXNG instance must have JSON output enabled in `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

## Docker Compose

```yaml
name: firecrawl

x-common-env: &common-env
  REDIS_URL: redis://redis:6379
  REDIS_RATE_LIMIT_URL: redis://redis:6379
  PLAYWRIGHT_MICROSERVICE_URL: http://playwright-service:3000/scrape
  NUQ_DATABASE_URL: postgres://postgres:postgres@nuq-postgres:5432/postgres
  USE_DB_AUTHENTICATION: "false"
  OPENAI_BASE_URL: ${OPENAI_BASE_URL}
  OPENAI_API_KEY: ${OPENAI_API_KEY}
  MODEL_NAME: ${MODEL_NAME}
  SEARXNG_ENDPOINT: ${SEARXNG_ENDPOINT}
  SEARXNG_ENGINES: ${SEARXNG_ENGINES:-google,duckduckgo,bing}
  SEARXNG_CATEGORIES: ${SEARXNG_CATEGORIES:-general}

services:
  api:
    image: git.holdenitdown.net/rfhold/firecrawl:v2.6.0
    environment:
      <<: *common-env
      HOST: "0.0.0.0"
      PORT: "3002"
      BULL_AUTH_KEY: ${BULL_AUTH_KEY}
    depends_on:
      - redis
      - playwright-service
      - nuq-postgres
    ports:
      - "3002:3002"
    networks:
      - firecrawl
    ulimits:
      nofile:
        soft: 65535
        hard: 65535

  playwright-service:
    image: git.holdenitdown.net/rfhold/firecrawl-playwright:v2.6.0
    environment:
      PORT: "3000"
      BLOCK_MEDIA: "true"
    networks:
      - firecrawl

  redis:
    image: redis:alpine
    networks:
      - firecrawl
    command: redis-server --bind 0.0.0.0

  nuq-postgres:
    image: git.holdenitdown.net/rfhold/firecrawl-nuq-postgres:v2.6.0
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    networks:
      - firecrawl

networks:
  firecrawl:
    driver: bridge
```

## Example .env File

```bash
OPENAI_BASE_URL=http://vllm-server:8000/v1
OPENAI_API_KEY=not-used
MODEL_NAME=meta-llama/Llama-3-8b-instruct

SEARXNG_ENDPOINT=http://searxng:8080
SEARXNG_ENGINES=google,duckduckgo,bing
SEARXNG_CATEGORIES=general

BULL_AUTH_KEY=your-secure-random-key
```

## API Endpoints

### No LLM Required

- `POST /v1/scrape` - Scrape single URL
- `POST /v2/scrape` - Scrape with v2 options (unless JSON format)
- `POST /v1/crawl` - Start crawl job
- `GET /v1/crawl/:id` - Check crawl status
- `POST /v1/search` - Web search via SearXNG
- `POST /v1/map` - Map website URLs (unless search param)
- `GET /admin/:key/queues` - Bull queue admin UI

### LLM Required

- `POST /v2/extract` - Extract structured data with schema

## Testing

### Basic Scrape

```shell
curl -X POST http://localhost:3002/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

### Search via SearXNG

```shell
curl -X POST http://localhost:3002/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "firecrawl web scraping", "limit": 5}'
```

### LLM Extraction

```shell
curl -X POST http://localhost:3002/v2/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "formats": [{
      "type": "json",
      "schema": {
        "type": "object",
        "properties": {
          "title": {"type": "string"},
          "description": {"type": "string"}
        }
      }
    }]
  }'
```

## Self-Hosted Limitations

- No Fire-engine access (advanced IP rotation, anti-bot features)
- Supabase configuration not supported
- Manual proxy configuration required if needed
- Ollama support is experimental

## Troubleshooting

### "Supabase client is not configured" Warning

Expected in self-hosted mode. Can be ignored.

### "You're bypassing authentication" Warning

Normal when USE_DB_AUTHENTICATION=false.

### LLM Extraction Not Working

- Verify OPENAI_BASE_URL is accessible from the container
- Check MODEL_NAME matches your deployed model
- Ensure LLM API is OpenAI-compatible (uses /v1/chat/completions)

## References

- https://docs.firecrawl.dev/contributing/self-host
- https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md
- https://github.com/firecrawl/firecrawl/releases/tag/v2.6.0
- https://github.com/firecrawl/firecrawl/pull/1193
