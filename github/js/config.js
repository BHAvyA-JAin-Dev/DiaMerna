/* ===== DiaMerna — App Configuration =====
   Loaded before all other scripts.
   For dev: real API key embedded.
   For github: replace with your own key.
   ========================================= */

window.DiaMerna = window.DiaMerna || {};
var Cfg = window.DiaMerna;

Cfg.API_KEY = '';
Cfg.MODEL  = 'nvidia/nemotron-3-super-120b-a12b:free';
Cfg.URL    = 'https://openrouter.ai/api/v1/chat/completions'; /* proxied through local server to avoid CORS */
Cfg.PROMPT = 'You are DiaMerna, an AI maternal wellness assistant. Keep ALL responses SHORT and direct (1-3 sentences max unless asked for detail). ' +
  'Provide practical, concise advice on gestational diabetes, blood sugar, diet, and pregnancy wellness. ' +
  'Always remind to consult a doctor for medical decisions. Never give emergency advice — direct to 911 or provider.';

/* --- Global aliases (modules reference these directly) --- */
var API_KEY   = Cfg.API_KEY;
var API_MODEL = Cfg.MODEL;
var API_URL   = Cfg.URL;
var AI_SYSTEM_PROMPT = Cfg.PROMPT;

