import { 
    ref, 
    push, 
    set, 
    get, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class AcademicHistoryManager {
    constructor() {
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.payments = {};
        this.attendance = {};
        this.filteredStudents = {};
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadAllData();
        } catch (error) {
            console.warn('Error al inicializar AcademicHistoryManager:', error);
        }
    }

    setupEventListeners() {
        // Filtros
        const studentFilter = document.getElementById('historyStudentFilter');
        if (studentFilter) {
            studentFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const courseFilter = document.getElementById('historyCourseFilter');
        if (courseFilter) {
            courseFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const statusFilter = document.getElementById('historyStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        // Escuchar cambios en todas las colecciones relevantes
        const collections = ['students', 'courses', 'groups', 'payments', 'attendance'];
        
        collections.forEach(collection => {
            const collectionRef = ref(db, collection);
            onValue(collectionRef, (snapshot) => {
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
                this.applyFilters();
            });
        });
    }

    async loadAllData() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para historial académico');
                return;
            }

            const collections = ['students', 'courses', 'groups', 'payments', 'attendance'];
            
            const promises = collections.map(async (collection) => {
                const collectionRef = ref(db, collection);
                const snapshot = await get(collectionRef);
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
            });

            await Promise.all(promises);
            
            // Debug: Log de grupos cargados
            console.log('Historial Académico - Grupos cargados:', {
                totalGroups: Object.keys(this.groups).length,
                groupsData: this.groups
            });
            
            this.updateFilters();
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar datos del historial académico:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar historial académico', 'error');
            }
        }
    }

    updateFilters() {
        // Actualizar filtro de estudiantes
        const studentFilter = document.getElementById('historyStudentFilter');
        if (studentFilter) {
            const students = Object.entries(this.students);
            studentFilter.innerHTML = '<option value="">Todos los estudiantes</option>' +
                students.map(([id, student]) => 
                    `<option value="${id}">${student.firstName} ${student.lastName} (${student.studentId})</option>`
                ).join('');
        }

        // Actualizar filtro de cursos
        const courseFilter = document.getElementById('historyCourseFilter');
        if (courseFilter) {
            const courses = Object.values(this.courses);
            courseFilter.innerHTML = '<option value="">Todos los cursos</option>' +
                courses.map(course => 
                    `<option value="${course.name}">${course.name}</option>`
                ).join('');
        }
    }

    applyFilters() {
        const studentFilter = document.getElementById('historyStudentFilter')?.value || '';
        const courseFilter = document.getElementById('historyCourseFilter')?.value || '';
        const statusFilter = document.getElementById('historyStatusFilter')?.value || '';

        this.filteredStudents = Object.fromEntries(
            Object.entries(this.students).filter(([id, student]) => {
                const matchesStudent = !studentFilter || id === studentFilter;
                const matchesCourse = !courseFilter || student.course === courseFilter;
                const matchesStatus = !statusFilter || student.status === statusFilter;
                
                return matchesStudent && matchesCourse && matchesStatus;
            })
        );

        this.renderAcademicHistoryTable();
    }

    renderAcademicHistoryTable() {
        const tbody = document.querySelector('#academicHistoryTable tbody');
        if (!tbody) return;

        const studentsToShow = Object.keys(this.filteredStudents).length > 0 ? 
            this.filteredStudents : this.students;

        if (Object.keys(studentsToShow).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-graduation-cap fa-3x mb-3"></i>
                            <h4>No hay registros académicos</h4>
                            <p>Los registros aparecerán aquí cuando haya estudiantes registrados</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(studentsToShow)
            .sort(([,a], [,b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .map(([studentId, student]) => {
                const studentStats = this.calculateStudentStats(studentId);
                return `
                    <tr>
                        <td><strong>${student.studentId}</strong></td>
                        <td>${student.firstName} ${student.lastName}</td>
                        <td>${student.course}</td>
                        <td>${studentStats.group || 'Sin grupo'}</td>
                        <td>
                            <span class="status-badge ${student.status}">
                                ${this.getStatusText(student.status)}
                            </span>
                        </td>
                        <td>
                            <span class="payment-status ${studentStats.paymentStatus}">
                                ${this.getPaymentStatusText(studentStats.paymentStatus)}
                            </span>
                        </td>
                        <td>${studentStats.attendancePercentage}%</td>
                        <td>
                            <button class="btn-info" onclick="window.academicHistoryManager.viewDetailedHistory('${studentId}')" title="Ver historial detallado">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-secondary" onclick="window.academicHistoryManager.viewStudentProfile('${studentId}')" title="Perfil completo">
                                <i class="fas fa-user-graduate"></i>
                            </button>
                            <button class="btn-warning" onclick="window.academicHistoryManager.generateReport('${studentId}')" title="Generar reporte">
                                <i class="fas fa-file-pdf"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
    }

    calculateStudentStats(studentId) {
        const student = this.students[studentId];
        if (!student) return {};

        // Método 1: Buscar en array group.students
        let studentGroup = Object.values(this.groups).find(group => 
            group.students && group.students.includes(studentId)
        );

        // Método 2: Si no se encuentra, buscar por campo student.group
        if (!studentGroup && student.group) {
            studentGroup = Object.values(this.groups).find(group => {
                const groupId = Object.keys(this.groups).find(key => this.groups[key] === group);
                const groupName = group.groupName || group.groupCode || '';
                
                return student.group === groupId || 
                       student.group === groupName || 
                       student.group === group.groupCode;
            });
        }

        // Debug: Log para verificar grupos
        if (studentId === '1' || studentId === '2' || studentId === '3') {
            console.log(`Debug estudiante ${studentId}:`, {
                studentGroup,
                studentGroupField: student.group,
                allGroups: Object.keys(this.groups).length,
                groupsData: this.groups
            });
        }

        // Obtener el nombre del grupo
        let groupName = null;
        if (studentGroup) {
            groupName = studentGroup.name || 
                       studentGroup.groupName || 
                       studentGroup.title || 
                       studentGroup.displayName ||
                       `Grupo ${Object.keys(this.groups).find(key => this.groups[key] === studentGroup)}`;
        }

        // Calcular estado de pagos
        const studentPayments = Object.values(this.payments).filter(payment => 
            payment.studentId === studentId
        );
        const pendingPayments = studentPayments.filter(payment => payment.status === 'pending' || payment.status === 'overdue');
        const paymentStatus = pendingPayments.length > 0 ? 'pending' : 'up-to-date';

        // Calcular porcentaje de asistencia
        const studentAttendance = Object.values(this.attendance).filter(attendance => 
            attendance.studentId === studentId
        );
        const totalClasses = studentAttendance.length;
        const attendedClasses = studentAttendance.filter(attendance => attendance.status === 'present').length;
        const attendancePercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 100;

        return {
            group: groupName,
            paymentStatus,
            attendancePercentage,
            totalPayments: studentPayments.length,
            pendingPayments: pendingPayments.length,
            totalClasses: totalClasses,
            attendedClasses: attendedClasses
        };
    }

    viewDetailedHistory(studentId) {
        const student = this.students[studentId];
        if (!student) return;

        const stats = this.calculateStudentStats(studentId);
        const studentPayments = Object.values(this.payments).filter(payment => payment.studentId === studentId);
        const studentAttendance = Object.values(this.attendance).filter(attendance => attendance.studentId === studentId);

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-graduation-cap"></i> 
                    Historial Académico - ${student.firstName} ${student.lastName}
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="academic-history-tabs">
                <button class="tab-button active" onclick="window.academicHistoryManager.showTab('overview')">Resumen</button>
                <button class="tab-button" onclick="window.academicHistoryManager.showTab('payments')">Pagos</button>
                <button class="tab-button" onclick="window.academicHistoryManager.showTab('attendance')">Asistencia</button>
            </div>
            
            <div id="overview-tab" class="tab-content active">
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4>Información General</h4>
                        <p><strong>ID:</strong> ${student.studentId}</p>
                        <p><strong>Curso:</strong> ${student.course}</p>
                        <p><strong>Grupo:</strong> ${stats.group || 'Sin asignar'}</p>
                        <p><strong>Estado:</strong> <span class="status-badge ${student.status}">${this.getStatusText(student.status)}</span></p>
                        <p><strong>Fecha de Matrícula:</strong> ${this.formatDate(student.enrollmentDate)}</p>
                    </div>
                    
                    <div class="stat-card">
                        <h4>Rendimiento Académico</h4>
                        <p><strong>Asistencia:</strong> ${stats.attendancePercentage}%</p>
                        <p><strong>Clases Asistidas:</strong> ${stats.attendedClasses}/${stats.totalClasses}</p>
                        <p><strong>Estado Académico:</strong> <span class="status-badge ${student.status}">${this.getStatusText(student.status)}</span></p>
                    </div>
                    
                    <div class="stat-card">
                        <h4>Estado Financiero</h4>
                        <p><strong>Estado de Pagos:</strong> <span class="payment-status ${stats.paymentStatus}">${this.getPaymentStatusText(stats.paymentStatus)}</span></p>
                        <p><strong>Pagos Registrados:</strong> ${stats.totalPayments}</p>
                        <p><strong>Pagos Pendientes:</strong> ${stats.pendingPayments}</p>
                    </div>
                </div>
            </div>
            
            
            <div id="payments-tab" class="tab-content">
                <div class="payments-section">
                    <h4>Historial de Pagos</h4>
                    <div class="payments-list">
                        ${studentPayments.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay pagos registrados</p>' :
                            studentPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(payment => `
                                <div class="payment-item">
                                    <div class="payment-info">
                                        <strong>${this.formatMonth(payment.month)}</strong>
                                        <span class="payment-amount">${this.formatCurrency(payment.amount)}</span>
                                    </div>
                                    <div class="payment-status">
                                        <span class="status-badge ${payment.status}">${this.getPaymentStatusText(payment.status)}</span>
                                        ${payment.paymentDate ? `<small>Pagado: ${this.formatDate(payment.paymentDate)}</small>` : ''}
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
            
            <div id="attendance-tab" class="tab-content">
                <div class="attendance-section">
                    <h4>Historial de Asistencia</h4>
                    <div class="attendance-summary">
                        <p><strong>Porcentaje de Asistencia:</strong> ${stats.attendancePercentage}%</p>
                        <p><strong>Total de Clases:</strong> ${stats.totalClasses}</p>
                        <p><strong>Clases Asistidas:</strong> ${stats.attendedClasses}</p>
                        <p><strong>Ausencias:</strong> ${stats.totalClasses - stats.attendedClasses}</p>
                    </div>
                    <div class="attendance-list">
                        ${studentAttendance.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay registros de asistencia</p>' :
                            studentAttendance.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map(attendance => `
                                <div class="attendance-item">
                                    <span class="attendance-date">${this.formatDate(attendance.date)}</span>
                                    <span class="attendance-status ${attendance.status}">
                                        ${attendance.status === 'present' ? 'Presente' : 
                                          attendance.status === 'absent' ? 'Ausente' : 'Tardanza'}
                                    </span>
                                    ${attendance.notes ? `<small>${attendance.notes}</small>` : ''}
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-primary" onclick="window.academicHistoryManager.generateDetailedReport('${studentId}')">
                    <i class="fas fa-download"></i> Generar Reporte Completo
                </button>
            </div>
            
            <style>
                .academic-history-tabs {
                    display: flex;
                    border-bottom: 1px solid #ddd;
                    margin-bottom: 20px;
                }
                
                .tab-button {
                    padding: 10px 20px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                }
                
                .tab-button.active {
                    border-bottom-color: #667eea;
                    background-color: #f8f9fa;
                }
                
                .tab-content {
                    display: none;
                }
                
                .tab-content.active {
                    display: block;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                .stat-card {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #e3e6f0;
                }
                
                .stat-card h4 {
                    margin-bottom: 15px;
                    color: #2c3e50;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 5px;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .payment-item, .attendance-item {
                    background: #f8f9fa;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 8px;
                    border: 1px solid #e3e6f0;
                }
                
                .payment-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .payment-amount {
                    font-size: 16px;
                    font-weight: bold;
                    color: #28a745;
                }
                
                .attendance-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .attendance-status.present { color: #28a745; }
                .attendance-status.absent { color: #dc3545; }
                .attendance-status.late { color: #ffc107; }
                
                .btn-sm {
                    padding: 5px 10px;
                    font-size: 12px;
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    showTab(tabName) {
        // Ocultar todas las pestañas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Mostrar la pestaña seleccionada
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`.tab-button[onclick*="${tabName}"]`).classList.add('active');
    }


    generateReport(studentId) {
        // Implementación básica para generar reporte
        if (window.app) {
            window.app.showNotification('Función de reporte en desarrollo', 'info');
        }
    }

    generateDetailedReport(studentId) {
        // Implementación básica para generar reporte detallado
        if (window.app) {
            window.app.showNotification('Función de reporte detallado en desarrollo', 'info');
        }
    }

    viewStudentProfile(studentId) {
        const student = this.students[studentId];
        if (!student) {
            if (window.app) {
                window.app.showNotification('Estudiante no encontrado', 'error');
            }
            return;
        }

        const stats = this.calculateStudentStats(studentId);
        const studentPayments = Object.values(this.payments).filter(payment => payment.studentId === studentId);
        const studentAttendance = Object.values(this.attendance).filter(attendance => attendance.studentId === studentId);

        // Obtener información del grupo
        // Método 1: Buscar en array group.students
        let studentGroup = Object.values(this.groups).find(group => 
            group.students && group.students.includes(studentId)
        );

        // Método 2: Si no se encuentra, buscar por campo student.group
        if (!studentGroup && student.group) {
            studentGroup = Object.values(this.groups).find(group => {
                const groupId = Object.keys(this.groups).find(key => this.groups[key] === group);
                const groupName = group.groupName || group.groupCode || '';
                
                return student.group === groupId || 
                       student.group === groupName || 
                       student.group === group.groupCode;
            });
        }
        
        // Obtener el nombre del grupo
        let groupName = 'Sin grupo';
        if (studentGroup) {
            groupName = studentGroup.name || 
                       studentGroup.groupName || 
                       studentGroup.title || 
                       studentGroup.displayName ||
                       `Grupo ${Object.keys(this.groups).find(key => this.groups[key] === studentGroup)}`;
        }

        const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-user-graduate"></i> 
                    Perfil Completo del Estudiante
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="student-profile-section">
                <div class="student-profile-header">
                    <div class="student-profile-avatar">${initials}</div>
                    <div class="student-profile-info">
                        <h3>${student.firstName} ${student.lastName}</h3>
                        <p><strong>ID:</strong> ${student.studentId}</p>
                        <p><strong>Email:</strong> ${student.email}</p>
                        <p><strong>Teléfono:</strong> ${student.phone || 'No registrado'}</p>
                        <p><strong>Curso:</strong> ${student.course}</p>
                        <p><strong>Grupo:</strong> ${groupName}</p>
                        <p><strong>Estado:</strong> <span class="status-badge ${student.status}">${this.getStatusText(student.status)}</span></p>
                    </div>
                </div>
                
                <div class="performance-metrics">
                    <div class="performance-card">
                        <div class="performance-value ${this.getPerformanceClass(stats.attendancePercentage, 'attendance')}">${stats.attendancePercentage}%</div>
                        <div class="performance-label">Asistencia</div>
                        <small>${stats.attendedClasses}/${stats.totalClasses} clases</small>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value ${stats.pendingPayments > 0 ? 'poor' : 'excellent'}">${stats.pendingPayments}</div>
                        <div class="performance-label">Pagos Pendientes</div>
                        <small>${stats.totalPayments} pagos totales</small>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value excellent">${this.formatDate(student.enrollmentDate || student.createdAt)}</div>
                        <div class="performance-label">Fecha Matrícula</div>
                        <small>Tiempo en el instituto</small>
                    </div>
                </div>
            </div>
            
            <div class="student-profile-section">
                <h4><i class="fas fa-calendar-check"></i> Resumen de Asistencia Reciente</h4>
                <div style="max-height: 200px; overflow-y: auto; margin-top: 15px;">
                    ${studentAttendance.length === 0 ? 
                        '<p style="color: #6c757d; text-align: center;">No hay registros de asistencia</p>' :
                        studentAttendance
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 8)
                            .map(record => `
                                <div class="attendance-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: #f8f9fa; border-radius: 6px;">
                                    <span>${this.formatDate(record.date)}</span>
                                    <span class="status-badge ${record.status}">
                                        ${record.status === 'present' ? 'Presente' : record.status === 'absent' ? 'Ausente' : 'Tardanza'}
                                    </span>
                                </div>
                            `).join('')
                    }
                </div>
            </div>
            
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-primary" onclick="window.academicHistoryManager.viewDetailedHistory('${studentId}')">
                    <i class="fas fa-graduation-cap"></i> Ver Historial Completo
                </button>
            </div>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    getPerformanceClass(value, type) {
        if (type === 'attendance') {
            if (value >= 90) return 'excellent';
            if (value >= 80) return 'good';
            if (value >= 70) return 'average';
            return 'poor';
        }
        return 'average';
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'Activo',
            'inactive': 'Congelado',
            'graduated': 'Graduado',
            'dropped': 'Abandonó'
        };
        return statusMap[status] || status;
    }

    getPaymentStatusText(status) {
        const statusMap = {
            'paid': 'Pagado',
            'pending': 'Pendiente',
            'overdue': 'Atrasado',
            'up-to-date': 'Al día'
        };
        return statusMap[status] || status;
    }


    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    formatDateTime(date) {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    formatMonth(month) {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'long'
        }).format(date);
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('academicHistoryTable')) {
        window.academicHistoryManager = new AcademicHistoryManager();
        // No inicializar automáticamente, esperar a que la app esté lista
    }
});

export default AcademicHistoryManager; 