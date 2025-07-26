import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

const envVars = config.getObject<string[]>("envVars") ?? [];

const envSecrets: Record<string, pulumi.Output<string>> = {};

for (const envVar of envVars) {
  const value = process.env[envVar];
  
  if (value === undefined) {
    throw new Error(`Environment variable ${envVar} is not set`);
  }
  
  envSecrets[envVar] = pulumi.secret(value);
}

export const secrets = envSecrets;