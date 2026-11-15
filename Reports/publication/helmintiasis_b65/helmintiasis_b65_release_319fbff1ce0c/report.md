# Pronóstico — Otras helmintiasis (B65, B66, B67, B70, B71, B72, B74, B76, B78, B79, B81, B82, B83)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `helmintiasis_b65_release_319fbff1ce0c`
- Lineage: forecast `helmintiasis_b65_forecast_h52_e9c807ad4bea_02a4122dd70c` · refit `helmintiasis_b65_refit_final_9fe0414b00c7_e9c807ad4bea` · dataset `helmintiasis_b65_251617083535`
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
- Gate congelado `bd06e32c22f22c237f2403c7b4a5f503a7e1a44cfd5143d0a71e03abd3abf345`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
