"""Regressions against actual caption layouts, including issue/observation boundaries."""
import unittest,json
from pathlib import Path
from boletin_archive_periods import cut,period
class ObservationCuts(unittest.TestCase):
 def check(self,header,code,name,issue,expected):
  self.assertEqual(cut(header,dict(code=code,name=name),dict(year=issue[0],week=issue[1])),expected)
 def test_ignore_issue_masthead(self):
  self.check('Vigilancia Epidemiológica Semana 2, 2014 CUADRO 4.2 Casos por entidad federativa hasta la semana epidemiológica 1 del 2014','B77','Ascariasis',(2014,2),(2014,1))
 def test_influenza_special_cut(self):
  for year,week in [(2014,20),(2016,9),(2020,20)]:
   self.check(f'CUADRO 3.6 Casos hasta la semana epidemiológica {week-1}; Influenza hasta la {week} del {year}','J09,J11','Influenza',(year,week),(year,week))
 def test_previous_year_53(self):
  self.check('Vigilancia Epidemiológica Semana 1, 2015 CUADRO 4.3 Casos hasta la semana epidemiológica 53 del 2014','A07.1','Giardiasis',(2015,1),(2014,53))
 def test_observed_vih_not_issue(self):
  self.check('CUADRO 6.5 Infección por VIH hasta la semana epidemiológica 27 del 2020','B20,B24,Z21','Infección por VIH',(2020,28),(2020,27))
 def test_vivax_specific_cut(self):
  self.check('CUADRO 7.4 hasta la semana epidemiológica 19; Paludismo por P. vivax hasta la 20 del 2018','B51','Paludismo por P. vivax',(2018,20),(2018,20))
 def test_unknown_caption_is_not_guessed(self):
  self.assertIsNone(cut('CUADRO sin corte legible',dict(name='Influenza',code='J09,J11'),dict(year=2020,week=1)))
 def test_actual_caption_abbreviations(self):
  fixtures=json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/boletin-observation-cuts.json').read_text())
  for f in fixtures:
   with self.subTest(source=f['source'],page=f['page']):self.check(f['header'],f['code'],f['name'],f['issue'],tuple(f['expected']))
 def test_calendar_has_actual_53_week_years(self):
  self.assertEqual(period(2026,1,1),(2025,53));self.assertEqual(period(2021,1,1),(2020,53));self.assertEqual(period(2015,1,1),(2014,53))
if __name__=='__main__':unittest.main()
