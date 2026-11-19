# Pronóstico — Lesión autoinfligida intencionalmente por objeto cortante (X78)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `objeto_cortante_x78_release_5377b5f38b46`
- Lineage: forecast `objeto_cortante_x78_forecast_h52_31e60fac18fb_97f6c2e08a71` · refit `objeto_cortante_x78_refit_final_7350c102eae7_31e60fac18fb` · dataset `objeto_cortante_x78_84c718e04498`
- Origen 2026-W43 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_mean_2y` | 15 |
| `seasonal_naive_lag52` | 49 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `9212fa1c6c520ec0c3c30ef1980510f06009598959a9f24f6169a390a2f704b5`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
