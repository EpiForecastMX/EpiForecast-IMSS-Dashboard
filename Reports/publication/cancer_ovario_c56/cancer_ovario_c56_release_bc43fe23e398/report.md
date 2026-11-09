# Pronóstico — Tumor maligno del ovario (C56)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_ovario_c56_release_bc43fe23e398`
- Lineage: forecast `cancer_ovario_c56_forecast_h52_3379c6aac08d_5452a5670ee7` · refit `cancer_ovario_c56_refit_final_05fffc1f92a5_3379c6aac08d` · dataset `cancer_ovario_c56_b29bb34fac69`
- Origen 2026-W41 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 13 |
| `seasonal_naive_lag52` | 19 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `dbffcac8196b387c2cd0a8b16999e9b00faa15bcedfe2329006a943fd66c0333`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
