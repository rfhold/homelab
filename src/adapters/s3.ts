import * as pulumi from "@pulumi/pulumi";

/**
 * Configuration for connecting to an S3-compatible storage service
 */
export interface S3Config {
  /** S3 endpoint URL (e.g., s3.amazonaws.com, localhost:9000, storage.example.com) */
  endpoint: pulumi.Input<string>;
  
  /** S3 access key ID for authentication */
  accessKeyId: pulumi.Input<string>;
  
  /** S3 secret access key for authentication */
  secretAccessKey: pulumi.Input<string>;
  
  /** S3 region (defaults to "auto") */
  region?: pulumi.Input<string>;
  
  /** Force path-style URLs instead of virtual-hosted-style (defaults to true for compatibility) */
  s3ForcePathStyle?: pulumi.Input<boolean>;
  
  /** Use SSL/TLS for connections (defaults to true) */
  useSSL?: pulumi.Input<boolean>;
}

/**
 * Creates an S3 connection URL from configuration
 * Useful for applications that accept S3 URLs (like backup tools, CLI tools, etc.)
 * 
 * @param config S3 configuration
 * @param bucketName Optional bucket name to include in the URL
 * @returns Pulumi output containing the S3 connection URL
 */
export function createS3Url(config: S3Config, bucketName?: pulumi.Input<string>): pulumi.Output<string> {
  return pulumi.all([
    config.endpoint,
    config.accessKeyId,
    config.secretAccessKey,
    config.useSSL !== undefined ? config.useSSL : true,
    bucketName || ""
  ]).apply(([endpoint, accessKeyId, secretAccessKey, useSSL, bucket]) => {
    const protocol = useSSL ? "https" : "http";
    const encodedAccessKey = encodeURIComponent(accessKeyId);
    const encodedSecretKey = encodeURIComponent(secretAccessKey);
    
    // Clean endpoint of protocol if provided
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, "");
    
    if (bucket) {
      return `s3://${encodedAccessKey}:${encodedSecretKey}@${cleanEndpoint}/${bucket}`;
    } else {
      return `${protocol}://${encodedAccessKey}:${encodedSecretKey}@${cleanEndpoint}`;
    }
  });
}

/**
 * Creates an S3 configuration object for AWS SDK and other S3 clients
 * 
 * @param config S3 configuration
 * @returns Object with S3 client configuration
 */
export function createS3ClientConfig(config: S3Config) {
  return {
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region || "auto",
    s3ForcePathStyle: config.s3ForcePathStyle !== undefined ? config.s3ForcePathStyle : true,
    useSSL: config.useSSL !== undefined ? config.useSSL : true,
  };
}

/**
 * Creates environment variables object for S3 configuration
 * Useful for applications that read S3 credentials from environment variables
 * 
 * @param config S3 configuration
 * @returns Object with standard S3 environment variable names
 */
export function createS3EnvironmentVariables(config: S3Config): pulumi.Output<Record<string, string>> {
  return pulumi.all([
    config.endpoint,
    config.accessKeyId,
    config.secretAccessKey,
    config.region || "auto",
    config.s3ForcePathStyle !== undefined ? config.s3ForcePathStyle : true,
    config.useSSL !== undefined ? config.useSSL : true
  ]).apply(([endpoint, accessKeyId, secretAccessKey, region, s3ForcePathStyle, useSSL]) => {
    const envVars: Record<string, string> = {
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AWS_DEFAULT_REGION: region,
      AWS_REGION: region,
      AWS_ENDPOINT_URL: `${useSSL ? 'https' : 'http'}://${endpoint.replace(/^https?:\/\//, "")}`,
      AWS_S3_FORCE_PATH_STYLE: s3ForcePathStyle.toString(),
      S3_ENDPOINT: endpoint,
      S3_ACCESS_KEY_ID: accessKeyId,
      S3_SECRET_ACCESS_KEY: secretAccessKey,
      S3_REGION: region,
      S3_FORCE_PATH_STYLE: s3ForcePathStyle.toString(),
    };
    return envVars;
  });
}
