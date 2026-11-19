# Pronóstico — Sífilis congénita (A50)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `sifilis_congenita_a50_release_75a396570357`
- Lineage: forecast `sifilis_congenita_a50_forecast_h52_e010f433aee6_65dc599bfdf3` · refit `sifilis_congenita_a50_refit_final_9fe0414b00c7_e010f433aee6` · dataset `sifilis_congenita_a50_6ab969a14a45`
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
- Gate congelado `fdf4619691313f87ee54b09fbb8913a10599b15441ddc0fd32f12d804673d406`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
