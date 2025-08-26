import { 
    ref, 
    push, 
    set, 
    get, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class AttendanceManager {
    constructor() {
        this.attendance = {};
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.currentStudentsForAttendance = [];
        this.currentAttendanceData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAllData();
    }

    setupEventListeners() {
        // Filtros principales que cargan estudiantes automáticamente
        const attendanceCourseFilter = document.getElementById('attendanceCourseFilter');
        if (attendanceCourseFilter) {
            attendanceCourseFilter.addEventListener('change', () => {
                this.loadGroupsForCourse();
                this.loadStudentsInTable();
            });
        }

        const attendanceGroupFilter = document.getElementById('attendanceGroupFilter');
        if (attendanceGroupFilter) {
            attendanceGroupFilter.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
        }

        const attendanceDate = document.getElementById('attendanceDate');
        if (attendanceDate) {
            attendanceDate.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
            // Establecer fecha actual por defecto
            attendanceDate.value = new Date().toISOString().slice(0, 10);
        }

        // Botón de guardar asistencia
        const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
        if (saveAttendanceBtn) {
            saveAttendanceBtn.addEventListener('click', () => {
                this.saveAllAttendance();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        const collections = ['attendance', 'students', 'courses', 'groups'];
        
        collections.forEach(collection => {
            const collectionRef = ref(db, collection);
            onValue(collectionRef, (snapshot) => {
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
                
                if (collection === 'courses') {
                    this.updateCourseFilter();
                }
            });
        });
    }

    async loadAllData() {
        try {
            const collections = ['attendance', 'students', 'courses', 'groups'];
            
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
            this.updateCourseFilter();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar datos', 'error');
            }
        }
    }

    updateCourseFilter() {
        const attendanceCourseFilter = document.getElementById('attendanceCourseFilter');
        
        if (attendanceCourseFilter) {
            const activeCourses = Object.values(this.courses)
                .filter(course => course.status === 'active');
            
            attendanceCourseFilter.innerHTML = '<option value="">Seleccionar curso</option>' +
                activeCourses.map(course => 
                    `<option value="${course.name}">${course.name}</option>`
                ).join('');
        }
    }

    loadGroupsForCourse() {
        const courseFilter = document.getElementById('attendanceCourseFilter');
        const groupFilter = document.getElementById('attendanceGroupFilter');
        
        if (!courseFilter || !groupFilter) return;

        const selectedCourse = courseFilter.value;
        
        if (!selectedCourse) {
            groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
            return;
        }

        const courseGroups = Object.entries(this.groups)
            .filter(([id, group]) => group.courseName === selectedCourse && group.status === 'active')
            .map(([id, group]) => ({ id, ...group }));

        groupFilter.innerHTML = '<option value="">Todos los grupos</option>' +
            courseGroups.map(group => 
                `<option value="${group.id}">${group.groupName} (${group.groupCode})</option>`
            ).join('');
    }

    async loadStudentsInTable() {
        const courseFilter = document.getElementById('attendanceCourseFilter');
        const groupFilter = document.getElementById('attendanceGroupFilter');
        const dateFilter = document.getElementById('attendanceDate');
        
        // Si no hay curso seleccionado, mostrar tabla vacía
        if (!courseFilter.value) {
            this.renderEmptyTable();
            return;
        }

        const selectedCourse = courseFilter.value;
        const selectedGroup = groupFilter.value;
        const selectedDate = dateFilter.value || new Date().toISOString().slice(0, 10);

        try {
            let studentsToShow = [];

            // DEBUG: Mostrar información detallada
            console.log('=== DEBUG ASISTENCIA ===');
            console.log('Curso seleccionado:', selectedCourse);
            console.log('Grupo seleccionado:', selectedGroup);
            console.log('Total estudiantes en sistema:', Object.keys(this.students).length);
            console.log('Todos los estudiantes:', this.students);

            if (selectedGroup) {
                // Obtener estudiantes del grupo específico
                const group = this.groups[selectedGroup];
                console.log('Datos del grupo:', group);
                if (group && group.students) {
                    studentsToShow = group.students
                        .map(studentId => ({ id: studentId, ...this.students[studentId] }))
                        .filter(student => student && student.course === selectedCourse && student.status === 'active');
                    console.log('Estudiantes del grupo (antes filtro):', group.students);
                    console.log('Estudiantes del grupo (después filtro):', studentsToShow);
                }
            } else {
                // Obtener todos los estudiantes del curso
                console.log('Buscando estudiantes del curso:', selectedCourse);
                
                // Analizar cada estudiante
                Object.entries(this.students).forEach(([id, student]) => {
                    console.log(`Estudiante ${id}:`, {
                        nombre: `${student.firstName} ${student.lastName}`,
                        curso: student.course,
                        estado: student.status,
                        coincideCurso: student.course === selectedCourse,
                        esActivo: student.status === 'active'
                    });
                });
                
                studentsToShow = Object.entries(this.students)
                    .filter(([id, student]) => 
                        student.course === selectedCourse && 
                        student.status === 'active'
                    )
                    .map(([id, student]) => ({ id, ...student }));
                    
                console.log('Estudiantes filtrados:', studentsToShow);
            }
            
            console.log('Total estudiantes a mostrar:', studentsToShow.length);
            console.log('========================');

            // Verificar registros de asistencia existentes para esta fecha
            const existingAttendance = Object.entries(this.attendance)
                .filter(([id, record]) => 
                    record.course === selectedCourse && 
                    record.date === selectedDate
                )
                .reduce((acc, [id, record]) => {
                    acc[record.studentId] = { ...record, id };
                    return acc;
                }, {});

            this.currentStudentsForAttendance = studentsToShow;
            this.currentAttendanceData = existingAttendance;
            
            this.renderStudentsInTable(studentsToShow, selectedCourse, selectedGroup, selectedDate, existingAttendance);
            
            // Mostrar botón de guardar si hay estudiantes
            const saveBtn = document.getElementById('saveAttendanceBtn');
            if (saveBtn) {
                saveBtn.style.display = studentsToShow.length > 0 ? 'block' : 'none';
            }

        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar estudiantes', 'error');
            }
        }
    }

    renderEmptyTable() {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div style="padding: 40px; color: #6c757d;">
                        <i class="fas fa-calendar-check fa-3x mb-3"></i>
                        <h4>Seleccione un curso para comenzar</h4>
                        <p>Elija un curso, grupo (opcional) y fecha para cargar los estudiantes</p>
                    </div>
                </td>
            </tr>
        `;

        // Ocultar botón de guardar
        const saveBtn = document.getElementById('saveAttendanceBtn');
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
    }

    renderStudentsInTable(students, course, groupId, date, existingAttendance) {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        if (students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-user-graduate fa-3x mb-3"></i>
                            <h4>No hay estudiantes</h4>
                            <p>No se encontraron estudiantes para los criterios seleccionados</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const groupName = groupId ? (this.groups[groupId]?.groupName || 'Sin grupo') : 'Todos los grupos';

        tbody.innerHTML = students.map(student => {
            const existingRecord = existingAttendance[student.id];
            const currentStatus = existingRecord ? existingRecord.status : 'present';
            const currentNotes = existingRecord ? existingRecord.notes || '' : '';

            return `
                <tr data-student-id="${student.id}">
                    <td>
                        <div class="student-info">
                            <strong>${student.firstName} ${student.lastName}</strong>
                            <div style="font-size: 12px; color: #6c757d;">${student.studentId}</div>
                        </div>
                    </td>
                    <td>${course}</td>
                    <td>${groupName}</td>
                    <td>${this.formatDate(date)}</td>
                    <td>
                        <div class="status-selector">
                            <select class="attendance-status-select" data-student-id="${student.id}" onchange="window.attendanceManager.updateStudentStatus('${student.id}', this.value)">
                                <option value="present" ${currentStatus === 'present' ? 'selected' : ''}>Presente</option>
                                <option value="absent" ${currentStatus === 'absent' ? 'selected' : ''}>Ausente</option>
                                <option value="late" ${currentStatus === 'late' ? 'selected' : ''}>Tardanza</option>
                            </select>
                        </div>
                    </td>
                    <td>
                        <input type="text" 
                               class="attendance-notes-input" 
                               data-student-id="${student.id}"
                               placeholder="Observaciones..."
                               value="${currentNotes}">
                    </td>
                    <td>
                        <button class="btn-info btn-sm" onclick="window.attendanceManager.viewStudentProfile('${student.id}')" title="Ver perfil">
                            <i class="fas fa-user"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStudentStatus(studentId, status) {
        // Actualizar datos internos
        if (!this.currentAttendanceData[studentId]) {
            this.currentAttendanceData[studentId] = {};
        }
        this.currentAttendanceData[studentId].status = status;

        // Actualizar visualmente la fila
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (row) {
            // Remover clases de estado anteriores
            row.classList.remove('status-present', 'status-absent', 'status-late');
            // Agregar nueva clase de estado
            row.classList.add(`status-${status}`);
        }
    }

    async saveAllAttendance() {
        const courseFilter = document.getElementById('attendanceCourseFilter');
        const groupFilter = document.getElementById('attendanceGroupFilter');
        const dateFilter = document.getElementById('attendanceDate');
        
        if (!courseFilter.value || !dateFilter.value) {
            if (window.app) {
                window.app.showNotification('Seleccione curso y fecha', 'error');
            }
            return;
        }

        try {
            const course = courseFilter.value;
            const date = dateFilter.value;
            const group = groupFilter.value;
            
            const attendanceRecords = [];
            const updates = [];

            // Recopilar datos de todos los estudiantes
            this.currentStudentsForAttendance.forEach(student => {
                const statusSelect = document.querySelector(`select[data-student-id="${student.id}"]`);
                const notesInput = document.querySelector(`input[data-student-id="${student.id}"]`);
                
                if (!statusSelect) return;

                const status = statusSelect.value;
                const notes = notesInput ? notesInput.value.trim() : '';

                const attendanceData = {
                    studentId: student.id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    course: course,
                    date: date,
                    status: status,
                    notes: notes,
                    group: group || null,
                    updatedAt: new Date().toISOString()
                };

                // Verificar si ya existe un registro
                const existingRecord = this.currentAttendanceData[student.id];
                if (existingRecord && existingRecord.id) {
                    // Actualizar registro existente
                    updates.push({ id: existingRecord.id, data: attendanceData });
                } else {
                    // Crear nuevo registro
                    attendanceData.createdAt = new Date().toISOString();
                    attendanceRecords.push(attendanceData);
                }
            });

            // Guardar nuevos registros
            const attendanceRef = ref(db, 'attendance');
            for (const record of attendanceRecords) {
                await push(attendanceRef, record);
            }

            // Actualizar registros existentes
            for (const update of updates) {
                const recordRef = ref(db, `attendance/${update.id}`);
                await set(recordRef, update.data);
            }

            if (window.app) {
                window.app.showNotification(
                    `Asistencia guardada para ${this.currentStudentsForAttendance.length} estudiantes`, 
                    'success'
                );
            }

            // Recargar datos para reflejar cambios
            setTimeout(() => {
                this.loadStudentsInTable();
            }, 500);

        } catch (error) {
            console.error('Error al guardar asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la asistencia', 'error');
            }
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

        // Calcular estadísticas del estudiante
        const studentAttendance = Object.values(this.attendance).filter(record => record.studentId === studentId);
        const totalClasses = studentAttendance.length;
        const presentClasses = studentAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
        const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

        // Obtener información adicional si está disponible
        const payments = window.paymentsManager ? 
            Object.values(window.paymentsManager.payments || {}).filter(p => p.studentId === studentId) : [];
        const grades = window.academicHistoryManager ? 
            Object.values(window.academicHistoryManager.grades || {}).filter(g => g.studentId === studentId) : [];

        const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue').length;
        const averageGrade = grades.length > 0 ? 
            (grades.reduce((sum, grade) => sum + parseFloat(grade.grade), 0) / grades.length).toFixed(1) : 'N/A';

        const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-user-graduate"></i> 
                    Perfil del Estudiante
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
                    </div>
                </div>
                
                <div class="performance-metrics">
                    <div class="performance-card">
                        <div class="performance-value ${this.getPerformanceClass(attendancePercentage, 'attendance')}">${attendancePercentage}%</div>
                        <div class="performance-label">Asistencia</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value ${this.getPerformanceClass(averageGrade, 'grade')}">${averageGrade}</div>
                        <div class="performance-label">Promedio</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value ${pendingPayments > 0 ? 'poor' : 'excellent'}">${pendingPayments}</div>
                        <div class="performance-label">Pagos Pendientes</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value excellent">${totalClasses}</div>
                        <div class="performance-label">Total Clases</div>
                    </div>
                </div>
            </div>
            
            <div class="student-profile-section">
                <h4><i class="fas fa-calendar-check"></i> Asistencia Reciente</h4>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 15px;">
                    ${studentAttendance.length === 0 ? 
                        '<p style="color: #6c757d; text-align: center;">No hay registros de asistencia</p>' :
                        studentAttendance
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 10)
                            .map(record => `
                                <div class="attendance-item">
                                    <span class="attendance-date">${this.formatDate(record.date)}</span>
                                    <span class="status-badge ${record.status}">
                                        ${this.getStatusText(record.status)}
                                    </span>
                                    ${record.notes ? `<small>${record.notes}</small>` : ''}
                                </div>
                            `).join('')
                    }
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                ${window.academicHistoryManager ? `
                    <button type="button" class="btn-primary" onclick="window.academicHistoryManager.viewDetailedHistory('${studentId}')">
                        <i class="fas fa-graduation-cap"></i> Ver Historial Completo
                    </button>
                ` : ''}
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
        } else if (type === 'grade') {
            if (value === 'N/A') return 'average';
            const numValue = parseFloat(value);
            if (numValue >= 90) return 'excellent';
            if (numValue >= 80) return 'good';
            if (numValue >= 70) return 'average';
            return 'poor';
        }
        return 'average';
    }

    getStatusText(status) {
        const statusMap = {
            'present': 'Presente',
            'absent': 'Ausente',
            'late': 'Tardanza'
        };
        return statusMap[status] || status;
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    // Obtener estadísticas de asistencia
    getAttendanceStats(studentId, month = null) {
        const studentRecords = Object.values(this.attendance).filter(record => {
            const matchesStudent = record.studentId === studentId;
            const matchesMonth = !month || record.date.startsWith(month);
            return matchesStudent && matchesMonth;
        });

        const stats = {
            total: studentRecords.length,
            present: studentRecords.filter(r => r.status === 'present').length,
            absent: studentRecords.filter(r => r.status === 'absent').length,
            late: studentRecords.filter(r => r.status === 'late').length
        };

        stats.percentage = stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) : 0;

        return stats;
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('attendanceTable')) {
        window.attendanceManager = new AttendanceManager();
    }
});

export default AttendanceManager;