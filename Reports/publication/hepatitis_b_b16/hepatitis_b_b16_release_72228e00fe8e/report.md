# Pronóstico — Hepatitis vírica B (B16)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `hepatitis_b_b16_release_72228e00fe8e`
- Lineage: forecast `hepatitis_b_b16_forecast_h52_84d5066c3bee_9c96d4f24fca` · refit `hepatitis_b_b16_refit_final_9fe0414b00c7_84d5066c3bee` · dataset `hepatitis_b_b16_b7a50a59ec73`
- Origen 2026-W42 → horizonte 52 semanas
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
- Gate congelado `9b3a59a8cf0f0e68b51551c020deb8f95b496d91dc08f91e5317f22468c22637`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
