// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const enableRomaji = document.getElementById('enableRomaji');
  const useOfficial = document.getElementById('useOfficial');
  const apiKey = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  chrome.storage.sync.get(['enableRomaji','useOfficialKey','apiKey'], res => {
    enableRomaji.checked = res.enableRomaji !== undefined ? res.enableRomaji : true;
    useOfficial.checked = !!res.useOfficialKey;
    apiKey.value = res.apiKey || "";
  });

  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      enableRomaji: enableRomaji.checked,
      useOfficialKey: useOfficial.checked,
      apiKey: apiKey.value.trim()
    }, () => {
      status.textContent = 'Kaydedildi!';
      setTimeout(()=> status.textContent = '', 1500);
    });
  });
});