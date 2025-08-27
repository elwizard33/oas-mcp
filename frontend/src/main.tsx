import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './modules/App';
import { Buffer } from 'buffer';

// Ensure Buffer is globally available for libs expecting Node environment
// (swagger-parser transitively uses Buffer in some code paths)
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;

createRoot(document.getElementById('root')!).render(<App />);
