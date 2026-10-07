import './canvas-loading-status.css';

export default function CanvasLoadingStatus({ overlay = false }) {
  return <div className={`canvas-loading-status${overlay ? ' is-overlay' : ''}`} role="status" aria-live="polite" aria-busy="true">
    <span className="loader" aria-hidden="true" />
    <p>캔버스를 불러오는 중입니다.</p>
  </div>;
}
