import { ref, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class RealtimeManager {
    constructor() {
        this.listeners = new Map();
        this.callbacks = new Map();
        this.isInitialized = false;
        this.updateCount = 0;
        this.lastUpdateTime = {};
    }

    // Inicializar el sistema de tiempo real
    init() {
        if (this.isInitialized) {
            console.log('Sistema de tiempo real ya está inicializado');
            return;
        }
        
        // Verificar que la base de datos esté disponible
        if (!db) {
            console.warn('Base de datos no disponible, reintentando en 1 segundo...');
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        console.log('Inicializando sistema de actualizaciones en tiempo real...');
        
        // Configurar escuchas para todas las entidades principales
        this.setupStudentsListener();
        this.setupCoursesListener();
        this.setupPaymentsListener();
        this.setupAttendanceListener();
        this.setupGroupsListener();
        this.setupUsersListener();
        this.setupAcademicHistoryListener();
        this.setupReportsListener();
        
        this.isInitialized = true;
        console.log('Sistema de actualizaciones en tiempo real inicializado');
        
        // Mostrar indicador de que el sistema está activo
        if (window.app) {
            setTimeout(() => {
                window.app.showNotification('Sistema de actualización en tiempo real activo', 'success', 2000);
            }, 500);
        }
    }

    // Configurar escucha para estudiantes
    setupStudentsListener() {
        const studentsRef = ref(db, 'students');
        const listener = onValue(studentsRef, (snapshot) => {
            const students = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('students', students);
            
            // Actualizar estadísticas del dashboard si está disponible
            if (window.dashboardManager) {
                window.dashboardManager.loadStats();
            }
        });
        
        this.listeners.set('students', listener);
    }

    // Configurar escucha para cursos
    setupCoursesListener() {
        const coursesRef = ref(db, 'courses');
        const listener = onValue(coursesRef, (snapshot) => {
            const courses = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('courses', courses);
            
            // Actualizar estadísticas del dashboard si está disponible
            if (window.dashboardManager) {
                window.dashboardManager.loadStats();
            }
        });
        
        this.listeners.set('courses', listener);
    }

    // Configurar escucha para pagos
    setupPaymentsListener() {
        const paymentsRef = ref(db, 'payments');
        const listener = onValue(paymentsRef, (snapshot) => {
            const payments = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('payments', payments);
            
            // Actualizar estadísticas del dashboard si está disponible
            if (window.dashboardManager) {
                window.dashboardManager.loadStats();
            }
        });
        
        this.listeners.set('payments', listener);
    }

    // Configurar escucha para asistencia
    setupAttendanceListener() {
        const attendanceRef = ref(db, 'attendance');
        const listener = onValue(attendanceRef, (snapshot) => {
            const attendance = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('attendance', attendance);
        });
        
        this.listeners.set('attendance', listener);
    }

    // Configurar escucha para grupos
    setupGroupsListener() {
        const groupsRef = ref(db, 'groups');
        const listener = onValue(groupsRef, (snapshot) => {
            const groups = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('groups', groups);
        });
        
        this.listeners.set('groups', listener);
    }

    // Configurar escucha para usuarios
    setupUsersListener() {
        const usersRef = ref(db, 'users');
        const listener = onValue(usersRef, (snapshot) => {
            const users = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('users', users);
        });
        
        this.listeners.set('users', listener);
    }

    // Configurar escucha para historial académico
    setupAcademicHistoryListener() {
        const historyRef = ref(db, 'academicHistory');
        const listener = onValue(historyRef, (snapshot) => {
            const history = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('academicHistory', history);
        });
        
        this.listeners.set('academicHistory', listener);
    }

    // Configurar escucha para reportes
    setupReportsListener() {
        const reportsRef = ref(db, 'reports');
        const listener = onValue(reportsRef, (snapshot) => {
            const reports = snapshot.exists() ? snapshot.val() : {};
            this.notifyListeners('reports', reports);
        });
        
        this.listeners.set('reports', listener);
    }

    // Registrar un callback para una entidad específica
    subscribe(entity, callback) {
        if (!this.callbacks.has(entity)) {
            this.callbacks.set(entity, new Set());
        }
        this.callbacks.get(entity).add(callback);
        
        // Si es la primera suscripción, inicializar el sistema
        if (!this.isInitialized) {
            this.init();
        }
        
        return () => this.unsubscribe(entity, callback);
    }

    // Desuscribir un callback
    unsubscribe(entity, callback) {
        if (this.callbacks.has(entity)) {
            this.callbacks.get(entity).delete(callback);
        }
    }

    // Notificar a todos los listeners de una entidad
    notifyListeners(entity, data) {
        // Evitar actualizaciones duplicadas muy rápidas (debounce)
        const now = Date.now();
        const lastUpdate = this.lastUpdateTime[entity] || 0;
        if (now - lastUpdate < 100) {
            return; // Ignorar actualizaciones muy rápidas
        }
        this.lastUpdateTime[entity] = now;
        
        // Mostrar indicador visual de actualización
        this.showUpdateFlash(entity);
        
        if (this.callbacks.has(entity)) {
            this.callbacks.get(entity).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error en callback de ${entity}:`, error);
                }
            });
        }
    }
    
    // Mostrar efecto flash cuando hay actualizaciones
    showUpdateFlash(entity) {
        this.updateCount++;
        
        // Mapear entidades a nombres amigables
        const entityNames = {
            'students': 'Estudiantes',
            'courses': 'Cursos',
            'payments': 'Pagos',
            'attendance': 'Asistencia',
            'groups': 'Grupos',
            'users': 'Usuarios',
            'academicHistory': 'Historial Académico',
            'reports': 'Reportes'
        };
        
        const entityName = entityNames[entity] || entity;
        
        // Agregar clase flash a la tabla correspondiente
        const tableMap = {
            'students': '#studentsTable',
            'courses': '#coursesTable',
            'payments': '#paymentsTable',
            'attendance': '#attendanceTable',
            'groups': '#groupsTable',
            'users': '#usersTable',
            'academicHistory': '#academicHistoryTable',
            'reports': '#reportsTable'
        };
        
        const tableSelector = tableMap[entity];
        if (tableSelector) {
            const table = document.querySelector(tableSelector);
            if (table) {
                // Agregar clase flash
                table.classList.add('data-updated');
                
                // Remover después de la animación
                setTimeout(() => {
                    table.classList.remove('data-updated');
                }, 1000);
            }
        }
        
        // Mostrar indicador discreto de actualización
        this.showUpdateIndicator(entityName);
    }
    
    // Mostrar indicador visual discreto de actualización
    showUpdateIndicator(entityName) {
        // Obtener o crear el indicador
        let indicator = document.getElementById('realtime-update-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'realtime-update-indicator';
            indicator.className = 'realtime-update-indicator';
            indicator.innerHTML = '<i class="fas fa-sync-alt"></i> <span>Actualizando...</span>';
            document.body.appendChild(indicator);
        }
        
        // Actualizar texto
        const span = indicator.querySelector('span');
        if (span) {
            span.textContent = `${entityName} actualizado`;
        }
        
        // Mostrar indicador
        indicator.classList.add('show');
        
        // Ocultar después de 2 segundos
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    // Obtener datos en tiempo real de una entidad específica
    getRealtimeData(entity, callback) {
        const entityRef = ref(db, entity);
        const listener = onValue(entityRef, (snapshot) => {
            const data = snapshot.exists() ? snapshot.val() : {};
            callback(data);
        });
        
        // Retornar función para detener la escucha
        return () => off(entityRef, 'value', listener);
    }

    // Detener todas las escuchas
    stopAllListeners() {
        this.listeners.forEach((listener, entity) => {
            try {
                off(ref(db, entity), 'value', listener);
            } catch (error) {
                console.error(`Error al detener listener de ${entity}:`, error);
            }
        });
        
        this.listeners.clear();
        this.callbacks.clear();
        this.isInitialized = false;
    }

    // Detener escucha de una entidad específica
    stopListener(entity) {
        if (this.listeners.has(entity)) {
            const listener = this.listeners.get(entity);
            try {
                off(ref(db, entity), 'value', listener);
                this.listeners.delete(entity);
            } catch (error) {
                console.error(`Error al detener listener de ${entity}:`, error);
            }
        }
    }

    // Verificar estado de conexión
    isConnected() {
        return this.isInitialized && this.listeners.size > 0;
    }

    // Obtener estadísticas de listeners activos
    getStats() {
        return {
            isInitialized: this.isInitialized,
            activeListeners: this.listeners.size,
            activeCallbacks: Array.from(this.callbacks.entries()).map(([entity, callbacks]) => ({
                entity,
                callbackCount: callbacks.size
            }))
        };
    }
}

// Crear instancia global
const realtimeManager = new RealtimeManager();

// Exportar para uso en otros módulos
export { realtimeManager, RealtimeManager };

