# Pronóstico — Síndrome coqueluchoide (U99)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `coqueluchoide_u99_release_d3adeef64700`
- Lineage: forecast `coqueluchoide_u99_forecast_h52_9c259609d693_0f56b7151c33` · refit `coqueluchoide_u99_refit_final_9fe0414b00c7_9c259609d693` · dataset `coqueluchoide_u99_2fb7fc0279cc`
- Origen 2026-W43 → horizonte 52 semanas
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
- Gate congelado `12d2b4bddd1b672fa2b9130a88a3fe806ecae35913df20747f6f9d6ed6c2dbbd`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
