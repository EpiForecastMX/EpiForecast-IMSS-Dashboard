# Pronóstico — Infección por el virus de la inmunodeficiencia humana (B20, B21, B22, B23, B24, Z21)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `vih_b20_release_ea7cd45d29e7`
- Lineage: forecast `vih_b20_forecast_h52_7f39a7deb042_1769097d5216` · refit `vih_b20_refit_final_9fe0414b00c7_7f39a7deb042` · dataset `vih_b20_8783ea5a6a52`
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
- Gate congelado `a1a486a8cddef6f5adde51aa1dc2e97fd445455bf0382f5f8ae38d5507f886ea`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
