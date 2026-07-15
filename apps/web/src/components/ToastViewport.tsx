import { useNavigate } from "react-router-dom";
import { dismissToast, pauseToast, resumeToast, useToastStore } from "../toastStore.js";

export default function ToastViewport() {
  const toasts = useToastStore();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast${t.tone === "error" ? " toast-error" : ""}`}
          onMouseEnter={() => pauseToast(t.id)}
          onMouseLeave={() => resumeToast(t.id)}
        >
          <div className="toast-body">
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Fermer">×</button>
          </div>
          {t.actions && t.actions.length > 0 && (
            <div className="toast-actions">
              {t.actions.map((a) => (
                <button
                  key={a.label}
                  className={a.to ? undefined : "secondary"}
                  onClick={() => {
                    if (a.onClick) void a.onClick();
                    if (a.to) navigate(a.to);
                    dismissToast(t.id);
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className={`toast-progress${t.paused ? " paused" : ""}`} style={{ animationDuration: `${t.durationMs}ms` }} />
        </div>
      ))}
    </div>
  );
}
