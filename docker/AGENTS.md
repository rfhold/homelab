# Docker Images - Agent Instructions

## Creating New Docker Images

Follow the existing patterns in subdirectories like `bitnami-postgres-documentdb/` and `bitnami-postgres-pgvector/`.

### Required Files
1. **Dockerfile** - Build configuration (multi-stage, compilation, or extension copying)
2. **README.md** - Usage documentation with versions, build args, and examples  
3. **docker-compose.yml** - Local testing setup with appropriate services and ports
4. **.dockerignore** - Standard exclusions
5. **GitHub workflow** - `.github/workflows/build-image-name.yml` for CI/CD

### Testing Process
1. `docker-compose up -d` (use non-conflicting ports)
2. Test core functionality with `docker-compose exec` or appropriate client connections
3. Verify the main purpose of the image works correctly
4. `docker-compose down` to cleanup

### Key Points
- Research base images and dependencies before building
- Test the actual functionality, not just container startup
- Use appropriate testing methods for the image type (database connections, API calls, CLI commands, etc.)
- Follow existing naming and structure patterns