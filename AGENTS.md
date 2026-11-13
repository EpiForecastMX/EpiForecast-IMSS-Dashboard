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

## Checkpoint vigente — lote alta10b (publicado al fusionar y desplegar este cambio) — 12-nov-2026

Prevalece sobre la sección siguiente en cuanto a conteos. El sitio sirve 65 padecimientos: 4 del carril
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

El sitio sirve 55 padecimientos: 4 del carril original y 51 releases del runner. Veinte se añadieron el
12-nov-2026: diez portafolios aceptados en la prueba de 2025 (validación prospectiva 0/4 en curso) y diez
controles estacionales no validados, publicados tras su rechazo por autorización nominal del autor. Las
cifras vigentes salen de `publication/catalog.json`; los contratos del carril original (432 series, hero con
4 series) no cambian. Guía y decisiones pendientes en el backend: `docs/C7_15_ALTA20.md` y
`docs/alta20/DECISIONES_PENDIENTES.md`. En el EpiBot, el alcance por nombre y código CIE vive en
`epibot/js/release_catalog.js` y el estado de un control en la función RAG sale de su vista
(`estadoDeControl` en `epibot/netlify/functions/rag.mjs`); pruebas en `epibot/tests/test_alcance_*.mjs`.
Cierre del lote: frontend `939e1d86`. Al 12-nov-2026 el `main` del frontend no tenía checks de GitHub:
consultar los del SHA final y, si no hay, verificar el despliegue por el contenido servido.
