# Gate de recorridos #1127

Fecha: 2026-10-31. Destino: `https://agorix.modern-ash.com/`. SHA leído de `/version.json` y fijado en Playwright: `cc8224f8fb5f`. La evidencia se amplió tras el merge de [PR #1154](https://github.com/Modern-Ash/agorix/pull/1154). La producción observada **no** contiene necesariamente las integraciones posteriores a `cc8224f8fb5f`.

## Evidencia reproducible

```sh
cd apps/web
AGORIX_E2E_BASE_URL=https://agorix.modern-ash.com AGORIX_EXPECT_SHA=cc8224f8fb5f \
  corepack pnpm exec playwright test -c playwright.prod.config.ts --workers=1
```

Primera corrida completa: **16 aprobadas, 1 omitida**. Tras añadir touch y portabilidad, la corrida completa terminó con **18 aprobadas, 1 omitida**. La omitida exige un despliegue con enlace de cuenta adulta habilitado. El smoke nuevo exige el SHA exacto en cada prueba, usa contextos descartables, no inicia sesión ni escribe al servidor. Los cambios de programa y los guardados son locales al navegador. Capturas: [escena](evidence/1127/prod-cc8224f8fb5f-scene.png), [propuesta en misión](evidence/1127/prod-cc8224f8fb5f-mission-proposal.png), [touch y Undo](evidence/1127/prod-cc8224f8fb5f-touch-ori-undo.png).

| Recorrido                   | Resultado observado en producción                                                                                                                                                                    | Límite                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Usuario habituado a Scratch | Sesión fresca → Crear → Escena libre → categorías → Mover → código proyectado → Jugar (1 bloque ejecutado) → Deshacer/Rehacer → recargar con bloque conservado. Sin errores `pageerror`.             | La captura y la automatización prueban operatividad, no familiaridad humana. No cubren edición de medios, importación ni todos los bloques. |
| Usuario principiante        | Sesión fresca → Mapa → Misión 1 → pistas → propuesta local revisable de Ori con host forzado a 503. Antes de decidir, el programa sigue vacío. Axe sin infracciones graves o críticas.               | No prueba que se complete la misión ni la calidad pedagógica.                                                                               |
| Touch y autoridad           | En teléfono 390×844, rechazar una idea local deja el programa intacto; aceptar agrega un bloque, Deshacer lo retira y la recarga conserva el bloque previo. Sin flags manuales ni scroll horizontal. | Prueba fallback local con host forzado a 503; no valida una respuesta de modelo ni el recorrido con lápiz.                                  |
| Persistencia e intercambio  | Escena guardada localmente → Mis proyectos → reabrir → exportar `.agorix` → importar → bloque conservado.                                                                                            | Archivo sin medios personales; no prueba el gate adulto de imágenes.                                                                        |
| Ori por fase                | El smoke existente confirma guía quieta en Mapa/Crear; los nuevos confirman fallback de misión y aceptar/rechazar/Undo local en Escena libre.                                                        | No acredita contexto remoto basado en trace ni cambio de una propuesta en producción. #1124 y #1135 registran esos límites.                 |
| Seguridad                   | Smoke existente: HTTPS, cabeceras, `/v1/session` privado, mismo origen y service worker.                                                                                                             | No equivale a una auditoría de seguridad completa.                                                                                          |
| Rama actual                 | `pnpm --filter @agorix/web build`: pasó. E2E locales de herramientas, franjas 6–8/9–12/13+ e interruptores de extensiones adultos: **9 aprobadas**.                                                  | Este resultado local no se atribuye al SHA desplegado.                                                                                      |

## Estado del gate antes del despliegue integrado

**Abierto en `cc8224f8fb5f`.** Faltaba desplegar el SHA que contuviera #1125, #1126 y los cambios de Ori, repetir los recorridos y capturas contra ese SHA, y completar las filas pendientes de la [matriz](SCRATCH_FUNCTIONAL_MATRIX_1122.md). También faltaban «Cambiar idea», perfiles de edad y permisos adultos en navegador público. El resultado posterior está documentado abajo. La validación con un usuario real familiarizado con Scratch sigue el [protocolo de adopción](ADOPTION_USABILITY_CHECKLIST.md); los E2E no la sustituyen.

Los fallos iniciales `EAI_AGAIN` y cierre de Chromium ocurrieron dentro del sandbox; la misma suite pasó fuera de él. Se clasifican como entorno de ejecución, no como fallos del producto.

El primer intento de portabilidad buscó «Exportar escena» en el editor, control añadido por #1126 y ausente de `cc8224f8fb5f`. Se corrigió el recorrido para usar «Exportar» en Mis proyectos, la ruta disponible en ese despliegue; pasó al repetirlo. Esa diferencia confirma que el SHA antiguo no debe usarse para acreditar #1126.

## Despliegue integrado y gate post-deploy

El 2026-10-31 se desplegó `main` en `0e10b7bc191f` con `pnpm deploy:web`, desde un checkout limpio. El preflight confirmó igualdad con `origin/main`; `pnpm verify` pasó (3.809 tests, 38 omitidos); la imagen Docker y el health gate local quedaron correctos. El script corrió el smoke público del commit y terminó con **19/19**. Una lectura independiente de `https://agorix.modern-ash.com/version.json` devolvió `0e10b7bc191f`. No hubo rollback.

Se amplió el smoke público para elegir las franjas 6–8, 9–12 y 13+ mediante Ajustes de Adultos, sin flags manuales, y comprobar que las ocho categorías siguen en Escena libre a 1280×800, 820×1180 y 390×844. También se verificó que apagar Lápiz y Música desde Adultos oculta esos paquetes sin quitar Movimiento, y que una idea contextual compuesta de Ori sigue provisional hasta «Cambiar idea», es deshacible y no entra al programa automáticamente. La corrida completa con `AGORIX_EXPECT_SHA=0e10b7bc191f` y `AGORIX_EXPECT_ADULT_LINK=1` pasó **24/24**.

Capturas del SHA integrado: [escena](evidence/1127/prod-0e10b7bc191f-scene.png), [misión y propuesta](evidence/1127/prod-0e10b7bc191f-mission-proposal.png), [touch y Undo](evidence/1127/prod-0e10b7bc191f-touch-ori-undo.png), [6–8](evidence/1127/prod-0e10b7bc191f-6-8.png), [9–12](evidence/1127/prod-0e10b7bc191f-9-12.png), [13+](evidence/1127/prod-0e10b7bc191f-13-plus.png).

El gate técnico de #1127 queda satisfecho para este SHA y estos recorridos. La prueba con un usuario real familiarizado con Scratch sigue pendiente en [ADOPTION_USABILITY_CHECKLIST.md](ADOPTION_USABILITY_CHECKLIST.md); el smoke no mide comprensión. La respuesta de un modelo remoto y el piloto privado con cuenta adulta corresponden a sus gates propios, no a la prueba anónima de fallback.
