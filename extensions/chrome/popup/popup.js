// PupilSafe AI — Extension popup status display

(function () {
  const pupilsafeEl = document.getElementById('pupilsafe-status');
  const aiEl = document.getElementById('ai-status');

  chrome.runtime.sendMessage({ type: 'STATUS_CHECK' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      pupilsafeEl.textContent = 'Error';
      aiEl.textContent = 'Error';
      return;
    }

    if (response.pupilsafeOpen) {
      pupilsafeEl.textContent = 'Connected';
      pupilsafeEl.className = 'status-value connected';
    } else {
      pupilsafeEl.textContent = 'Not open';
      pupilsafeEl.className = 'status-value disconnected';
    }

    if (response.aiTabOpen) {
      aiEl.textContent = 'Connected';
      aiEl.className = 'status-value connected';
    } else {
      aiEl.textContent = 'Not open';
      aiEl.className = 'status-value disconnected';
    }
  });
})();
