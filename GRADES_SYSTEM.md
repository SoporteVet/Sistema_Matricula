# Sistema de Notas Mejorado

## 🎯 **Descripción General**

El sistema de notas mejorado permite gestionar evaluaciones por rubros con cálculo automático de promedios ponderados. Cada evaluación tiene un peso específico y el sistema calcula automáticamente los promedios individuales por tipo de evaluación y el promedio general.

## 📊 **Características Principales**

### **1. Gestión de Evaluaciones**
- ✅ **Crear evaluaciones** con título, tipo, grupo, peso y fecha
- ✅ **Tipos de evaluación** disponibles:
  - Examen
  - Tarea
  - Proyecto
  - Participación
  - Asistencia
  - Quiz
  - Laboratorio
- ✅ **Peso configurable** (1-100%) para cada evaluación
- ✅ **Puntaje máximo** personalizable
- ✅ **Descripción opcional** para cada evaluación

### **2. Sistema de Notas por Rubros**
- ✅ **Tabla dinámica** que muestra todas las evaluaciones del grupo
- ✅ **Cálculo automático** de promedios ponderados
- ✅ **Promedio por tipo** de evaluación (exámenes, tareas, etc.)
- ✅ **Promedio general** del estudiante
- ✅ **Estado académico** automático (Aprobado/Condicional/Reprobado)

### **3. Interfaz de Usuario**
- ✅ **Vista de tabla** similar al documento de ejemplo
- ✅ **Celdas editables** al hacer clic
- ✅ **Formulario de edición** individual y masivo
- ✅ **Vista detallada** del estudiante con promedios por rubro
- ✅ **Colores indicativos** según el rendimiento

## 🎓 **Tipos de Evaluación**

| Tipo | Descripción | Uso Típico |
|------|-------------|------------|
| **Examen** | Evaluación formal | Exámenes parciales, finales |
| **Tarea** | Trabajo asignado | Tareas, ejercicios |
| **Proyecto** | Trabajo de investigación | Proyectos finales |
| **Participación** | Intervención en clase | Participación activa |
| **Asistencia** | Presencia en clase | Control de asistencia |
| **Quiz** | Evaluación corta | Quizzes, mini evaluaciones |
| **Laboratorio** | Práctica de laboratorio | Trabajos prácticos |

## 📈 **Cálculo de Promedios**

### **Promedio Ponderado**
```
Promedio = (Σ Nota × Peso) / Σ Peso
```

### **Ejemplo de Cálculo**
- **Examen 1**: 85 puntos (peso 30%)
- **Examen 2**: 92 puntos (peso 30%)
- **Tarea 1**: 78 puntos (peso 20%)
- **Asistencia**: 95 puntos (peso 20%)

**Cálculo:**
- Promedio Exámenes: (85×30 + 92×30) / 60 = 88.5%
- Promedio Tareas: 78%
- Promedio Asistencia: 95%
- **Promedio General**: (85×30 + 92×30 + 78×20 + 95×20) / 100 = 87.5%

### **Estados Académicos**
- **Aprobado**: ≥ 70%
- **Condicional**: 60-69%
- **Reprobado**: < 60%

## 🎨 **Colores y Estados Visuales**

### **Promedios**
- 🟢 **Excelente** (90-100%): Verde
- 🔵 **Bueno** (80-89%): Azul
- 🟡 **Promedio** (70-79%): Amarillo
- 🔴 **Bajo** (<70%): Rojo

### **Notas Individuales**
- 🟢 **90-100**: Verde
- 🔵 **80-89**: Azul
- 🟡 **70-79**: Amarillo
- 🔴 **<70**: Rojo

## 🚀 **Cómo Usar el Sistema**

### **1. Crear una Evaluación**
1. Ir a **"Sistema de Notas"**
2. Hacer clic en **"Nueva Evaluación"**
3. Completar el formulario:
   - Título de la evaluación
   - Tipo de evaluación
   - Grupo asignado
   - Peso (%)
   - Fecha
   - Puntaje máximo
   - Descripción (opcional)
4. Guardar la evaluación

### **2. Asignar Notas**
1. Seleccionar un grupo en el filtro
2. La tabla mostrará todos los estudiantes del grupo
3. Hacer clic en cualquier celda de nota para editarla
4. O usar el botón "Editar" para modificar todas las notas del estudiante

### **3. Ver Detalles del Estudiante**
1. Hacer clic en el botón "Ver" (👁️) del estudiante
2. Se mostrará:
   - Información del estudiante
   - Promedio general con estado
   - Promedios por tipo de evaluación
   - Detalle de todas las evaluaciones

## 📋 **Estructura de Datos**

### **Evaluación**
```javascript
{
  id: "evaluation_id",
  title: "Examen Parcial 1",
  type: "exam",
  groupId: "group_id",
  weight: 30,
  date: "2024-01-15",
  maxScore: 100,
  description: "Evaluación de la primera unidad",
  createdAt: "2024-01-10T10:00:00Z",
  updatedAt: "2024-01-10T10:00:00Z"
}
```

### **Nota**
```javascript
{
  id: "grade_id",
  studentId: "student_id",
  evaluationId: "evaluation_id",
  score: 85,
  comments: "Buen trabajo, mejorar en la parte práctica",
  createdAt: "2024-01-15T14:30:00Z",
  updatedAt: "2024-01-15T14:30:00Z"
}
```

## 🔧 **Configuración Avanzada**

### **Personalizar Tipos de Evaluación**
Para agregar nuevos tipos de evaluación, editar el archivo `js/grades.js`:

```javascript
getEvaluationTypeText(type) {
    const typeMap = {
        'exam': 'Examen',
        'assignment': 'Tarea',
        'project': 'Proyecto',
        'participation': 'Participación',
        'attendance': 'Asistencia',
        'quiz': 'Quiz',
        'lab': 'Laboratorio',
        // Agregar nuevos tipos aquí
        'presentation': 'Presentación',
        'research': 'Investigación'
    };
    return typeMap[type] || type;
}
```

### **Modificar Estados Académicos**
Para cambiar los criterios de aprobación:

```javascript
getStudentStatus(average) {
    if (average >= 70) return 'approved';    // Cambiar 70 por el valor deseado
    if (average >= 60) return 'conditional'; // Cambiar 60 por el valor deseado
    return 'failed';
}
```

## 📊 **Reportes Disponibles**

### **Reporte de Notas por Grupo**
- Exportar tabla completa con todas las evaluaciones
- Incluye promedios y estados
- Formato Excel/CSV

### **Reporte Individual del Estudiante**
- Historial completo de evaluaciones
- Promedios por rubro
- Gráficos de rendimiento

## 🎯 **Beneficios del Sistema**

1. **Flexibilidad**: Soporta múltiples tipos de evaluación
2. **Precisión**: Cálculo automático de promedios ponderados
3. **Transparencia**: Los estudiantes pueden ver su progreso por rubro
4. **Eficiencia**: Interfaz intuitiva para asignar notas
5. **Análisis**: Promedios por tipo de evaluación para identificar fortalezas/debilidades
6. **Escalabilidad**: Fácil agregar nuevos tipos de evaluación

## 🔄 **Actualizaciones Futuras**

- [ ] Gráficos de progreso temporal
- [ ] Notificaciones automáticas de notas
- [ ] Exportación a PDF
- [ ] Integración con sistema de asistencia
- [ ] Dashboard de rendimiento por grupo
- [ ] Comparativas entre grupos
- [ ] Alertas de bajo rendimiento
