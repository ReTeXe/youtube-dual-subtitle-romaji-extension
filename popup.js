// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const enableRomaji = document.getElementById('enableRomaji');
  const useOfficial = document.getElementById('useOfficial');
  const apiKey = document.getElementById('apiKey');
  const secondSubtitleLang = document.getElementById('secondSubtitleLang');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Mevcut ayarları yükle
  chrome.storage.sync.get(
    ['enableRomaji', 'useOfficialKey', 'apiKey', 'secondSubtitleLang'],
    res => {
      enableRomaji.checked = res.enableRomaji !== undefined ? res.enableRomaji : true;
      useOfficial.checked = !!res.useOfficialKey;
      apiKey.value = res.apiKey || "";
      secondSubtitleLang.value = res.secondSubtitleLang || "en";
    }
  );

  // Kaydet butonu
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      enableRomaji: enableRomaji.checked,
      useOfficialKey: useOfficial.checked,
      apiKey: apiKey.value.trim(),
      secondSubtitleLang: secondSubtitleLang.value
    }, () => {
      status.textContent = 'Kaydedildi!';
      setTimeout(() => status.textContent = '', 1500);
    });
  });
});
