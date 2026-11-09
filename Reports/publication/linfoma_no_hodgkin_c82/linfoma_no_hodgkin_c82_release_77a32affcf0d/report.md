# Pronóstico — Linfoma no Hodgkin (C82, C83, C84, C85)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `linfoma_no_hodgkin_c82_release_77a32affcf0d`
- Lineage: forecast `linfoma_no_hodgkin_c82_forecast_h52_f36a56a5eb8b_742ce8cac806` · refit `linfoma_no_hodgkin_c82_refit_final_39efe15eafcc_f36a56a5eb8b` · dataset `linfoma_no_hodgkin_c82_8d66a72c9729`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 16 |
| `seasonal_naive_lag52` | 48 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `3ad3f6be0541a18b0e089cfd5bf078dc6eda36d3396a742204adcf6b9535e189`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
