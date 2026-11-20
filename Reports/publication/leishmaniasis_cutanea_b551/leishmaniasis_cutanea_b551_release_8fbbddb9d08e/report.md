# Pronóstico — Leishmaniasis cutánea (B55.1)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `leishmaniasis_cutanea_b551_release_8fbbddb9d08e`
- Lineage: forecast `leishmaniasis_cutanea_b551_forecast_h52_52ce1d9ecaa5_259662aaceb5` · refit `leishmaniasis_cutanea_b551_refit_final_9fe0414b00c7_52ce1d9ecaa5` · dataset `leishmaniasis_cutanea_b551_fe671041b5e3`
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
- Gate congelado `676e32419e5fe5b353060f647c3be19d3f00c5c6297bfc96f49f7759ff8bf550`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
