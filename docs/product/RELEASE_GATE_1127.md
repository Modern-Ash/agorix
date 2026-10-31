# Gate de recorridos #1127

Fecha: 2026-10-31. Destino: `https://agorix.modern-ash.com/`. SHA leído de `/version.json` y fijado en Playwright: `cc8224f8fb5f`. Código de esta rama: `86d1fda5` más las pruebas de este PR. La producción observada **no** contiene necesariamente las integraciones posteriores a `cc8224f8fb5f`.

## Evidencia reproducible

```sh
cd apps/web
AGORIX_E2E_BASE_URL=https://agorix.modern-ash.com AGORIX_EXPECT_SHA=cc8224f8fb5f \
  corepack pnpm exec playwright test -c playwright.prod.config.ts --workers=1
```

Resultado: **16 aprobadas, 1 omitida**. La omitida exige un despliegue con enlace de cuenta adulta habilitado. El smoke nuevo exige el SHA exacto en cada prueba, usa contextos descartables, no inicia sesión ni escribe al servidor. Los cambios de programa y los guardados son locales al navegador. Capturas: [escena](evidence/1127/prod-cc8224f8fb5f-scene.png), [propuesta en misión](evidence/1127/prod-cc8224f8fb5f-mission-proposal.png).

| Recorrido                   | Resultado observado en producción                                                                                                                                                        | Límite                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Usuario habituado a Scratch | Sesión fresca → Crear → Escena libre → categorías → Mover → código proyectado → Jugar (1 bloque ejecutado) → Deshacer/Rehacer → recargar con bloque conservado. Sin errores `pageerror`. | La captura y la automatización prueban operatividad, no familiaridad humana. No cubren edición de medios, importación ni todos los bloques. |
| Usuario principiante        | Sesión fresca → Mapa → Misión 1 → pistas → propuesta local revisable de Ori con host forzado a 503. Antes de decidir, el programa sigue vacío. Axe sin infracciones graves o críticas.   | No prueba que se complete la misión ni la calidad pedagógica.                                                                               |
| Ori por fase                | El smoke existente confirma guía quieta en Mapa/Crear; el nuevo confirma fallback de misión.                                                                                             | No acredita contexto remoto basado en trace, aceptación/cambio/rechazo y Undo en producción. #1124 y #1135 registran esos límites.          |
| Seguridad                   | Smoke existente: HTTPS, cabeceras, `/v1/session` privado, mismo origen y service worker.                                                                                                 | No equivale a una auditoría de seguridad completa.                                                                                          |
| Rama actual                 | `pnpm --filter @agorix/web build`: pasó. E2E locales de herramientas, franjas 6–8/9–12/13+ e interruptores de extensiones adultos: **9 aprobadas**.                                      | Este resultado local no se atribuye al SHA desplegado.                                                                                      |

## Estado del gate

**Abierto para entrega de integración.** Falta desplegar el SHA que contenga #1125, #1126 y los cambios de Ori, repetir los recorridos y capturas contra ese SHA, y completar las filas pendientes de la [matriz](SCRATCH_FUNCTIONAL_MATRIX_1122.md). También faltan recorrido touch y revisión de propuesta con Undo en producción, import/export y reapertura del proyecto desde Mis proyectos. La validación con un usuario real familiarizado con Scratch sigue el [protocolo de adopción](ADOPTION_USABILITY_CHECKLIST.md); los E2E no la sustituyen.

Los fallos iniciales `EAI_AGAIN` y cierre de Chromium ocurrieron dentro del sandbox; la misma suite pasó fuera de él. Se clasifican como entorno de ejecución, no como fallos del producto.
