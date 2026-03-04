/**
 * PupilSafe Bridge — Content script injected into PupilSafe web app pages.
 * Bridges the Svelte web app and the Chrome extension background worker.
 */

// Signal to the Svelte app that the extension is installed.
function dispatchReady() {
  window.dispatchEvent(new CustomEvent('PUPILSAFE_EXTENSION_READY'));
}

dispatchReady();

// SPA may mount after this script runs, so re-dispatch after a short delay.
setTimeout(dispatchReady, 100);

// Register this tab with the background worker.
chrome.runtime.sendMessage({ type: 'REGISTER_PUPILSAFE' });

// Listen for prompt sends from the Svelte app.
window.addEventListener('PUPILSAFE_SEND_PROMPT', (event) => {
  const prompt = event.detail?.prompt;
  if (!prompt) return;

  // Belt-and-braces clipboard write (the web app already does this).
  navigator.clipboard.writeText(prompt).catch(() => {});

  // Forward the prompt to the background worker.
  chrome.runtime.sendMessage({ type: 'PROMPT_READY', prompt });
});

// Listen for captured AI responses from the background worker.
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'RESPONSE_CAPTURED') return;

  // Dispatch the response to the Svelte app.
  window.dispatchEvent(
    new CustomEvent('PUPILSAFE_RESPONSE_RECEIVED', {
      detail: { response: message.response },
    })
  );

  // Acknowledge receipt to the background worker.
  chrome.runtime.sendMessage({ type: 'RESPONSE_RECEIVED' });
});
