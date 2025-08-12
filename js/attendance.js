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
        this.filteredAttendance = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAttendance();
        this.loadCourseOptions();
    }

    setupEventListeners() {
        // Botón para marcar asistencia
        const markAttendanceBtn = document.getElementById('markAttendanceBtn');
        if (markAttendanceBtn) {
            markAttendanceBtn.addEventListener('click', () => {
                this.showAttendanceModal();
            });
        }

        // Filtros
        const attendanceCourseFilter = document.getElementById('attendanceCourseFilter');
        if (attendanceCourseFilter) {
            attendanceCourseFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const attendanceDate = document.getElementById('attendanceDate');
        if (attendanceDate) {
            attendanceDate.addEventListener('change', () => {
                this.applyFilters();
            });
            // Establecer fecha actual por defecto
            attendanceDate.value = new Date().toISOString().slice(0, 10);
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        const attendanceRef = ref(db, 'attendance');
        onValue(attendanceRef, (snapshot) => {
            if (snapshot.exists()) {
                this.attendance = snapshot.val();
                this.applyFilters();
            } else {
                this.attendance = {};
                this.renderAttendanceTable();
            }
        });
    }

    async loadAttendance() {
        try {
            const attendanceRef = ref(db, 'attendance');
            const snapshot = await get(attendanceRef);
            
            if (snapshot.exists()) {
                this.attendance = snapshot.val();
            } else {
                this.attendance = {};
            }
            
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar asistencia', 'error');
            }
        }
    }

    async loadCourseOptions() {
        try {
            // Cargar estudiantes
            const studentsRef = ref(db, 'students');
            const studentsSnapshot = await get(studentsRef);
            if (studentsSnapshot.exists()) {
                this.students = studentsSnapshot.val();
            }

            // Cargar cursos
            const coursesRef = ref(db, 'courses');
            const coursesSnapshot = await get(coursesRef);
            if (coursesSnapshot.exists()) {
                this.courses = coursesSnapshot.val();
                this.updateCourseFilter();
            }
        } catch (error) {
            console.error('Error al cargar opciones:', error);
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

    applyFilters() {
        const courseFilter = document.getElementById('attendanceCourseFilter')?.value || '';
        const dateFilter = document.getElementById('attendanceDate')?.value || '';

        this.filteredAttendance = Object.fromEntries(
            Object.entries(this.attendance).filter(([id, record]) => {
                const matchesCourse = !courseFilter || record.course === courseFilter;
                const matchesDate = !dateFilter || record.date === dateFilter;
                
                return matchesCourse && matchesDate;
            })
        );

        this.renderAttendanceTable();
    }

    renderAttendanceTable() {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        const attendanceToShow = Object.keys(this.filteredAttendance).length > 0 ? 
            this.filteredAttendance : this.attendance;

        if (Object.keys(attendanceToShow).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-calendar-check fa-3x mb-3"></i>
                            <h4>No hay registros de asistencia</h4>
                            <p>Comience marcando la asistencia de los estudiantes</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(attendanceToShow)
            .sort(([,a], [,b]) => new Date(b.date || 0) - new Date(a.date || 0))
            .map(([id, record]) => `
                <tr>
                    <td>${record.studentName}</td>
                    <td>${record.course}</td>
                    <td>${this.formatDate(record.date)}</td>
                    <td>
                        <span class="status-badge ${record.status}">
                            ${this.getStatusText(record.status)}
                        </span>
                    </td>
                    <td>${record.notes || '-'}</td>
                    <td>
                        <button class="btn-warning" onclick="window.attendanceManager.editAttendance('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger" onclick="window.attendanceManager.deleteAttendance('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
    }

    showAttendanceModal(attendanceId = null) {
        const record = attendanceId ? this.attendance[attendanceId] : null;
        const isEdit = record !== null;

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-calendar-check"></i> 
                    ${isEdit ? 'Editar' : 'Marcar'} Asistencia
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            ${!isEdit ? `
            <div class="attendance-options">
                <button type="button" class="btn-primary" onclick="window.attendanceManager.showBulkAttendance()">
                    <i class="fas fa-users"></i> Marcar Asistencia Grupal
                </button>
                <button type="button" class="btn-secondary" onclick="window.attendanceManager.showIndividualAttendance()">
                    <i class="fas fa-user"></i> Marcar Asistencia Individual
                </button>
            </div>
            ` : ''}
            
            <form id="attendanceForm" class="handled" style="display: ${isEdit ? 'block' : 'none'};">
                <div class="form-group">
                    <label for="attendanceDate">Fecha *</label>
                    <input 
                        type="date" 
                        id="attendanceDate" 
                        value="${record?.date || new Date().toISOString().slice(0, 10)}" 
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label for="attendanceCourse">Curso *</label>
                    <select id="attendanceCourse" required>
                        <option value="">Seleccionar curso</option>
                        ${Object.values(this.courses)
                            .filter(course => course.status === 'active')
                            .map(course => `
                                <option value="${course.name}" ${record?.course === course.name ? 'selected' : ''}>
                                    ${course.name}
                                </option>
                            `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="attendanceStudent">Estudiante *</label>
                    <select id="attendanceStudent" required>
                        <option value="">Seleccionar estudiante</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="attendanceStatus">Estado *</label>
                    <select id="attendanceStatus" required>
                        <option value="present" ${record?.status === 'present' ? 'selected' : ''}>Presente</option>
                        <option value="absent" ${record?.status === 'absent' ? 'selected' : ''}>Ausente</option>
                        <option value="late" ${record?.status === 'late' ? 'selected' : ''}>Tardanza</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="attendanceNotes">Observaciones</label>
                    <textarea 
                        id="attendanceNotes" 
                        placeholder="Notas adicionales..."
                    >${record?.notes || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Marcar'} Asistencia
                    </button>
                </div>
            </form>
            
            <style>
                .attendance-options {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 25px;
                    justify-content: center;
                }
                
                .attendance-options button {
                    flex: 1;
                    padding: 15px;
                    font-size: 14px;
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar eventos del formulario
        this.setupAttendanceFormEvents(attendanceId);
    }

    showBulkAttendance() {
        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-users"></i> 
                    Marcar Asistencia Grupal
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="bulkAttendanceForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="bulkDate">Fecha *</label>
                        <input 
                            type="date" 
                            id="bulkDate" 
                            value="${new Date().toISOString().slice(0, 10)}" 
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="bulkCourse">Curso *</label>
                        <select id="bulkCourse" required>
                            <option value="">Seleccionar curso</option>
                            ${Object.values(this.courses)
                                .filter(course => course.status === 'active')
                                .map(course => `
                                    <option value="${course.name}">${course.name}</option>
                                `).join('')}
                        </select>
                    </div>
                </div>
                
                <div id="studentsListContainer" style="display: none;">
                    <h4>Estudiantes del Curso</h4>
                    <div id="studentsList" class="students-attendance-list">
                        <!-- Los estudiantes se cargarán aquí -->
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        Guardar Asistencia
                    </button>
                </div>
            </form>
            
            <style>
                .students-attendance-list {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                
                .student-attendance-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                    margin-bottom: 10px;
                }
                
                .student-attendance-item:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }
                
                .student-info {
                    flex: 1;
                }
                
                .attendance-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .attendance-controls input[type="radio"] {
                    margin-right: 5px;
                }
                
                .attendance-controls label {
                    margin-right: 15px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        this.setupBulkAttendanceEvents();
    }

    showIndividualAttendance() {
        // Mostrar el formulario individual
        const form = document.getElementById('attendanceForm');
        if (form) {
            form.style.display = 'block';
        }
    }

    setupBulkAttendanceEvents() {
        const courseSelect = document.getElementById('bulkCourse');
        const studentsListContainer = document.getElementById('studentsListContainer');
        const studentsList = document.getElementById('studentsList');
        const form = document.getElementById('bulkAttendanceForm');

        if (courseSelect) {
            courseSelect.addEventListener('change', () => {
                const selectedCourse = courseSelect.value;
                if (selectedCourse) {
                    this.loadStudentsForCourse(selectedCourse, studentsList);
                    studentsListContainer.style.display = 'block';
                } else {
                    studentsListContainer.style.display = 'none';
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveBulkAttendance();
            });
        }
    }

    loadStudentsForCourse(courseName, container) {
        const courseStudents = Object.entries(this.students)
            .filter(([id, student]) => student.course === courseName && student.status === 'active')
            .map(([id, student]) => ({ id, ...student }));

        container.innerHTML = courseStudents.map(student => `
            <div class="student-attendance-item">
                <div class="student-info">
                    <strong>${student.firstName} ${student.lastName}</strong>
                    <br>
                    <small>${student.studentId}</small>
                </div>
                <div class="attendance-controls">
                    <label>
                        <input type="radio" name="attendance_${student.id}" value="present" checked>
                        Presente
                    </label>
                    <label>
                        <input type="radio" name="attendance_${student.id}" value="absent">
                        Ausente
                    </label>
                    <label>
                        <input type="radio" name="attendance_${student.id}" value="late">
                        Tardanza
                    </label>
                </div>
            </div>
        `).join('');
    }

    async saveBulkAttendance() {
        const date = document.getElementById('bulkDate').value;
        const course = document.getElementById('bulkCourse').value;
        
        if (!date || !course) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        try {
            const attendanceRecords = [];
            const studentInputs = document.querySelectorAll('[name^="attendance_"]');
            
            // Agrupar por estudiante
            const studentAttendance = {};
            studentInputs.forEach(input => {
                if (input.checked) {
                    const studentId = input.name.replace('attendance_', '');
                    studentAttendance[studentId] = input.value;
                }
            });

            // Crear registros de asistencia
            for (const [studentId, status] of Object.entries(studentAttendance)) {
                const student = this.students[studentId];
                if (student) {
                    // Verificar si ya existe registro para esta fecha y estudiante
                    const existingRecord = Object.values(this.attendance).find(record => 
                        record.studentId === studentId && 
                        record.date === date &&
                        record.course === course
                    );

                    if (!existingRecord) {
                        attendanceRecords.push({
                            studentId,
                            studentName: `${student.firstName} ${student.lastName}`,
                            course,
                            date,
                            status,
                            notes: '',
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }

            // Guardar en Firebase
            const attendanceRef = ref(db, 'attendance');
            for (const record of attendanceRecords) {
                await push(attendanceRef, record);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Se registró la asistencia de ${attendanceRecords.length} estudiantes`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar asistencia masiva:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la asistencia', 'error');
            }
        }
    }

    setupAttendanceFormEvents(attendanceId) {
        const courseSelect = document.getElementById('attendanceCourse');
        const studentSelect = document.getElementById('attendanceStudent');
        const form = document.getElementById('attendanceForm');

        // Actualizar estudiantes cuando se selecciona curso
        if (courseSelect) {
            courseSelect.addEventListener('change', () => {
                const selectedCourse = courseSelect.value;
                this.updateStudentSelect(selectedCourse, studentSelect);
            });

            // Si hay un curso preseleccionado, cargar estudiantes
            if (courseSelect.value) {
                this.updateStudentSelect(courseSelect.value, studentSelect);
            }
        }

        // Configurar envío del formulario
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAttendance(attendanceId);
            });
        }
    }

    updateStudentSelect(courseName, studentSelect) {
        if (!studentSelect) return;

        const courseStudents = Object.entries(this.students)
            .filter(([id, student]) => student.course === courseName && student.status === 'active');

        studentSelect.innerHTML = '<option value="">Seleccionar estudiante</option>' +
            courseStudents.map(([id, student]) => `
                <option value="${id}">${student.firstName} ${student.lastName} - ${student.studentId}</option>
            `).join('');
    }

    async saveAttendance(attendanceId = null) {
        const form = document.getElementById('attendanceForm');
        if (!form) return;

        const studentId = document.getElementById('attendanceStudent').value;
        const student = this.students[studentId];

        const attendanceData = {
            studentId,
            studentName: student ? `${student.firstName} ${student.lastName}` : '',
            course: document.getElementById('attendanceCourse').value,
            date: document.getElementById('attendanceDate').value,
            status: document.getElementById('attendanceStatus').value,
            notes: document.getElementById('attendanceNotes').value.trim(),
            updatedAt: new Date().toISOString()
        };

        // Validaciones
        if (!attendanceData.studentId || !attendanceData.course || !attendanceData.date || !attendanceData.status) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Verificar registros duplicados
        if (!attendanceId) {
            const isDuplicate = Object.values(this.attendance).some(record => 
                record.studentId === attendanceData.studentId && 
                record.date === attendanceData.date &&
                record.course === attendanceData.course
            );

            if (isDuplicate) {
                if (window.app) {
                    window.app.showNotification('Ya existe un registro de asistencia para este estudiante en esta fecha', 'error');
                }
                return;
            }
        }

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (attendanceId) {
                // Actualizar registro existente
                const attendanceRef = ref(db, `attendance/${attendanceId}`);
                await set(attendanceRef, attendanceData);
            } else {
                // Crear nuevo registro
                attendanceData.createdAt = new Date().toISOString();
                const attendanceRef = ref(db, 'attendance');
                await push(attendanceRef, attendanceData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Asistencia ${attendanceId ? 'actualizada' : 'registrada'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la asistencia', 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${attendanceId ? 'Actualizar' : 'Marcar'} Asistencia`;
            }
        }
    }

    editAttendance(attendanceId) {
        this.showAttendanceModal(attendanceId);
    }

    async deleteAttendance(attendanceId) {
        const record = this.attendance[attendanceId];
        if (!record) return;

        const confirmed = confirm(
            `¿Está seguro de que desea eliminar el registro de asistencia de ${record.studentName} del ${this.formatDate(record.date)}?\n\n` +
            'Esta acción no se puede deshacer.'
        );

        if (!confirmed) return;

        try {
            const attendanceRef = ref(db, `attendance/${attendanceId}`);
            await remove(attendanceRef);

            if (window.app) {
                window.app.showNotification('Registro de asistencia eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar registro de asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el registro', 'error');
            }
        }
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

