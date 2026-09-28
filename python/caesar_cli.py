#!/usr/bin/env python3
"""
Cipher Lab - command-line companion (Project 2: Basic Encryption & Decryption).

Implements the same algorithm as the web app, using only ord(), chr() and % 26.

Examples
    python caesar_cli.py encrypt "Hello, World!" --key 3
    python caesar_cli.py decrypt "Khoor, Zruog!" --key 3
    python caesar_cli.py crack "Phhw ph dw wkh oleudub diwhu wkh ohfwxuh"
    python caesar_cli.py                      # interactive menu
"""

from __future__ import annotations

import argparse
import sys
from typing import List, Tuple

# Expected letter frequencies (%) in English, A..Z
ENGLISH_FREQ = [
    8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153,
    0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056,
    2.758, 0.978, 2.360, 0.150, 1.974, 0.074,
]


def caesar(text: str, key: int, decrypt: bool = False) -> str:
    """Shift every ASCII letter by `key` places. Everything else is kept as is.

    Encryption:  E(x) = (x + n) mod 26
    Decryption:  D(x) = (x - n) mod 26
    Python's % always returns a non-negative result for a positive modulus,
    so negative shifts wrap around correctly.
    """
    if not isinstance(key, int) or isinstance(key, bool):
        raise ValueError("The shift key must be a whole number.")
    shift = -key if decrypt else key
    out: List[str] = []
    for ch in text:
        if "A" <= ch <= "Z":
            base = ord("A")
        elif "a" <= ch <= "z":
            base = ord("a")
        else:
            out.append(ch)  # spaces, punctuation, digits, non-ASCII
            continue
        out.append(chr((ord(ch) - base + shift) % 26 + base))
    return "".join(out)


def vigenere(text: str, keyword: str, decrypt: bool = False) -> str:
    """Vigenere cipher: like Caesar, but the shift comes from a repeating keyword."""
    shifts = [ord(c) - ord("a") for c in keyword.lower() if "a" <= c <= "z"]
    if not shifts:
        raise ValueError("The keyword needs at least one letter (A-Z).")
    out: List[str] = []
    i = 0
    for ch in text:
        if ("A" <= ch <= "Z") or ("a" <= ch <= "z"):
            k = shifts[i % len(shifts)]
            i += 1
            out.append(caesar(ch, k, decrypt))
        else:
            out.append(ch)
    return "".join(out)


def chi_squared(text: str) -> float:
    """Distance from English letter frequencies. Lower means more English-like."""
    counts = [0] * 26
    for ch in text.lower():
        if "a" <= ch <= "z":
            counts[ord(ch) - ord("a")] += 1
    total = sum(counts)
    if total == 0:
        return float("inf")
    return sum(
        (counts[i] - ENGLISH_FREQ[i] / 100 * total) ** 2 / (ENGLISH_FREQ[i] / 100 * total)
        for i in range(26)
    )


def crack(ciphertext: str) -> List[Tuple[int, str, float]]:
    """Try all 25 keys. Returns (key, plaintext, score) sorted best-first."""
    results = [(k, caesar(ciphertext, k, decrypt=True)) for k in range(1, 26)]
    scored = [(k, t, chi_squared(t)) for k, t in results]
    return sorted(scored, key=lambda r: r[2])


def _print_pair(label_in: str, original: str, label_out: str, result: str) -> None:
    print(f"\n{label_in:<12}: {original}")
    print(f"{label_out:<12}: {result}\n")


def interactive() -> None:
    print("Cipher Lab - Caesar cipher (Ctrl+C to quit)")
    while True:
        try:
            print("\n  1) Encrypt   2) Decrypt   3) Crack (brute force)   4) Round-trip demo   q) Quit")
            choice = input("Choose: ").strip().lower()
            if choice in {"q", "quit", "exit"}:
                return
            if choice in {"1", "2", "4"}:
                text = input("Text: ")
                key = int(input("Shift key (whole number): "))
                if choice == "1":
                    _print_pair("Plaintext", text, "Ciphertext", caesar(text, key))
                elif choice == "2":
                    _print_pair("Ciphertext", text, "Plaintext", caesar(text, key, decrypt=True))
                else:
                    enc = caesar(text, key)
                    dec = caesar(enc, key, decrypt=True)
                    _print_pair("Original", text, "Encrypted", enc)
                    print(f"Decrypted   : {dec}")
                    print("Round trip  :", "OK - matches the original" if dec == text else "FAILED")
            elif choice == "3":
                text = input("Ciphertext: ")
                for key, plain, score in crack(text)[:5]:
                    print(f"  shift {key:>2}  score {score:8.1f}  {plain[:70]}")
            else:
                print("Please choose 1, 2, 3, 4 or q.")
        except ValueError as exc:
            print(f"Input error: {exc}")
        except (KeyboardInterrupt, EOFError):
            print()
            return


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Caesar / Vigenere encryption and decryption.")
    sub = p.add_subparsers(dest="cmd")
    for name in ("encrypt", "decrypt"):
        s = sub.add_parser(name, help=f"{name} a message")
        s.add_argument("text")
        g = s.add_mutually_exclusive_group(required=True)
        g.add_argument("-k", "--key", type=int, help="Caesar shift (whole number)")
        g.add_argument("-w", "--keyword", help="Vigenere keyword")
    c = sub.add_parser("crack", help="brute-force a Caesar ciphertext")
    c.add_argument("text")
    c.add_argument("-n", "--top", type=int, default=3, help="how many candidates to show")
    return p


def main(argv: List[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.cmd is None:
        interactive()
        return 0
    try:
        if args.cmd in ("encrypt", "decrypt"):
            dec = args.cmd == "decrypt"
            if args.keyword is not None:
                print(vigenere(args.text, args.keyword, dec))
            else:
                print(caesar(args.text, args.key, dec))
        else:
            for key, plain, score in crack(args.text)[: args.top]:
                print(f"shift {key:>2}  score {score:8.1f}  {plain}")
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
