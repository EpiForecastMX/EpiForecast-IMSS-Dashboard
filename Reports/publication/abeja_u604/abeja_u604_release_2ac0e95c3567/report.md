# Pronóstico — Picadura de abeja (U60.4)

**Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**

- Release: `abeja_u604_release_2ac0e95c3567`
- Lineage: forecast `abeja_u604_forecast_h52_4cde10a1fbe3_4553aa01585b` · refit `abeja_u604_refit_final_947eb11f60fe_4cde10a1fbe3` · dataset `abeja_u604_171a6a33dda6`
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

- **Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `0a7606ceed0f8b326917d16a95c4b6b56494a24ae5cbb56b1af90f2b695b6485`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
