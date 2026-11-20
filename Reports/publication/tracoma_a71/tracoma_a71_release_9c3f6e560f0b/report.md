# Pronóstico — Tracoma (A71)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tracoma_a71_release_9c3f6e560f0b`
- Lineage: forecast `tracoma_a71_forecast_h52_856fe0b99067_dc3a4b9d836b` · refit `tracoma_a71_refit_final_9fe0414b00c7_856fe0b99067` · dataset `tracoma_a71_d2d6fdec4c2e`
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
- Gate congelado `25af1d49c636df225036d319bfd1053f7fdff652178fbf35fe354688125c4da8`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
