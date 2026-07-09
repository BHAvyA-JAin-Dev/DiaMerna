/* ===== DiaMerna — AI Health Companion Module ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.AIChat = (() => {

  const C = DiaMerna.CONSTANTS.AI;
  const Storage = DiaMerna.Storage;
  const Helpers = DiaMerna.Helpers;

  let conversationHistory = [];
  let isProcessing = false;

  function getApiKey() {
    return Storage.get(C.STORAGE_KEY) || '';
  }

  function saveApiKey(key) {
    return Storage.set(C.STORAGE_KEY, key.trim());
  }

  function loadConversation() {
    const saved = Storage.get('chatHistory');
    if (saved && Array.isArray(saved)) {
      conversationHistory = saved.slice(-20);
    } else {
      conversationHistory = [
        {
          role: 'system',
          content: C.SYSTEM_PROMPT
        }
      ];
    }
  }

  function saveConversation() {
    const toSave = conversationHistory.filter(m => m.role !== 'system').slice(-30);
    Storage.set('chatHistory', toSave);
  }

  function clearConversation() {
    conversationHistory = [{ role: 'system', content: C.SYSTEM_PROMPT }];
    saveConversation();
  }

  function addMessage(role, content) {
    conversationHistory.push({ role, content });
    if (conversationHistory.length > 30) {
      const system = conversationHistory[0];
      conversationHistory = [system, ...conversationHistory.slice(-25)];
    }
    saveConversation();
  }

  function renderMessage(content, role, container) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;

    if (role === 'ai') {
      const formatted = content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      div.innerHTML = formatted;
    } else {
      div.textContent = content;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function showLoading(container) {
    const div = document.createElement('div');
    div.className = 'chat-msg ai loading';
    div.id = 'chatLoading';
    div.innerHTML = '<span class="flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full bg-cyber-pink animate-pulse"></span> Thinking<span class="inline-block w-2 h-2 rounded-full bg-cyber-lavender animate-pulse" style="animation-delay:0.2s"></span><span class="inline-block w-2 h-2 rounded-full bg-cyber-mint animate-pulse" style="animation-delay:0.4s"></span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  async function sendMessage(message, chatContainer) {
    if (isProcessing) return;
    if (!message.trim()) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      renderMessage('Please save your OpenRouter API key first (paste it above and tap "Save Key").', 'ai', chatContainer);
      return;
    }

    isProcessing = true;
    const sanitizedMsg = Helpers.sanitizeString(message);

    renderMessage(sanitizedMsg, 'user', chatContainer);
    addMessage('user', sanitizedMsg);

    const loadingEl = showLoading(chatContainer);

    try {
      const messagesForApi = conversationHistory.slice(0, -1);
      messagesForApi.push({ role: 'user', content: sanitizedMsg });

      const response = await fetch(C.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'DiaMerna'
        },
        body: JSON.stringify({
          model: C.MODEL,
          messages: messagesForApi,
          max_tokens: C.MAX_TOKENS,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      const data = await response.json();

      loadingEl.remove();

      if (!response.ok) {
        let errorMsg = 'Something went wrong. ';
        if (data.error) {
          if (data.error.message) errorMsg += data.error.message;
          else errorMsg += JSON.stringify(data.error);
        } else {
          errorMsg += `HTTP ${response.status}. Check your API key or try again.`;
        }
        renderMessage(errorMsg, 'ai', chatContainer);
        isProcessing = false;
        return;
      }

      const reply = data.choices?.[0]?.message?.content;
      if (!reply) {
        renderMessage('The AI did not return a response. Please try again.', 'ai', chatContainer);
        isProcessing = false;
        return;
      }

      renderMessage(reply, 'ai', chatContainer);
      addMessage('assistant', reply);

    } catch (err) {
      loadingEl.remove();
      const isNetwork = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('NetworkError');
      const errorText = isNetwork
        ? 'Network error. Please check your internet connection and try again.'
        : `Error: ${err.message || 'Unknown error'}. Please try again.`;
      renderMessage(errorText, 'ai', chatContainer);
    }

    isProcessing = false;
  }

  function init() {
    const apiInput = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveApiKeyBtn');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const chatContainer = document.getElementById('chatMessages');

    const savedKey = getApiKey();
    if (savedKey) apiInput.value = savedKey;

    loadConversation();
    const savedMsgs = conversationHistory.filter(m => m.role !== 'system');
    savedMsgs.forEach(msg => {
      renderMessage(msg.content, msg.role === 'assistant' ? 'ai' : 'user', chatContainer);
    });

    saveBtn.addEventListener('click', () => {
      const key = apiInput.value.trim();
      if (!key) return;
      saveApiKey(key);
      saveBtn.textContent = '✅ Saved';
      saveBtn.style.borderColor = 'rgba(105,240,174,0.5)';
      setTimeout(() => {
        saveBtn.textContent = 'Save Key';
        saveBtn.style.borderColor = '';
      }, 2000);
    });

    async function handleSend() {
      const msg = chatInput.value.trim();
      if (!msg || isProcessing) return;
      chatInput.value = '';
      chatInput.disabled = true;
      await sendMessage(msg, chatContainer);
      chatInput.disabled = false;
      chatInput.focus();
    }

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'text-[10px] text-gray-500 hover:text-gray-300 ml-auto';
    clearBtn.textContent = 'Clear chat';
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear conversation history?')) {
        clearConversation();
        chatContainer.innerHTML = '';
        renderMessage('Hi! I\'m your DiaMerna AI assistant. Ask me anything about gestational diabetes, nutrition, or how to manage your blood sugar during pregnancy.', 'ai', chatContainer);
      }
    });

    const headerEl = document.querySelector('#tab-ai .glass-panel:first-child');
    if (headerEl) {
      const flexDiv = document.createElement('div');
      flexDiv.className = 'flex items-center justify-end mt-1';
      flexDiv.appendChild(clearBtn);
      headerEl.appendChild(flexDiv);
    }
  }

  return { init, sendMessage, clearConversation, getApiKey, saveApiKey };
})();

window.DiaMerna = DiaMerna;
