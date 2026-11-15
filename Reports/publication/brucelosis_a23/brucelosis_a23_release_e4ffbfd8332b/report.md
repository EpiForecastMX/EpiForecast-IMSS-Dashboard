# Pronóstico — Brucelosis (A23)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `brucelosis_a23_release_e4ffbfd8332b`
- Lineage: forecast `brucelosis_a23_forecast_h52_c5673e4393a1_0b7d4954843d` · refit `brucelosis_a23_refit_final_9fe0414b00c7_c5673e4393a1` · dataset `brucelosis_a23_f2ebf644e428`
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
- Gate congelado `ff4488cf3a46777660857aabac6e0990269c403ce8c64cf97e9d536cecb31782`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
