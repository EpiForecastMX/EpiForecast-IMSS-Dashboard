# Otitis media aguda — release otitis_h65_release_3dce204c0ac3

Otitis media aguda (H65.0, H65.1) tiene 64 modelos finales, uno por serie base (estado × sexo). De esas 64 series base se derivan por suma 47 productos agregados, hasta un total de 111 productos. Los modelos y los productos NO son lo mismo: hay 64 modelos y 111 productos.

El pronóstico cubre 52 semanas desde 2026-W42.

Motores del portafolio: ets_add_damped_log1p (57 series), seasonal_median_5y (1 series), seasonal_naive_lag52 (6 series). Los productos derivados se atribuyen al portafolio, no a un motor concreto.

IMPORTANTE — incertidumbre: Pronóstico puntual; sin intervalo de incertidumbre. interval_method=none y uncertainty_available=false: este release NO tiene intervalos de confianza ni bandas de incertidumbre. No deben describirse como si existieran.

IMPORTANTE — validación prospectiva: Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos. El veredicto del gate congelado es INCOMPLETE con 0 de 4 semanas objetivo observadas (gate 34549d032f718bb1279c228bf7e8dd438f0c2e3deefa63b322bf2e5357d04cb2). Cualquier respuesta que use estas cifras debe declarar esa condición.

Estado de publicación: lifecycle=published.
