export default function DashboardLoading() {
  return <div className="route-loading" role="status" aria-live="polite">
    <span className="navigation-spinner" aria-hidden="true" />
    <span>Завантаження розділу…</span>
  </div>;
}
