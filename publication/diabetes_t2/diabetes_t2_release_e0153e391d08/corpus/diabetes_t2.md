# Diabetes mellitus tipo II — release diabetes_t2_release_e0153e391d08

Diabetes mellitus tipo II (E11, E12, E13, E14) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W41.

Motores del portafolio: ets_add_damped_log1p (34 series), ridge_harmonic_log1p (20 series), seasonal_mean_3y (2 series), seasonal_mean_5y (5 series), seasonal_median_5y (3 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate 4a8e4403994ba11536175f5b62455e136db32514197e67bb31023463a76de819). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
