# Pronóstico — Desnutrición leve (E44.1)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `desnutricion_leve_e441_release_30b1895c19bd`
- Lineage: forecast `desnutricion_leve_e441_forecast_h52_61b317b8eb85_72b6bc5ce874` · refit `desnutricion_leve_e441_refit_final_9fe0414b00c7_61b317b8eb85` · dataset `desnutricion_leve_e441_e211223d9d39`
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
- Gate congelado `3f9d55c0adbb5514eceea25b4e030d8841f7569a7aff3788f645b2c7731da984`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
