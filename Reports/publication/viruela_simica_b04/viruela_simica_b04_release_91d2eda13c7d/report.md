# Pronóstico — Viruela símica (B04)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `viruela_simica_b04_release_91d2eda13c7d`
- Lineage: forecast `viruela_simica_b04_forecast_h52_fd1ec78329ca_6dcbf43dafcd` · refit `viruela_simica_b04_refit_final_9fe0414b00c7_fd1ec78329ca` · dataset `viruela_simica_b04_48ff960c9890`
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
- Gate congelado `89aa51a3b4881041a7b288608843405aa3e6fcf884a235270819d449815a1128`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
