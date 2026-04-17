export type JsonSchemaObject = {
  type?: string;
  required?: string[];
  properties?: Record<string, unknown>;
};

type JsonSchemaProperty = {
  default?: unknown;
};

export function registryDefaultParams(
  schema: unknown,
  opts: { projectId?: string },
): Record<string, unknown> {
  const s = schema as JsonSchemaObject | null;
  const out: Record<string, unknown> = {};
  if (!s || typeof s !== "object") return out;
  if (s.type !== "object") return out;

  const props = s.properties ?? {};
  for (const [k, v] of Object.entries(props)) {
    const pv = v as JsonSchemaProperty | null;
    if (!pv || typeof pv !== "object") continue;
    if ("default" in pv) out[k] = pv.default;
  }

  // Common convention in built-in reporting: project-scoped reports use project_id.
  if (opts.projectId && ("project_id" in props || s.required?.includes("project_id"))) {
    out.project_id = opts.projectId;
  }

  return out;
}

