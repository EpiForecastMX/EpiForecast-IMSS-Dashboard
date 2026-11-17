# Pronóstico — Sífilis adquirida (A51, A52, A53)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `sifilis_adquirida_a51_release_a18527def134`
- Lineage: forecast `sifilis_adquirida_a51_forecast_h52_f05fe8367f4d_2d757fa262c6` · refit `sifilis_adquirida_a51_refit_final_9fe0414b00c7_f05fe8367f4d` · dataset `sifilis_adquirida_a51_0cc942faddb8`
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
- Gate congelado `7dc27e9b3d37209b91360e49e3e9b841cffeb866c285ee500f0a2c42f70d9f58`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
