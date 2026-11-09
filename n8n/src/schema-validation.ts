type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean;
};

/** The build rejects unsupported JSON Schema keywords before this can be deployed. */
export function matchesSchema(value: unknown, schema: Schema, depth = 0): boolean {
  if (depth > 32) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'string') {
    return (
      typeof value === 'string' &&
      (schema.minLength === undefined || [...value].length >= schema.minLength) &&
      (schema.maxLength === undefined || [...value].length <= schema.maxLength) &&
      (!schema.pattern || new RegExp(schema.pattern).test(value))
    );
  }
  if (schema.type === 'array') {
    return (
      Array.isArray(value) &&
      (schema.minItems === undefined || value.length >= schema.minItems) &&
      (schema.maxItems === undefined || value.length <= schema.maxItems) &&
      (!schema.items || value.every((item) => matchesSchema(item, schema.items!, depth + 1)))
    );
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (schema.required?.some((key) => !Object.hasOwn(record, key))) return false;
    if (
      schema.additionalProperties === false &&
      Object.keys(record).some((key) => !Object.hasOwn(schema.properties ?? {}, key))
    )
      return false;
    return Object.entries(schema.properties ?? {}).every(
      ([key, child]) => !Object.hasOwn(record, key) || matchesSchema(record[key], child, depth + 1),
    );
  }
  return false;
}
