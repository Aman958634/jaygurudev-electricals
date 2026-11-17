import Loading from "./Loading.jsx";

export default function ResourceFeedback({ loading, error, empty, onRetry, emptyMessage = "Nothing to show yet." }) {
  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="resource-error" role="alert">
        <p>{error}</p>
        {onRetry && <button className="button button-outline" type="button" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (empty) return <div className="resource-empty" role="status">{emptyMessage}</div>;
  return null;
}
