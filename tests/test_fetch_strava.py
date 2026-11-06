import importlib.util
import unittest
from datetime import date, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location('fetcher', Path(__file__).resolve().parents[1] / 'scripts/fetch_strava_5948.py')
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

def rows():
    result = []
    for i in range(5):
        day = (date(2026, 11, 2) + timedelta(days=i)).strftime('%d.%m.%Y')
        for label, name in [('Polévka', f'Polévka vývar {i}'), ('Oběd 1', f'Řízek, brambory {i}')]:
            result.append({'datum': day, 'druh_popis': label, 'nazev': name})
    return result

class FetchTests(unittest.TestCase):
    def test_complete_exact_text_and_both_lunches(self):
        source = rows() + [{'datum': '02.11.2026', 'druh_popis': 'Oběd 2', 'nazev': 'Řízek, bramborová kaše'}]
        weeks, skipped = M.parse_menu({'table0': source})
        self.assertFalse(skipped)
        self.assertEqual(weeks[0]['days'][0]['soup'], 'Polévka vývar 0')
        self.assertEqual(weeks[0]['days'][0]['main2'], 'Řízek, bramborová kaše')

    def test_organizational_day_is_preserved_and_complete(self):
        source = rows()[2:] + [{'datum': '02.11.2026', 'druh_popis': 'Polévka', 'nazev': 'P R Á Z D N I N Y'}]
        weeks, skipped = M.parse_menu({'table0': source})
        self.assertFalse(skipped)
        self.assertEqual(weeks[0]['days'][0]['soup'], 'P R Á Z D N I N Y')
        self.assertTrue(weeks[0]['days'][0]['closed'])

    def test_missing_day_is_not_an_inferred_holiday(self):
        weeks, skipped = M.parse_menu({'table0': rows()[2:]})
        self.assertFalse(weeks)
        self.assertEqual(skipped[0]['complete_days'], 4)

    def test_announced_but_unfilled_lunch2_blocks_replacement(self):
        source = rows() + [{'datum': '02.11.2026', 'druh_popis': 'Oběd 2', 'nazev': 'Oběd 2'}]
        weeks, skipped = M.parse_menu({'table0': source})
        self.assertFalse(weeks)
        self.assertIn('missing_announced_lunch2', skipped[0]['reasons'])

    def test_conflicting_rows_block_the_week(self):
        weeks, skipped = M.parse_menu({'table0': rows() + [{'datum': '02.11.2026', 'druh_popis': 'Oběd 1', 'nazev': 'Jiný oběd'}]})
        self.assertFalse(weeks)
        self.assertIn('conflicting_rows', skipped[0]['reasons'])

    def test_incomplete_live_data_cannot_erase_archived_complete_week(self):
        complete, _ = M.parse_menu({'table0': rows()})
        old = {'cafeteria': '5948', 'weeks': complete}
        incoming, skipped = M.parse_menu({'table0': rows()[2:]})
        self.assertEqual(M.merge_archive(old, incoming, skipped)['weeks'], complete)

    def test_complete_correction_replaces_archive_and_other_weeks_survive(self):
        complete, _ = M.parse_menu({'table0': rows()})
        later = {'week': '2026-11-09', 'days': complete[0]['days']}
        original = {'cafeteria': '5948', 'weeks': complete + [later]}
        source = rows()
        source[1]['nazev'] = 'Opravený oběd, rýže'
        current, skipped = M.parse_menu({'table0': source})
        merged = M.merge_archive(original, current, skipped)
        self.assertEqual(merged['weeks'][0]['days'][0]['main'], 'Opravený oběd, rýže')
        self.assertEqual(merged['weeks'][1], later)

    def test_wrong_archive_and_organizational_conflict_are_rejected(self):
        with self.assertRaises(ValueError):
            M.merge_archive({'cafeteria': '0948', 'weeks': []}, [], [])
        weeks, skipped = M.parse_menu({'table0': rows() + [{'datum': '02.11.2026', 'druh_popis': 'Polévka', 'nazev': 'NEVAŘÍ SE'}]})
        self.assertFalse(weeks)
        self.assertTrue(skipped)

if __name__ == '__main__':
    unittest.main()
