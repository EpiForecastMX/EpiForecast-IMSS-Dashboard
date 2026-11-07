# Hipertensión arterial — release hipertension_i10_release_053505b088df

Hipertensión arterial (I10, I11, I12, I13, I14, I15) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: ets_add_damped_log1p (29 series), ridge_harmonic_log1p (19 series), seasonal_mean_3y (1 series), seasonal_mean_5y (9 series), seasonal_median_5y (5 series), seasonal_naive_lag52 (1 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate b97a2cf4412fd7a7b66186da0f246566c6ebff5b9e920553579f504df3e2dc10). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
