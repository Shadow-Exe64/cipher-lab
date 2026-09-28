/*!
 * Cipher Lab — core cipher engine (pure logic, no DOM).
 * Works in the browser (window.CipherCore) and in Node (require).
 *
 * Caesar:   E(x) = (x + n) mod 26      D(x) = (x - n) mod 26
 * Vigenère: Caesar with a different shift per letter, taken from a keyword.
 * Atbash:   x -> 25 - x  (a fixed mirror alphabet, no key).
 *
 * Only ASCII letters are transformed. Spaces, punctuation, digits (unless the
 * `digits` option is on) and non-ASCII characters pass through unchanged, so
 * decrypting always restores the exact original text.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CipherCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Expected letter frequencies (%) in English text, A..Z. */
  const ENGLISH_FREQ = [
    8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153,
    0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056,
    2.758, 0.978, 2.36, 0.15, 1.974, 0.074,
  ];

  /**
   * True mathematical modulo. JavaScript's % keeps the sign of the dividend,
   * so (-3 % 26) is -3, not 23. Decryption needs the positive result.
   */
  const mod = (n, m) => ((n % m) + m) % m;

  function isUpper(c) { return c >= 65 && c <= 90; }
  function isLower(c) { return c >= 97 && c <= 122; }
  function isDigit(c) { return c >= 48 && c <= 57; }
  function isLetterCode(c) { return isUpper(c) || isLower(c); }

  function validateShift(key) {
    const n = Number(key);
    if (key === '' || key === null || key === undefined || !Number.isInteger(n)) {
      throw new RangeError('The shift key must be a whole number.');
    }
    return n;
  }

  /** Shift a single character by k positions (k may be negative). */
  function shiftChar(ch, k, opts) {
    const c = ch.codePointAt(0);
    if (isUpper(c)) return String.fromCharCode(mod(c - 65 + k, 26) + 65);
    if (isLower(c)) return String.fromCharCode(mod(c - 97 + k, 26) + 97);
    if (opts && opts.digits && isDigit(c)) return String.fromCharCode(mod(c - 48 + k, 10) + 48);
    return ch;
  }

  /** Caesar cipher. opts: { decrypt?: boolean, digits?: boolean } */
  function caesar(text, key, opts) {
    opts = opts || {};
    let k = validateShift(key);
    if (opts.decrypt) k = -k;
    let out = '';
    for (const ch of String(text)) out += shiftChar(ch, k, opts);
    return out;
  }

  /** Turn a keyword into a list of shifts (A=0 … Z=25). Non-letters are ignored. */
  function keywordShifts(keyword) {
    const shifts = [];
    for (const ch of String(keyword)) {
      const c = ch.toLowerCase().charCodeAt(0);
      if (c >= 97 && c <= 122) shifts.push(c - 97);
    }
    if (!shifts.length) throw new RangeError('The keyword needs at least one letter (A–Z).');
    return shifts;
  }

  /** Vigenère cipher. The keyword only advances on letters. */
  function vigenere(text, keyword, opts) {
    opts = opts || {};
    const shifts = keywordShifts(keyword);
    let i = 0;
    let out = '';
    for (const ch of String(text)) {
      if (isLetterCode(ch.codePointAt(0))) {
        const k = shifts[i++ % shifts.length];
        out += shiftChar(ch, opts.decrypt ? -k : k);
      } else out += ch;
    }
    return out;
  }

  /** Atbash cipher (self-inverse): A<->Z, B<->Y, … */
  function atbash(text) {
    let out = '';
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (isUpper(c)) out += String.fromCharCode(90 - (c - 65));
      else if (isLower(c)) out += String.fromCharCode(122 - (c - 97));
      else out += ch;
    }
    return out;
  }

  /**
   * Explain how one character is transformed, step by step (mirrors the
   * "Algorithm Visualization" from the project brief).
   * Returns null for characters that are not letters.
   */
  function trace(ch, shift, opts) {
    opts = opts || {};
    const c = ch.codePointAt(0);
    if (!isLetterCode(c)) return null;
    const base = isUpper(c) ? 65 : 97;
    const k = opts.decrypt ? -shift : shift;
    const offset = c - base;
    const raw = offset + k;
    const wrapped = mod(raw, 26);
    return {
      char: ch, ascii: c, base, offset, shift: k, raw, wrapped,
      finalAscii: wrapped + base, result: String.fromCharCode(wrapped + base),
      didWrap: raw < 0 || raw > 25,
    };
  }

  /** Count letters A..Z (case-insensitive). Returns { counts, total }. */
  function letterCounts(text) {
    const counts = new Array(26).fill(0);
    let total = 0;
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (isUpper(c)) { counts[c - 65]++; total++; }
      else if (isLower(c)) { counts[c - 97]++; total++; }
    }
    return { counts, total };
  }

  /** Letter frequencies as percentages (0–100). */
  function letterPercentages(text) {
    const { counts, total } = letterCounts(text);
    return counts.map((n) => (total ? (n / total) * 100 : 0));
  }

  /** Chi-squared distance from English. Lower = more English-like. */
  function chiSquared(text) {
    const { counts, total } = letterCounts(text);
    if (!total) return Infinity;
    let chi = 0;
    for (let i = 0; i < 26; i++) {
      const expected = (ENGLISH_FREQ[i] / 100) * total;
      chi += Math.pow(counts[i] - expected, 2) / expected;
    }
    return chi;
  }

  /**
   * Try every possible Caesar key (1–25) and rank the results.
   * Returns { results: [{shift, text, score, rank}], confidence, letters }.
   */
  function bruteForce(ciphertext) {
    const results = [];
    for (let shift = 1; shift <= 25; shift++) {
      const text = caesar(ciphertext, shift, { decrypt: true });
      results.push({ shift, text, score: chiSquared(text) });
    }
    results.sort((a, b) => a.score - b.score);
    results.forEach((r, i) => { r.rank = i + 1; });
    const letters = letterCounts(ciphertext).total;
    let confidence = 'low';
    if (letters >= 25 && results[0].score < results[1].score * 0.5) confidence = 'high';
    else if (letters >= 12 && results[0].score < results[1].score * 0.75) confidence = 'medium';
    return { results, confidence, letters };
  }

  /** Encrypt then decrypt and confirm the original text comes back. */
  function verifyRoundTrip(method, text, params) {
    const run = (t, decrypt) => {
      if (method === 'caesar') return caesar(t, params.key, { decrypt, digits: params.digits });
      if (method === 'vigenere') return vigenere(t, params.keyword, { decrypt });
      return atbash(t);
    };
    return run(run(text, false), true) === text;
  }

  return {
    ENGLISH_FREQ, mod, shiftChar, caesar, vigenere, atbash, keywordShifts,
    trace, letterCounts, letterPercentages, chiSquared, bruteForce, verifyRoundTrip,
  };
});
