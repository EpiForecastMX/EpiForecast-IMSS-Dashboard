# Pronóstico — Otras infecciones intestinales debidas a protozoarios (A07.0, A07.2, A07.9)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `protozoarios_a07_release_f2efbad8fcea`
- Lineage: forecast `protozoarios_a07_forecast_h52_9a28a3d3d00d_7e033fec2967` · refit `protozoarios_a07_refit_final_9fe0414b00c7_9a28a3d3d00d` · dataset `protozoarios_a07_5f63a43d12f8`
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
- Gate congelado `6f9eec09307f5de48b50c6d628917208d41f2eb4ac667b34edb5d7f5686f3e4f`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
