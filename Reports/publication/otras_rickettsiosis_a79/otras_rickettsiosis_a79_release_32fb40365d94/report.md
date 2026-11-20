# Pronóstico — Otras rickettsiosis (A79)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `otras_rickettsiosis_a79_release_32fb40365d94`
- Lineage: forecast `otras_rickettsiosis_a79_forecast_h52_58fba2b36852_97fdd6ec8ae6` · refit `otras_rickettsiosis_a79_refit_final_9fe0414b00c7_58fba2b36852` · dataset `otras_rickettsiosis_a79_8bbb140ee21d`
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
- Gate congelado `d078e927d820b220975ab36b5f1f4267bac933db8e86db7057451ee4276f37bc`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
