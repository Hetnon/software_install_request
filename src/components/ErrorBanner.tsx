export function ErrorBanner({ error }: { error: Error | string }) {
  const message = typeof error === "string" ? error : error.message;
  return (
    <div className="error-banner" role="alert">
      <strong>Something went wrong.</strong>
      <pre>{message}</pre>
    </div>
  );
}
