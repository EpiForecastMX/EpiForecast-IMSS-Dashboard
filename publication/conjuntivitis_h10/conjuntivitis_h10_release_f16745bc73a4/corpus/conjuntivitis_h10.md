# Conjuntivitis — release conjuntivitis_h10_release_f16745bc73a4

Conjuntivitis (H10) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W42.

Motores del portafolio: ets_add_damped_log1p (61 series), ridge_harmonic_log1p (1 series), seasonal_mean_3y (1 series), seasonal_mean_5y (1 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate 0cb235f7078b3ef4344cd2443a3d0240fa55338d9307a4859c55e31b82347963). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
