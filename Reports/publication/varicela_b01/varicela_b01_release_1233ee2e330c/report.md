# Pronóstico — Varicela (B01)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `varicela_b01_release_1233ee2e330c`
- Lineage: forecast `varicela_b01_forecast_h52_773ae56e9f11_05f4961e437f` · refit `varicela_b01_refit_final_9fe0414b00c7_773ae56e9f11` · dataset `varicela_b01_9409edf02bac`
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
- Gate congelado `730a0f10f25913763f6696c0abe50929be6abe37725c2f880b19b13ce4d1a3c1`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
