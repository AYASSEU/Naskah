import { LoaderCircle } from 'lucide-react';
import './route-loading.css';

export function RouteLoading({ label, overlay = false }: { label: string; overlay?: boolean }) {
  return (
    <div
      className={`route-loading${overlay ? ' route-loading-overlay' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="route-loading-content">
        <span className="route-loading-icon" aria-hidden="true">
          <LoaderCircle />
        </span>
        <p>{label}</p>
        <span className="route-loading-track" aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  );
}
