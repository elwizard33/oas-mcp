import React, { useMemo } from 'react';
import type { ParsedSpec } from '../types';
import { buildConfig } from '../util/buildConfig';

interface Props { spec: ParsedSpec | null; config: any | null; }

export const GeneratedConfig: React.FC<Props> = ({ spec, config }) => {
  const built = useMemo(() => {
    if (!spec || !config) return null;
    return buildConfig(spec, config);
  }, [spec, config]);

  function copySnippet() {
    if (!built) return;
    navigator.clipboard.writeText(JSON.stringify(built.snippet, null, 2)).catch(()=>{});
  }
  function copyURL() {
    if (!built) return;
    navigator.clipboard.writeText(built.url).catch(()=>{});
  }

  return (
    <section style={secStyle}>
      <h2 style={h2Style}>3. Generated Configuration</h2>
  {!built && <p style={pStyle}>Provide a spec & server options then click Generate.</p>}
  {built && (
        <>
          <div style={{display:'flex', gap:'.5rem', marginBottom:'.5rem'}}>
    <button style={btnStyle} onClick={copySnippet}>Copy servers snippet</button>
    <button style={btnStyle} onClick={copyURL}>Copy URL only</button>
          </div>
          <pre style={preStyle}>{JSON.stringify(built.snippet, null, 2)}</pre>
        </>
      )}
    </section>
  );
};

const secStyle: React.CSSProperties = { background:'#1b1f27', border:'1px solid #2a303c', padding:'1rem', borderRadius:8 };
const h2Style: React.CSSProperties = { margin:'0 0 .75rem', fontSize:'1rem', fontWeight:600 };
const pStyle: React.CSSProperties = { opacity:.8, fontSize:'.75rem', margin:0 };
const preStyle: React.CSSProperties = { margin:0, padding:'.75rem', background:'#0f1115', border:'1px solid #2a303c', borderRadius:4, fontSize:12, overflowX:'auto', maxHeight:400 };
const btnStyle: React.CSSProperties = { background:'#2563eb', color:'#fff', border:'1px solid #1d4ed8', padding:'.4rem .75rem', borderRadius:4, fontSize:'.7rem', cursor:'pointer' };
