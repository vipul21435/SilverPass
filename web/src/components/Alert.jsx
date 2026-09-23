/**
 * Announced live, because the thing that just went wrong is usually the most
 * important thing on the page. Errors interrupt (`assertive`); everything else
 * waits its turn (`polite`).
 */
export function Alert({ kind = 'info', title, children }) {
  const isError = kind === 'error';
  return (
    <div
      className={`alert alert--${kind}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {title ? <strong>{title}</strong> : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
}
