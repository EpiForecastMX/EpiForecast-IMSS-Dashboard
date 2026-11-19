# Pronóstico — Tétanos (A34, A35)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tetanos_a34_release_cd4de88372e8`
- Lineage: forecast `tetanos_a34_forecast_h52_1b728d367f0e_78a973635e32` · refit `tetanos_a34_refit_final_9fe0414b00c7_1b728d367f0e` · dataset `tetanos_a34_ef42a36243c2`
- Origen 2026-W44 → horizonte 52 semanas
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
- Gate congelado `74f2d149bb27c936a7b88e4887199a835be7aaa3287b548f10f68dc3f8c3e681`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
