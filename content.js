// content.js
(function(){
  'use strict';

  // Kana->Romaji (aynı veya daha önce kullandığın fonksiyon)
  const kanaMap = {
    'きゃ':'kya','きゅ':'kyu','きょ':'kyo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
    'しゃ':'sha','しゅ':'shu','しょ':'sho','じゃ':'ja','じゅ':'ju','じょ':'jo',
    'ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo',
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'o','ん':'n',
    'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
    'ゃ':'ya','ゅ':'yu','ょ':'yo','っ':'ltsu','ー':'-'
  };

  function kataToHira(text){ return text.replace(/[\u30A1-\u30F6]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0x60)); }
  function normalize(s){ return s.replace(/[「」『』（）\[\]【】]/g,'').trim(); }

  function kanaToRomaji(input){
    if (!input) return "";
    let s = kataToHira(input);
    s = normalize(s);
    let out = "";
    for (let i=0;i<s.length;i++){
      const two = s.substr(i,2);
      const one = s.charAt(i);
      if (kanaMap[two]) { out += kanaMap[two]; i+=1; continue; }
      if (one === 'っ') {
        const next = s.charAt(i+1) || '';
        let nextRom = '';
        const nextTwo = s.substr(i+1,2);
        if (kanaMap[nextTwo]) nextRom = kanaMap[nextTwo];
        else if (kanaMap[next]) nextRom = kanaMap[next];
        if (nextRom && nextRom[0]) out += nextRom[0];
        continue;
      }
      if (kanaMap[one]) { out += kanaMap[one]; continue; }
      out += one;
    }
    out = out.replace(/ltsu/g,'');
    out = out.replace(/\s+/g,' ').trim();
    return out;
  }

  function hasKana(s){ return /[\u3040-\u309F\u30A0-\u30FF]/.test(s); }

  function createEl(t,cls,txt){ const e=document.createElement(t); if(cls) e.className=cls; if(txt!==undefined) e.textContent=txt; return e; }

  const processed = new WeakSet();
  const cache = {}; // original -> {tr, romaji}

  function processSegment(seg){
    if (!seg || processed.has(seg)) return;
    const original = (seg.textContent||"").trim();
    if (!original) return;

    // kullanıcıya orijinali göstermemek için hemen temizle
    while (seg.firstChild) seg.removeChild(seg.firstChild);
    // geçici placeholder
    seg.appendChild(createEl('div','tr-line',''));

    if (cache[original]) {
      render(seg, cache[original]);
      processed.add(seg);
      return;
    }

    // parallel: TR ve (yalnız Kanji durumunda) RM iste
    const trP = new Promise(res => {
      chrome.runtime.sendMessage({ action: 'translate', text: original }, (r) => res(r && r.tr ? r.tr : ""));
    });

    const rmP = new Promise(res => {
      // remote romaji iste only if kanji present — ama yine iste; background'da 'ja' dönerse reddedecek
      chrome.runtime.sendMessage({ action: 'getRomaji', text: original }, (r) => res(r && r.romaji ? r.romaji : ""));
    });

    Promise.all([trP, rmP]).then(([trText, remoteRom])=>{
      let rom = (remoteRom || "").trim();

      // Eğer remoteRom sadece 'ja' gibi kısaysa veya boşsa, bunu reddet
      if (rom.toLowerCase() === 'ja' || rom.length <= 2) {
        console.debug("Remote romaji rejected (short/lang code):", rom);
        rom = "";
      }

      // Eğer rom yok ve metinde kana varsa, yerelde üret
      if (!rom && hasKana(original)) {
        rom = kanaToRomaji(original);
        console.debug("Fallback kana->romaji:", rom);
      }

      // Eğer rom halen yok ama metinde kana parçaları varsa onları birleştir
      if (!rom) {
        const kanaChunks = (original.match(/[\u3040-\u309F\u30A0-\u30FF]+/g) || []).join(' ');
        if (kanaChunks) rom = kanaToRomaji(kanaChunks);
      }

      const result = { tr: trText || "", romaji: rom || "" };
      cache[original] = result;
      render(seg, result);
      processed.add(seg);
    }).catch(err=>{
      console.error("segment processing error", err);
      // fallback: TR only
      chrome.runtime.sendMessage({ action: 'translate', text: original }, (r) => {
        const resObj = { tr: (r && r.tr) ? r.tr : "", romaji: "" };
        cache[original] = resObj;
        render(seg, resObj);
        processed.add(seg);
      });
    });
  }

  function render(seg, data){
    if (!seg || !document.body.contains(seg)) return;
    while (seg.firstChild) seg.removeChild(seg.firstChild);
    if (data.tr && data.tr.trim() !== "") seg.appendChild(createEl('div','tr-line', data.tr));
    if (data.romaji && data.romaji.trim() !== "") seg.appendChild(createEl('div','romaji-line', data.romaji));
  }

  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.classList && node.classList.contains('ytp-caption-segment')) processSegment(node);
        else if (node.querySelectorAll) {
          const segs = node.querySelectorAll('.ytp-caption-segment');
          segs.forEach(s => processSegment(s));
        }
      }
      if (m.type === 'characterData' && m.target && m.target.parentElement) {
        const parent = m.target.parentElement;
        if (parent.classList && parent.classList.contains('ytp-caption-segment')) processSegment(parent);
      }
    }
  });

  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  // initial
  setTimeout(()=> { document.querySelectorAll('.ytp-caption-segment').forEach(s=>processSegment(s)); }, 700);

})();