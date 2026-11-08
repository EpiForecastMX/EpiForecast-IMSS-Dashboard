# Pronóstico — Tumor maligno de la mama (C50)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_mama_c50_release_ee47f3dfc962`
- Lineage: forecast `cancer_mama_c50_forecast_h52_4bc2c7ac4efa_68d55b0a092a` · refit `cancer_mama_c50_refit_final_9fe0414b00c7_4bc2c7ac4efa` · dataset `cancer_mama_c50_2be16e7b2c1c`
- Origen 2026-W41 → horizonte 52 semanas
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
- Gate congelado `a279242306034589de8fe4f7e0391bf7a412010a5c3924a19c9e3191462740d8`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
