export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="alert" className="banner banner-error">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="banner-close" onClick={onDismiss} aria-label="Dismiss error">
          ×
        </button>
      )}
    </div>
  );
}
