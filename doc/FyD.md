# PressureBoard v0.1

## Propósito

PressureBoard no es un gestor de correo.

PressureBoard transforma evidencia dispersa en una representación navegable de la atención ejecutiva.

El usuario no navega correos.

El usuario navega aquello que compite por su atención.

---

# Problema

Los correos muestran eventos, solicitudes, seguimientos y conversaciones.

Sin embargo, los ejecutivos no operan sobre correos.

Operan sobre:

* decisiones
* bloqueos
* riesgos
* compromisos
* problemas recurrentes
* oportunidades de comprensión

El objetivo de PressureBoard es descubrir y organizar esos elementos utilizando el correo únicamente como fuente de evidencia.

---

# Principios

## El correo no es la interfaz

El correo es evidencia.

Nunca es la unidad principal de navegación.

---

## Nada existe sin evidencia

Toda observación visible en el tablero debe estar respaldada por evidencia trazable.

No existen conclusiones sin soporte.

---

## Las cards compiten por atención

No todo merece aparecer.

Una card debe ganarse su espacio en el tablero.

---

## El usuario navega atención

No navega:

* correos
* hilos
* tareas

Navega aquello que consume atención ejecutiva.

---

## El sistema descubre

El objetivo no es clasificar correos.

El objetivo es descubrir patrones de atención.

---

# Modelo Conceptual

Evidence

↓

Card

↓

Dimension

↓

PressureBoard

---

## Evidence

Fuente original.

Ejemplos:

* correos
* hilos
* respuestas
* seguimientos

La evidencia nunca desaparece.

Siempre puede ser inspeccionada.

---

## Card

Unidad visible del tablero.

Una card representa algo que merece atención.

No representa necesariamente un correo.

No representa necesariamente una tarea.

Representa una observación relevante.

---

## Dimension

Agrupa formas similares de atención.

Actualmente se consideran tres dimensiones iniciales.

### Ejecutiva

Responde:

¿Qué depende de mí?

Ejemplos:

* aprobaciones
* decisiones
* compromisos asumidos
* respuestas pendientes

---

### Operacional

Responde:

¿Qué sistema está generando fricción?

Ejemplos:

* proveedores
* infraestructura
* continuidad operacional
* ejecución

---

### Estratégica

Responde:

¿Qué debería entender mejor?

Ejemplos:

* anomalías
* patrones emergentes
* investigaciones
* temas que merecen profundización

---

# Estructura del tablero

## Dimensión Ejecutiva

### Urgente

Requiere acción inmediata.

### Importante

Requiere atención relevante.

### Tareas

Requiere seguimiento o ejecución.

---

## Dimensión Operacional

### Urgente

Impacto operacional inmediato.

### Importante

Problemas que pueden transformarse en incidentes.

### Tareas

Acciones operativas en seguimiento.

---

## Dimensión Estratégica

### Insights

Aprendizajes relevantes.

### Anomalías

Cambios de patrón observados.

### Vale la pena profundizar

Temas que merecen investigación adicional.

---

# Caso Carolina

El análisis inicial permitió observar evidencia asociada a:

* dependencias externas
* continuidad operacional
* aprobaciones
* seguimientos reiterados
* coordinación entre terceros
* ejecución de iniciativas de tienda

Estos hallazgos no se consideran definitivos.

Representan la primera hipótesis obtenida desde evidencia real.

---

# Arquitectura de Descubrimiento

Correo

↓

LLM

↓

Etiquetas

↓

Backend

↓

Árbol de decisión

↓

PressureBoard

---

# Responsabilidades

## LLM

Descubrir atributos.

No construir el tablero.

No tomar decisiones finales.

Su función es etiquetar evidencia.

---

## Backend

Construir el árbol de decisión.

Determinar:

* dimensión
* bucket
* visibilidad
* agrupaciones

El backend es quien dibuja el tablero.

---

# Feedback

Las cards pueden ser descartadas por el usuario.

Eliminar una card no significa necesariamente que la evidencia sea incorrecta.

Significa que dicha observación no merece ocupar espacio en el tablero.

El feedback del usuario debe incorporarse al modelo de descubrimiento.

---

# Hipótesis actuales

1. Las dimensiones Ejecutiva, Operacional y Estratégica son una hipótesis inicial.
2. No sabemos aún si son universales o específicas por usuario.
3. No sabemos cuántas cards debe mostrar el tablero.
4. No sabemos qué atributos predicen mejor la atención ejecutiva.
5. No sabemos qué observaciones serán descartadas sistemáticamente por los usuarios.

---

# Validación

Usuario inicial:

Carolina

Duración:

1 semana

Objetivo:

Observar uso real del tablero.

---

## Qué observar

* qué abre
* qué ignora
* qué elimina
* qué profundiza
* qué considera ruido
* qué considera útil
* qué decisiones toma a partir del tablero

---

# Próximos pasos

## Fase 1

Persistir evidencia en Neon.

Objetivo:

Construir una capa de evidencia auditable.

---

## Fase 2

Generar etiquetas mediante LLM.

Objetivo:

Transformar evidencia en observaciones estructuradas.

---

## Fase 3

Implementar árbol de decisión en backend.

Objetivo:

Construir el tablero desde reglas explícitas.

---

## Fase 4

Validar durante una semana con Carolina.

Objetivo:

Descubrir cómo realmente navega su atención.

---

## Resultado esperado

No validar una teoría.

Descubrir, desde evidencia y comportamiento real, cómo debe construirse un sistema de navegación de atención ejecutiva.
