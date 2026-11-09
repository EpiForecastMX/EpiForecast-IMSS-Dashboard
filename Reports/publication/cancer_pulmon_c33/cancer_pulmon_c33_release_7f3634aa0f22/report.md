# Pronóstico — Tumor maligno de tráquea, bronquios y pulmón (C33, C34)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_pulmon_c33_release_7f3634aa0f22`
- Lineage: forecast `cancer_pulmon_c33_forecast_h52_0c69fc2023c6_169f263b1596` · refit `cancer_pulmon_c33_refit_final_f0e7458fef3a_0c69fc2023c6` · dataset `cancer_pulmon_c33_b410257fba2f`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 14 |
| `seasonal_naive_lag52` | 50 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `171429b1acbbc11e0ea614a7c928e103b2faff68f637f66e9ef7df228eb06ad0`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
