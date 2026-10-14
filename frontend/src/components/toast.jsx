import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo } from "react-icons/lu";

const ToastContext = createContext(() => {});
const ICONS = { success: [LuCircleCheck, "green"], error: [LuCircleAlert, "red"], info: [LuInfo, "sky"] };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, type: "success", ...toast }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), toast.duration || 4200);
  }, []);

  const api = useMemo(
    () => ({
      success: (title, message) => push({ type: "success", title, message }),
      error: (title, message) => push({ type: "error", title, message }),
      info: (title, message) => push({ type: "info", title, message }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const [Icon, tone] = ICONS[t.type] || ICONS.info;
          return (
            <div key={t.id} className="toast">
              <span className={`icon-bubble ${tone}`}>
                <Icon />
              </span>
              <div>
                <div className="toast-title">{t.title}</div>
                {t.message && <div className="toast-msg">{t.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
