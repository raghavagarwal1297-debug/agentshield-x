import React from 'react';
import { useConsole } from './store.jsx';

export default function Toasts() {
  const { toasts } = useConsole();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="t">{t.title}</div>
          {t.text && <div>{t.text}</div>}
        </div>
      ))}
    </div>
  );
}
