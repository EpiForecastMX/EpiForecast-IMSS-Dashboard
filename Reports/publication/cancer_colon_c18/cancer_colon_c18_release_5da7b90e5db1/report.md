# Pronóstico — Tumor maligno del colon y recto (C18, C19, C20, C21)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_colon_c18_release_5da7b90e5db1`
- Lineage: forecast `cancer_colon_c18_forecast_h52_df9640e77d80_0a098745e7eb` · refit `cancer_colon_c18_refit_final_074419c03585_df9640e77d80` · dataset `cancer_colon_c18_35431d7d00ab`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 25 |
| `seasonal_naive_lag52` | 39 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `a892964fa13e90941cbe1ae7e2219b314075146cf266f74300fc288256c9372a`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
