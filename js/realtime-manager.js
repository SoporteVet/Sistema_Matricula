import { ref, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class RealtimeManager {
    constructor() {
        this.listeners = new Map();
        this.callbacks = new Map();
        this.isInitialized = false;
    }

    // Inicializar el sistema de tiempo real
    init() {
        if (this.isInitialized) return;
        
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
