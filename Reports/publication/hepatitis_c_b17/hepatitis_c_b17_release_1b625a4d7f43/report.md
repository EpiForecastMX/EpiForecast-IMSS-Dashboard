# Pronóstico — Hepatitis vírica C (B17.1, B18.2)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `hepatitis_c_b17_release_1b625a4d7f43`
- Lineage: forecast `hepatitis_c_b17_forecast_h52_a59fc6cd2199_2dfbc0c21f6a` · refit `hepatitis_c_b17_refit_final_9fe0414b00c7_a59fc6cd2199` · dataset `hepatitis_c_b17_0a974ec6fc81`
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
- Gate congelado `b9b33b9d4d8009ad9d0ded8551d0c6e694e86b7f574e875afeeb4c2a94399262`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
