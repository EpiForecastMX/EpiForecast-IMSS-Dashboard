# Pronóstico — Infección por virus de papiloma humano (B97.7)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `vph_b97_release_532749b67520`
- Lineage: forecast `vph_b97_forecast_h52_b0650e639a1d_619b5fc1ba13` · refit `vph_b97_refit_final_9fe0414b00c7_b0650e639a1d` · dataset `vph_b97_1f7e0b59881f`
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
- Gate congelado `0f064a4e55681c59055d4b97e238d659e3004ec4f69f5b093c995fdabefba6f9`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
