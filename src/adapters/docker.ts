import * as pulumi from "@pulumi/pulumi";

/**
 * Configuration for connecting to a Docker registry
 */
export interface DockerRegistryConfig {
  /** Registry URL (e.g., docker.io, ghcr.io, registry.example.com) */
  url: pulumi.Input<string>;
  
  /** Registry username for authentication */
  username: pulumi.Input<string>;
  
  /** Registry password or token for authentication */
  password: pulumi.Input<string>;
}

/**
 * Creates a .dockerconfigjson formatted string from Docker registry configuration
 * This format is used by Kubernetes for registry authentication secrets
 * 
 * @param config Docker registry configuration
 * @returns Pulumi output containing the .dockerconfigjson formatted string
 */
export function createDockerConfigJson(config: DockerRegistryConfig): pulumi.Output<string> {
  return pulumi.all([config.url, config.username, config.password]).apply(([url, username, password]) => {
    // Create base64 encoded auth string (username:password)
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Create the .dockerconfigjson structure
    const dockerConfig = {
      auths: {
        [url]: {
          username: username,
          password: password,
          auth: auth
        }
      }
    };
    
    return JSON.stringify(dockerConfig);
  });
}

/**
 * Creates Docker registry environment variables from configuration
 * Uses common Docker registry environment variable patterns
 * 
 * @param config Docker registry configuration
 * @param prefix Optional prefix for environment variable names (defaults to "DOCKER")
 * @returns Object with Docker registry environment variables
 */
export function createDockerRegistryEnvironmentVariables(config: DockerRegistryConfig, prefix: string = "DOCKER"): Record<string, pulumi.Input<string>> {
  return {
    [`${prefix}_REGISTRY`]: config.url,
    [`${prefix}_REGISTRY_URL`]: config.url,
    [`${prefix}_USERNAME`]: config.username,
    [`${prefix}_PASSWORD`]: config.password,
    // Alternative naming patterns
    [`${prefix}_REGISTRY_USER`]: config.username,
    [`${prefix}_REGISTRY_PASSWORD`]: config.password,
    // For apps expecting specific registry patterns
    REGISTRY_URL: config.url,
    REGISTRY_USERNAME: config.username,
    REGISTRY_PASSWORD: config.password,
  };
}

