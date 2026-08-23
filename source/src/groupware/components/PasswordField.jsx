import { useId, useState } from 'react';

export default function PasswordField({ id, label, name, autoComplete, required = true, hint, minLength }) {
  const generatedHintId = useId();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-${generatedHintId}` : undefined;

  return (
    <div className="gw-field">
      <label htmlFor={id}>{label}</label>
      <div className="gw-password-control">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-describedby={hintId}
          required={required}
          minLength={minLength}
        />
        <button
          className="gw-password-toggle"
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? '숨기기' : '표시'}
        </button>
      </div>
      {hint && <p className="gw-field-hint" id={hintId}>{hint}</p>}
    </div>
  );
}
