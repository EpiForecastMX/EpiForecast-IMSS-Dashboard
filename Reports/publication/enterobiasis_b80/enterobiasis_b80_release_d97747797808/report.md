# Pronóstico — Enterobiasis (B80)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `enterobiasis_b80_release_d97747797808`
- Lineage: forecast `enterobiasis_b80_forecast_h52_673791e8de04_a8609ddbc500` · refit `enterobiasis_b80_refit_final_9fe0414b00c7_673791e8de04` · dataset `enterobiasis_b80_576961f53369`
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
- Gate congelado `0b529d4cceda3f82d754753463a02294f693e1061b368a5d0ed2ef45ea41c453`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
