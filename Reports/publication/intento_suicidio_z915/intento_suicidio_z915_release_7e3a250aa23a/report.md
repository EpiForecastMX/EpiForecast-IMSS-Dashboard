# Pronóstico — Historia personal de lesión autoinfligida intencionalmente (intento de suicidio) (Z91.5)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `intento_suicidio_z915_release_7e3a250aa23a`
- Lineage: forecast `intento_suicidio_z915_forecast_h52_d176dedd38a8_faa6be1c8fe4` · refit `intento_suicidio_z915_refit_final_9fe0414b00c7_d176dedd38a8` · dataset `intento_suicidio_z915_29472542bf03`
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
- Gate congelado `14b455bfec79686bf11bc0de460a3e22bb9e82a913a66e4dcd36d937bc119860`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
