# De prompts a proceso: lo que aprendí usando Agora AI-SDLC sobre Agorix

Empecé este experimento con una expectativa simple: si AI-SDLC pretende que la IA conduzca el ciclo de desarrollo, yo debería escribir menos prompts, no más.

Agorix fue el proyecto elegido para probarlo de verdad. No un ejemplo preparado, sino un producto real con backlog, decisiones de UX, restricciones de arquitectura y varios agentes posibles.

El resultado del primer ciclo fue útil precisamente porque no salió perfecto.

## Antes del primer prompt: el backlog

El experimento no empezó con un agente escribiendo código. Primero convertimos el Product Intent, el MVP, la pedagogía y la arquitectura de Agorix en un backlog visible en GitHub.

Quedaron siete épicas:

- Product foundation and learner experience.
- Canonical program model and deterministic runtime.
- Visual editor, stage and block-to-text bridge.
- Guided learning and first mission.
- AI tutor with pedagogical guardrails.
- Child safety, persistence, platform quality and CI.
- Agora AI-SDLC proof-of-concept validation.

Cada épica se descompuso en issues verificables.

La idea era simple: GitHub Issues seguía siendo la work queue. Agora no debía reemplazarla, sino transformar un issue seleccionado en Intent, planificación, evidencia y decisiones gobernadas.

## Primer ciclo: issue #8

El primer trabajo elegido fue:

`#8 Define the POC learner journey and editor information architecture`

Arranqué con:

```bash
aisdlc start --issue 8 --agent opencode
```

AI-SDLC hizo varias cosas bien:

- leyó el issue a través de un Tool Run gobernado;
- creó un Intent durable;
- mantuvo GitHub como source;
- seleccionó OpenCode como agente;
- se detuvo antes de Construction.

El runtime real fue:

```text
OpenCode 1.18.32
    ↓
Ollama
    ↓
qwen3:8b
```

Eso fue importante porque el método no dependía del proveedor. OpenCode era la interfaz de agente, Ollama el runtime del modelo y qwen3:8b el modelo concreto.

## El primer problema: seguía teniendo que escribir el método a mano

Después de `aisdlc start`, el framework me dijo qué debía pasar:

- interpretar el Intent;
- generar un Level 1 Plan;
- proponer Units;
- proponer Bolts;
- detenerse para revisión humana.

Pero no lanzó el agente con ese comportamiento.

Tuve que abrir OpenCode y explicar manualmente cómo conducir Inception.

Ahí apareció el primer hallazgo importante:

> Seleccionar un agente no alcanza. El método tiene que viajar con el agente.

Si cada runtime necesita un prompt distinto para entender qué significa Inception, AI-SDLC sólo está envolviendo herramientas. No está orquestando el proceso.

Ese gap quedó registrado en Agora AI-SDLC como issue #154.

## El segundo problema: el agente podía hacer el trabajo, pero el contrato era débil

La primera respuesta de OpenCode/Ollama parecía razonable. Generó un learner journey completo.

El problema era metodológico: había saltado directamente al artefacto.

No había producido primero:

- Level 1 Plan;
- Units;
- Bolts;
- riesgos;
- clarificaciones materiales;
- boundary de decisión humana.

Además inventó decisiones de producto: sharing, badges, dashboards, ratios de layout y otras opciones que no estaban autorizadas.

Cuando el mismo runtime recibió una corrección metodológica, produjo una respuesta mucho mejor:

- interpretó el Intent;
- identificó clarificaciones materiales;
- propuso el Level 1 Plan;
- definió Units;
- propuso Bolts;
- separó hechos de propuestas;
- se detuvo para decisión humana.

El modelo era capaz.

El contrato del método no estaba siendo suficientemente exigente.

## El humano debería decidir, no operar el workflow

Las decisiones abiertas eran razonables:

- split entre bloques y código;
- comportamiento narrow viewport;
- highlight block→code;
- ubicación del tutor;
- autosave;
- exit behavior;
- alcance de First Mission.

Yo las resolví una vez.

Lo que no debería haber ocurrido era que después tuviera que volver a decirle manualmente al agente:

1. actualizá el plan;
2. aplicá las decisiones;
3. generá el documento;
4. pará para review;
5. ahora corregí findings;
6. ahora volvé a revisar.

Eso es Human-Driven SDLC con un agente rápido.

No AI-Driven SDLC.

## El review detectó algo más importante que un error de UX

El reviewer independiente encontró que varias decisiones estaban marcadas como `approved decision`.

La frase era verdadera desde la conversación: yo las había aprobado.

Pero no era auditable.

Agora tenía:

- el Intent;
- el Tool Run que leyó el issue;
- el artefacto generado.

No tenía un registro durable que demostrara quién había elegido 60/40, stacking mobile, autosave u otras decisiones materiales.

Eso produjo el issue #155:

`Persist material human Inception decisions as durable AI-SDLC evidence`.

Ese hallazgo cambió el sentido del experimento.

La supervisión humana no alcanza si vive solamente en una conversación.

Tiene que ser trazable.

## El review como loss function

El proceso de review sí mostró una propiedad interesante.

El primer output parecía plausible.

El review encontró decisiones inventadas.

El siguiente output ya produjo planificación correcta.

Otro review encontró la falta de provenance durable.

Después quedaron sólo ambigüedades menores: tutor disabled, Reset semantics, version mismatch, editing while running, narrow viewport.

Cada revisión redujo errores antes de que llegaran a Construction.

Ahí el concepto del paper empezó a hacerse visible en la práctica: el review humano/independiente funciona como una loss function que evita que errores tempranos se solidifiquen downstream.

## Pero hubo demasiados prompts

Para un solo issue terminamos haciendo algo parecido a:

```text
start
→ prompt de Inception
→ corrección metodológica
→ decisiones humanas
→ prompt de aplicación
→ independent review
→ rework
→ segundo review
→ cleanup
→ review focalizado
```

Eso es demasiado.

El issue #8 no estaba mal definido. Tenía:

- objetivo;
- fuentes;
- deliverable;
- restricciones;
- acceptance criteria;
- verification;
- non-goal.

La mayor parte de la fricción pertenecía al framework.

## Cómo debería verse AI-SDLC

Para un issue como #8, espero una experiencia más parecida a:

```bash
aisdlc start --issue 8
```

Y que AI-SDLC haga:

```text
Issue
  ↓
Intent
  ↓
portable skill
  ↓
runtime compatible
  ↓
Level 1 Plan
  ↓
Units + Bolts
  ↓
material decisions
  ↓
HUMAN
  ↓
artifact
  ↓
independent review
  ↓
bounded rework
  ↓
HUMAN acceptance
```

El humano debería aparecer sólo cuando aporta valor:

- trade-offs;
- cambio de scope;
- aceptación;
- riesgo;
- seguridad;
- decisiones de producto.

No para decirle a la IA qué paso metodológico viene después.

## Lo que voy a cambiar en Agora AI-SDLC

El primer ciclo de Agorix dejó tres mejoras concretas.

### 1. El skill debe ser el método

Start, Inception, Construction y Review deben estar definidos en un skill portable.

OpenCode, Ollama, Codex, Claude o un agente futuro deberían recibir el mismo contrato.

El runtime selecciona quién ejecuta.

No qué significa AI-SDLC.

### 2. Inception necesita un output contract

No alcanza con pedir “proponé un plan”.

La salida debe poder verificarse:

```text
Intent interpretation
Level 1 Plan
Units
Bolts
Material clarifications
Risks
Dependencies
Human decision required
```

Si falta el Level 1 Plan, el framework no debería considerar Inception preparada.

### 3. Las decisiones humanas deben ser durables

Una decisión tomada durante el diálogo debe convertirse en un registro auditable.

No debería ser necesario confiar en el historial privado de un chat para saber quién eligió un trade-off.

## La conclusión del primer ciclo

Mi conclusión no es que necesitamos prompts mejores.

Es casi la contraria:

> AI-SDLC mejora cuando los prompts dejan de ser responsabilidad del usuario y pasan a formar parte del método.

El framework debería absorber esa conversación repetitiva y convertirla en orchestration.

El usuario define el destino.

La IA propone el camino.

El humano corrige las decisiones importantes.

Y el sistema conserva la evidencia de cómo llegó hasta ahí.

Agorix todavía está en el primer ciclo, pero el dogfood ya hizo su trabajo: obligó a Agora AI-SDLC a pasar de ser una colección de controles correctos a empezar a convertirse en una experiencia realmente AI-driven.


## Second dogfood result: fewer prompts exposed deeper framework problems

The portable handoff solved the first visible problem: I no longer had to paste the complete Inception methodology into OpenCode. The agent read the handoff, the skill, the Intent and the source issue and produced a Level 1 Plan, Units and Bolts on its own.

That was progress, but the next layer of dogfood was more revealing.

The generated Markdown looked correct to a human while being invalid to the framework itself. The Plan used non-canonical references and an empty structured `steps` list; the Bolt Plan described Bolts in prose while persisting `bolts: []`. AI-SDLC had told the agent what to write, but it had not required the agent to validate what it persisted.

At the same time, `aisdlc continue` was still reading the bootstrap `first-work` rather than a Work bound to issue #8. The conversational context and the governed lifecycle had diverged.

A third mismatch appeared in the installed Method Pack: Agorix was still operating the legacy Core AI-DLC lifecycle instead of the newer AI-SDLC 0.2.0 three-phase method.

These findings became issues #158, #159 and #160.

That changes the next target for Agora AI-SDLC:

> Reducing prompts is necessary, but not sufficient. The framework must also guarantee that the agent's output is structurally valid, bound to the correct governed Work and evaluated against the intended Method Pack before a human is asked to approve anything.

The experiment therefore stopped before approving the Inception proposal. The correct next step is to fix the framework, then repeat the same issue and verify that the user only sees valid, correctly scoped decisions.
