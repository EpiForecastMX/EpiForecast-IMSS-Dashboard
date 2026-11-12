# Pronóstico — Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio (O10, O11, O12, O13, O14, O15, O16)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `embarazo_hipertensivos_o10_release_3139b1adfd8f`
- Lineage: forecast `embarazo_hipertensivos_o10_forecast_h52_36c2bfdb8677_a3e5d135c191` · refit `embarazo_hipertensivos_o10_refit_final_3b2bf888eca5_36c2bfdb8677` · dataset `embarazo_hipertensivos_o10_188b663b481c`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 12 |
| `ridge_harmonic_log1p` | 16 |
| `seasonal_mean_3y` | 1 |
| `seasonal_mean_5y` | 1 |
| `seasonal_median_3y` | 1 |
| `seasonal_median_5y` | 1 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `6d86ba00f245284b519d44a9983272afb2e57a3167ff82fb889420125740a31e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
