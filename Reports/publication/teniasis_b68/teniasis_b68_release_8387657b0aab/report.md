# Pronóstico — Teniasis (B68)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `teniasis_b68_release_8387657b0aab`
- Lineage: forecast `teniasis_b68_forecast_h52_51c08b18cb38_731fa9aa7998` · refit `teniasis_b68_refit_final_9fe0414b00c7_51c08b18cb38` · dataset `teniasis_b68_89b79cc6e3a8`
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
- Veredicto `INCOMPLETE` · 1 de 4 semanas objetivo con verdad disponible.
- Gate congelado `365af8173e18cb0c19e3851d384fbb08dfe6fbdebc1c218a82ede6767efdfabf`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
