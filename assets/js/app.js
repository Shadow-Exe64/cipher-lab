/* Cipher Lab — UI layer. All cipher logic lives in cipher.js. */
(function () {
  'use strict';

  const C = window.CipherCore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORE = 'cipherlab.v1';
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const STEP_DEG = 360 / 26;

  /* ------------------------------------------------------------------ state */
  const state = { mode: 'encrypt', method: 'caesar', key: 3, keyword: 'SECRET', digits: false, deliverables: {} };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
      if (['encrypt', 'decrypt'].includes(saved.mode)) state.mode = saved.mode;
      if (['caesar', 'vigenere', 'atbash'].includes(saved.method)) state.method = saved.method;
      if (Number.isInteger(saved.key) && saved.key >= 1 && saved.key <= 25) state.key = saved.key;
      if (typeof saved.keyword === 'string') state.keyword = saved.keyword.slice(0, 40);
      state.digits = !!saved.digits;
      if (saved.deliverables && typeof saved.deliverables === 'object') state.deliverables = saved.deliverables;
    } catch (e) { /* storage unavailable: run with defaults */ }
  }
  function saveState() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- helpers */
  function toast(message) {
    const region = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  async function copyText(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) { /* ignore */ }
      ta.remove();
    }
    toast(okMessage || 'Copied to clipboard');
  }

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ------------------------------------------------------------------ theme */
  function currentTheme() {
    return document.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  $('#theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cipherlab.theme', next); } catch (e) { /* ignore */ }
  });

  /* ------------------------------------------------------------------- tabs */
  const tabs = $$('.tab');
  function showTab(name, focus) {
    if (!['workbench', 'attack', 'learn'].includes(name)) name = 'workbench';
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    ['workbench', 'attack', 'learn'].forEach((id) => { $('#' + id).hidden = id !== name; });
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0 });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      showTab(next.dataset.tab, true);
    });
  });
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

  /* -------------------------------------------------------------- workbench */
  const els = {
    input: $('#input'), output: $('#output'), error: $('#error'), badge: $('#verify-badge'),
    stats: $('#stats'), range: $('#shift-range'), rangeOut: $('#shift-out'), keyword: $('#keyword'),
    digits: $('#digits'),
  };

  const SAMPLES = [
    'Meet me at the library at 5 pm. Bring the notes!',
    'The quick brown fox jumps over the lazy dog.',
    'Confidentiality means only the right people can read the data.',
    'Attack at dawn, but keep the plan secret until then.',
  ];
  let sampleIdx = 0;

  function run(text, mode) {
    const decrypt = mode === 'decrypt';
    if (state.method === 'caesar') return C.caesar(text, state.key, { decrypt, digits: state.digits });
    if (state.method === 'vigenere') return C.vigenere(text, state.keyword, { decrypt });
    return C.atbash(text);
  }
  const opposite = (mode) => (mode === 'encrypt' ? 'decrypt' : 'encrypt');

  function lastLetterInfo(text) {
    let count = 0; let last = null;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { count++; last = ch.toUpperCase(); }
    }
    return last ? { ch: last, idx: last.charCodeAt(0) - 65, position: count } : null;
  }

  function updateWorkbench() {
    const text = els.input.value;
    let out = '';
    let err = '';
    try { out = run(text, state.mode); } catch (e) { err = e.message; }

    // labels + pressed states
    $('#input-label').textContent = state.mode === 'encrypt' ? 'Your message' : 'Ciphertext to decode';
    $('#output-label').textContent = state.mode === 'encrypt' ? 'Ciphertext' : 'Recovered message';
    els.input.placeholder = state.mode === 'encrypt' ? 'Type or paste text here…' : 'Paste ciphertext here…';
    $$('#mode-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    $$('#method-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.method === state.method)));
    $('#key-caesar').hidden = state.method !== 'caesar';
    $('#key-vigenere').hidden = state.method !== 'vigenere';
    $('#key-atbash').hidden = state.method !== 'atbash';
    els.rangeOut.textContent = state.key;

    // output + verification
    els.error.hidden = !err;
    els.error.textContent = err;
    els.output.textContent = err ? '' : out;
    const buttons = ['#btn-copy', '#btn-swap', '#btn-download'].map((s) => $(s));
    buttons.forEach((b) => { b.disabled = !!err || !out; });

    if (!err && text) {
      let ok = false;
      try { ok = run(out, opposite(state.mode)) === text; } catch (e) { ok = false; }
      els.badge.hidden = false;
      els.badge.className = 'badge ' + (ok ? 'ok' : 'bad');
      els.badge.textContent = ok ? 'Round trip verified' : 'Round trip failed';
      const total = Array.from(text).length;
      const letters = (text.match(/[A-Za-z]/g) || []).length;
      const digitCount = state.method === 'caesar' && state.digits ? (text.match(/[0-9]/g) || []).length : 0;
      const changed = letters + digitCount;
      els.stats.textContent = `${total} characters · ${changed} transformed · ${total - changed} kept as is`;
    } else {
      els.badge.hidden = true;
      els.stats.textContent = '';
    }

    renderSteps(err);
    renderWheel();
    saveState();
  }

  /* ---- step-by-step table ---- */
  function renderSteps(err) {
    const head = $('#steps-table thead');
    const body = $('#steps-table tbody');
    head.textContent = ''; body.textContent = '';
    const chars = Array.from(els.input.value);
    const LIMIT = 14;

    if (err || !chars.length) {
      $('#steps-note').textContent = '';
      const tr = el('tr'); const td = el('td', { colspan: 7 }, err ? 'Fix the key above to see the steps.' : 'Type something to see each character travel through the pipeline.');
      td.className = 'muted'; tr.appendChild(td); body.appendChild(tr);
      return;
    }

    const isAtbash = state.method === 'atbash';
    const cols = isAtbash
      ? ['Character', 'ASCII', '− base', '25 − x', '+ base', 'Result']
      : ['Character', 'ASCII', '− base', '+ key', 'mod 26', '+ base', 'Result'];
    const hr = el('tr'); cols.forEach((c) => hr.appendChild(el('th', null, c))); head.appendChild(hr);

    let shifts = [];
    if (state.method === 'vigenere') { try { shifts = C.keywordShifts(state.keyword); } catch (e) { shifts = [0]; } }
    const kwLetters = state.keyword.replace(/[^A-Za-z]/g, '').toUpperCase();
    const decrypt = state.mode === 'decrypt';
    let letterPos = 0;

    chars.slice(0, LIMIT).forEach((ch) => {
      const code = ch.codePointAt(0);
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const tr = el('tr');
      const shown = ch === ' ' ? '␣' : ch;
      const chCell = el('td', { class: 'ch' }, shown); tr.appendChild(chCell);
      tr.appendChild(el('td', null, String(code)));

      if (isLetter) {
        let keyShift = state.key;
        let keyLetter = '';
        if (state.method === 'vigenere') {
          keyShift = shifts[letterPos % shifts.length];
          keyLetter = kwLetters[letterPos % kwLetters.length] || '';
        }
        letterPos++;
        if (isAtbash) {
          const base = code <= 90 ? 65 : 97;
          const x = code - base;
          tr.appendChild(el('td', null, String(x)));
          tr.appendChild(el('td', null, String(25 - x)));
          tr.appendChild(el('td', null, '+ ' + base));
          tr.appendChild(el('td', { class: 'res' }, String.fromCharCode(25 - x + base)));
        } else {
          const t = C.trace(ch, keyShift, { decrypt });
          tr.appendChild(el('td', null, String(t.offset)));
          const keyCell = el('td', null, `${t.raw}`);
          const sign = decrypt ? '−' : '+';
          keyCell.title = `${t.offset} ${sign} ${keyShift}${keyLetter ? ' (key letter ' + keyLetter + ')' : ''}`;
          if (keyLetter) keyCell.appendChild(el('small', { class: 'muted' }, ` (${sign}${keyShift}, ${keyLetter})`));
          else keyCell.appendChild(el('small', { class: 'muted' }, ` (${sign}${keyShift})`));
          tr.appendChild(keyCell);
          const modCell = el('td', null, String(t.wrapped));
          if (t.didWrap) { modCell.textContent = ''; modCell.appendChild(el('span', { class: 'wrap', title: 'Wrapped around the alphabet' }, `${t.wrapped} ↻`)); }
          tr.appendChild(modCell);
          tr.appendChild(el('td', null, String(t.finalAscii)));
          tr.appendChild(el('td', { class: 'res' }, t.result));
        }
      } else if (state.method === 'caesar' && state.digits && code >= 48 && code <= 57) {
        const k = decrypt ? -state.key : state.key;
        const res = String(C.mod(code - 48 + k, 10));
        const td = el('td', { colspan: 4 }, `digit: (${ch} ${decrypt ? '−' : '+'} ${state.key}) mod 10`); td.className = 'muted';
        tr.appendChild(td); tr.appendChild(el('td', { class: 'res' }, res));
        if (isAtbash) tr.lastChild.remove();
      } else {
        const td = el('td', { colspan: isAtbash ? 4 : 5 }, 'not a letter, kept as is');
        tr.appendChild(td); tr.classList.add('skipped');
      }
      body.appendChild(tr);
    });
    $('#steps-note').textContent = chars.length > LIMIT ? `Showing the first ${LIMIT} of ${chars.length} characters` : '';
  }

  /* ---- cipher wheel ---- */
  const wheel = { outer: [], inner: [], innerGroup: null, hubNum: null, hubSub: null, ready: false };

  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function makeCell(letter, index, radius, cls) {
    const g = svgEl('g', { class: 'w-cell', transform: `rotate(${index * STEP_DEG} 160 160)` });
    g.appendChild(svgEl('circle', { class: 'hit-bg', cx: 160, cy: 160 - radius, r: 10.5 }));
    const t = svgEl('text', { class: cls + (index === 0 ? ' is-a' : ''), x: 160, y: 160 - radius });
    t.textContent = letter;
    g.appendChild(t);
    return { g, t };
  }

  function buildWheel() {
    const svg = $('#wheel');
    svg.appendChild(svgEl('circle', { class: 'band-outer', cx: 160, cy: 160, r: 152 }));
    svg.appendChild(svgEl('circle', { class: 'band-inner', cx: 160, cy: 160, r: 121 }));
    svg.appendChild(svgEl('circle', { class: 'hub', cx: 160, cy: 160, r: 86 }));
    [152, 121, 86].forEach((r) => svg.appendChild(svgEl('circle', { class: 'ring', cx: 160, cy: 160, r })));

    const outerG = svgEl('g');
    for (let i = 0; i < 26; i++) { const c = makeCell(ALPHA[i], i, 136.5, 'w-outer'); outerG.appendChild(c.g); wheel.outer.push(c); }
    svg.appendChild(outerG);

    wheel.innerGroup = svgEl('g', { id: 'wheel-inner' });
    for (let i = 0; i < 26; i++) { const c = makeCell(ALPHA[i], i, 103.5, 'w-inner'); wheel.innerGroup.appendChild(c.g); wheel.inner.push(c); }
    svg.appendChild(wheel.innerGroup);

    wheel.hubNum = svgEl('text', { class: 'hub-num', x: 160, y: 154 });
    wheel.hubSub = svgEl('text', { class: 'hub-sub', x: 160, y: 182 });
    svg.appendChild(wheel.hubNum); svg.appendChild(wheel.hubSub);
    wheel.ready = true;
  }

  function currentWheelShift(info) {
    if (state.method === 'caesar') return state.key;
    if (state.method === 'vigenere') {
      try {
        const s = C.keywordShifts(state.keyword);
        return s[(info ? info.position - 1 : 0) % s.length];
      } catch (e) { return 0; }
    }
    return 0;
  }

  function renderWheel() {
    if (!wheel.ready) buildWheel();
    const info = lastLetterInfo(els.input.value);
    const decrypt = state.mode === 'decrypt';
    const atbash = state.method === 'atbash';
    const k = currentWheelShift(info);

    // inner ring letters: A–Z, or mirrored for Atbash
    wheel.inner.forEach((c, i) => { c.t.textContent = atbash ? ALPHA[25 - i] : ALPHA[i]; });
    wheel.innerGroup.style.transform = `rotate(${atbash ? 0 : -k * STEP_DEG}deg)`;

    // hub
    if (atbash) { wheel.hubNum.textContent = 'A↔Z'; wheel.hubNum.style.fontSize = '24px'; wheel.hubSub.textContent = 'mirror alphabet'; }
    else {
      wheel.hubNum.style.fontSize = '';
      wheel.hubNum.textContent = (decrypt ? '−' : '+') + k;
      wheel.hubSub.textContent = state.method === 'vigenere' ? 'key letter ' + (ALPHA[k] || '') : 'shift';
    }

    // highlight
    [...wheel.outer, ...wheel.inner].forEach((c) => c.g.classList.remove('on'));
    const caption = $('#wheel-caption');
    if (!info) { caption.textContent = 'Type a letter to see where it lands on the wheel.'; return; }

    let outerIdx; let innerIdx; let from; let to;
    if (atbash) {
      outerIdx = decrypt ? 25 - info.idx : info.idx; innerIdx = outerIdx;
    } else if (!decrypt) {
      outerIdx = info.idx; innerIdx = C.mod(info.idx + k, 26);
    } else {
      innerIdx = info.idx; outerIdx = C.mod(info.idx - k, 26);
    }
    wheel.outer[outerIdx].g.classList.add('on');
    wheel.inner[innerIdx].g.classList.add('on');
    const plain = ALPHA[outerIdx];
    const cipher = atbash ? ALPHA[25 - outerIdx] : ALPHA[innerIdx];
    if (!decrypt) { from = plain; to = cipher; } else { from = cipher; to = plain; }
    const extra = state.method === 'vigenere' ? ` (letter ${info.position} uses key letter ${ALPHA[k]})` : '';
    caption.textContent = `${from} becomes ${to}${extra}. ` + (decrypt ? 'Read from inner ring to outer ring.' : 'Read from outer ring to inner ring.');
  }

  /* ---- workbench events ---- */
  els.input.addEventListener('input', updateWorkbench);
  els.range.addEventListener('input', () => { state.key = Number(els.range.value); updateWorkbench(); });
  els.keyword.addEventListener('input', () => { state.keyword = els.keyword.value; updateWorkbench(); });
  els.digits.addEventListener('change', () => { state.digits = els.digits.checked; updateWorkbench(); });
  $('#mode-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    state.mode = b.dataset.mode; updateWorkbench();
  });
  $('#method-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-method]'); if (!b) return;
    state.method = b.dataset.method; updateWorkbench();
  });
  $('#btn-clear').addEventListener('click', () => { els.input.value = ''; updateWorkbench(); els.input.focus(); });
  $('#btn-sample').addEventListener('click', () => {
    const sample = SAMPLES[sampleIdx++ % SAMPLES.length];
    try { els.input.value = state.mode === 'decrypt' ? run(sample, 'encrypt') : sample; }
    catch (e) { els.input.value = sample; }
    updateWorkbench();
  });
  $('#btn-copy').addEventListener('click', () => copyText(els.output.textContent, 'Result copied'));
  $('#btn-swap').addEventListener('click', () => {
    const out = els.output.textContent;
    if (!out) return;
    els.input.value = out;
    state.mode = opposite(state.mode);
    updateWorkbench();
    toast(state.mode === 'decrypt' ? 'Result moved to the input. Now decrypting.' : 'Result moved to the input. Now encrypting.');
  });
  $('#btn-download').addEventListener('click', () => {
    const blob = new Blob([els.output.textContent], { type: 'text/plain;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: state.mode === 'encrypt' ? 'ciphertext.txt' : 'plaintext.txt' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#file-in').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 1024 * 1024) { toast('That file is over 1 MB. Try a smaller one.'); return; }
    const reader = new FileReader();
    reader.onload = () => { els.input.value = String(reader.result); updateWorkbench(); toast('File loaded'); };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ---------------------------------------------------------------- attack */
  const atk = { results: [], selected: null, challenge: null, wrong: 0 };
  const atkInput = $('#attack-input');

  const PHRASES = [
    'The best defence is knowing how the attacker thinks and working one step ahead of them.',
    'A secret is only as safe as the key that protects it, so guard the key before the message.',
    'Encryption turns readable data into noise that only the right person can turn back into sense.',
    'Every great security analyst starts by understanding the simple ciphers that came before.',
    'Patterns are the enemy of secrecy because patterns are what an analyst learns to recognise.',
  ];

  function randInt(min, max) {
    const buf = new Uint32Array(1); crypto.getRandomValues(buf);
    return min + (buf[0] % (max - min + 1));
  }

  function analyze() {
    const cipher = atkInput.value;
    const hasLetters = C.letterCounts(cipher).total > 0;
    $('#attack-empty').hidden = hasLetters || !!atk.challenge;
    const hideForChallenge = !!atk.challenge;
    $('#attack-results').hidden = !hasLetters || hideForChallenge;
    if (!hasLetters || hideForChallenge) {
      if (hideForChallenge) $('#attack-empty').hidden = true;
      return;
    }

    const t0 = performance.now();
    const res = C.bruteForce(cipher);
    const ms = Math.max(performance.now() - t0, 0.01);
    atk.results = res.results;
    atk.selected = res.results[0].shift;

    const best = res.results[0];
    const v = $('#verdict'); v.textContent = '';
    v.appendChild(el('span', { class: 'big' }, `Best guess: shift ${best.shift}`));
    const labels = { high: ['ok', 'High confidence'], medium: ['warn', 'Medium confidence'], low: ['bad', 'Low confidence'] };
    v.appendChild(el('span', { class: 'badge ' + labels[res.confidence][0] }, labels[res.confidence][1]));
    v.appendChild(el('span', { class: 'muted' }, `All 25 keys tried in ${ms.toFixed(2)} ms.` +
      (res.confidence === 'low' ? ` Only ${res.letters} letters to go on, so the ranking may be wrong. Paste a longer message.` : '')));

    renderCandidates();
    renderCandidateText();
    renderFreqChart(cipher, best.shift);
  }

  function renderCandidates() {
    const list = $('#cands'); list.textContent = '';
    const scores = atk.results.map((r) => r.score);
    const min = Math.min(...scores); const max = Math.max(...scores);
    atk.results.forEach((r) => {
      const li = el('li');
      const btn = el('button', { type: 'button', class: 'cand' + (r.rank === 1 ? ' best' : ''), 'aria-pressed': String(r.shift === atk.selected) });
      btn.appendChild(el('span', { class: 'shift' }, 'Shift ' + r.shift));
      btn.appendChild(el('span', { class: 'prev' }, r.text.replace(/\s+/g, ' ').slice(0, 70)));
      const bar = el('span', { class: 'bar', 'aria-hidden': 'true' });
      const fill = el('i'); const closeness = max === min ? 100 : 100 - ((r.score - min) / (max - min)) * 100;
      fill.style.width = Math.max(4, closeness) + '%'; bar.appendChild(fill); btn.appendChild(bar);
      btn.title = `Distance from English: ${Number.isFinite(r.score) ? r.score.toFixed(1) : 'n/a'}`;
      btn.addEventListener('click', () => { atk.selected = r.shift; renderCandidates(); renderCandidateText(); });
      li.appendChild(btn); list.appendChild(li);
    });
  }

  function renderCandidateText() {
    const r = atk.results.find((x) => x.shift === atk.selected);
    $('#cand-title').textContent = `Result for shift ${r.shift}`;
    $('#cand-text').textContent = r.text;
  }

  function renderFreqChart(cipher, bestShift) {
    const en = C.ENGLISH_FREQ;
    const ct = C.letterPercentages(cipher);
    const maxV = Math.max(13, ...ct);
    const W = 520; const H = 236; const left = 6; const bw = 15.4; const gap = (W - left * 2 - bw * 26) / 25;
    const chartH = 78;
    const parts = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Letter frequency of English compared with your ciphertext">`];
    const enPeak = en.indexOf(Math.max(...en));
    const ctPeak = ct.indexOf(Math.max(...ct));
    function bars(vals, top, cls, peak, caption) {
      parts.push(`<text class="cap" x="${left}" y="${top - 6}">${caption}</text>`);
      vals.forEach((v, i) => {
        const h = Math.max(1, (v / maxV) * chartH);
        const x = left + i * (bw + gap);
        parts.push(`<rect class="${i === peak ? 'bar-peak' : cls}" x="${x.toFixed(1)}" y="${(top + chartH - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="2"/>`);
        parts.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${top + chartH + 11}">${ALPHA[i]}</text>`);
      });
    }
    bars(en, 20, 'bar-en', enPeak, 'English (expected): tallest bar is E');
    bars(ct, 136, 'bar-ct', ctPeak, `Your ciphertext: tallest bar is ${ALPHA[ctPeak]}${bestShift ? ` (E shifted by ${bestShift} lands on ${ALPHA[(4 + bestShift) % 26]})` : ''}`);
    parts.push('</svg>');
    $('#freq-chart').innerHTML = parts.join('');
  }

  function endChallenge() {
    atk.challenge = null; atk.wrong = 0;
    $('#challenge-box').hidden = true;
    $('#challenge-msg').textContent = '';
  }

  atkInput.addEventListener('input', () => { endChallenge(); analyze(); });

  $('#btn-from-bench').addEventListener('click', () => {
    if (state.method !== 'caesar') { toast('The attack lab targets Caesar. Switch the method to Caesar first.'); return; }
    const source = state.mode === 'encrypt' ? els.output.textContent : els.input.value;
    if (!source.trim()) { toast('Nothing to use yet. Type a message in the Workbench.'); return; }
    endChallenge(); atkInput.value = source; analyze();
  });

  $('#btn-challenge').addEventListener('click', () => {
    const plain = PHRASES[randInt(0, PHRASES.length - 1)];
    const shift = randInt(1, 25);
    atk.challenge = { plain, shift }; atk.wrong = 0;
    atkInput.value = C.caesar(plain, shift);
    $('#challenge-box').hidden = false;
    $('#guess').value = ''; $('#challenge-msg').textContent = 'Hint: use the frequency chart after you reveal, or try shifts by hand.';
    analyze();
    $('#guess').focus();
  });

  function finishChallenge(message) {
    const shift = atk.challenge ? atk.challenge.shift : null;
    atk.challenge = null;
    analyze();
    $('#challenge-msg').textContent = message;
    if (shift) { atk.selected = shift; if (atk.results.length) { renderCandidates(); renderCandidateText(); } }
  }

  $('#btn-check').addEventListener('click', () => {
    if (!atk.challenge) return;
    const g = Number($('#guess').value);
    if (!Number.isInteger(g) || g < 1 || g > 25) { $('#challenge-msg').textContent = 'Enter a whole number from 1 to 25.'; return; }
    if (g === atk.challenge.shift) { toast('Cracked it!'); finishChallenge(`Correct: the shift was ${g}. Here is how the attack finds it.`); return; }
    atk.wrong++;
    let msg = `Not shift ${g}. Try again.`;
    if (atk.wrong >= 2) {
      const counts = C.letterCounts(atkInput.value).counts;
      const top = counts.indexOf(Math.max(...counts));
      msg += ` Hint: the most common letter is ${ALPHA[top]}. In English the most common letter is usually E.`;
    }
    $('#challenge-msg').textContent = msg;
  });
  $('#guess').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-check').click(); });
  $('#btn-reveal').addEventListener('click', () => {
    if (!atk.challenge) return;
    finishChallenge(`The shift was ${atk.challenge.shift}. Any 25-key search would have found it instantly.`);
  });
  $('#btn-cand-copy').addEventListener('click', () => copyText($('#cand-text').textContent, 'Result copied'));

  /* ----------------------------------------------------------------- learn */
  function renderPipe() {
    const list = $('#pipe'); list.textContent = '';
    const chRaw = $('#pipe-char').value;
    const key = Number($('#pipe-key').value);
    const ch = Array.from(chRaw)[0] || '';
    const add = (label, value, cls) => {
      const li = el('li', cls ? { class: cls } : null);
      li.appendChild(el('span', null, label)); li.appendChild(el('b', null, value)); list.appendChild(li);
    };
    if (!/^[A-Za-z]$/.test(ch) || !Number.isInteger(key)) { add('Enter one letter (A–Z) and a whole-number shift', '…'); return; }
    const t = C.trace(ch, key);
    add('Character', `'${ch}'`);
    add('ASCII conversion', String(t.ascii));
    add(`Subtract base (−${t.base})`, String(t.offset));
    add(`Add key (${key >= 0 ? '+' : '−'}${Math.abs(key)})`, String(t.raw));
    add(`Modulo (% 26)${t.didWrap ? ', wrapped around' : ''}`, String(t.wrapped), t.didWrap ? 'wrap' : '');
    add(`Add base (+${t.base})`, String(t.finalAscii));
    add('Character', `'${t.result}'`);
  }
  $('#pipe-char').addEventListener('input', renderPipe);
  $('#pipe-key').addEventListener('input', renderPipe);
  $('#btn-copy-py').addEventListener('click', () => copyText($('#py-code').textContent, 'Code copied'));

  $$('#deliverables input').forEach((cb) => {
    cb.checked = !!state.deliverables[cb.dataset.d];
    cb.addEventListener('change', () => { state.deliverables[cb.dataset.d] = cb.checked; saveState(); });
  });

  /* ------------------------------------------------------------------ init */
  function init() {
    loadState();
    els.range.value = state.key;
    els.keyword.value = state.keyword;
    els.digits.checked = state.digits;
    $$('#deliverables input').forEach((cb) => { cb.checked = !!state.deliverables[cb.dataset.d]; });
    updateWorkbench();
    renderPipe();
    showTab(location.hash.slice(1));
  }
  init();
})();
