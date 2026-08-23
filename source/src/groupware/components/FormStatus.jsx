export default function FormStatus({ id, message, tone = 'info' }) {
  return (
    <div
      className={`gw-form-status gw-form-status--${tone}`}
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      hidden={!message}
    >
      {message}
    </div>
  );
}
