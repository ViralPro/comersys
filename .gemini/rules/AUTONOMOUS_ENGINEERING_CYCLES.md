# Metodología de Trabajo Autónomo mediante Ciclos de Ingeniería

Este documento establece el marco operativo y protocolo de ingeniería obligatorio para el proyecto **ComerSys Platform** y cualquier desarrollo asistido por agentes de inteligencia artificial en este repositorio.

---

## 1. Objetivo Principal
Aumentar exponencialmente la velocidad de desarrollo, garantizar cero regresiones y evitar instrucciones repetitivas o intervenciones manuales constantes mediante la ejecución autónoma, controlada y verificada de tareas de ingeniería de software.

---

## 2. Funcionamiento Obligatorio (El Ciclo de 9 Etapas)

Cada tarea, refactorización, corrección o adición debe ejecutarse estrictamente a través de estas 9 etapas:

```
[1. ANALIZAR] ───► [2. IDENTIFICAR] ───► [3. PLANIFICAR] ───► [4. DIVIDIR]
                                                                  │
[9. ENTREGAR] ◄─── [8. COMPARAR] ◄─── [7. CORREGIR] ◄─── [6. PROBAR] ◄─── [5. EJECUTAR]
                                            ▲               │
                                            └─ (si hay fallo)
```

1. **Analizar el proyecto antes de modificar cualquier archivo**:
   - Inspeccionar el estado de Git (`git status`), estructura del árbol de archivos y archivos directamente vinculados a la tarea.
2. **Identificar arquitectura, tecnologías, dependencias y funcionalidades**:
   - Mapear el stack en uso (ej. Node.js native, Vanilla ES Modules, CSS Variables, PBKDF2 crypto, JSON database).
   - Identificar cómo interactúa el módulo destino con el resto de la plataforma.
3. **Crear un plan de ejecución con tareas pequeñas**:
   - Descomponer la meta en unidades atómicas, medibles y verificables paso a paso.
4. **Dividir tareas independientes entre agentes especializados cuando sea conveniente**:
   - Si la tarea involucra múltiples áreas (ej. Frontend UI, Backend API, Base de Datos, Pruebas), asignar roles especializados o ejecutar secuencialmente sin solapamientos destructivos.
5. **Ejecutar las modificaciones necesarias**:
   - Implementar los cambios con la mínima huella requerida, siguiendo la arquitectura establecida.
6. **Ejecutar pruebas automáticas después de cada cambio importante**:
   - Correr `npm test` o `npm run check` inmediatamente tras cada modificación clave.
7. **Detectar errores, corregirlos y repetir las pruebas**:
   - Si un test falla o surge una regresión, aislar la causa raíz, corregir y volver a correr las pruebas hasta que el 100% pase.
8. **Comparar el resultado con los requisitos originales**:
   - Contrastar punto por punto lo implementado con el pedido del usuario para asegurar cobertura total sin desviaciones.
9. **Entregar un informe final de lo realizado**:
   - Resumir con precisión los cambios realizados, pruebas superadas y el estado operativo final.

---

## 3. Reglas de Seguridad Innegociables

- **No eliminar funcionalidades existentes**: Todo cambio debe ser aditivo o una refactorización transparente que conserve la compatibilidad retroactiva.
- **No modificar módulos ajenos a la tarea**: Limitar las ediciones exclusivamente a los archivos directamente involucrados en el requerimiento.
- **No duplicar componentes ni código**: Reutilizar las utilidades, servicios y componentes existentes (`js/core/`, `js/services/`, `css/`).
- **No trabajar dos agentes simultáneamente sobre los mismos archivos**: Evitar conflictos de concurrencia asegurando propiedad única por archivo/módulo durante la ejecución.
- **Mantener intactos los datos y la base de datos**: Prohibido sobrescribir o vaciar `data/comersys_platform.json` sin transacciones atómicas seguras y respetando siempre la estructura de datos existente.
- **Crear puntos de control antes de cambios importantes mediante Git**: Registrar commits limpios o checkpoints antes de modificaciones de alto impacto.
- **No declarar una tarea terminada sin verificarla**: La verificación empírica (pruebas automáticas passing) es obligatoria antes de reportar la tarea como completada.
- **Detención preventiva ante bloqueos irresolubles**: Si se produce un error bloqueante que no puede ser resuelto tras análisis forense, detener ese ciclo inmediatamente y explicar con exactitud la causa raíz al usuario.

---

## 4. Optimización de Velocidad y Eficiencia de Recursos

- **Evitar análisis repetidos de archivos que ya fueron revisados**: Conservar el modelo mental de los archivos ya leídos durante la sesión.
- **Reutilizar el contexto y los resultados de las pruebas**: Basarse en los diagnósticos ya obtenidos en lugar de repetir inspecciones redundantes.
- **Ejecutar tareas independientes en paralelo**: Desacoplar tareas que no tienen dependencias directas entre sí.
- **Priorizar cambios pequeños y verificables**: Pasos cortos reducen la probabilidad de errores y aceleran la depuración.
- **Evitar consumir tokens innecesariamente**: Respuestas concisas, lectura dirigida por rangos de líneas y ejecución de comandos directos.
- **No repetir ciclos cuando todas las pruebas ya pasan**: Cuando el arnés de pruebas se encuentra en verde y los requisitos están cubiertos, avanzar a la fase de reporte sin bucles vacíos.

---

## 5. Criterio de Finalización

El agente o equipo autónomo no debe detenerse prematuramente a esperar instrucciones intermedias cuando el camino esté claro: debe **desarrollar, probar, corregir y verificar** de forma autónoma hasta que todos los requisitos estén satisfechos y demostrados mediante pruebas operativas.
