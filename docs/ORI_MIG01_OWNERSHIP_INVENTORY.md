# Ori MIG-01 — inventario de integración y ownership

**Estado:** relevamiento inicial; no representa aprobación de cutover ni cierre de Modern-Ash/ori#27.

**Referencias:** [Ori #27](https://github.com/Modern-Ash/ori/issues/27), [Ori #6](https://github.com/Modern-Ash/ori/issues/6), [Agorix #722](https://github.com/Modern-Ash/agorix/issues/722).

**Destino:** Agorix `integration/ori`. No modificar `main`, `development` ni los trabajos de Kids de otros agentes.

## Inventario observado

| Superficie | Dueño | Evidencia / responsabilidad |
| --- | --- | --- |
| `packages/ori-agent` | Agorix, integración legacy | Contrato Kids de sugerencias con revisión, fallback determinista, sin herramientas/red propias; no retirar sin paridad. |
| `apps/tutor-api` | Agorix, host | Consumo y evaluación del proceso Ori real; validación de entradas/salidas y autorización del lado servidor. |
| Programa canónico, runtime, trace y proyectos | Agorix | Fuente exclusiva de verdad; Ori no escribe programa ni ejecuta mutaciones. |
| Currículo, misión y aprobación del aprendiz | Agorix | Componer contexto mínimo autorizado; revisión humana/infantil obligatoria. |
| `Modern-Ash/ori` | Ori, servicio headless | Planner, contratos, proveedores y tools ports; responde con planes y propuestas revisables. |
| `docs/ORI_V2_TRUSTED_HOST_ADAPTER.md` | Agorix | Adapter experimental solo servidor. El documento exige grants del host, revisión canónica y revalidación al aceptar/rechazar. |
| `docs/ORI_RUNTIME_CROSS_REPO_GATE.md` | Agorix | Verificación opt-in entre checkouts con `ORI_REPO_PATH`; distingue proceso real de una integración completa navegador-runtime. |

## Límites de confianza

1. Agorix deriva grants, identidad de proyecto, revisión canónica y traza de fuentes confiables; nunca admite esos valores como autoridad desde el navegador.
2. Ori recibe contexto mínimo y autorizado; no datos personales de niños ni persistencia de chat infantil.
3. Ori propone, pero no aplica diffs. Toda mutación exige revisión del aprendiz y revalidación de permisos y revisión canónica.
4. Fallo de Ori no debe impedir el funcionamiento offline/determinista del producto.
5. Los perfiles Kids no permiten shell, Git, filesystem ni red arbitraria mediante Ori.
6. Pruebas sintéticas o A/B con contexto desigual no acreditan eficacia pedagógica ni seguridad infantil en producción.

## Riesgos y verificaciones pendientes

| Riesgo | Verificación antes del cutover | Ticket |
| --- | --- | --- |
| Divergencia entre Ori nuevo y tutor legado | Comparación shadow/golden sobre contextos equivalentes y matriz de divergencias | Ori #29 |
| Grants o revisiones falsificables | Contract tests y pruebas adversariales del adapter real | Ori #28 |
| Pérdida de disponibilidad por fallos de proveedor | Ruta offline y rollback comprobados con fallos y timeouts | Ori #28, #30 |
| Filtración de datos del alumno | Auditoría de payloads y logs, tests de privacidad | Ori #23, #28 |
| Retiro prematuro del agente legacy | Gate documentado con evidencia de paridad, revisión humana y latencia | Ori #30 |

## Plan de transición

1. **MIG-01 (#27):** validar este inventario contra el código y las pruebas de ambos repositorios; identificar referencias y rutas exactas del legado. No mover código durante el inventario.
2. **MIG-02 (#28):** cerrar los contract tests API v1 en ambos extremos, con casos offline, rechazo de grants falsos y propuestas sin aplicación.
3. **MIG-03 (#29):** ejecutar shadow mode solo con fixtures sintéticas, guardar diferencias clasificadas, demostrar equivalencia de contexto o explicitar su ausencia.
4. **MIG-04 (#30):** activar progresivamente solo tras aprobación de los gates, con rollback y mediciones; conservar legacy hasta demostrar que su retiro es seguro.

## Evidencia y limitaciones

Inspeccionados en `integration/ori`: `packages/ori-agent/README.md`, `docs/ORI_V2_TRUSTED_HOST_ADAPTER.md`, `docs/ORI_RUNTIME_CROSS_REPO_GATE.md`, además del backlog de Ori #6/#27–#30 y Agorix #722.

**No ejecutado en este cambio:** tests locales, evaluación pediátrica, validación de tráfico real, prueba Playwright completa o cutover. Este PR solo agrega un inventario para revisión. Mantener los issues abiertos hasta verificar criterios de aceptación.
