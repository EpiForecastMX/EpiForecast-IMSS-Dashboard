# Pronóstico — Insuficiencia venosa periférica (I87.2)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `ivp_i87_release_0b4b7fb06127`
- Lineage: forecast `ivp_i87_forecast_h52_494905741dc9_d91d6d4b6564` · refit `ivp_i87_refit_final_9fe0414b00c7_494905741dc9` · dataset `ivp_i87_fe523605c1c5`
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
- Gate congelado `42e0bb6a09910f08b707a977cefe3e2f4f4f78d221449ba77583235ffe301cfc`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
