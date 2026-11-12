# Pronóstico — Amebiasis intestinal (A06.0, A06.1, A06.2, A06.3, A06.9)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `amebiasis_a06_release_aaf5c1da2175`
- Lineage: forecast `amebiasis_a06_forecast_h52_279af4cb1e3e_afcaad6df825` · refit `amebiasis_a06_refit_final_d113b2329a60_279af4cb1e3e` · dataset `amebiasis_a06_8d41b62066a7`
- Origen 2026-W42 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `ets_add_damped_log1p` | 27 |
| `ridge_harmonic_log1p` | 33 |
| `seasonal_mean_3y` | 4 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `11e8936a8b3ff0b9709854bb6fca62e029832727bbb45fdd82905ecd496864d7`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
