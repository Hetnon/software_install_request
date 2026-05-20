import type { IOperationResult } from "@microsoft/power-apps/data";

export function unwrap<T>(result: IOperationResult<T>, context: string): T {
  if (!result.success) {
    const message = result.error?.message ?? "Unknown Dataverse error";
    throw new Error(`${context}: ${message}`);
  }
  return result.data;
}

export function bind(entitySetName: string, id: string): string {
  return `/${entitySetName}(${id})`;
}

// Dataverse returns lookup display names as OData annotations on the *_value
// columns (e.g. _cr108_software_value@OData.Community.Display.V1.FormattedValue),
// not as standalone properties. The generated TS models include columns like
// cr108_softwarename but Dataverse rejects them in $select, so we read the
// annotation off the response instead.
export function readFormatted(
  record: object,
  valueField: string,
): string | undefined {
  const r = record as Record<string, unknown>;
  const key = `${valueField}@OData.Community.Display.V1.FormattedValue`;
  const v = r[key];
  return typeof v === "string" ? v : undefined;
}
