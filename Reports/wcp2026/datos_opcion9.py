"""Recalcula cifras desde CSV, sin entrenar, escribir fuentes ni abrir modelos.

La selección es la del snapshot 20260605. Los 25 puntos vienen del forecast completo;
las ocho semanas anticipadas se contrastan además con el snapshot redondeado a .01.
"""
from pathlib import Path
import hashlib
import json
import unicodedata
import numpy as np
import pandas as pd
from epiforecast.utils.config import conf

ROOT = Path(__file__).resolve().parents[3]
FIG = Path(__file__).parent
SNAP = ROOT / 'reports/ProdDetails/congelado/forecast_congelado_20260605.csv'

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s).lower())
                   if unicodedata.category(c) != 'Mn')

def smape(y, p):
    den = abs(y) + abs(p)
    mask = den > 0
    if not mask.any():
        raise ValueError('SIN_SENAL')
    return float(np.mean(200 * abs(y-p)[mask] / den[mask]))

def calcula():
    bp = ROOT / conf['data']['boletin']
    b = pd.read_csv(bp)
    b = b[(b.Anio == 2026) & b.Semana.between(7, 31)].copy()
    b['pad'] = b.Padecimiento.map(norm)
    y = b.groupby(['pad', 'Entidad', 'Semana']).Casos_semana.sum()
    s = pd.read_csv(SNAP)
    s['pad'] = s.padecimiento.map(norm)
    s = s[s['pad'].isin(['depresion', 'parkinson', 'alzheimer'])].copy()
    selection = s[['pad', 'entidad', 'sexo', 'motor']].drop_duplicates()
    if len(selection) != 297 or selection.duplicated(['pad','entidad','sexo']).any():
        raise ValueError('SELECCION_NO_UNICA_297')
    files = [bp, SNAP]
    forecasts = {}
    for motor in selection.motor.unique():
        path = ROOT / f'reports/forecasts/{motor}/all_forecast_{motor}.csv'
        files.append(path)
        f = pd.read_csv(path, low_memory=False)
        f['pad'] = f.meta_padecimiento.map(norm)
        f['public_date'] = pd.to_datetime(f.ds) + pd.Timedelta(days=7)
        f = f[f.public_date.between('2026-02-09', '2026-07-27')].copy()
        f['Semana'] = f.public_date.dt.isocalendar().week.astype(int)
        key = ['pad','meta_entidad','meta_modo','Semana']
        if f.duplicated(key).any():
            raise ValueError(f'FORECAST_DUPLICADO:{motor}')
        forecasts[motor] = f.set_index(key).yhat
    rows = []
    for row in selection[selection.sexo.eq('general')].itertuples():
        if row.entidad != 'Nacional' and row.pad != 'depresion':
            continue
        obs = np.array([float(y.loc[(row.pad, slice(None), w)].sum())
                        if row.entidad == 'Nacional' else float(y.loc[row.pad,row.entidad,w])
                        for w in range(7,32)])
        pred = np.array([forecasts[row.motor].loc[row.pad,row.entidad,'general',w]
                         for w in range(7,32)], dtype=float)
        if not np.isfinite(obs).all() or not np.isfinite(pred).all():
            raise ValueError('VALORES_NO_FINITOS')
        frozen = s[(s['pad'] == row.pad) & s.entidad.eq(row.entidad) & s.sexo.eq('general')
                   & s.iso_anio.eq(2026)].copy()
        frozen['Semana'] = frozen.iso_semana + 1
        frozen = frozen.set_index('Semana').yhat
        diff = max(abs(pred[w-7] - frozen.loc[w]) for w in range(24,32))
        if diff > .00501:
            raise ValueError(f'FORECAST_NO_COINCIDE_SNAPSHOT:{row.entidad}:{diff}')
        rows.append(dict(padecimiento=row.pad, entidad=row.entidad, motor=row.motor,
                         semanas=25, smape25=smape(obs,pred), smape8=smape(obs[-8:],pred[-8:]),
                         observado=float(obs.sum()), pronosticado=float(pred.sum()),
                         desviacion=100*(float(pred.sum()/obs.sum())-1),
                         max_diferencia_snapshot=diff))
    states = [r for r in rows if r['padecimiento']=='depresion' and r['entidad']!='Nacional']
    if len(states) != 32:
        raise ValueError('MAPA_NO_TIENE_32_ESTADOS')
    return dict(ventana='W7-W31', subconjunto='W24-W31', seleccion='snapshot 20260605',
                cobertura=297, filas=rows,
                fuentes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                         for p in files})

if __name__ == '__main__':
    result = calcula()
    (FIG/'datos_opcion9.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    pd.DataFrame(result['filas']).to_csv(FIG/'datos_opcion9.csv',index=False)
    print('Cifras recalculadas: 3 nacionales + 32 estatales; snapshot contrastado.')
