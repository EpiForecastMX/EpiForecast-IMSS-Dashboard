# Pronóstico — Enfermedad isquémica del corazón (I20, I25)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `isquemica_i20_release_791553dfcf93`
- Lineage: forecast `isquemica_i20_forecast_h52_5d2b385eff70_b8b69ffff56d` · refit `isquemica_i20_refit_final_9fe0414b00c7_5d2b385eff70` · dataset `isquemica_i20_c3e05e6d22cf`
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
- Gate congelado `93bbefdc65dc969a37b05fea947d7e9986034ce7bba8a27fe2d3b1c14cd7e143`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
