# Pronóstico — Tumor maligno del páncreas (C26)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `cancer_pancreas_c26_release_22b93205d12a`
- Lineage: forecast `cancer_pancreas_c26_forecast_h52_816324b0daf0_6cdeb79fd273` · refit `cancer_pancreas_c26_refit_final_e65ea9b99fbb_816324b0daf0` · dataset `cancer_pancreas_c26_c0f0642c8ea9`
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
- Gate congelado `d8de123c299a67ee75a5f493427cdea54836fb77fabe9db9a058c351db5619b2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
