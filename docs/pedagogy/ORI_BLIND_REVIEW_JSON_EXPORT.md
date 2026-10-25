# Ori — exportación JSON para revisión exploratoria ciega

El módulo `exportOriBlindReviewJson` serializa una captura ya validada en dos cadenas JSON separadas:

- **educatorJson**: misión, respuestas A/B y advertencias metodológicas. No contiene claves de origen.
- **coordinatorJson**: misión y correspondencia A/B entre Ori y el tutor determinista. Debe conservarse en un entorno restringido.

La exportación rechaza campos inesperados, claves A/B inconsistentes, identificadores de misión distintos, mensajes fuera de límites y afirmaciones indebidas de equivalencia o eficacia.

## Límites

Esta es una función pura en memoria. No escribe archivos, no gestiona permisos y no garantiza aislamiento si el llamador comparte ambos JSON. Los textos no incluyen una prueba criptográfica de procedencia. El estudio continúa siendo exploratorio porque Ori y Agorix reciben contextos distintos.

El siguiente incremento puede conectar este exportador con una ejecución real del proceso Ori y escribir archivos separados con permisos restrictivos, exclusivamente en un entorno de evaluación offline.

No se habilitan rutas ni funcionalidades de Kids.
