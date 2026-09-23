import { useId } from 'react';

/**
 * A labelled input that wires up its own hint and error text via
 * aria-describedby, so a screen reader announces the guidance and the problem
 * together with the field rather than leaving them orphaned on the page.
 */
export function Field({
  label,
  hint,
  error,
  type = 'text',
  as = 'input',
  children,
  required = false,
  ...inputProps
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const shared = {
    id,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    ...inputProps,
  };

  return (
    <div className="field" data-invalid={error ? 'true' : 'false'}>
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {as === 'select' ? (
        <select {...shared}>{children}</select>
      ) : (
        <input type={type} {...shared} />
      )}

      {error ? (
        <strong className="field-error" id={errorId}>
          {error}
        </strong>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, ...props }) {
  const id = useId();
  return (
    <label className="checkbox" htmlFor={id}>
      <input type="checkbox" id={id} {...props} />
      <span>{label}</span>
    </label>
  );
}
