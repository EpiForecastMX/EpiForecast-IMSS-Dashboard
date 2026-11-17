## Orden vigente del autor: cierre sincronizado en main (5-nov-2026)

El autor ordenó: «no dejar nada en ramas, todo siempre sincronizado». Aplica a
EpiForecast-MX y EpiForecast-IMSS-Dashboard y prevalece sobre recetas históricas
que terminaban dejando el checkout en una rama de trabajo.

- Las ramas y worktrees de desarrollo son temporales. El trabajo terminado debe
  quedar integrado en `main` y enviado a `origin/main`; ambos checkouts principales
  deben terminar en `main`, sin cambios pendientes de la tarea y sin divergencia.
- Antes de integrar, inventariar ramas, worktrees, stashes y cambios locales.
  Respaldar y verificar por hash los cambios ajenos; resolver los conflictos sin
  descartarlos. Nunca usar `reset --hard`, `clean`, force-push ni borrar trabajo
  único para aparentar sincronización. Un stash o una etiqueta de respaldo no
  equivalen a integración ni a cierre.
- Tras integrar y verificar CI, retirar las ramas locales y remotas ya contenidas
  en `main` y los worktrees temporales propios; conservar antes sus runs y evidencia.
  Las ramas con commits únicos requieren revisión e integración; no se borran ni
  se fusionan a ciegas. No abandonar silenciosamente cambios ajenos pendientes.
- Verificar con red `fetch --prune`, `HEAD == main == origin/main`, el SHA real de
  `refs/heads/main` en origin, estado del árbol, ramas restantes y CI del SHA final.
  Comprobar backend y frontend como un par; el despliegue público requiere además
  comprobar la versión servida. No confundir una referencia remota local con red.
- Si falta red, acceso o una decisión sobre cambios ajenos, el cierre queda
  bloqueado con el motivo y los pendientes exactos. No afirmar «todo sincronizado»
  ni «cerrado» por tener una PR fusionada o por conservar una copia en /tmp.
- La sincronización no autoriza reentrenar, reabrir 2025, cambiar criterios de
  aceptación, publicar otro padecimiento ni modificar artefactos sellados.

# Instrucciones del repositorio

## Versión con control A51 y fuente 2026-W44

Esta versión incorpora la configuración conjunta de **86 padecimientos publicados en el sitio** (`4` del carril original + **82 releases del runner**, gobernados por `publication/catalog.json` y `config/padecimientos.yaml` del backend) en paridad `F5` sobre la **semana fuente `2026-W44`** (`control_autorizado_20261116/week44/candidato_completo/dataset_boletin_epidemiologico.csv`, sha256 `0f6252f94e78b4af62044f81abe3977006f7e1cadb45bab8baf1512fb823ad44`, `92,155,130` B; `BASE_85_W43` `8c21883a…` es prefijo byte a byte de `BASE_86_W43` `82b6bd85…`, y `BASE_86_W43` es prefijo byte a byte de este consolidado `W44`), junto con el `raw` actualizado de COVID-19 `2026-W44` (`cf66c8704d57d8239156a46d396da2c8edf2758b0ec9a783ca3b6d53a0e1daa4`) y su emisión protocolaria `2026-W44.json` (`c8c88c36…`, sin evaluación acumulada) en el backend como base previa para `N=45`.

- **Control estacional no validado de `sifilis_adquirida_a51` (`Sífilis adquirida`, `A51-A53`, `sifilis_adquirida_a51.html`, `lag=1`):** publicado bajo `seasonal_naive_lag52` (`sifilis_adquirida_a51_release_a18527def134`, entrenado hasta `2026-W42` sobre `sifilis_adquirida_a51_0cc942faddb8`, horizonte de `52` semanas desde el origen `2026-W43..2027-W42` y no `52` semanas futuras) por **autorización directa del autor** (`«autorizo publicar el control»`, registrada en `control_autorizado_20261116/AUTORIZACION_AUTOR_CONTROL.json`, sha256 `8f3805d467815766228d2c34047bad9f69d80e7b9f1eed2e9bfa892a76e19d68`, instante de registro JSON `2026-11-17T01:20:40.821319+00:00` sin afirmar timestamp del mensaje de chat; en esta alta Fable audita de forma independiente y no decide —la delegación literal histórica de `alta20c` no se niega ni se hereda— ni equivale a firma humana). El boletín `2026_sem44.pdf` (`2026-W43`) estuvo disponible públicamente (`2026-11-17T01:23:31.237010+00:00` UTC) **antes** de emitir el pronóstico congelado (`2026-11-17T01:32:25.156213+00:00` UTC; observación separada `sifilis_adquirida_a51_eaca7efc1a11`, primer objetivo `2026-W43` conocido pre-emisión y no prospectivo); el contador técnico `1/4 INCOMPLETE` transita a `CONTROL_ONLY` al completar `4` semanas (**nunca `PASS`**), con divulgación obligatoria de `MASE > 1` en `64/64` bases, `D1`, riesgos `K6` (sexo/errata `2015_sem40.pdf`, `32` filas vacías `keep_period` + `1` celda `n.e.` en `raw` frente a `66` filas modeladas imputadas y `0` en `2025`, `12` encabezados raster en corpus `<= W43` con encabezado `44` verificado aparte, alcance `A51-A53` sin `A50`/`O98.1` y desambiguación de `sífilis` a secas) y pico oficial de Coahuila (`250` en `2026_sem12.pdf` → objetivo `2026-W11` → eco `2027-W11`; guía en el backend: `docs/C7_18_PILOTO_CARBON.md` §5).
- **Disposición nominal real de `miasis` en `2026_sem44.pdf`:** autorización directa del autor `«Sí: cifras intactas y aviso NO RECONCILIADO»` (`control_autorizado_20261116/AUTORIZACION_AUTOR_MIASIS44.json`, sha256 `febd17075686c7c63b7efe4e9e266ca8af865bfc0ca43c935d7741ca8530b45e`, pág. `81` col. `7` de `c6b328e4…`, suma estatal `830` vs total impreso `831` y Chihuahua `0 + 2 ≠ 1` sin modificar celdas bajo `display_status = NO_RECONCILIADO`, sin heredar a otros PDF; mecanismo nominal y pruebas en preparación, sin afirmar que la generación del radar `44` ya haya concluido).
- **Vigencia histórica y condición de despliegue verificado:** este bloque rige el estado actual de esta versión y prevalece sobre las referencias inferiores fechadas al `15-nov-2026` (`2026-W43`) y sobre cualquier mención previa de `A51` a `lifecycle: configured` (`0/1`) o autorización de control pendiente (que se conservan como historia anterior a la autorización del control); **en cambio, la prueba única `test_2025` de `A51` (`sifilis_adquirida_a51_benchmark_test_73490ea8b2b5_749316ac335e`, `+27.7169 %` > `10 %` en nacional General) permanece definitivamente consumida y rechazada** (prohibido reabrir `2025`, reseleccionar o cambiar criterios). La disponibilidad pública efectiva en `https://epiforecast.mx/` está condicionada a la revisión final independiente, la integración sincronizada en `main` de [EpiForecast-MX](https://github.com/EpiForecastMX/EpiForecast-MX) y [EpiForecast-IMSS-Dashboard](https://github.com/EpiForecastMX/EpiForecast-IMSS-Dashboard), las verificaciones remotas y la comprobación del contenido servido (ninguna se preafirma aquí; en backend `6c8021313f4589b070c726382ba8fe57abab882b` se verificó localmente la suite hidratada en `2,885 passed, 491 skipped, 66 deselected`, sin equivaler a CI remoto ni a `main`). Para consultar el estado operativo activo y el cierre durable de despliegue verificado, véanse `planes/piloto_carbon_alta1_2026-11-15/ROOT_CURRENT_STATUS.json` y `planes/piloto_carbon_alta1_2026-11-15/control_autorizado_20261116/CURRENT_STATUS_CONTROL_v5.json`.

## Checkpoint vigente — lote alta20c publicado — 15-nov-2026

Prevalece sobre las secciones siguientes en cuanto a conteos. El sitio sirve 85 padecimientos: 4 del carril original
y 81 releases del runner. Veinte se añadieron con alta20c: tres portafolios aceptados en su prueba única de 2025
(fiebre paratifoidea, mal del pinto y vulvovaginitis; validación prospectiva 0/4 en curso) y diecisiete controles
estacionales no validados por dictámenes delegados de Fable (delegación literal del autor del 15-nov; no son firma
humana): brucelosis, fiebre reumática, bocio, hepatitis B, rotavirus, absceso hepático amebiano, leptospirosis,
helmintiasis, desnutrición moderada y severa, enterobiasis, giardiasis, síndrome coqueluchoide, intoxicación por
plaguicidas, tos ferina, síndrome meníngeo e intoxicación por monóxido de carbono. Guía en el backend:
`docs/C7_17_ALTA20C.md`. Alcance del EpiBot: «meningitis» a secas pide precisar (el síndrome meníngeo es G00-G03
excepto G00.0 y G00.1); coqueluchoide y tos ferina son series distintas (rezago impreso 0: origen W43, primer
objetivo W44); plaguicidas y monóxido no distinguen intención y las consultas de riesgo personal reciben la respuesta
de crisis sin cifras (`epibot/tests/test_alcance_controles5.mjs`). La función RAG lee fichas HTML: deben ir en
`included_files` de `netlify.toml` (prueba `epibot/tests/test_rag_preview_aceptados3.mjs`).
Publicado y medido en producción: main `f065b839` (PR #98), Netlify `6af9d133`; 26/26 consultas a la API real, 141/141
archivos servidos byte iguales y navegador real. La nota D7 se añade de forma determinista a la respuesta generada
(`notaD7Rag`) porque el modelo puede omitirla; meningitis de tipo nombrado y G00.0/G00.1 reciben texto fijo
(`epibot/tests/test_meningitis_d7_rag.mjs`, `test_d7_guardas_alta20c.mjs`, `test_fable_pub5.mjs`). Tocar
`obesidad_kb.js` obliga a subir la cadena de caché `obesidad_kb.js` → `kb.js` → `app.js`, y
`tests/herramientas.test.mjs` fija la versión de `app.js`. Limitación ambiental: en este checkout, `npm run test:site`
da 106/107 porque `LuisMNA.jpeg` lleva un atributo de privacidad de macOS y el caso 101 de `tests/site_shell.test.mjs`
no puede copiarlo (EPERM); el mismo árbol da 107/107 en copia hermética. No tocar el archivo ni la prueba.
Mantenimiento pendiente, no ejecutado: O1 a O3 de la revisión final (`docs/DEUDAS_VIGENTES.md` del backend).

## Checkpoint — lote alta10b publicado — 12-nov-2026

Historia: tras alta10b el sitio servía 65 padecimientos: 4 del carril
original y 61 releases del runner. Diez se añadieron con el lote alta10b: cuatro portafolios aceptados en
la prueba única de 2025 con la política de cinco motores (ascariasis, hepatitis vírica A, efectos del calor y
de la luz, otras hepatitis víricas; validación prospectiva 0/4 en curso) y seis controles estacionales no
validados por autorización nominal del autor (desnutrición leve, otras salmonelosis, fiebre tifoidea,
escarlatina, hepatitis vírica C y displasia cervical severa con el cáncer cervicouterino in situ, sin sexo).
Guía en el backend: `docs/C7_16_ALTA10B.md`. Alcance del EpiBot: «hepatitis» a secas, «displasia
cervical» y «desnutrición» piden precisar; la hepatitis B aguda (B16), la paratifoidea, la desnutrición
moderada y severa y la displasia N87.9 no reciben cifras de un vecino (`epibot/tests/test_alcance_alta10b.mjs`).
Las letras de hepatitis se reescriben a «hepatitis vírica X» y esos alias llevan espacio final, porque
`nombraAlias` compara por prefijo («hepatitis virica a» capturaría «hepatitis virica aguda»).

## Checkpoint — lote alta20 publicado — 12-nov-2026

Historia (superada por alta10b y alta20c): el sitio servía entonces 55 padecimientos, 4 del carril original y 51
releases del runner. Veinte se añadieron el
12-nov-2026: diez portafolios aceptados en la prueba de 2025 (validación prospectiva 0/4 en curso) y diez
controles estacionales no validados, publicados tras su rechazo por autorización nominal del autor. Las
cifras vigentes salen de `publication/catalog.json`; los contratos del carril original (432 series, hero con
4 series) no cambian. Guía y decisiones pendientes en el backend: `docs/C7_15_ALTA20.md` y
`docs/alta20/DECISIONES_PENDIENTES.md`. En el EpiBot, el alcance por nombre y código CIE vive en
`epibot/js/release_catalog.js` y el estado de un control en la función RAG sale de su vista
(`estadoDeControl` en `epibot/netlify/functions/rag.mjs`); pruebas en `epibot/tests/test_alcance_*.mjs`.
Cierre del lote: frontend `939e1d86`. Al 12-nov-2026 el `main` del frontend no tenía checks de GitHub:
consultar los del SHA final y, si no hay, verificar el despliegue por el contenido servido.
