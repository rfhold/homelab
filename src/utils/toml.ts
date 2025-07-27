import * as pulumi from "@pulumi/pulumi";
import * as toml from "@iarna/toml";

/**
 * Options for TOML marshaling
 */
export interface TOMLMarshalOptions {
  /** Sort object keys */
  sortKeys?: boolean;
  
  /** Custom key comparator for sorting */
  keyComparator?: (a: string, b: string) => number;
}

/**
 * Marshals a JavaScript object to TOML string
 * 
 * @param obj Object to marshal
 * @param options TOML marshaling options
 * @returns TOML string
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
 * const tomlString = marshalTOML(config);
 * ```
 */
export function marshalTOML(obj: any, options?: TOMLMarshalOptions): string {
  const processedObj = options?.sortKeys ? sortObject(obj, options.keyComparator) : obj;
  return toml.stringify(processedObj);
}

/**
 * Creates a Pulumi Output that marshals an object to TOML
 * 
 * @param obj Pulumi Input object to marshal
 * @param options TOML marshaling options
 * @returns Pulumi Output of TOML string
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
 * const tomlOutput = createTOMLOutput(config);
 * ```
 */
export function createTOMLOutput(
  obj: pulumi.Input<any>,
  options?: TOMLMarshalOptions
): pulumi.Output<string> {
  return pulumi.output(obj).apply(value => marshalTOML(value, options));
}

/**
 * Parses a TOML string to JavaScript object
 * 
 * @param tomlString TOML string to parse
 * @returns Parsed JavaScript object
 */
export function parseTOML(tomlString: string): any {
  return toml.parse(tomlString);
}

/**
 * Creates a TOML document with proper header comment
 * 
 * @param obj Object to marshal
 * @param header Header comment (without # prefix)
 * @param options TOML marshaling options
 * @returns TOML string with header
 * 
 * @example
 * ```typescript
 * const tomlWithHeader = createTOMLDocument(
 *   config,
 *   "Application Configuration",
 *   { sortKeys: true }
 * );
 * // Output:
 * // # Application Configuration
 * // server.host = "localhost"
 * // server.port = 8080
 * ```
 */
export function createTOMLDocument(
  obj: any,
  header?: string,
  options?: TOMLMarshalOptions
): string {
  const tomlContent = marshalTOML(obj, options);
  
  if (header) {
    const headerLines = header.split('\n').map(line => `# ${line}`).join('\n');
    return `${headerLines}\n\n${tomlContent}`;
  }
  
  return tomlContent;
}

/**
 * Creates a Pulumi Output for a TOML document with header
 * 
 * @param obj Pulumi Input object to marshal
 * @param header Header comment
 * @param options TOML marshaling options
 * @returns Pulumi Output of TOML string with header
 */
export function createTOMLDocumentOutput(
  obj: pulumi.Input<any>,
  header?: string,
  options?: TOMLMarshalOptions
): pulumi.Output<string> {
  return pulumi.output(obj).apply(value => createTOMLDocument(value, header, options));
}

/**
 * Helper function to recursively sort object keys
 */
function sortObject(obj: any, comparator?: (a: string, b: string) => number): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sortObject(item, comparator));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort(comparator);
    return sortedKeys.reduce((sorted, key) => {
      sorted[key] = sortObject(obj[key], comparator);
      return sorted;
    }, {} as any);
  }
  
  return obj;
}