/**
 * PupilSafe AI Panel — Content script for AI provider pages.
 *
 * Creates a floating, draggable panel inside a Shadow DOM to avoid
 * style collisions with the host page.  Communicates with the
 * background service worker via chrome.runtime messages.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Prevent double-injection                                          */
  /* ------------------------------------------------------------------ */
  if (document.getElementById('pupilsafe-panel-host')) return;

  /* ------------------------------------------------------------------ */
  /*  State                                                             */
  /* ------------------------------------------------------------------ */
  let panelState = 'idle';          // 'idle' | 'prompt-ready' | 'capture' | 'sent'
  let storedPrompt = '';
  let errorTimeout = null;
  let autoMinTimeout = null;

  /* ------------------------------------------------------------------ */
  /*  Shadow DOM host                                                   */
  /* ------------------------------------------------------------------ */
  const host = document.createElement('div');
  host.id = 'pupilsafe-panel-host';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  /* ------------------------------------------------------------------ */
  /*  Styles (injected into the shadow root)                            */
  /* ------------------------------------------------------------------ */
  const style = document.createElement('style');
  style.textContent = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  user-select: none;
  transition: all 0.2s ease;
}

.panel.minimised {
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 24px;
}

.panel.expanded {
  width: 320px;
}

.pill-text {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  cursor: grab;
  background: #f9fafb;
}

.header:active { cursor: grabbing; }

.title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.minimise-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #6b7280;
  padding: 0 4px;
  line-height: 1;
}

.minimise-btn:hover { color: #111827; }

.body {
  padding: 20px 16px;
  text-align: center;
}

.status-icon {
  font-size: 32px;
  margin: 0 0 8px;
}

.status-text {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.instruction {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px;
  line-height: 1.5;
}

.sub-instruction {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 16px;
}

.or-text {
  font-size: 12px;
  color: #9ca3af;
  margin: 8px 0;
}

.btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary {
  background: #22c55e;
  color: #fff;
}

.btn-primary:hover { background: #16a34a; }

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover { background: #e5e7eb; }

.error-text {
  font-size: 12px;
  color: #ef4444;
  margin: 8px 0 0;
}

.ready-btn {
  margin-top: 8px;
}
`;
  shadow.appendChild(style);

  /* ------------------------------------------------------------------ */
  /*  Panel container                                                   */
  /* ------------------------------------------------------------------ */
  const panel = document.createElement('div');
  panel.className = 'panel minimised';
  shadow.appendChild(panel);

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                         */
  /* ------------------------------------------------------------------ */

  function render() {
    panel.innerHTML = '';

    switch (panelState) {
      case 'idle':
        renderIdle();
        break;
      case 'prompt-ready':
        renderPromptReady();
        break;
      case 'capture':
        renderCapture();
        break;
      case 'sent':
        renderSent();
        break;
    }
  }

  /* --- idle (minimised pill) --- */
  function renderIdle() {
    panel.className = 'panel minimised';
    const pill = document.createElement('span');
    pill.className = 'pill-text';
    pill.textContent = 'PupilSafe \u00B7 Connected';
    panel.appendChild(pill);

    panel.addEventListener('click', expand, { once: true });
  }

  /* --- prompt-ready --- */
  function renderPromptReady() {
    panel.className = 'panel expanded';
    panel.appendChild(buildHeader());

    const body = document.createElement('div');
    body.className = 'body';

    const icon = document.createElement('p');
    icon.className = 'status-icon';
    icon.textContent = '\u2705';
    body.appendChild(icon);

    const status = document.createElement('p');
    status.className = 'status-text';
    status.textContent = 'Prompt copied to clipboard!';
    body.appendChild(status);

    const instruction = document.createElement('p');
    instruction.className = 'instruction';
    instruction.innerHTML = 'Paste it into the chat below<br>(Ctrl+V / \u2318V)';
    body.appendChild(instruction);

    const sub = document.createElement('p');
    sub.className = 'sub-instruction';
    sub.textContent = 'Then wait for the AI to respond.';
    body.appendChild(sub);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary ready-btn';
    btn.textContent = "I'm ready to send the response back";
    btn.addEventListener('click', function () {
      setState('capture');
    });
    body.appendChild(btn);

    panel.appendChild(body);
  }

  /* --- capture --- */
  function renderCapture() {
    panel.className = 'panel expanded';
    panel.appendChild(buildHeader());

    const body = document.createElement('div');
    body.className = 'body';

    const instruction = document.createElement('p');
    instruction.className = 'instruction';
    instruction.textContent = "Select the AI's response text, then:";
    body.appendChild(instruction);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-primary';
    sendBtn.textContent = 'Send response to PupilSafe';
    sendBtn.addEventListener('click', handleSelectionCapture);
    body.appendChild(sendBtn);

    const or = document.createElement('p');
    or.className = 'or-text';
    or.textContent = 'Or copy it first, then:';
    body.appendChild(or);

    const clipBtn = document.createElement('button');
    clipBtn.className = 'btn btn-secondary';
    clipBtn.textContent = 'Use clipboard instead';
    clipBtn.addEventListener('click', handleClipboardCapture);
    body.appendChild(clipBtn);

    panel.appendChild(body);
  }

  /* --- sent --- */
  function renderSent() {
    panel.className = 'panel expanded';
    panel.appendChild(buildHeader());

    const body = document.createElement('div');
    body.className = 'body';

    const icon = document.createElement('p');
    icon.className = 'status-icon';
    icon.textContent = '\u2705';
    body.appendChild(icon);

    const status = document.createElement('p');
    status.className = 'status-text';
    status.textContent = 'Sent to PupilSafe!';
    body.appendChild(status);

    const instruction = document.createElement('p');
    instruction.className = 'instruction';
    instruction.textContent = 'Switch back to de-anonymise.';
    body.appendChild(instruction);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Open PupilSafe tab';
    btn.addEventListener('click', function () {
      chrome.runtime.sendMessage({ type: 'FOCUS_PUPILSAFE_TAB' });
    });
    body.appendChild(btn);

    panel.appendChild(body);

    // Auto-minimise after 3 seconds
    clearTimeout(autoMinTimeout);
    autoMinTimeout = setTimeout(function () {
      setState('idle');
    }, 3000);
  }

  /* ------------------------------------------------------------------ */
  /*  Shared UI builders                                                */
  /* ------------------------------------------------------------------ */

  function buildHeader() {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'PupilSafe';
    header.appendChild(title);

    const minBtn = document.createElement('button');
    minBtn.className = 'minimise-btn';
    minBtn.textContent = '\u2212';
    minBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setState('idle');
    });
    header.appendChild(minBtn);

    // Draggable via header
    initDrag(header);

    return header;
  }

  function showError(message) {
    // Find or create error element inside the body
    let body = panel.querySelector('.body');
    if (!body) return;

    // Remove existing error
    let existing = body.querySelector('.error-text');
    if (existing) existing.remove();

    const err = document.createElement('p');
    err.className = 'error-text';
    err.textContent = message;
    body.appendChild(err);

    clearTimeout(errorTimeout);
    errorTimeout = setTimeout(function () {
      if (err.parentNode) err.remove();
    }, 3000);
  }

  /* ------------------------------------------------------------------ */
  /*  State management                                                  */
  /* ------------------------------------------------------------------ */

  function setState(newState) {
    clearTimeout(autoMinTimeout);
    panelState = newState;
    render();
  }

  function expand() {
    // Re-expand to the last meaningful expanded state
    if (panelState === 'idle') {
      // If we had a prompt waiting, go to prompt-ready; otherwise just show capture
      setState(storedPrompt ? 'prompt-ready' : 'capture');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Capture handlers                                                  */
  /* ------------------------------------------------------------------ */

  function handleSelectionCapture() {
    const text = window.getSelection().toString().trim();
    if (!text) {
      showError('No text selected. Try selecting the response again, or use the clipboard button.');
      return;
    }
    sendResponse(text);
  }

  function handleClipboardCapture() {
    navigator.clipboard.readText().then(function (text) {
      if (!text || !text.trim()) {
        showError('Clipboard is empty. Please copy the response first.');
        return;
      }
      sendResponse(text.trim());
    }).catch(function () {
      showError('Clipboard access denied. Please select the text instead.');
    });
  }

  function sendResponse(text) {
    chrome.runtime.sendMessage({ type: 'RESPONSE_CAPTURED', response: text });
    setState('sent');
  }

  /* ------------------------------------------------------------------ */
  /*  Dragging                                                          */
  /* ------------------------------------------------------------------ */

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function initDrag(headerEl) {
    headerEl.addEventListener('mousedown', onDragStart);
  }

  function onDragStart(e) {
    // Only left-click
    if (e.button !== 0) return;
    e.preventDefault();

    isDragging = true;
    const rect = host.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging) return;

    let x = e.clientX - dragOffsetX;
    let y = e.clientY - dragOffsetY;

    // Clamp to viewport
    const rect = host.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    host.style.left = x + 'px';
    host.style.top = y + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);

    // Persist position
    const rect = host.getBoundingClientRect();
    chrome.storage.local.set({
      panelPosition: { left: rect.left, top: rect.top }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Positioning                                                       */
  /* ------------------------------------------------------------------ */

  function applyDefaultPosition() {
    host.style.position = 'fixed';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647';
  }

  function applySavedPosition(pos) {
    host.style.position = 'fixed';
    host.style.left = pos.left + 'px';
    host.style.top = pos.top + 'px';
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.style.zIndex = '2147483647';
  }

  function loadPosition() {
    applyDefaultPosition();
    chrome.storage.local.get('panelPosition', function (result) {
      if (result && result.panelPosition) {
        applySavedPosition(result.panelPosition);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Message handling                                                  */
  /* ------------------------------------------------------------------ */

  chrome.runtime.onMessage.addListener(function (message) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'PROMPT_READY':
        storedPrompt = message.prompt || '';
        setState('prompt-ready');
        break;

      case 'RESPONSE_RECEIVED':
        // Confirmation that PupilSafe got the response — no state change needed
        break;
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                    */
  /* ------------------------------------------------------------------ */

  // Register this tab with the background service worker
  chrome.runtime.sendMessage({ type: 'REGISTER_AI_TAB' });

  // Position and render
  loadPosition();
  render();
})();
