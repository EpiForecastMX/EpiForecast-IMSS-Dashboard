# Pronóstico — Displasia cervical severa y CaCu in situ (N87.2, D06)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `displasia_severa_n87_release_2046566a5794`
- Lineage: forecast `displasia_severa_n87_forecast_h52_4e7d9a83cee0_73157a5e81c3` · refit `displasia_severa_n87_refit_final_30e6b4ef89df_4e7d9a83cee0` · dataset `displasia_severa_n87_538858b62aa5`
- Origen 2026-W42 → horizonte 52 semanas
- 32 modelos finales sobre 32 series base; 5 productos derivados por suma → 37 productos, 1924 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 32 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 5 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `6e2cc3d46a9018493f9c3ab0cc4a0e68590b38f414404023d595192f85ad6faf`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
