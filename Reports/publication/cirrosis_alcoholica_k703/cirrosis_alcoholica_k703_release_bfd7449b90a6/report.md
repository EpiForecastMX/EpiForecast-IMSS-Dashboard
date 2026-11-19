# Pronóstico — Cirrosis hepática alcohólica (K70.3)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cirrosis_alcoholica_k703_release_bfd7449b90a6`
- Lineage: forecast `cirrosis_alcoholica_k703_forecast_h52_16029f60bac1_d55d85c54cb9` · refit `cirrosis_alcoholica_k703_refit_final_9fe0414b00c7_16029f60bac1` · dataset `cirrosis_alcoholica_k703_5efeabed79ed`
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
- Gate congelado `6620857f5e24d5013771de0f6d5361c18ea15eb991ced4de891299c3cdc89acf`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
