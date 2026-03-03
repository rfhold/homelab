import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

interface ImageSecretRegistryConfig {
  type: "environment-token";
  username: string;
  tokenName: string;
}

interface ImageSecretsConfig {
  [registry: string]: ImageSecretRegistryConfig;
}

function extractRegistryDomain(image: string): string | null {
  const trimmed = image.trim();
  
  if (!trimmed.includes("/")) {
    return null;
  }
  
  const firstSlashIndex = trimmed.indexOf("/");
  const potentialRegistry = trimmed.substring(0, firstSlashIndex);
  
  if (potentialRegistry.includes(".") || potentialRegistry.includes(":")) {
    return potentialRegistry;
  }
  
  return null;
}

export function createImagePullSecrets(args: {
  name: string;
  namespace: pulumi.Input<string>;
  images: pulumi.Input<string>[];
  provider?: k8s.Provider;
}): Array<{ name: string }> | undefined {
  const config = new pulumi.Config();
  const imageSecretsConfig = config.getObject<ImageSecretsConfig>("image-secrets:config");
  const tokenStashes = new Map<string, pulumi.Stash>();
  
  if (!imageSecretsConfig || Object.keys(imageSecretsConfig).length === 0) {
    return undefined;
  }
  
  const allInputs = pulumi.all(args.images);
  
  const hasMatches = allInputs.apply(resolvedImages => {
    for (const image of resolvedImages) {
      const registry = extractRegistryDomain(image);
      if (registry && imageSecretsConfig[registry]) {
        return true;
      }
    }
    return false;
  });
  
  return hasMatches.apply(matches => {
    if (!matches) {
      return undefined;
    }
    
    return allInputs.apply(resolvedImages => {
      const matchedRegistries: string[] = [];
      
      for (const image of resolvedImages) {
        const registry = extractRegistryDomain(image);
        if (registry && imageSecretsConfig[registry] && !matchedRegistries.includes(registry)) {
          matchedRegistries.push(registry);
        }
      }
      
      const passwordOutputs = matchedRegistries.map(registry => {
        const secretConfig = imageSecretsConfig[registry];
        if (secretConfig.type === "environment-token") {
          let stash = tokenStashes.get(secretConfig.tokenName);
          if (!stash) {
            const tokenValue = process.env[secretConfig.tokenName];
            if (tokenValue === undefined) {
              throw new Error(`Environment variable ${secretConfig.tokenName} is not set`);
            }
            const stashName = `image-secret-${secretConfig.tokenName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            stash = new pulumi.Stash(stashName, {
              input: pulumi.secret(tokenValue),
            });
            tokenStashes.set(secretConfig.tokenName, stash);
          }
          return { registry, username: secretConfig.username, password: stash.output.apply(v => String(v)) };
        }
        throw new Error(`Unsupported secret type: ${(secretConfig as any).type}`);
      });
      
      const passwords = passwordOutputs.map(p => p.password);
      
      return pulumi.all(passwords).apply(resolvedPasswords => {
        const authsMap: Record<string, { username: string; password: string; auth: string }> = {};
        
        for (let i = 0; i < passwordOutputs.length; i++) {
          const item = passwordOutputs[i];
          const password = resolvedPasswords[i];
          const auth = Buffer.from(`${item.username}:${password}`).toString('base64');
          
          authsMap[item.registry] = {
            username: item.username,
            password: password,
            auth: auth,
          };
        }
        
        const dockerConfigJson = JSON.stringify({ auths: authsMap });
        const base64DockerConfig = Buffer.from(dockerConfigJson).toString('base64');
        
        new k8s.core.v1.Secret(
          args.name,
          {
            metadata: {
              name: args.name,
              namespace: args.namespace,
            },
            type: "kubernetes.io/dockerconfigjson",
            data: {
              ".dockerconfigjson": base64DockerConfig,
            },
          },
          {
            provider: args.provider,
          }
        );
        
        return [{ name: args.name }];
      });
    });
  }) as any;
}
