# Obesidad — release obesidad_release_2517e7858901

Obesidad (E66) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W26.

Motores del portafolio: ets_add_damped_log1p (16 series), prophet_count_log1p (5 series), prophet_rate_log1p (5 series), ridge_harmonic_log1p (12 series), seasonal_mean_5y (16 series), seasonal_median_5y (10 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva superada (4/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es PASS con 4 de 4 semanas objetivo observadas (gate 5bc39aa5d44f5e62062775dc09a0366ac856f47e5444fbb52ca07e608e61b65d). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
