import React, { useRef } from 'react';

interface Props { onChange: (raw: string) => void; }

export const SpecUploader: React.FC<Props> = ({ onChange }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    onChange(text);
  }

  return (
    <section style={secStyle}>
      <h2 style={h2Style}>1. OpenAPI Specification</h2>
      <p style={pStyle}>Paste JSON/YAML or upload a file.</p>
      <textarea
        placeholder="Paste spec JSON or YAML here"
        onChange={e => onChange(e.target.value)}
        style={taStyle}
        rows={10}
      />
      <div>
        <input ref={inputRef} type="file" accept=".json,.yaml,.yml" onChange={handleFile} />
      </div>
    </section>
  );
};

const secStyle: React.CSSProperties = { background:'#1b1f27', border:'1px solid #2a303c', padding:'1rem', borderRadius:8 };
const h2Style: React.CSSProperties = { margin:'0 0 .5rem', fontSize:'1rem', fontWeight:600 };
const pStyle: React.CSSProperties = { margin:'0 0 .75rem', fontSize:'.8rem', opacity:.85 };
const taStyle: React.CSSProperties = { width:'100%', fontFamily:'monospace', fontSize:12, padding:'.5rem', background:'#0f1115', color:'#e5e7eb', border:'1px solid #2a303c', borderRadius:4, resize:'vertical' };
