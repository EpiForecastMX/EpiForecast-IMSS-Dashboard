# Pronóstico — Fiebre manchada (A77.0)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `fiebre_manchada_a770_release_a37deb0ac7f9`
- Lineage: forecast `fiebre_manchada_a770_forecast_h52_d10a5bcd07fd_0cb9650cb5ae` · refit `fiebre_manchada_a770_refit_final_9fe0414b00c7_d10a5bcd07fd` · dataset `fiebre_manchada_a770_e127fe52d053`
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
- Gate congelado `07cc745c2ab76ed30d1217008455317fa172d4a966170789046648c1056e629a`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
