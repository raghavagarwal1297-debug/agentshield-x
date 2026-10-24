// Drawer showing a document with its hidden text spans highlighted by line.
import React, { useEffect, useState } from 'react';
import { getDocument } from '../api.js';
import { Drawer } from './ui.jsx';

export default function DocViewer({ id, onClose }) {
  const [doc, setDoc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getDocument(id).then((d) => { if (!live) return; if (d) setDoc(d); else setFailed(true); });
    return () => { live = false; };
  }, [id]);
  const hidden = new Map((doc?.hidden_spans || []).map((h) => [h.line, h]));
  return (
    <Drawer title={id} onClose={onClose} meta={doc && <span className={`chip cls-${doc.classification}`}>{doc.classification}</span>}>
      {failed && <p className="empty">Could not load this document.</p>}
      {!doc && !failed && <p className="empty">Loading…</p>}
      {doc && (
        <>
          {hidden.size > 0 && (
            <p className="doc-warn">
              {hidden.size} hidden {hidden.size === 1 ? 'span' : 'spans'}: text a reader cannot see but the assistant can. Highlighted below.
            </p>
          )}
          <pre className="doc">
            {doc.content.split('\n').map((line, i) => {
              const h = hidden.get(i + 1);
              return (
                <div key={i} className={h ? 'doc-line hidden' : 'doc-line'}>
                  <span className="ln">{i + 1}</span>
                  <span>{line || ' '}</span>
                  {h && <span className="doc-tag">hidden · {h.how}</span>}
                </div>
              );
            })}
          </pre>
        </>
      )}
    </Drawer>
  );
}
