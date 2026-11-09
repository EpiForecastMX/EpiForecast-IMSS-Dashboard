# Pronóstico — Tumor maligno del páncreas (C26)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_pancreas_c26_release_b7eeb1352582`
- Lineage: forecast `cancer_pancreas_c26_forecast_h52_2e84d47cf45a_b0b0e87889ba` · refit `cancer_pancreas_c26_refit_final_e65ea9b99fbb_2e84d47cf45a` · dataset `cancer_pancreas_c26_69ea1333c331`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 10 |
| `seasonal_naive_lag52` | 54 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `b0f2cf796f08c08fc353fc9309ae7682ac746dc303f13bc99ee6c355df620443`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
