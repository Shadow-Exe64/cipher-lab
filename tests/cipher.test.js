'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/js/cipher.js');

test('Caesar matches the classic examples', () => {
  assert.equal(C.caesar('HELLO', 3), 'KHOOR');
  assert.equal(C.caesar('KHOOR', 3, { decrypt: true }), 'HELLO');
  assert.equal(C.caesar('A', 3), 'D');
});

test('Caesar wraps around the alphabet (Y + 3 = B)', () => {
  assert.equal(C.caesar('Y', 3), 'B');
  assert.equal(C.caesar('xyz', 3), 'abc');
  assert.equal(C.caesar('abc', 3, { decrypt: true }), 'xyz');
});

test('Case, spaces, punctuation and unicode are preserved', () => {
  const src = "Hello, World! It's 2026 — café ✓";
  const enc = C.caesar(src, 5);
  assert.equal(enc, "Mjqqt, Btwqi! Ny'x 2026 — hfké ✓");
  assert.equal(C.caesar(enc, 5, { decrypt: true }), src);
});

test('Non-ASCII letters are left alone rather than corrupted', () => {
  assert.equal(C.caesar('é', 4), 'é');
  assert.equal(C.caesar('日本', 9), '日本');
});

test('Negative and large keys behave (true modulo)', () => {
  assert.equal(C.caesar('abc', -1), 'zab');
  assert.equal(C.caesar('abc', 27), C.caesar('abc', 1));
  assert.equal(C.caesar('abc', 26), 'abc');
  assert.equal(C.caesar('abc', -27), C.caesar('abc', 25));
});

test('Every key round-trips on a mixed string', () => {
  const src = 'The Quick Brown Fox, jumps over 13 lazy dogs!';
  for (let k = -30; k <= 30; k++) {
    assert.equal(C.caesar(C.caesar(src, k), k, { decrypt: true }), src);
  }
});

test('Digits are shifted only when asked', () => {
  assert.equal(C.caesar('a1', 3), 'd1');
  assert.equal(C.caesar('a9', 3, { digits: true }), 'd2');
  assert.equal(C.caesar('d2', 3, { digits: true, decrypt: true }), 'a9');
});

test('Invalid keys are rejected', () => {
  assert.throws(() => C.caesar('x', ''), RangeError);
  assert.throws(() => C.caesar('x', 1.5), RangeError);
  assert.throws(() => C.caesar('x', 'abc'), RangeError);
});

test('Vigenère known vector', () => {
  assert.equal(C.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(C.vigenere('LXFOPVEFRNHR', 'LEMON', { decrypt: true }), 'ATTACKATDAWN');
});

test('Vigenère keyword only advances on letters', () => {
  const enc = C.vigenere('Attack at dawn!', 'Lemon');
  assert.equal(enc, 'Lxfopv ef rnhr!');
  assert.equal(C.vigenere(enc, 'Lemon', { decrypt: true }), 'Attack at dawn!');
  assert.throws(() => C.vigenere('x', '123'), RangeError);
});

test('Atbash is its own inverse', () => {
  assert.equal(C.atbash('Hello'), 'Svool');
  assert.equal(C.atbash(C.atbash('Round trip, please.')), 'Round trip, please.');
});

test('trace() mirrors the brief: A -> 65 -> 0 -> 3 -> 3 -> 68 -> D', () => {
  const t = C.trace('A', 3);
  assert.deepEqual([t.ascii, t.offset, t.raw, t.wrapped, t.finalAscii, t.result], [65, 0, 3, 3, 68, 'D']);
  const y = C.trace('Y', 3);
  assert.deepEqual([y.offset, y.raw, y.wrapped, y.result, y.didWrap], [24, 27, 1, 'B', true]);
  assert.equal(C.trace(' ', 3), null);
});

test('Brute force finds the right shift on real English', () => {
  const plain = 'Meet me at the old library after the lecture, and bring the notes we talked about.';
  const cipher = C.caesar(plain, 11);
  const r = C.bruteForce(cipher);
  assert.equal(r.results[0].shift, 11);
  assert.equal(r.results[0].text, plain);
  assert.equal(r.confidence, 'high');
  assert.equal(r.results.length, 25);
});

test('Brute force is honest about very short input', () => {
  assert.equal(C.bruteForce('Khoor').confidence, 'low');
});

test('Frequency helpers', () => {
  const { counts, total } = C.letterCounts('Aab!');
  assert.equal(total, 3);
  assert.equal(counts[0], 2);
  assert.equal(C.chiSquared('1234'), Infinity);
});

test('verifyRoundTrip', () => {
  assert.ok(C.verifyRoundTrip('caesar', 'Hi there!', { key: 7, digits: true }));
  assert.ok(C.verifyRoundTrip('vigenere', 'Hi there!', { keyword: 'key' }));
  assert.ok(C.verifyRoundTrip('atbash', 'Hi there!', {}));
});
