import * as pulumi from "@pulumi/pulumi";
import * as yaml from "yaml";

/**
 * Options for YAML marshaling
 */
export interface YAMLMarshalOptions {
  /** Indentation level (defaults to 2) */
  indent?: number;
  
  /** Use flow style for arrays and objects where possible */
  flowLevel?: number;
  
  /** Sort object keys */
  sortKeys?: boolean;
  
  /** Line width for folding long lines (defaults to 80, -1 for no folding) */
  lineWidth?: number;
  
  /** Quote style: 'single', 'double', or false for no quotes */
  singleQuote?: boolean;
  
  /** Null representation (defaults to 'null') */
  nullStr?: string;
}

/**
 * Marshals a JavaScript object to YAML string
 * 
 * @param obj Object to marshal
 * @param options YAML marshaling options
 * @returns YAML string
 * 
 * @example
 * ```typescript
 * const config = {
 *   server: {
 *     host: "localhost",
 *     port: 8080,
 *   },
 *   features: ["search", "cache"],
 * };
 * 
 * const yamlString = marshalYAML(config);
 * ```
 */
export function marshalYAML(obj: any, options?: YAMLMarshalOptions): string {
  const stringifyOptions: yaml.DocumentOptions & yaml.SchemaOptions & yaml.ToStringOptions = {
    indent: options?.indent ?? 2,
    lineWidth: options?.lineWidth ?? 80,
    singleQuote: options?.singleQuote ?? false,
    nullStr: options?.nullStr ?? 'null',
  };

  // Handle sortKeys separately as it's not part of the main options
  const replacer = options?.sortKeys ? 
    (_key: any, value: any) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {} as any);
      }
      return value;
    } : undefined;

  return yaml.stringify(obj, replacer, stringifyOptions);
}

/**
 * Creates a Pulumi Output that marshals an object to YAML
 * 
 * @param obj Pulumi Input object to marshal
 * @param options YAML marshaling options
 * @returns Pulumi Output of YAML string
 * 
 * @example
 * ```typescript
 * const config = pulumi.all([
 *   args.host,
 *   args.port,
 *   args.features,
 * ]).apply(([host, port, features]) => ({
 *   server: { host, port },
 *   features,
 * }));
 * 
 * const yamlOutput = createYAMLOutput(config);
 * ```
 */
export function createYAMLOutput(
  obj: pulumi.Input<any>,
  options?: YAMLMarshalOptions
): pulumi.Output<string> {
  return pulumi.output(obj).apply(value => marshalYAML(value, options));
}

/**
 * Parses a YAML string to JavaScript object
 * 
 * @param yamlString YAML string to parse
 * @returns Parsed JavaScript object
 */
export function parseYAML(yamlString: string): any {
  return yaml.parse(yamlString);
}

/**
 * Creates a YAML document with proper header comment
 * 
 * @param obj Object to marshal
 * @param header Header comment (without # prefix)
 * @param options YAML marshaling options
 * @returns YAML string with header
 * 
 * @example
 * ```typescript
 * const yamlWithHeader = createYAMLDocument(
 *   config,
 *   "Application Configuration",
 *   { sortKeys: true }
 * );
 * // Output:
 * // # Application Configuration
 * // server:
 * //   host: localhost
 * //   port: 8080
 * ```
 */
export function createYAMLDocument(
  obj: any,
  header?: string,
  options?: YAMLMarshalOptions
): string {
  const yamlContent = marshalYAML(obj, options);
  
  if (header) {
    const headerLines = header.split('\n').map(line => `# ${line}`).join('\n');
    return `${headerLines}\n${yamlContent}`;
  }
  
  return yamlContent;
}

/**
 * Creates a Pulumi Output for a YAML document with header
 * 
 * @param obj Pulumi Input object to marshal
 * @param header Header comment
 * @param options YAML marshaling options
 * @returns Pulumi Output of YAML string with header
 */
export function createYAMLDocumentOutput(
  obj: pulumi.Input<any>,
  header?: string,
  options?: YAMLMarshalOptions
): pulumi.Output<string> {
  return pulumi.output(obj).apply(value => createYAMLDocument(value, header, options));
}