/* ===== DiaMerna — App Configuration =====
   BEFORE USING: set your own API key below.
   Get one free at https://openrouter.ai/keys
   ========================================= */

window.DiaMerna = window.DiaMerna || {};
var Cfg = window.DiaMerna;

Cfg.API_KEY = 'YOUR_OPENROUTER_API_KEY_HERE';
Cfg.MODEL  = 'nvidia/nemotron-3-super-120b-a12b:free';
Cfg.URL    = '/api/chat'; /* proxied through local server to avoid CORS */
/* SERVER_URL: where the persistent backend runs.
   Web (Vercel): same origin → points to Vercel API or PERSISTENT_SERVER_URL proxy
   Desktop EXE:  injected at runtime by main.js → 'http://127.0.0.1:5199' local proxy → remote server
   Mobile APK:   points to remote server (set at build time or via env)
   Change this to your server URL for production:
     Cfg.SERVER_URL = 'https://diamerna-api.onrender.com'; */
Cfg.SERVER_URL = ''; /* '' = same origin */
Cfg.PROMPT = 'You are DiaMerna, an AI maternal wellness assistant. Keep ALL responses SHORT and direct (1-3 sentences max unless asked for detail). ' +
  'Provide practical, concise advice on gestational diabetes, blood sugar, diet, and pregnancy wellness. ' +
  'Always remind to consult a doctor for medical decisions. Never give emergency advice — direct to 911 or provider.';

/* --- Global aliases (modules reference these directly) --- */
var API_KEY   = Cfg.API_KEY;
var API_MODEL = Cfg.MODEL;
var API_URL   = Cfg.URL;
var AI_SYSTEM_PROMPT = Cfg.PROMPT;
