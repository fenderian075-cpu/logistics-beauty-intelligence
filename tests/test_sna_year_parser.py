import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from run_sna_industry_deflators import year_of


class SnaYearParserTests(unittest.TestCase):
    def test_western_years(self):
        self.assertEqual(year_of(2024), 2024)
        self.assertEqual(year_of("2024年"), 2024)
        self.assertEqual(year_of("2020暦年"), 2020)

    def test_heisei_calendar_year(self):
        self.assertEqual(year_of("平成6暦年"), 1994)
        self.assertEqual(year_of("平成31年"), 2019)

    def test_reiwa_calendar_year(self):
        self.assertEqual(year_of("令和元年"), 2019)
        self.assertEqual(year_of("令和6暦年"), 2024)
        self.assertEqual(year_of("令和６暦年"), 2024)

    def test_showa_and_noise(self):
        self.assertEqual(year_of("昭和63年"), 1988)
        self.assertIsNone(year_of("増加率"))
        self.assertIsNone(year_of(None))


if __name__ == "__main__":
    unittest.main()
