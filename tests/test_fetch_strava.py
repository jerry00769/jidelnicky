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

    def test_placeholder_lunch2_does_not_block_replacement(self):
        source = rows() + [{'datum': '02.11.2026', 'druh_popis': 'Oběd 2', 'nazev': 'Oběd 2'}]
        weeks, skipped = M.parse_menu({'table0': source})
        self.assertFalse(skipped)
        self.assertEqual(len(weeks), 1)
        self.assertEqual(weeks[0]['days'][0]['main2'], '')

    def test_conflicting_rows_block_the_week(self):
        weeks, skipped = M.parse_menu({'table0': rows() + [{'datum': '02.11.2026', 'druh_popis': 'Oběd 1', 'nazev': 'Jiný oběd'}]})
        self.assertFalse(weeks)
        self.assertIn('conflicting_rows', skipped[0]['reasons'])

    def test_cross_month_current_menu_with_placeholders_and_stale_history(self):
        menu = [('Polévka hovězí s vaječnou jíškou','Špagety se sýrovou omáčkou'),
                ('Polévka z hlívy ústřičné','Rybí filé smažené, Brambory m.m.'),
                ('Polévka hovězí se strouháním','Čínské nudle s kuřecím masem a zeleninou'),
                ('Polévka drožďová','Zbojnická hovězí pečeně, Rýže dušená'),
                ('Polévka čočková se zeleninou','Smetanové brambory s brokolicí a šunkou')]
        current, history = [], []
        for i, (soup, main) in enumerate(menu):
            d = date(2026, 11, 30) + timedelta(days=i)
            stamp = d.strftime('%d.%m.%Y')
            current.extend([{'datum':stamp,'druh_popis':'Polévka','nazev':soup},
                            {'datum':stamp,'druh_popis':'Oběd 1','nazev':main}])
            if i:
                current.append({'datum':stamp,'druh_popis':'Oběd 2','nazev':'Oběd 2'})
            history.extend([{'datum':stamp,'druh_popis':'Polévka','nazev':soup},
                            {'datum':stamp,'druh_popis':'Oběd 1','nazev':main if not i else 'Starší údaj'}])
        weeks, skipped, partial = M.combine_sources({'table0':history}, [{'table0':current}])
        self.assertEqual(len(weeks),1)
        self.assertEqual(weeks[0]['week'],'2026-11-30')
        self.assertEqual([(d['soup'],d['main']) for d in weeks[0]['days']],menu)
        self.assertTrue(all(not d['main2'] for d in weeks[0]['days']))
        self.assertFalse(skipped or partial)

    def test_missing_future_day_stays_unknown(self):
        weeks, skipped, partial = M.combine_sources({'table0':[]}, {'table0':rows()[:2]})
        self.assertFalse(weeks)
        self.assertEqual(partial[0]['days'][1:], [None]*4)
        self.assertEqual(skipped[0]['complete_days'],1)

    def test_current_date_formats(self):
        source = rows()
        source[0]['datum'] = '2. 11. 2026'
        source[1]['datum'] = '2026-11-02T00:00:00'
        self.assertEqual(len(M.parse_menu({'table0':source})[0]),1)

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
