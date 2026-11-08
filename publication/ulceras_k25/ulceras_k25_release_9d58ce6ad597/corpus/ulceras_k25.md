# Úlceras, gastritis y duodenitis — release ulceras_k25_release_9d58ce6ad597

Úlceras, gastritis y duodenitis (K25, K26, K27, K28, K29) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: ets_add_damped_log1p (40 series), ridge_harmonic_log1p (15 series), seasonal_mean_3y (3 series), seasonal_mean_5y (3 series), seasonal_naive_lag52 (3 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate b2a7558aacb0f44bde020fd861791eb7a6e841b4a0543a2cb34268e9cbc046c6). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
