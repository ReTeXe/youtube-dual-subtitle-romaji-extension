// content.js
(function () {
  "use strict";

  const kanaMap = {
    "きゃ": "kya","きゅ": "kyu","きょ": "kyo","ぎゃ": "gya","ぎゅ": "gyu","ぎょ": "gyo",
    "しゃ": "sha","しゅ": "shu","しょ": "sho","じゃ": "ja","じゅ": "ju","じょ": "jo",
    "ちゃ": "cha","ちゅ": "chu","ちょ": "cho","にゃ": "nya","にゅ": "nyu","にょ": "nyo",
    "あ": "a","い": "i","う": "u","え": "e","お": "o",
    "か": "ka","き": "ki","く": "ku","け": "ke","こ": "ko",
    "が": "ga","ぎ": "gi","ぐ": "gu","げ": "ge","ご": "go",
    "さ": "sa","し": "shi","す": "su","せ": "se","そ": "so",
    "た": "ta","ち": "chi","つ": "tsu","て": "te","と": "to",
    "な": "na","に": "ni","ぬ": "nu","ね": "ne","の": "no",
    "は": "ha","ひ": "hi","ふ": "fu","へ": "he","ほ": "ho",
    "ま": "ma","み": "mi","む": "mu","め": "me","も": "mo",
    "や": "ya","ゆ": "yu","よ": "yo","ら": "ra","り": "ri","る": "ru","れ": "re","ろ": "ro",
    "わ": "wa","を": "o","ん": "n",
    "ぁ": "a","ぃ": "i","ぅ": "u","ぇ": "e","ぉ": "o",
    "ゃ": "ya","ゅ": "yu","ょ": "yo","っ": "ltsu","ー": "-"
  };

  function kataToHira(text) {
    return text.replace(/[\u30A1-\u30F6]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  function normalize(s) {
    return s.replace(/[「」『』（）\[\]【】]/g, "").trim();
  }

  function kanaToRomaji(input) {
    if (!input) return "";
    let s = kataToHira(input);
    s = normalize(s);

    let out = "";
    for (let i = 0; i < s.length; i++) {
      const two = s.substr(i, 2);
      const one = s.charAt(i);

      if (kanaMap[two]) {
        out += kanaMap[two];
        i += 1;
        continue;
      }

      if (one === "っ") {
        const next = s.charAt(i + 1) || "";
        const nextTwo = s.substr(i + 1, 2);
        const nextRom = kanaMap[nextTwo] || kanaMap[next] || "";
        if (nextRom) out += nextRom[0];
        continue;
      }

      out += kanaMap[one] || one;
    }

    return out.replace(/ltsu/g, "").replace(/\s+/g, " ").trim();
  }

  function hasKana(s) {
    return /[\u3040-\u309F\u30A0-\u30FF]/.test(s);
  }

  function createEl(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  let settings = {
    enableRomaji: true,
    secondSubtitleLang: "en"
  };

  let cache = {};
  let lastSeenText = new WeakMap();

  function sendMessageAsync(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("sendMessage error:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    });
  }

  function cacheKey(original) {
    return `${settings.secondSubtitleLang}|${settings.enableRomaji ? 1 : 0}|${original}`;
  }

  function processSegment(seg, force = false) {
    if (!seg) return;

    const hasCustomLines = !!seg.querySelector(".second-line, .romaji-line");
    if (!force && hasCustomLines) return;

    const liveText = (seg.textContent || "").trim();
    const original = force && seg.dataset.jrmOriginal ? seg.dataset.jrmOriginal : liveText;
    if (!original) return;

    if (!force) {
      const prev = lastSeenText.get(seg);
      if (prev === original) return;
      lastSeenText.set(seg, original);
    }

    const key = cacheKey(original);
    if (cache[key]) {
      render(seg, cache[key], original);
      return;
    }

    // kendi çıktımızı temizle ama orijinali dataset'te sakla
    seg.dataset.jrmOriginal = original;
    while (seg.firstChild) seg.removeChild(seg.firstChild);

    const translatePromise = sendMessageAsync({
      action: "translate",
      text: original,
      targetLang: settings.secondSubtitleLang
    });

    const romajiPromise = settings.enableRomaji
      ? sendMessageAsync({
          action: "getRomaji",
          text: original
        })
      : Promise.resolve({ romaji: "" });

    Promise.all([translatePromise, romajiPromise])
      .then(([trResp, rmResp]) => {
        const secondLangText =
          (trResp && (trResp.text || trResp.en || trResp.tr)) || "";

        let rom = (rmResp && rmResp.romaji) ? rmResp.romaji.trim() : "";

        if (rom.toLowerCase() === "ja" || rom.length <= 2) {
          rom = "";
        }

        if (settings.enableRomaji) {
          if (!rom && hasKana(original)) {
            rom = kanaToRomaji(original);
          }

          if (!rom) {
            const kanaChunks = (original.match(/[\u3040-\u309F\u30A0-\u30FF]+/g) || []).join(" ");
            if (kanaChunks) rom = kanaToRomaji(kanaChunks);
          }
        } else {
          rom = "";
        }

        const result = {
          secondLang: secondLangText || "",
          romaji: rom || ""
        };

        cache[key] = result;
        render(seg, result, original);
      })
      .catch((err) => {
        console.error("segment processing error", err);
      });
  }

  function render(seg, data, original) {
    if (!seg || !document.body.contains(seg)) return;

    while (seg.firstChild) seg.removeChild(seg.firstChild);
    seg.dataset.jrmOriginal = original || seg.dataset.jrmOriginal || "";

    if (data.secondLang && data.secondLang.trim() !== "") {
      seg.appendChild(createEl("div", "second-line", data.secondLang));
    }

    if (data.romaji && data.romaji.trim() !== "") {
      seg.appendChild(createEl("div", "romaji-line", data.romaji));
    }
  }

  function refreshAllSegments() {
    cache = {};
    lastSeenText = new WeakMap();

    document.querySelectorAll(".ytp-caption-segment").forEach((seg) => {
      if (seg.dataset.jrmOriginal) {
        processSegment(seg, true);
      } else {
        processSegment(seg);
      }
    });
  }

  chrome.storage.sync.get(["enableRomaji", "secondSubtitleLang"], (res) => {
    settings.enableRomaji = res.enableRomaji !== undefined ? res.enableRomaji : true;
    settings.secondSubtitleLang = res.secondSubtitleLang || "en";
    refreshAllSegments();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    if (changes.enableRomaji) {
      settings.enableRomaji = changes.enableRomaji.newValue !== undefined
        ? changes.enableRomaji.newValue
        : true;
    }

    if (changes.secondSubtitleLang) {
      settings.secondSubtitleLang = changes.secondSubtitleLang.newValue || "en";
    }

    refreshAllSegments();
  });

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.classList && node.classList.contains("ytp-caption-segment")) {
          processSegment(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll(".ytp-caption-segment").forEach((s) => processSegment(s));
        }
      }

      if (m.type === "characterData" && m.target && m.target.parentElement) {
        const parent = m.target.parentElement;
        if (parent.classList && parent.classList.contains("ytp-caption-segment")) {
          processSegment(parent);
        }
      }
    }
  });

  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  setTimeout(() => {
    document.querySelectorAll(".ytp-caption-segment").forEach((s) => processSegment(s));
  }, 700);
})();
