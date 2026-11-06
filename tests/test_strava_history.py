import importlib.util
import unittest
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('history',ROOT/'scripts/strava_history.py');M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
class HistoryTests(unittest.TestCase):
 def test_real_october_2025_and_original_text(self):
  path=ROOT/'docs/source_months/202510.json'
  if not path.exists():path=ROOT/'DOKUMENTACE/source_months/202510.json'
  rows,dates=M.parse_month(path.read_text(),'202510')
  self.assertEqual(dates[0],'2025-10-01')
  self.assertTrue(any(r['nazev']=='Lotrinské tagliatelle se sýrem' for r in rows))
  self.assertFalse(any(r['nazev']=='Oběd 2' for r in rows))
  self.assertTrue(all(r['nazev'].strip()==r['nazev'] for r in rows))
 def test_wrong_requested_year_cannot_be_mistaken_for_a_matching_archive(self):
  path=ROOT/'docs/source_months/202510.json'
  if not path.exists():path=ROOT/'DOKUMENTACE/source_months/202510.json'
  with self.assertRaises(ValueError):M.parse_month(path.read_text(),'202610')
 def test_empty_month_is_empty_and_not_an_inferred_closed_week(self):
  rows,dates=M.parse_month(json.dumps({'chyba':False,'data':''}),'202608');self.assertEqual(rows,[]);self.assertEqual(dates,[])
 def test_server_rejection_cannot_become_verified_data(self):
  with self.assertRaises(ValueError):M.parse_month(json.dumps({'chyba':True,'data':''}),'202510')
if __name__=='__main__':unittest.main()
