import { useAppState } from '../hooks/useAppState'

export function Toasts() {
  const { toasts, dismissToast } = useAppState()
  if (!toasts.length) return null
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismissToast(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
