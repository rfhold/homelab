import * as pulumi from "@pulumi/pulumi";
import { getStackOutput } from "./stack-reference";

export interface EnvironmentConfig {
  stack?: pulumi.Input<string>;
}

export function getEnvironmentVariable(
  name: string,
  config?: EnvironmentConfig
): pulumi.Output<string> {
  const stack = config?.stack ?? "dev";
  
  return getStackOutput<Record<string, string>>({
    organization: pulumi.getOrganization(),
    project: "environment",
    stack: stack
  }, "secrets").apply(secrets => {
    if (!secrets || !secrets[name]) {
      throw new Error(`Environment variable ${name} not found in environment stack ${stack}`);
    }
    return secrets[name];
  });
}

export function getEnvironmentVariables(
  names: string[],
  config?: EnvironmentConfig
): pulumi.Output<Record<string, string>> {
  const stack = config?.stack ?? "dev";
  
  return getStackOutput<Record<string, string>>({
    organization: pulumi.getOrganization(),
    project: "environment",
    stack: stack
  }, "secrets").apply(secrets => {
    const result: Record<string, string> = {};
    
    for (const name of names) {
      if (!secrets || !secrets[name]) {
        throw new Error(`Environment variable ${name} not found in environment stack ${stack}`);
      }
      result[name] = secrets[name];
    }
    
    return result;
  });
}

export function getAllEnvironmentVariables(
  config?: EnvironmentConfig
): pulumi.Output<Record<string, string>> {
  const stack = config?.stack ?? "dev";
  
  return getStackOutput<Record<string, string>>({
    organization: pulumi.getOrganization(),
    project: "environment",
    stack: stack
  }, "secrets");
}