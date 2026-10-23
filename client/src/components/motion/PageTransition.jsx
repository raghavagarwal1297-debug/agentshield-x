import React from 'react';

export default function PageTransition({ children, activeKey }) {
  return (
    <div
      key={activeKey}
      className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {children}
    </div>
  );
}
