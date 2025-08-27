import React, { useState, useEffect } from 'react';
import { SpecUploader } from './SpecUploader';
import { ConfigForm } from './ConfigForm';
import { GeneratedConfig } from './GeneratedConfig';
import { parseSpec } from '../util/parseSpec';
import type { ParsedSpec } from '../types';

export const App: React.FC = () => {
  const [rawSpec, setRawSpec] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedSpec | null>(null);
  const [config, setConfig] = useState<any | null>(null);
  const [tab, setTab] = useState<'generate'|'connected'>('generate');
  const [connected, setConnected] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('mcp_connected')||'[]'); } catch { return []; }
  });

  function handleServerRegistered(info: any) {
    setConnected(prev => {
      const existingIdx = prev.findIndex(p => p.id === info.id);
      const next = existingIdx === -1 ? [...prev, info] : prev.map(p => p.id === info.id ? { ...p, ...info } : p);
      try { localStorage.setItem('mcp_connected', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function handleSpecInput(input: string) {
    setRawSpec(input);
    try {
      const spec = await parseSpec(input);
      setParsed(spec);
    } catch (e:any) {
      console.error(e);
      setParsed(null);
    }
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
      <div style={{display:'flex', justifyContent:'center', gap:'1rem'}}>
        <TabButton active={tab==='generate'} onClick={()=>setTab('generate')}>Generate Setup</TabButton>
        <TabButton active={tab==='connected'} onClick={()=>setTab('connected')}>Connected MCPs</TabButton>
      </div>
      {tab === 'generate' && (
        <div style={{display:'grid', gap:'1.25rem'}}>
          <SpecUploader onChange={handleSpecInput} />
          <ConfigForm spec={parsed} onConfig={setConfig} onServerRegistered={handleServerRegistered} />
          <GeneratedConfig spec={parsed} config={config} />
        </div>
      )}
      {tab === 'connected' && (
        <ConnectedMcpList items={connected} onRemove={(id:string)=>{
          setConnected(prev => {
            const next = prev.filter(p=>p.id!==id);
            try { localStorage.setItem('mcp_connected', JSON.stringify(next)); } catch {}
            return next;
          });
        }} />
      )}
    </div>
  );
};

const TabButton: React.FC<{active:boolean; onClick:()=>void; children: React.ReactNode}> = ({active,onClick,children}) => (
  <button onClick={onClick} style={{
    padding: '.5rem 1rem',
    borderRadius: 6,
    border: '1px solid ' + (active? '#10b981':'#374151'),
    background: active? '#10b981':'#1f2937',
    color:'#fff',
    cursor:'pointer',
    fontSize:'.75rem',
    letterSpacing:'.05em'
  }}>{children}</button>
);

const ConnectedMcpList: React.FC<{items:any[]; onRemove:(id:string)=>void}> = ({items,onRemove}) => {
  if (!items.length) return <div style={panelStyle}>No MCP servers saved yet.</div>;
  return (
    <div style={{display:'grid', gap:'.75rem'}}>
      {items.map(it => (
        <div key={it.id} style={panelStyle}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <strong>{it.name || it.id}</strong>
            <button style={miniBtn} onClick={()=>onRemove(it.id)}>Remove</button>
          </div>
          <div style={metaRow}><label>ID</label><span>{it.id}</span></div>
          <div style={metaRow}><label>Base</label><span>{it.baseURL}</span></div>
          <div style={metaRow}><label>Schema</label><span>{it.schemaURL}</span></div>
          <div style={metaRow}><label>Saved</label><span>{new Date(it.savedAt).toLocaleString()}</span></div>
        </div>
      ))}
    </div>
  );
};

const panelStyle: React.CSSProperties = { background:'#111827', border:'1px solid #1f2937', padding:'0.75rem 1rem', borderRadius:8, fontSize:'.7rem', display:'flex', flexDirection:'column', gap:'.35rem' };
const miniBtn: React.CSSProperties = { background:'#dc2626', border:'1px solid #b91c1c', color:'#fff', fontSize:'.6rem', padding:'.25rem .5rem', borderRadius:4, cursor:'pointer' };
const metaRow: React.CSSProperties = { display:'flex', gap:'.5rem', alignItems:'center' };
