# Pronóstico — Mordeduras por otros mamíferos (W55)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `mordedura_mamiferos_w55_release_41b1df4d6c71`
- Lineage: forecast `mordedura_mamiferos_w55_forecast_h52_59612e4fa035_f4d289bd6b6f` · refit `mordedura_mamiferos_w55_refit_final_9fe0414b00c7_59612e4fa035` · dataset `mordedura_mamiferos_w55_b65afdb7b1d0`
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
- Gate congelado `f720e466ccf07fa42e42e3de96c391020669c9c9ee12553bf80df3ea79849d48`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
