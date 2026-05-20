export function Loading({ label }: { label?: string }) {
  return <div className="loading">{label ?? "Loading..."}</div>;
}
