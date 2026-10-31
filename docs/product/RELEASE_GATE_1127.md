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

## Estado del gate

**Abierto para entrega de integración.** Falta desplegar el SHA que contenga #1125, #1126 y los cambios de Ori, repetir los recorridos y capturas contra ese SHA, y completar las filas pendientes de la [matriz](SCRATCH_FUNCTIONAL_MATRIX_1122.md). También faltan la variante «Cambiar idea» y la respuesta remota de Ori en producción, los perfiles de edad y permisos adultos en navegador público, y edición de medios. La validación con un usuario real familiarizado con Scratch sigue el [protocolo de adopción](ADOPTION_USABILITY_CHECKLIST.md); los E2E no la sustituyen.

Los fallos iniciales `EAI_AGAIN` y cierre de Chromium ocurrieron dentro del sandbox; la misma suite pasó fuera de él. Se clasifican como entorno de ejecución, no como fallos del producto.

El primer intento de portabilidad buscó «Exportar escena» en el editor, control añadido por #1126 y ausente de `cc8224f8fb5f`. Se corrigió el recorrido para usar «Exportar» en Mis proyectos, la ruta disponible en ese despliegue; pasó al repetirlo. Esa diferencia confirma que el SHA antiguo no debe usarse para acreditar #1126.
