# Pronóstico — Conjuntivitis epidémica aguda hemorrágica (B30.3)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `conjuntivitis_hemorragica_b303_release_87c64c5f9316`
- Lineage: forecast `conjuntivitis_hemorragica_b303_forecast_h52_b96a82ebbbfe_ccde970463a9` · refit `conjuntivitis_hemorragica_b303_refit_final_9fe0414b00c7_b96a82ebbbfe` · dataset `conjuntivitis_hemorragica_b303_8624f8eadf8c`
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
- Veredicto `INCOMPLETE` · 1 de 4 semanas objetivo con verdad disponible.
- Gate congelado `f35ef9ed875cd58c56027f6bb97b9ab78fd00e160e4775ce0110710b46bd590e`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
