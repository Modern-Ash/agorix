import type { Locale } from "../i18n.js";

/**
 * What every control does, in a sentence a child can read (issue #1246). One table: the tooltip
 * layer asks it for the control under the pointer or the keyboard focus, so a new button needs one
 * line here and the e2e check (`kids-tooltips.spec.ts`) fails until it has one.
 *
 * A rule matches by something stable (a class, a data attribute) and, where the control has none,
 * by its accessible name in Spanish or English. The first rule that matches wins.
 */
type Tip = { readonly es: string; readonly en: string };
interface TipRule {
  readonly match: (control: HTMLElement) => boolean;
  readonly tip: Tip | ((control: HTMLElement) => Tip);
}

const label = (control: HTMLElement): string =>
  (control.getAttribute("aria-label") ?? control.textContent ?? "").replace(/\s+/g, " ").trim();
/** Whether the control sits in a labelled group whose name matches. */
const groupLabel = (control: HTMLElement, pattern: RegExp): boolean => {
  const group = control.closest<HTMLElement>("[role='group'][aria-label]");
  return group !== null && pattern.test(group.getAttribute("aria-label") ?? "");
};
const named = (pattern: RegExp) => (control: HTMLElement) => pattern.test(label(control));
const cls = (name: string) => (control: HTMLElement) => control.classList.contains(name);

/** What each block does, by block kind (`data-kids-block`). */
export const BLOCK_TIPS: Readonly<Record<string, Tip>> = {
  move: {
    es: "Mover: el personaje camina hacia donde mira",
    en: "Move: the character walks where it faces",
  },
  goTo: { es: "Ir a una posición del escenario", en: "Jump to a spot on the stage" },
  nextCostume: {
    es: "Pasar al siguiente disfraz",
    en: "Change to the next costume",
  },
  setRotationStyle: {
    es: "Elegir cómo se ve al girar: toda la vuelta o solo de lado",
    en: "Choose how it looks when it turns",
  },
  createCopies: {
    es: "Hacer copias del personaje que aparecen al jugar",
    en: "Make copies of the character that appear when you play",
  },
  goToTarget: {
    es: "Ir a un lugar al azar o hacia el puntero",
    en: "Jump to a random spot or to the pointer",
  },
  setX: { es: "Fijar la posición de lado a lado", en: "Set the left-right position" },
  setY: { es: "Fijar la altura en el escenario", en: "Set the height on the stage" },
  changeX: { es: "Correr hacia un lado sin girar", en: "Slide sideways without turning" },
  changeY: { es: "Subir o bajar sin girar", en: "Move up or down without turning" },
  glideTo: { es: "Deslizarse suave hasta una posición", en: "Glide smoothly to a spot" },
  turn: { es: "Girar: el personaje mira para otro lado", en: "Turn: changes where it faces" },
  pointInDirection: {
    es: "Mirar hacia arriba, abajo o a un lado",
    en: "Face up, down or sideways",
  },
  pointTowards: { es: "Mirar hacia otro personaje", en: "Face another character" },
  bounceOnEdge: {
    es: "Rebotar si toca el borde del escenario",
    en: "Bounce when it touches the edge",
  },
  goToLayer: {
    es: "Pasar delante o detrás de los demás",
    en: "Go in front of or behind the others",
  },
  say: {
    es: "Decir algo en una burbuja (o por unos segundos)",
    en: "Say something in a bubble (or for a few seconds)",
  },
  think: {
    es: "Pensar algo en una burbuja (o por unos segundos)",
    en: "Think something in a bubble (or for a few seconds)",
  },
  show: { es: "Mostrar al personaje", en: "Show the character" },
  hide: { es: "Esconder al personaje", en: "Hide the character" },
  setSize: { es: "Poner un tamaño: más grande o más chico", en: "Set a size: bigger or smaller" },
  changeSize: { es: "Agrandar o achicar un poco", en: "Grow or shrink a little" },
  setEffect: { es: "Poner un efecto de color o brillo", en: "Set a colour or glow effect" },
  changeEffect: { es: "Cambiar un efecto de a poco", en: "Change an effect a little at a time" },
  clearEffects: { es: "Quitar todos los efectos", en: "Remove every effect" },
  resetTimer: {
    es: "Volver a contar el tiempo desde cero",
    en: "Start counting the time again from zero",
  },
  deleteThisClone: {
    es: "Esta copia desaparece de la escena",
    en: "This copy disappears from the scene",
  },
  wait: { es: "Esperar unos segundos antes de seguir", en: "Wait a few seconds before going on" },
  switchCostume: { es: "Cambiar el disfraz del personaje", en: "Change the character's costume" },
  switchBackdrop: { es: "Cambiar el fondo de la escena", en: "Change the scene's backdrop" },
  playSound: { es: "Hacer sonar un sonido", en: "Play a sound" },
  stopSounds: { es: "Callar todos los sonidos", en: "Silence every sound" },
  setVolume: { es: "Fijar qué tan fuerte suena", en: "Set how loud it sounds" },
  changeVolume: { es: "Subir o bajar el volumen", en: "Turn the volume up or down" },
  stop: {
    es: "Parar este programa, el personaje o toda la escena",
    en: "Stop this program, the character or the whole scene",
  },
  askText: {
    es: "Preguntar algo y guardar la palabra que escribas",
    en: "Ask something and keep the word you type",
  },
  askChoice: {
    es: "Hacer una pregunta con opciones para elegir",
    en: "Ask a question with choices",
  },
  repeat: {
    es: "Repetir los bloques de adentro varias veces",
    en: "Repeat the blocks inside a few times",
  },
  repeatUntil: { es: "Repetir hasta que pase algo", en: "Repeat until something happens" },
  forever: { es: "Repetir sin parar", en: "Repeat without stopping" },
  waitUntil: { es: "Esperar hasta que pase algo", en: "Wait until something happens" },
  if: { es: "Si pasa algo, hacer estos bloques", en: "If something happens, do these blocks" },
  broadcast: {
    es: "Mandar un mensaje a los demás personajes (o esperar a que terminen)",
    en: "Send a message to the other characters (or wait for them to finish)",
  },
  callProcedure: { es: "Usar un bloque que armaste vos", en: "Use a block you made" },
  penDown: {
    es: "Bajar el lápiz: deja una línea al moverse",
    en: "Pen down: leaves a line as it moves",
  },
  penUp: { es: "Subir el lápiz: deja de dibujar", en: "Pen up: stops drawing" },
  setPenColor: { es: "Elegir el color del lápiz", en: "Choose the pen colour" },
  setPenSize: { es: "Elegir qué tan gruesa es la línea", en: "Choose how thick the line is" },
  setPenTransparency: {
    es: "Elegir qué tan transparente es la línea",
    en: "Choose how see-through the line is",
  },
  setPenShade: {
    es: "Elegir si la línea sale más clara o más oscura",
    en: "Choose whether the line is lighter or darker",
  },
  clearPen: { es: "Borrar todo lo dibujado", en: "Erase everything drawn" },
  stamp: {
    es: "Dejar una copia del personaje en el lugar donde está",
    en: "Leave a copy of the character where it is",
  },
  playNote: { es: "Tocar una nota musical", en: "Play a musical note" },
  playDrum: { es: "Tocar un tambor", en: "Play a drum" },
  setInstrument: { es: "Elegir el instrumento", en: "Choose the instrument" },
  setTempo: { es: "Elegir qué tan rápida es la música", en: "Choose how fast the music is" },
  setPitch: { es: "Hacer la música más grave o más aguda", en: "Make the music lower or higher" },
  setPan: {
    es: "Mandar el sonido a la izquierda o a la derecha",
    en: "Send the sound left or right",
  },
  setText: { es: "Guardar una palabra para usarla después", en: "Keep a word to use later" },
  setVariable: { es: "Guardar un número en una variable", en: "Keep a number in a variable" },
  changeVariable: {
    es: "Sumarle o restarle a una variable",
    en: "Add to or subtract from a variable",
  },
  showVariable: { es: "Mostrar la variable en el escenario", en: "Show the variable on the stage" },
  hideVariable: { es: "Esconder la variable", en: "Hide the variable" },
  listAdd: { es: "Agregar algo al final de la lista", en: "Add something to the end of the list" },
  listRemoveAt: { es: "Sacar algo de la lista", en: "Take something out of the list" },
  listInsertAt: {
    es: "Meter algo en un lugar de la lista",
    en: "Put something in a place of the list",
  },
  listReplaceAt: { es: "Cambiar algo de la lista", en: "Change something in the list" },
};

const CATEGORY_TIPS: Readonly<Record<string, Tip>> = {
  motion: {
    es: "Movimiento: bloques para que el personaje se mueva",
    en: "Motion: blocks that move the character",
  },
  looks: { es: "Apariencia: cómo se ve y qué dice", en: "Looks: how it looks and what it says" },
  media: {
    es: "Disfraces y sonidos: cambiar de aspecto y hacer ruido",
    en: "Costumes and sounds: change looks and make noise",
  },
  logic: {
    es: "Eventos y control: repetir, esperar y decidir",
    en: "Events and control: repeat, wait and decide",
  },
  pen: { es: "Lápiz: dibujar mientras se mueve", en: "Pen: draw while it moves" },
  music: {
    es: "Música: notas, tambores e instrumentos",
    en: "Music: notes, drums and instruments",
  },
  data: {
    es: "Variables y listas: guardar números y cosas",
    en: "Variables and lists: keep numbers and things",
  },
  myBlocks: { es: "Mis bloques: los que armaste vos", en: "My blocks: the ones you made" },
};

const t = (es: string, en: string): Tip => ({ es, en });

export const TIP_RULES: readonly TipRule[] = [
  // Ori's ideas for a picture (#1308): each button carries its own sentence, already in the locale.
  {
    match: (c) =>
      c.matches("button") &&
      (c.closest(".kids-art-variation") !== null ||
        (c.getAttribute("data-testid") ?? "").startsWith("art-variation")),
    tip: (c) => {
      const sentence = c.getAttribute("title") ?? "";
      return { es: sentence, en: sentence };
    },
  },
  // The copy-script panel (#1311): each button carries its own sentence, already in the locale.
  {
    match: (c) => c.closest(".kids-copy-script") !== null && c.matches("button"),
    tip: (c) => {
      const sentence = c.getAttribute("title") ?? "";
      return { es: sentence, en: sentence };
    },
  },
  // The editor's top bar and its helpers.
  {
    match: cls("kids-studio-back"),
    tip: t(
      "Volver a la pantalla de antes. Tu trabajo queda guardado.",
      "Go back. Your work is saved.",
    ),
  },
  {
    match: cls("kids-mission-pill"),
    tip: t("Ver la meta de la misión completa", "See the whole mission goal"),
  },
  {
    match: cls("kids-hint-button"),
    tip: t(
      "Una pista para ayudarte, sin hacerlo por vos",
      "A hint to help you, without doing it for you",
    ),
  },
  {
    match: cls("kids-band-chip"),
    tip: t("Tu franja de edad: qué te muestra la app", "Your age band: what the app shows you"),
  },
  {
    match: named(/^(Deshacer|Undo)$/),
    tip: t("Deshacer el último cambio", "Undo the last change"),
  },
  {
    match: named(/^(Rehacer|Redo)$/),
    tip: t("Volver a hacer lo que deshiciste", "Redo what you undid"),
  },
  {
    match: named(/^(Atajos|Shortcuts)/),
    tip: t("Ver las teclas rápidas", "See the keyboard shortcuts"),
  },
  {
    match: named(/^(Exportar escena|Export scene)/),
    tip: t("Guardar la escena en un archivo", "Save the scene to a file"),
  },
  {
    match: named(/^(Ayuda|Help)$/),
    tip: t("Ayuda para usar el editor", "Help for using the editor"),
  },
  // Run controls.
  { match: cls("kids-flag-button"), tip: t("Jugar: correr tu programa", "Play: run your program") },
  {
    match: cls("kids-stop-button"),
    tip: t("Volver al inicio: frenar y empezar de nuevo", "Back to start: stop and begin again"),
  },
  {
    match: cls("kids-replay-button"),
    tip: t(
      "Otra vez: ver de nuevo lo que pasó, con lo mismo que tocaste",
      "Again: watch what happened once more, with the same taps and keys",
    ),
  },
  {
    match: cls("kids-ori-noticed-button"),
    tip: t("Ori vio algo en lo que pasó", "Ori noticed something in what happened"),
  },
  {
    match: cls("kids-ori-rephrase-button"),
    tip: t("Pedirle a Ori que lo diga con otras palabras", "Ask Ori to say it in other words"),
  },
  {
    match: cls("kids-show-when"),
    tip: t("Ir al momento en que pasó", "Go to the moment it happened"),
  },
  {
    match: (control) => control.matches(".kids-timeline input[type='range']"),
    tip: t(
      "Arrastrá para ver cómo estaba la escena en cada paso",
      "Drag to see the scene at each step",
    ),
  },
  {
    match: cls("kids-show-in-program"),
    tip: t("Mostrar el bloque del que habla Ori", "Show the block Ori is talking about"),
  },
  {
    match: named(/Paso$|Step$/),
    tip: t("Paso: ver un bloque por vez", "Step: watch one block at a time"),
  },
  {
    match: named(/^(Pantalla completa|Full screen)/),
    tip: t("Ver el escenario en pantalla completa", "See the stage full screen"),
  },
  // Editor activities (side tabs and the phone bar).
  {
    match: (c) =>
      (c.classList.contains("kids-studio-tab") ||
        c.classList.contains("kids-studio-bottom-button")) &&
      /Código|Code/.test(label(c)),
    tip: t("Código: tu programa escrito con letras", "Code: your program written out"),
  },
  {
    match: (c) =>
      (c.classList.contains("kids-studio-tab") ||
        c.classList.contains("kids-studio-bottom-button")) &&
      /Disfraces|Costumes/.test(label(c)),
    tip: t(
      "Disfraces: elegí o dibujá cómo se ve cada personaje",
      "Costumes: pick or draw how each character looks",
    ),
  },
  {
    match: (c) =>
      (c.classList.contains("kids-studio-tab") ||
        c.classList.contains("kids-studio-bottom-button")) &&
      /Sonidos|Sounds/.test(label(c)),
    tip: t(
      "Sonidos: escuchá y elegí sonidos para tu escena",
      "Sounds: listen and pick sounds for your scene",
    ),
  },
  {
    match: (c) =>
      c.classList.contains("kids-studio-bottom-button") && /Bloques|Blocks/.test(label(c)),
    tip: t(
      "Bloques: las piezas para armar tu programa",
      "Blocks: the pieces to build your program",
    ),
  },
  // Block palette.
  {
    match: (c) => c.classList.contains("kids-studio-category"),
    tip: (c) =>
      CATEGORY_TIPS[c.dataset["category"] ?? ""] ??
      t("Una familia de bloques", "A family of blocks"),
  },
  {
    match: (c) => c.matches(".kids-palette-tool-add[data-kids-block]"),
    tip: (c) =>
      BLOCK_TIPS[c.dataset["kidsBlock"] ?? ""] ??
      t("Agregar este bloque a tu programa", "Add this block to your program"),
  },
  {
    match: (c) => c.classList.contains("kids-palette-tool-add"),
    tip: t("Escuchar el sonido antes de elegirlo", "Listen to the sound before choosing it"),
  },
  { match: named(/^(★ )?(Mover|Move)$/), tip: BLOCK_TIPS["move"]! },
  { match: named(/^(★ )?(Girar a la derecha|Turn right)$/), tip: BLOCK_TIPS["turn"]! },
  { match: named(/^(★ )?(Sonar|Play sound)$/), tip: BLOCK_TIPS["playSound"]! },
  { match: named(/^(★ )?(Repetir|Repeat)$/), tip: BLOCK_TIPS["repeat"]! },
  { match: named(/^(★ )?(Esperar|Wait)$/), tip: BLOCK_TIPS["wait"]! },
  {
    match: cls("kids-palette-view-toggle"),
    tip: t(
      "Ver los bloques de a una familia o todos juntos",
      "See blocks one family at a time or all together",
    ),
  },
  {
    match: cls("kids-palette-collapse"),
    tip: t("Esconder o mostrar la lista de bloques", "Hide or show the list of blocks"),
  },
  // Blocks of the Logic, Data, Pen and Music families that are plain buttons in the palette.
  {
    match: named(/^\+ (Si toca el borde|If at edge)/),
    tip: t("Si toca el borde, hacer lo que sigue", "If it touches the edge, do what follows"),
  },
  {
    match: named(/^\+ (Si toca,|If touching)/),
    tip: t(
      "Si toca a otro personaje, hacer lo que sigue",
      "If it touches another character, do what follows",
    ),
  },
  {
    match: named(/^\+ (Si la tecla|If the key)/),
    tip: t("Si hay una tecla apretada, hacer lo que sigue", "If a key is held, do what follows"),
  },
  {
    match: named(/^\+ (Si el ratón|If the mouse)/),
    tip: t(
      "Si el ratón está apretado, hacer lo que sigue",
      "If the mouse is held, do what follows",
    ),
  },
  {
    match: named(/^\+ (Condición combinada|Combined condition)/),
    tip: t("Juntar dos condiciones: que pasen las dos", "Join two conditions: both must happen"),
  },
  { match: named(/^\+ (Esperar hasta|Wait until)/), tip: BLOCK_TIPS["waitUntil"]! },
  { match: named(/^\+ (Detener|Stop)$/), tip: BLOCK_TIPS["stop"]! },
  { match: named(/^\+ (Preguntar con opciones|Ask with choices)/), tip: BLOCK_TIPS["askChoice"]! },
  { match: named(/^\+ (Preguntar una palabra|Ask for a word)/), tip: BLOCK_TIPS["askText"]! },
  { match: named(/^\+ (Enviar mensaje|Broadcast message)/), tip: BLOCK_TIPS["broadcast"]! },
  { match: named(/^\+ (Bajar el lápiz|Pen down)/), tip: BLOCK_TIPS["penDown"]! },
  { match: named(/^\+ (Subir el lápiz|Pen up)/), tip: BLOCK_TIPS["penUp"]! },
  { match: named(/^\+ (Color del lápiz|Pen color)/), tip: BLOCK_TIPS["setPenColor"]! },
  { match: named(/^\+ (Grosor del lápiz|Pen size)/), tip: BLOCK_TIPS["setPenSize"]! },
  {
    match: named(/^\+ (Transparencia del lápiz|Pen transparency)/),
    tip: BLOCK_TIPS["setPenTransparency"]!,
  },
  {
    match: named(/^\+ (Tono del lápiz|Pen shade)/),
    tip: BLOCK_TIPS["setPenShade"]!,
  },
  { match: named(/^\+ (Borrar los trazos|Clear drawing)/), tip: BLOCK_TIPS["clearPen"]! },
  { match: named(/^\+ (Sellar|Stamp)/), tip: BLOCK_TIPS["stamp"]! },
  { match: named(/^\+ (Tocar nota|Play note)/), tip: BLOCK_TIPS["playNote"]! },
  { match: named(/^\+ (Tocar percusión|Play drum)/), tip: BLOCK_TIPS["playDrum"]! },
  { match: named(/^\+ (Instrumento|Instrument)/), tip: BLOCK_TIPS["setInstrument"]! },
  { match: named(/^\+ (Velocidad|Speed)/), tip: BLOCK_TIPS["setTempo"]! },
  { match: named(/^\+ (Tono|Pitch)/), tip: BLOCK_TIPS["setPitch"]! },
  { match: named(/^\+ (Lado del sonido|Sound side)/), tip: BLOCK_TIPS["setPan"]! },
  {
    match: named(/^\+ (Crear variable|Create variable)/),
    tip: t(
      "Crear una variable: una caja con un número adentro",
      "Create a variable: a box with a number inside",
    ),
  },
  {
    match: named(/^\+ (Crear palabra|Create word)/),
    tip: t("Crear un lugar para guardar una palabra", "Create a place to keep a word"),
  },
  {
    match: named(/^\+ (Crear lista|Create list)/),
    tip: t("Crear una lista: varias cosas en orden", "Create a list: several things in order"),
  },
  { match: named(/^\+ (Guardar palabra|Save word)/), tip: BLOCK_TIPS["setText"]! },
  {
    match: named(/^\+ (Fijar valor|Set value|Fijar con|Set from|Set with|Guardar|Save)/),
    tip: BLOCK_TIPS["setVariable"]!,
  },
  { match: named(/^\+ (Cambiar valor|Change value)/), tip: BLOCK_TIPS["changeVariable"]! },
  { match: named(/^\+ (Mostrar variable|Show variable)/), tip: BLOCK_TIPS["showVariable"]! },
  { match: named(/^\+ (Ocultar variable|Hide variable)/), tip: BLOCK_TIPS["hideVariable"]! },
  { match: named(/^\+ (Agregar número|Add number)/), tip: BLOCK_TIPS["listAdd"]! },
  { match: named(/^\+ (Quitar elemento|Remove item)/), tip: BLOCK_TIPS["listRemoveAt"]! },
  { match: named(/^\+ (Insertar número|Insert number)/), tip: BLOCK_TIPS["listInsertAt"]! },
  { match: named(/^\+ (Cambiar elemento|Replace item)/), tip: BLOCK_TIPS["listReplaceAt"]! },
  {
    match: named(/^\+ (Leer elemento|Read item)/),
    tip: t("Leer un elemento de la lista", "Read an item from the list"),
  },
  {
    match: named(/^(Pedirle a Ori una combinación|Ask Ori for a combination)/),
    tip: t(
      "Ori te propone una condición para que la revises",
      "Ori suggests a condition for you to review",
    ),
  },
  // The code panel.
  {
    match: named(/^(Ocultar código|Hide code|Mostrar código|Show code)$/),
    tip: t("Esconder o mostrar tu programa escrito", "Hide or show your program written out"),
  },
  {
    match: named(/^(Agorix Code|Python|TypeScript|Java)$/),
    tip: t("Ver tu programa escrito en este lenguaje", "See your program written in this language"),
  },
  {
    match: named(/^(Más lenguajes|More languages)$/),
    tip: t("Ver tu programa en otros lenguajes", "See your program in other languages"),
  },
  // Characters panel and scene goal.
  {
    match: (c) => c.classList.contains("kids-button") && c.hasAttribute("data-drop-actor"),
    tip: t("Elegir este personaje para programarlo", "Pick this character to program it"),
  },
  {
    match: named(/^(No sé, probemos|I do not know|Let's just try)/),
    tip: t("Empezar sin meta: probá cosas", "Start without a goal: try things out"),
  },
  {
    match: named(/^(Inventá una meta|Make up a goal)/),
    tip: t("Ori te propone una meta para tu escena", "Ori suggests a goal for your scene"),
  },
  {
    match: named(/^(Listo, no mostrar más|Got it, hide this)/),
    tip: t("Entendido: no mostrar este consejo", "Got it: do not show this tip again"),
  },
  // Sounds drawer.
  {
    match: named(/^(Elegir y escuchar|Pick and listen to) /),
    tip: (c) =>
      t(
        `Escuchá «${label(c).replace(/^(Elegir y escuchar|Pick and listen to) /, "")}» y elegilo`,
        `Listen to “${label(c).replace(/^(Elegir y escuchar|Pick and listen to) /, "")}” and pick it`,
      ),
  },
  {
    match: (c) =>
      c.closest(".kids-studio-media-content, .kids-sound-picker-filters") !== null &&
      c.classList.contains("kids-button"),
    tip: t("Mostrar solo este tipo de sonidos", "Show only this kind of sound"),
  },
  // Costumes and backdrops drawer.
  {
    match: (c) => groupLabel(c, /^(Disfraces|Costumes)$/),
    tip: t("Ponerle este disfraz al personaje", "Give the character this costume"),
  },
  {
    match: (c) => groupLabel(c, /^(Fondos|Backdrops)$/),
    tip: t("Usar este fondo en la escena", "Use this backdrop in the scene"),
  },
  {
    match: (c) => groupLabel(c, /(Mis disfraces|My costumes)/i),
    tip: t("Ponerle tu disfraz al personaje", "Give the character your costume"),
  },
  {
    match: (c) => groupLabel(c, /(Mis fondos|My backdrops)/i),
    tip: t("Usar tu fondo en la escena", "Use your backdrop in the scene"),
  },
  {
    match: named(/^(Dibujar disfraz|Draw costume)/),
    tip: t("Dibujar un disfraz nuevo", "Draw a new costume"),
  },
  {
    match: named(/^(Dibujar fondo|Draw backdrop)/),
    tip: t("Dibujar un fondo nuevo", "Draw a new backdrop"),
  },
  {
    match: named(/^(Agregar|Add) (disfraz|costume)/),
    tip: t("Usar una imagen tuya como disfraz", "Use an image of yours as a costume"),
  },
  {
    match: named(/^(Agregar|Add) (fondo|backdrop)/),
    tip: t("Usar una imagen tuya como fondo", "Use an image of yours as a backdrop"),
  },
  // Blocks already in the program.
  {
    match: cls("kids-block-handle"),
    tip: t("Agarrá y arrastrá para cambiar de lugar el bloque", "Grab and drag to move the block"),
  },
  {
    match: named(/^(Subir bloque|Move block up)/),
    tip: t("Subir el bloque un lugar", "Move the block up one place"),
  },
  {
    match: named(/^(Bajar bloque|Move block down)/),
    tip: t("Bajar el bloque un lugar", "Move the block down one place"),
  },
  {
    match: named(/^(Duplicar bloque|Duplicate block)/),
    tip: t("Hacer una copia del bloque", "Make a copy of the block"),
  },
  {
    match: named(/^(Quitar bloque|Remove block)/),
    tip: t("Sacar el bloque del programa", "Take the block out of the program"),
  },
  // Stage tools and characters.
  {
    match: named(/^\+ (Objeto|Sprite)$/),
    tip: t("Sumar otro personaje a la escena", "Add another character to the scene"),
  },
  {
    match: named(/^\+ (Fondo|Backdrop)$/),
    tip: t("Elegir otro fondo para la escena", "Pick another backdrop for the scene"),
  },
  {
    match: named(/^\+ (Agregar personaje|Add character)/),
    tip: t(
      "Sumar otro personaje con su propio programa",
      "Add another character with its own program",
    ),
  },
  {
    match: named(/Preguntar a Ori|Ask Ori/),
    tip: t("Preguntale una idea a Ori", "Ask Ori for an idea"),
  },
  {
    match: named(/Elegir fondo o disfraz|Choose backdrop or costume/),
    tip: t("Abrir los disfraces y los fondos", "Open costumes and backdrops"),
  },
  {
    match: cls("kids-studio-stage-actor"),
    tip: t(
      "Tocá para elegirlo. Doble toque: ver sus propiedades",
      "Tap to pick it. Double-tap: see its properties",
    ),
  },
  // Shared panels (zoom, minimise, maximise) in either language.
  { match: named(/^(Alejar|Zoom out) /), tip: t("Alejar para ver más", "Zoom out to see more") },
  {
    match: named(/^(Acercar|Zoom in) /),
    tip: t("Acercar para ver mejor", "Zoom in to see better"),
  },
  {
    match: named(/^(Volver .* al 100|Reset zoom)/),
    tip: t("Volver al tamaño normal", "Back to normal size"),
  },
  {
    match: named(/^(Minimizar|Minimize) /),
    tip: t("Guardar este panel abajo", "Tuck this panel away"),
  },
  {
    match: named(/^(Maximizar|Maximize) /),
    tip: t("Agrandar este panel a toda la pantalla", "Make this panel fill the screen"),
  },
  {
    match: named(/^(Restaurar|Restore) /),
    tip: t("Volver al tamaño de antes", "Back to its earlier size"),
  },
  {
    match: (c) => c.closest(".kids-studio-palette") !== null && /^\+ /.test(label(c)),
    tip: t(
      "Agregar este bloque a tu programa. También podés arrastrarlo.",
      "Add this block to your program. You can also drag it.",
    ),
  },
  // Ori.
  {
    match: (c) =>
      c.classList.contains("kids-studio-ori-rail") ||
      c.classList.contains("kids-ori-float-trigger"),
    tip: t(
      "Ori: tu compañero. Tocalo para pedirle ayuda o para esconderlo",
      "Ori, your helper: tap it to ask for help or to hide it",
    ),
  },
  {
    match: cls("kids-ori-stage-close"),
    tip: t("Tocá a Ori para esconder la ayuda", "Tap Ori to hide the help"),
  },
  // The map.
  {
    match: cls("kids-world-tab"),
    tip: t("Elegir este mundo y ver sus misiones", "Pick this world and see its missions"),
  },
  {
    match: cls("kids-node"),
    tip: t("Una misión: tocala para jugarla", "A mission: tap it to play it"),
  },
  {
    match: cls("kids-map-next-main"),
    tip: t("Seguir con la próxima misión del mapa", "Go on with the next mission on the map"),
  },
  {
    match: cls("kids-map-next-create"),
    tip: t("Crear tu propia escena, sin misiones", "Make your own scene, without missions"),
  },
  { match: cls("kids-listen"), tip: t("Que te lo lea en voz alta", "Have it read aloud to you") },
  {
    match: named(/^(Escuchar|Listen)$/),
    tip: t("Que te lo lea en voz alta", "Have it read aloud to you"),
  },
  {
    match: named(/^(Cerrar aviso|Close notice)$/),
    tip: t("Cerrar este aviso", "Close this notice"),
  },
  {
    match: named(/^(Elegir la franja de edad|Choose the age band)/),
    tip: t("Una persona adulta elige la franja de edad", "A grown-up picks the age band"),
  },
  {
    match: (c) => c.matches(".kids-path button, .kids-concepts button"),
    tip: t("Ver qué se aprende en este mundo", "See what you learn in this world"),
  },
  // The grown-ups area.
  {
    match: (c) => c.getAttribute("role") === "tab" && c.id.startsWith("kids-adult-tab-"),
    tip: t("Cambiar de sección de Adultos", "Switch grown-ups section"),
  },
  {
    match: cls("kids-adult-switch"),
    tip: t("Encender o apagar esta opción", "Turn this option on or off"),
  },
  {
    match: named(/Salir y bloquear|Exit and lock/),
    tip: t("Volver a bloquear la zona de adultos", "Lock the grown-ups area again"),
  },
  {
    match: named(/^(Meta diaria|Daily goal)/),
    tip: t("Cambiar el tiempo de juego sugerido por día", "Change the suggested play time per day"),
  },
  {
    match: named(/^(Borrar indicadores|Clear indicators)/),
    tip: t(
      "Borrar los conteos guardados en este dispositivo",
      "Erase the counts kept on this device",
    ),
  },
  {
    match: named(/^(Ver privacidad|See privacy)/),
    tip: t("Ir a la sección de privacidad", "Go to the privacy section"),
  },
  {
    match: named(/^(Seguir con|Keep )/),
    tip: t("Confirmar la franja de edad actual", "Confirm the current age band"),
  },
  {
    match: (c) => c.closest("#kids-adult-panel-customize") !== null,
    tip: t("Ver y administrar esta lista", "See and manage this list"),
  },
  {
    match: (c) => c.matches("summary") && c.closest("#kids-adult-panel-account") !== null,
    tip: t("Abrir o cerrar esta sección", "Open or close this section"),
  },
  // Mis proyectos.
  {
    match: (c) => c.matches(".kids-projects-header .kids-primary"),
    tip: t("Empezar un proyecto nuevo", "Start a new project"),
  },
  {
    match: (c) => c.closest(".kids-project-card") !== null && /^(Jugar|Play)$/.test(label(c)),
    tip: t("Abrir este proyecto y jugarlo", "Open this project and play it"),
  },
  {
    match: (c) => c.closest(".kids-project-card") !== null && /^(Exportar|Export)/.test(label(c)),
    tip: t("Guardar este proyecto en un archivo", "Save this project to a file"),
  },
  {
    match: (c) => c.closest(".kids-project-card") !== null && /^(Borrar|Delete)/.test(label(c)),
    tip: t(
      "Borrar este proyecto (un adulto lo confirma)",
      "Delete this project (a grown-up confirms)",
    ),
  },
  // Crear.
  {
    match: named(/^[12] · /),
    tip: t(
      "Pasos para crear: personaje, fondo y listo",
      "Steps to create: character, backdrop and done",
    ),
  },
  {
    match: cls("kids-gallery-card"),
    tip: t("Elegir esto para tu escena", "Pick this for your scene"),
  },
  {
    match: cls("kids-create-upload"),
    tip: t("Dibujar el tuyo en el lienzo", "Draw your own on the canvas"),
  },
  { match: cls("kids-create-pick"), tip: t("Cambiar lo que elegiste", "Change what you picked") },
  {
    match: cls("kids-create-surprise"),
    tip: t("Elegir un personaje y un fondo al azar", "Pick a random character and backdrop"),
  },
  {
    match: cls("kids-create-go"),
    tip: t("Crear la escena con lo que elegiste", "Create the scene with what you picked"),
  },
  {
    match: (c) => c.closest(".kids-create") !== null && c.classList.contains("kids-button"),
    tip: t("Mostrar solo este tipo de cosas", "Show only this kind of thing"),
  },
  // The bottom navigation.
  {
    match: (c) => c.classList.contains("kids-nav-button") && /Mapa|Map/.test(label(c)),
    tip: t("Mapa: tus misiones paso a paso", "Map: your missions, step by step"),
  },
  {
    match: (c) => c.classList.contains("kids-nav-button") && /Crear|Create/.test(label(c)),
    tip: t("Crear: armá tu propia escena", "Create: build your own scene"),
  },
  {
    match: (c) => c.classList.contains("kids-nav-button") && /proyectos|projects/i.test(label(c)),
    tip: t("Mis proyectos: lo que ya creaste", "My projects: what you already made"),
  },
  {
    match: (c) => c.classList.contains("kids-nav-button") && /Adultos|Grown/.test(label(c)),
    tip: t(
      "Adultos: ajustes y progreso, con una cuenta rápida",
      "Grown-ups: settings and progress, with a quick sum",
    ),
  },
];

/** The tip for the control under the pointer or focus, if any. */
export function tipFor(control: HTMLElement, locale: Locale): string | undefined {
  const rule = TIP_RULES.find((candidate) => candidate.match(control));
  if (!rule) return undefined;
  const tip = typeof rule.tip === "function" ? rule.tip(control) : rule.tip;
  return tip[locale];
}

/** Controls a tooltip belongs to: things a child can press. */
export const TIP_CONTROLS = "button, [role='tab'], [role='menuitem'], summary, a[href]";
