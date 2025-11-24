# CloudNativePG Extensions

PostgreSQL extensions for vector search and document storage in CloudNativePG.

## Extension Management

CloudNativePG provides two approaches for managing extensions:

### Image Volume Extensions

For PostgreSQL 18+ and Kubernetes 1.33+:

- Extensions mounted as read-only volumes
- No custom images required
- More secure architecture
- Requires CloudNativePG 1.27+

### Custom Container Images

For PostgreSQL < 18 or Kubernetes < 1.33:

- Build Docker image based on CloudNativePG images
- Install extensions via package managers
- Use when extensions need complex dependencies

### Declarative Management

Use the Database CRD to manage extension lifecycle:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Database
metadata:
  name: my-app-db
spec:
  name: app
  owner: app
  cluster:
    name: my-cluster
  extensions:
  - name: vector
    version: "0.8.0"
    ensure: present
  - name: bloom
    ensure: present
```

CloudNativePG automatically reconciles extensions using CREATE/DROP/ALTER EXTENSION.

## pgvector Extension

The pgvector extension enables vector similarity search for AI/ML applications.

### Features

- Vector types: vector, halfvec, bit, sparsevec
- Distance functions: L2, inner product, cosine, L1, Hamming, Jaccard
- Index types: HNSW (recommended), IVFFlat
- Up to 2,000 dimensions
- Full ACID compliance

### Installation

Create a PostgreSQL cluster:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pgvector-cluster
spec:
  instances: 3
  storage:
    size: 10Gi
```

Enable the pgvector extension:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Database
metadata:
  name: pgvector-app
spec:
  name: app
  owner: app
  cluster:
    name: pgvector-cluster
  extensions:
  - name: vector
    version: "0.8.0"
```

Verify installation:

```shell
kubectl cnpg psql pgvector-cluster -- app -c '\dx'
```

### Basic Usage

Create a table with vector column:

```sql
CREATE TABLE items (
  id bigserial PRIMARY KEY,
  embedding vector(1536)
);
```

Insert vectors:

```sql
INSERT INTO items (embedding) VALUES 
  ('[1,2,3,...]'),
  ('[4,5,6,...]');
```

Query by similarity using L2 distance:

```sql
SELECT * FROM items 
ORDER BY embedding <-> '[3,1,2,...]' 
LIMIT 5;
```

### Distance Operators

- `<->` L2 distance
- `<#>` Negative inner product
- `<=>` Cosine distance
- `<+>` L1 distance

### Indexing

Create HNSW index (recommended):

```sql
CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops);
```

Create HNSW index with custom parameters:

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops) 
WITH (m = 16, ef_construction = 64);
```

Create IVFFlat index:

```sql
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);
```

### Performance Tuning

HNSW parameters:

- `m` Max connections per layer (default 16, range 2-100)
- `ef_construction` Construction candidate list size (default 64)

Query-time tuning:

```sql
SET hnsw.ef_search = 100;
```

IVFFlat parameters:

- `lists` Number of inverted lists (use sqrt of rows for > 1M rows)

Query-time tuning:

```sql
SET ivfflat.probes = 10;
```

Memory configuration:

```yaml
postgresql:
  parameters:
    maintenance_work_mem: "8GB"
    shared_buffers: "4GB"
```

Storage optimization with half-precision vectors:

```sql
CREATE TABLE items (embedding halfvec(1536));
```

Binary quantization for reduced storage:

```sql
CREATE INDEX ON items USING hnsw 
  ((binary_quantize(embedding)::bit(1536)) bit_hamming_ops);
```

### Best Practices

1. Create indexes AFTER bulk loading data
2. Use cosine distance for normalized vectors like OpenAI embeddings
3. Start with HNSW unless specific IVFFlat requirements exist
4. Monitor queries with pg_stat_statements
5. Allocate sufficient maintenance_work_mem for index builds
6. Use CREATE INDEX CONCURRENTLY in production environments

### Use Cases

- AI/ML embeddings storage for OpenAI, Cohere, or custom models
- Semantic search across text, images, or other modalities
- Retrieval-Augmented Generation (RAG) for LLMs
- Image similarity search
- Content recommendations

## Document Storage

PostgreSQL's native JSONB provides production-ready document storage without requiring extensions.

### Basic JSONB Usage

Create a table with JSONB column:

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL
);
```

Create GIN index for fast queries:

```sql
CREATE INDEX ON documents USING GIN (data);
```

Query documents:

```sql
SELECT * FROM documents WHERE data @> '{"key": "value"}';
```

### Why JSONB

- Built-in, no extension required
- Excellent performance with GIN indexes
- Full ACID compliance
- Well-documented and battle-tested

### DocumentDB Extension Status

No mature PostgreSQL DocumentDB extension exists for CloudNativePG. Microsoft announced a DocumentDB extension in January 2025, but production readiness is unclear.

Use native JSONB for document storage needs.

## Bootstrap Configuration

Install extensions during cluster initialization:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cluster-example
spec:
  instances: 3
  bootstrap:
    initdb:
      database: app
      owner: app
      postInitApplicationSQL:
        - CREATE EXTENSION IF NOT EXISTS vector
        - CREATE EXTENSION IF NOT EXISTS bloom
  storage:
    size: 1Gi
```

## Shared Preload Libraries

CloudNativePG automatically manages shared_preload_libraries for:

- auto_explain
- pg_stat_statements
- pgaudit
- pg_failover_slots

Configure pg_stat_statements:

```yaml
postgresql:
  parameters:
    pg_stat_statements.max: "10000"
    pg_stat_statements.track: "all"
```

Add custom shared preload libraries:

```yaml
postgresql:
  shared_preload_libraries:
    - my_extension
  parameters:
    my_extension.parameter: "value"
```

## Extension Upgrades

For image volume extensions (PostgreSQL 18+):

```yaml
extensions:
- name: vector
  version: "0.8.1"
```

Update the version and CloudNativePG will trigger a rolling restart.

For custom images:

1. Build new image with updated extension
2. Test thoroughly in staging
3. Update imageName in Cluster spec

## Extension Removal

Remove an extension by setting ensure to absent:

```yaml
extensions:
- name: old_extension
  ensure: absent
```

## Security Best Practices

1. Install only required extensions
2. Use official extension images
3. Apply security patches regularly
4. Test thoroughly in staging before production
5. Use Database CRD to avoid granting superuser access to applications

## Operational Best Practices

1. Document all installed extensions and versions
2. Monitor performance impact of extensions
3. Test database recovery with extensions installed
4. Pin extension versions in production
5. Ensure backups include extension-dependent data

## Resource Planning

For pgvector deployments:

1. HNSW indexes require significant memory during builds
2. Plan storage for vector indexes (2-3x data size)
3. Adjust max_parallel_maintenance_workers for index builds
4. Monitor resource usage with pg_stat_statements

## Summary

pgvector is production-ready and bundled in CloudNativePG images. Use it for AI/ML workloads requiring vector embeddings. Configure HNSW indexes with cosine distance for best results with normalized embeddings like OpenAI.

For document storage, use PostgreSQL's native JSONB capabilities. No mature DocumentDB extension currently exists for CloudNativePG.

Use the Database CRD for declarative extension management. For PostgreSQL 18+, prefer image volume extensions over custom images.
