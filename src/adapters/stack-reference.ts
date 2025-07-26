import * as pulumi from "@pulumi/pulumi";

export interface StackReferenceConfig {
  organization: pulumi.Input<string>;
  project: pulumi.Input<string>;
  stack: pulumi.Input<string>;
}

const stackReferenceCache = new Map<string, pulumi.StackReference>();

export function getStackReference(config: StackReferenceConfig): pulumi.Output<pulumi.StackReference> {
  return pulumi.all([config.organization, config.project, config.stack]).apply(([org, proj, stack]) => {
    const key = `${org}/${proj}/${stack}`;
    
    let stackRef = stackReferenceCache.get(key);
    if (!stackRef) {
      stackRef = new pulumi.StackReference(key);
      stackReferenceCache.set(key, stackRef);
    }
    
    return stackRef;
  });
}

export function createStackReferenceKey(config: StackReferenceConfig): pulumi.Output<string> {
  return pulumi.interpolate`${config.organization}/${config.project}/${config.stack}`;
}

export function getStackOutput<T = any>(config: StackReferenceConfig, outputName: string): pulumi.Output<T> {
  return getStackReference(config).apply(stackRef => stackRef.getOutput(outputName) as pulumi.Output<T>);
}

export function getStackOutputs<T extends Record<string, any> = Record<string, any>>(
  config: StackReferenceConfig, 
  outputNames: string[]
): pulumi.Output<T> {
  return getStackReference(config).apply(stackRef => {
    const outputs: Record<string, pulumi.Output<any>> = {};
    for (const name of outputNames) {
      outputs[name] = stackRef.getOutput(name);
    }
    return pulumi.all(outputs) as pulumi.Output<T>;
  });
}