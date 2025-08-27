import React, { useState, useEffect } from 'react';
import type { ParsedSpec } from '../types';

interface Props { spec: ParsedSpec | null; onConfig: (cfg:any)=>void; onServerRegistered?: (info: { id:string; name:string; baseURL:string; schemaURL:string; savedAt:number; }) => void; }

export const ConfigForm: React.FC<Props> = ({ spec, onConfig, onServerRegistered }) => {
  const [baseURL, setBaseURL] = useState('https://api.example.com');
  const [userTouchedBase, setUserTouchedBase] = useState(false);
  const [schemaURL, setSchemaURL] = useState('');
  const [serverName, setServerName] = useState('openapi');
  const [sseServerURL, setSseServerURL] = useState('http://127.0.0.1:8080');
  const [authType, setAuthType] = useState<'none'|'bearer'|'api-key-header'|'basic'|'authorization-raw'|'custom-headers'>('bearer');
  const [schemeName, setSchemeName] = useState('auth');
  const [token, setToken] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyHeaderName, setApiKeyHeaderName] = useState('Authorization');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [rawAuthValue, setRawAuthValue] = useState('');
  const [customHeadersText, setCustomHeadersText] = useState('');
  const [credStatus, setCredStatus] = useState<string | null>(null);
  const [availableSchemes, setAvailableSchemes] = useState<string[]>([]);
  // headers removed from URL generation; tokens stored securely via /credentials

  // Auto-populate baseURL from spec (OAS3: servers, OAS2: schemes+host+basePath) if user hasn't touched it.
  useEffect(() => {
    if (!spec || userTouchedBase) return;
    try {
      let candidate: string | undefined;
      // OAS3: servers array
      const servers = spec.deref?.servers || spec.raw?.servers;
      if (Array.isArray(servers) && servers.length) {
        // Pick the first absolute http(s) server after variable substitution
        for (const srv of servers) {
          if (!srv || !srv.url) continue;
          let url: string = srv.url;
          if (typeof url !== 'string') continue;
          const vars = srv.variables || {};
          url = url.replace(/\{([^}]+)\}/g, (m, v) => {
            const def = vars[v]?.default || vars[v]?.enum?.[0];
            return def ?? v; // if no default, leave the var name (avoids collapsing slashes)
          });
          if (/^https?:\/\//i.test(url)) { candidate = url; break; }
        }
      }
      // OAS2: swagger: '2.0'
      if (!candidate && (spec.raw?.swagger === '2.0' || spec.deref?.swagger === '2.0')) {
        const root = spec.raw || spec.deref || {};
        if (root.host) {
          const scheme = Array.isArray(root.schemes) && root.schemes.length ? root.schemes[0] : 'https';
          const basePath = root.basePath || '';
          candidate = scheme + '://' + root.host + basePath;
        }
      }
      if (candidate && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
        setBaseURL(candidate);
        // Heuristic: if schemaURL is blank and candidate ends with /api or similar, try common openapi.json path; otherwise leave blank.
        setSchemaURL(prev => prev || (candidate.replace(/\/$/, '') + '/openapi.json'));
      }
    } catch {/* ignore */}
  }, [spec, userTouchedBase]);

  // Extract security scheme names from spec for dropdown
  useEffect(() => {
    if (!spec) { setAvailableSchemes([]); return; }
    try {
      const raw = spec.deref || spec.raw;
      const comps = raw?.components?.securitySchemes || {};
      const names = Object.keys(comps);
      setAvailableSchemes(names);
      // If current schemeName is default 'auth' and the spec has exactly one scheme, adopt it automatically
      if (schemeName === 'auth' && names.length === 1) setSchemeName(names[0]);
    } catch { setAvailableSchemes([]); }
  }, [spec]);

  // If auth type changes to bearer and current schemeName not in availableSchemes but there is a bearer-like scheme, pick first
  useEffect(() => {
    if (authType === 'bearer' && availableSchemes.length) {
      if (!availableSchemes.includes(schemeName)) {
        // look for bearer style scheme (http bearer or oauth2) heuristically by name
        const bearerCandidate = availableSchemes.find(s => /bearer|auth|token/i.test(s)) || availableSchemes[0];
        setSchemeName(bearerCandidate);
      }
    }
  }, [authType, availableSchemes, schemeName]);

  function generate() {
    let port: number | undefined;
    try {
      const u = new URL(sseServerURL);
      port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 8080);
    } catch { /* ignore */ }
    const cfg = { baseURL, schemaURL, serverName, port };
    onConfig(cfg);
    setCredStatus(null);
  }

  async function saveCredential() {
    setCredStatus('saving...');
    try {
      const entries: any[] = [];
      if (authType === 'bearer') {
        if (!token) { setCredStatus('token required'); return; }
        entries.push({ type:'bearer', scheme: schemeName, token });
      } else if (authType === 'api-key-header') {
        if (!apiKeyValue) { setCredStatus('key required'); return; }
        entries.push({ type:'api-key-header', scheme: schemeName, value: apiKeyValue, headerName: apiKeyHeaderName });
      } else if (authType === 'basic') {
        if (!basicUser || !basicPass) { setCredStatus('user/pass required'); return; }
        entries.push({ type:'basic', scheme: schemeName, username: basicUser, password: basicPass });
      } else if (authType === 'authorization-raw') {
        if (!rawAuthValue) { setCredStatus('value required'); return; }
        entries.push({ type:'authorization-raw', scheme: schemeName, token: rawAuthValue, headerName: apiKeyHeaderName });
      } else if (authType === 'custom-headers') {
        if (!customHeadersText.trim()) { setCredStatus('headers JSON required'); return; }
        let headersObj: any = {};
        try { headersObj = JSON.parse(customHeadersText); } catch { setCredStatus('bad JSON'); return; }
        entries.push({ type:'custom-headers', scheme: schemeName, headers: headersObj });
      }
      if (!entries.length) { setCredStatus('nothing to save'); return; }
  // Must match backend createMcpServer id logic: if serverName provided => oas_mcp_<sanitizedName>
  let cleanName = serverName.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const serverId = cleanName ? `oas_mcp_${cleanName}` : 'oas_mcp';
      const endpoint = sseServerURL.replace(/\/$/, '') + '/credentials';
  const resp = await fetch(endpoint, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ server: serverId, serverName, baseURL, schemaURL, entries }) });
      if (!resp.ok) { setCredStatus('error'); return; }
      setCredStatus('saved');
      try {
        if (onServerRegistered) {
          onServerRegistered({ id: serverId, name: serverName, baseURL, schemaURL, savedAt: Date.now() });
        }
      } catch {/* ignore callback errors */}
    } catch {
      setCredStatus('error');
    }
  }

  async function importEnvCreds() {
    setCredStatus('importing env...');
    try {
      const endpoint = sseServerURL.replace(/\/$/, '') + '/import-env-credentials';
      const resp = await fetch(endpoint, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ prefix: 'OAS_MCP_' }) });
      if (!resp.ok) { setCredStatus('env import error'); return; }
      const json = await resp.json();
      setCredStatus('imported: ' + (json.imported || []).join(','));
    } catch { setCredStatus('env import error'); }
  }

  return (
    <section style={secStyle}>
      <h2 style={h2Style}>2. Server Configuration</h2>
      <div style={grid}>
        <label style={labelStyle}>Base URL
          <input style={inputStyle} value={baseURL} onChange={e=>{ setBaseURL(e.target.value); setUserTouchedBase(true); }} placeholder="https://api.example.com" />
        </label>
        <label style={labelStyle}>Schema URL
          <input style={inputStyle} value={schemaURL} onChange={e=>setSchemaURL(e.target.value)} placeholder="https://api.example.com/openapi.json" />
        </label>
        <label style={labelStyle}>Server Name
          <input style={inputStyle} value={serverName} onChange={e=>setServerName(e.target.value)} placeholder="openapi" />
        </label>
        <label style={labelStyle}>SSE Server URL
          <input style={inputStyle} value={sseServerURL} onChange={e=>setSseServerURL(e.target.value)} placeholder="http://127.0.0.1:8080" />
        </label>
        <label style={labelStyle}>Auth Type
          <select style={inputStyle} value={authType} onChange={e=>setAuthType(e.target.value as any)}>
            <option value="none">none</option>
            <option value="bearer">Bearer Token</option>
            <option value="api-key-header">API Key (Header)</option>
            <option value="basic">Basic Auth</option>
            <option value="authorization-raw">Raw Authorization Header</option>
            <option value="custom-headers">Custom Headers (JSON)</option>
          </select>
        </label>
        <label style={labelStyle}>Scheme Name
          {availableSchemes.length > 0 ? (
            <select style={inputStyle} value={schemeName} onChange={e=>setSchemeName(e.target.value)}>
              {availableSchemes.map(s => <option key={s} value={s}>{s}</option>)}
              {!availableSchemes.includes(schemeName) && <option value={schemeName}>{schemeName}</option>}
            </select>
          ) : (
            <input style={inputStyle} value={schemeName} onChange={e=>setSchemeName(e.target.value)} placeholder="auth" />
          )}
        </label>
        {authType === 'bearer' && (
          <label style={labelStyle}>Token
            <input style={inputStyle} value={token} onChange={e=>setToken(e.target.value)} placeholder="sk_xxx" />
          </label>
        )}
        {authType === 'api-key-header' && (
          <>
            <label style={labelStyle}>Header Name
              <input style={inputStyle} value={apiKeyHeaderName} onChange={e=>setApiKeyHeaderName(e.target.value)} placeholder="X-API-Key" />
            </label>
            <label style={labelStyle}>API Key Value
              <input style={inputStyle} value={apiKeyValue} onChange={e=>setApiKeyValue(e.target.value)} placeholder="key" />
            </label>
          </>
        )}
        {authType === 'basic' && (
          <>
            <label style={labelStyle}>Username
              <input style={inputStyle} value={basicUser} onChange={e=>setBasicUser(e.target.value)} placeholder="user" />
            </label>
            <label style={labelStyle}>Password
              <input style={inputStyle} type="password" value={basicPass} onChange={e=>setBasicPass(e.target.value)} placeholder="pass" />
            </label>
          </>
        )}
        {authType === 'authorization-raw' && (
          <>
            <label style={labelStyle}>Header Name
              <input style={inputStyle} value={apiKeyHeaderName} onChange={e=>setApiKeyHeaderName(e.target.value)} placeholder="Authorization" />
            </label>
            <label style={labelStyle}>Header Value
              <input style={inputStyle} value={rawAuthValue} onChange={e=>setRawAuthValue(e.target.value)} placeholder="Bearer ... or custom" />
            </label>
          </>
        )}
        {authType === 'custom-headers' && (
          <label style={labelStyle}>Headers JSON
            <textarea style={inputStyle} rows={4} value={customHeadersText} onChange={e=>setCustomHeadersText(e.target.value)} placeholder='{"Authorization":"sk_...","X-Org":"123"}' />
          </label>
        )}
        <p style={{fontSize:'.6rem', opacity:.7, margin:0}}>Credentials saved server-side; nothing sensitive in URL.</p>
      </div>
      <div style={{display:'flex', gap:'.5rem', marginTop:'.75rem'}}>
  <button disabled={!spec} style={btnStyle(!spec)} onClick={generate}>Generate</button>
  <button disabled={authType!=='none' && authType==='bearer' && !token} style={btnStyle(authType!=='none' && authType==='bearer' && !token)} type="button" onClick={saveCredential}>Save Credential</button>
  <button disabled={!spec} style={btnStyle(!spec)} type="button" onClick={importEnvCreds}>Import .env</button>
  {credStatus && <span style={{fontSize:'.7rem'}}>{credStatus}</span>}
  {!spec && <p style={pStyle}>Upload or paste a spec to enable generation.</p>}
      </div>
    </section>
  );
};

// Auto-populate effect outside component body not allowed; place inside component above return

const secStyle: React.CSSProperties = { background:'#1b1f27', border:'1px solid #2a303c', padding:'1rem', borderRadius:8 };
const h2Style: React.CSSProperties = { margin:'0 0 .75rem', fontSize:'1rem', fontWeight:600 };
const grid: React.CSSProperties = { display:'grid', gap:'.75rem', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', marginBottom:'.5rem' };
const labelStyle: React.CSSProperties = { display:'flex', flexDirection:'column', gap:'.35rem', fontSize:'.75rem', textTransform:'uppercase', letterSpacing:'.05em' };
const inputStyle: React.CSSProperties = { padding:'.4rem .5rem', background:'#0f1115', border:'1px solid #2a303c', borderRadius:4, color:'#e5e7eb', fontSize:'.75rem' };
const pStyle: React.CSSProperties = { opacity:.8, fontSize:'.75rem', margin:'0.5rem 0 0' };
const btnStyle = (disabled:boolean): React.CSSProperties => ({ background: disabled ? '#374151' : '#10b981', color:'#fff', border:'1px solid ' + (disabled ? '#374151' : '#059669'), padding:'.5rem 1rem', borderRadius:4, fontSize:'.75rem', cursor: disabled? 'not-allowed':'pointer' });
