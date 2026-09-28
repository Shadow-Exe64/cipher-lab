import unittest

from caesar_cli import caesar, chi_squared, crack, main, vigenere


class CaesarTests(unittest.TestCase):
    def test_classic(self):
        self.assertEqual(caesar("HELLO", 3), "KHOOR")
        self.assertEqual(caesar("KHOOR", 3, decrypt=True), "HELLO")

    def test_wraparound(self):
        self.assertEqual(caesar("Y", 3), "B")
        self.assertEqual(caesar("abc", -1), "zab")
        self.assertEqual(caesar("abc", 29), "def")

    def test_preserves_everything_else(self):
        src = "Hello, World! It's 2026 - cafe\u0301 \u2713"
        for key in range(-30, 31):
            self.assertEqual(caesar(caesar(src, key), key, decrypt=True), src)

    def test_bad_key(self):
        with self.assertRaises(ValueError):
            caesar("x", 1.5)  # type: ignore[arg-type]

    def test_vigenere_vector(self):
        self.assertEqual(vigenere("ATTACKATDAWN", "LEMON"), "LXFOPVEFRNHR")
        self.assertEqual(vigenere("LXFOPVEFRNHR", "LEMON", decrypt=True), "ATTACKATDAWN")
        with self.assertRaises(ValueError):
            vigenere("x", "123")

    def test_crack(self):
        plain = "Meet me at the old library after the lecture, and bring the notes we talked about."
        best = crack(caesar(plain, 11))[0]
        self.assertEqual((best[0], best[1]), (11, plain))

    def test_chi_squared_no_letters(self):
        self.assertEqual(chi_squared("1234"), float("inf"))

    def test_cli_exit_codes(self):
        self.assertEqual(main(["encrypt", "hi", "-k", "3"]), 0)
        self.assertEqual(main(["encrypt", "hi", "-w", "123"]), 2)


if __name__ == "__main__":
    unittest.main()
