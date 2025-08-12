# Sistema de Gestión de Matrículas - Instituto Veterinario

Un sistema web completo para la gestión de matrículas de estudiantes veterinarios desarrollado con HTML, CSS, JavaScript y Firebase, adaptado específicamente para Costa Rica.

## 🚀 Características

### Funcionalidades Principales
- **Gestión de Cursos Veterinarios**: Crear, editar y administrar cursos y grupos veterinarios
- **Registro de Estudiantes Veterinarios**: Control completo de información de estudiantes con validación de cédula costarricense
- **Control de Pagos**: Gestión de matrículas y pagos mensuales en colones costarricenses (CRC)
- **Sistema de Asistencia**: Registro y control de asistencia por clase
- **Reportes Avanzados**: Exportación a Excel y PDF
- **Historial Académico**: Seguimiento completo por estudiante
- **Control de Usuarios**: Sistema de roles (Admin/Usuario)
- **Localización Costarricense**: Sistema adaptado para Costa Rica con cédulas y teléfonos de 8 dígitos

### Características Técnicas
- **Diseño Responsivo**: Adaptable a dispositivos móviles y tablets
- **Tiempo Real**: Actualizaciones automáticas con Firebase Realtime Database
- **Seguridad**: Autenticación con Firebase Auth y control de permisos
- **Exportación**: Reportes en Excel y PDF
- **Interfaz Moderna**: UI intuitiva y amigable

## 📋 Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Conexión a Internet
- Cuenta de Firebase (para configuración)

## 🛠️ Instalación

1. **Clonar o descargar el proyecto**
   ```
   Descargar todos los archivos en una carpeta local
   ```

2. **Configurar Firebase**
   - Crear un proyecto en [Firebase Console](https://console.firebase.google.com)
   - Habilitar Authentication (Email/Password)
   - Habilitar Realtime Database
   - Copiar la configuración en `js/firebase-config.js`

3. **Configurar las reglas de Firebase Realtime Database**
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null",
       "users": {
         "$uid": {
           ".write": "auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin'"
         }
       }
     }
   }
   ```

4. **Configurar Authentication en Firebase**
   - Ir a Authentication > Sign-in method
   - Habilitar "Email/password"

5. **Abrir el archivo index.html**
   - Simplemente abrir `index.html` en un navegador web
   - O usar un servidor web local

## 👤 Usuarios por Defecto

Para crear el primer usuario administrador, puedes:

1. **Opción 1: Registrar manualmente**
   - Crear usuario en Firebase Console
   - Añadir en Realtime Database:
   ```json
   {
     "users": {
       "UID_DEL_USUARIO": {
         "email": "admin@institutosmp.com",
         "role": "admin",
         "status": "active",
         "createdAt": "2024-01-01T00:00:00.000Z"
       }
     }
   }
   ```

2. **Opción 2: Usar función automática**
   - Descomentar la línea en `js/auth.js`:
   ```javascript
   // window.authManager.initializeDefaultUsers();
   ```
   - Esto creará automáticamente:
     - **Email**: admin@institutosmp.com
     - **Contraseña**: admin123456

## 🎯 Uso del Sistema

### Inicio de Sesión
1. Abrir la aplicación en el navegador
2. Usar las credenciales de administrador o usuario
3. El sistema mostrará diferentes opciones según el rol

### Gestión de Cursos Veterinarios
- **Crear Curso**: Botón "Nuevo Curso"
- **Editar**: Clic en el ícono de edición
- **Eliminar**: Clic en el ícono de eliminación (solo si no hay estudiantes)

### Gestión de Estudiantes Veterinarios
- **Registrar**: Botón "Nuevo Estudiante"
- **Buscar**: Usar filtros por curso o búsqueda por nombre
- **Ver Detalles**: Clic en el ícono de vista
- **Validación de Cédula**: Sistema automático de validación de cédula costarricense (9-12 dígitos)
- **Validación de Teléfono**: Formato de 8 dígitos (ej: 72654651, 7265 4651, 7265-4651)

### Control de Pagos
- **Registrar Pago**: Individual o seleccionar estudiante
- **Filtrar**: Por curso, estado o mes
- **Marcar como Pagado**: Botón verde en pagos pendientes

### Sistema de Asistencia
- **Individual**: Marcar un estudiante específico
- **Grupal**: Marcar toda una clase
- **Filtrar**: Por curso y fecha

### Reportes
Generar reportes en diferentes formatos:
- **Financiero**: Ingresos y pagos por período
- **Estudiantes**: Lista con información personalizable
- **Asistencia**: Estadísticas por estudiante o curso
- **Académico**: Historial completo por estudiante

## 🔧 Estructura del Proyecto

```
├── index.html              # Página principal
├── css/
│   └── styles.css          # Estilos principales
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   ├── auth.js            # Autenticación y roles
│   ├── app.js             # Aplicación principal
│   ├── dashboard.js       # Dashboard y estadísticas
│   ├── courses.js         # Gestión de cursos
│   ├── students.js        # Gestión de estudiantes
│   ├── payments.js        # Control de pagos
│   ├── attendance.js      # Sistema de asistencia
│   ├── reports.js         # Reportes y exportación
│   └── users.js           # Gestión de usuarios (admin)
└── README.md              # Este archivo
```

## 🔒 Roles y Permisos

### Administrador
- Acceso completo a todas las funcionalidades
- Gestión de usuarios
- Crear/editar/eliminar cursos
- Acceso a todos los reportes

### Usuario
- Gestión de estudiantes
- Control de pagos
- Sistema de asistencia
- Reportes básicos
- Sin acceso a gestión de usuarios ni cursos

## 📊 Base de Datos

### Estructura de Firebase Realtime Database

```json
{
  "users": {
    "uid": {
      "email": "string",
      "role": "admin|user",
      "status": "active|inactive",
      "createdAt": "ISO string"
    }
  },
  "courses": {
    "courseId": {
      "code": "string",
      "name": "string",
      "description": "string",
      "price": "number (en colones costarricenses)",
      "duration": "number",
      "status": "active|inactive"
    }
  },
  "students": {
    "studentId": {
      "studentId": "string",
      "cedula": "string (9-12 dígitos)",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string (8 dígitos, formato: 72654651, 7265 4651, 7265-4651)",
      "course": "string",
      "status": "active|inactive|graduated|dropped",
      "enrollmentDate": "date string"
    }
  },
  "payments": {
    "paymentId": {
      "studentId": "string",
      "studentName": "string",
      "course": "string",
      "month": "YYYY-MM",
      "amount": "number (en colones costarricenses)",
      "status": "paid|pending|overdue",
      "paymentDate": "date string"
    }
  },
  "attendance": {
    "recordId": {
      "studentId": "string",
      "studentName": "string",
      "course": "string",
      "date": "date string",
      "status": "present|absent|late",
      "notes": "string"
    }
  }
}
```

## 🎨 Personalización

### Cambiar Colores
Editar las variables CSS en `css/styles.css`:
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
}
```

### Añadir Nuevos Campos
1. Actualizar el formulario HTML correspondiente
2. Modificar la función de guardado en el archivo JS apropiado
3. Actualizar la tabla de visualización

## 🐛 Solución de Problemas

### Error de Conexión a Firebase
- Verificar la configuración en `firebase-config.js`
- Comprobar que los servicios estén habilitados en Firebase Console

### Problemas de Permisos
- Verificar las reglas de Realtime Database
- Comprobar que el usuario esté autenticado

### Exportación no Funciona
- Verificar que las librerías XLSX y jsPDF estén cargadas
- Comprobar la conexión a Internet

## 📱 Dispositivos Móviles

El sistema está optimizado para dispositivos móviles:
- **Navegación**: Menú adaptable en móviles
- **Formularios**: Campos optimizados para touch
- **Tablas**: Scroll horizontal en pantallas pequeñas
- **Botones**: Tamaño apropiado para dedos

## 🔄 Actualizaciones

Para mantener el sistema actualizado:
1. Hacer backup de la base de datos de Firebase
2. Actualizar los archivos del código
3. Verificar compatibilidad con nuevas versiones de Firebase

## 📞 Soporte

Para soporte técnico o consultas:
- Revisar la documentación de Firebase
- Comprobar la consola del navegador para errores
- Verificar la conexión de red

## 🚀 Funcionalidades Futuras

Posibles mejoras a implementar:
- **Notificaciones**: Sistema de notificaciones push
- **Calificaciones**: Módulo de notas y evaluaciones
- **Horarios**: Gestión de horarios de clases
- **Comunicación**: Sistema de mensajería interna
- **Mobile App**: Aplicación móvil nativa
- **Certificados**: Generación automática de certificados

## 📄 Licencia

Este proyecto es de uso educativo y puede ser modificado según las necesidades del instituto.

---

**Instituto Veterinario - Sistema de Gestión de Matrículas**
*Desarrollado con ❤️ para la gestión educativa moderna*
