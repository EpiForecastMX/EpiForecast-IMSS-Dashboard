# Pronóstico — Tumor maligno del esófago (C15)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_esofago_c15_release_5c6a6bc1f3da`
- Lineage: forecast `cancer_esofago_c15_forecast_h52_0f2526b59df5_2f65bcbf4193` · refit `cancer_esofago_c15_refit_final_9fe0414b00c7_0f2526b59df5` · dataset `cancer_esofago_c15_9ed6d4350756`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `9db0c0f0c4a409aca31ff9aff767844629fbea7ac62e93226889915f64f68759`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
