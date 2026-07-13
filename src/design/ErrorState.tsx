/** Branded failure panel — shown instead of an endless skeleton when the
 *  screen's queries have settled in error (see the smart Spinner in ui.tsx). */
export function ErrorState({
  onRetry,
  title = "Couldn't load this screen",
}: {
  onRetry?: () => void;
  title?: string;
}) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="card p-10 text-center max-w-md mx-auto my-12">
      <svg
        width="40" height="40" viewBox="0 0 24 24" fill="none"
        className="mx-auto text-muted" aria-hidden
      >
        {offline ? (
          <>
            <path d="M5 12.5A4.5 4.5 0 016.7 9 6 6 0 0118 10.5a3.5 3.5 0 011 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="15.8" r="0.9" fill="currentColor" />
          </>
        )}
      </svg>
      <div className="font-display text-lg text-ink mt-3">
        {offline ? "You're offline" : title}
      </div>
      <div className="text-sm text-muted mt-1">
        {offline
          ? "Check your connection and try again."
          : "The server didn't respond. Your data is safe."}
      </div>
      {onRetry && (
        <button className="btn-primary mt-5" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
