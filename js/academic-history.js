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
        this.grades = {};
        this.filteredStudents = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAllData();
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
        const collections = ['students', 'courses', 'groups', 'payments', 'attendance', 'grades'];
        
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
            const collections = ['students', 'courses', 'groups', 'payments', 'attendance', 'grades'];
            
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
            this.updateFilters();
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar datos del historial académico:', error);
            if (window.app) {
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
                    <td colspan="8" class="text-center">
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
                        <td>${studentStats.averageGrade || 'N/A'}</td>
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
                            <button class="btn-success" onclick="window.academicHistoryManager.manageGrades('${studentId}')" title="Gestionar notas">
                                <i class="fas fa-star"></i>
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

        // Calcular grupo
        const studentGroup = Object.values(this.groups).find(group => 
            group.students && group.students.includes(studentId)
        );

        // Calcular promedio de notas
        const studentGrades = Object.values(this.grades).filter(grade => 
            grade.studentId === studentId
        );
        const averageGrade = studentGrades.length > 0 ? 
            (studentGrades.reduce((sum, grade) => sum + parseFloat(grade.grade), 0) / studentGrades.length).toFixed(1) : null;

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
            group: studentGroup ? studentGroup.groupName : null,
            averageGrade,
            paymentStatus,
            attendancePercentage,
            totalGrades: studentGrades.length,
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
        const studentGrades = Object.values(this.grades).filter(grade => grade.studentId === studentId);
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
                <button class="tab-button" onclick="window.academicHistoryManager.showTab('grades')">Notas</button>
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
                        <p><strong>Promedio General:</strong> ${stats.averageGrade || 'N/A'}</p>
                        <p><strong>Total de Notas:</strong> ${stats.totalGrades}</p>
                        <p><strong>Asistencia:</strong> ${stats.attendancePercentage}%</p>
                        <p><strong>Clases Asistidas:</strong> ${stats.attendedClasses}/${stats.totalClasses}</p>
                    </div>
                    
                    <div class="stat-card">
                        <h4>Estado Financiero</h4>
                        <p><strong>Estado de Pagos:</strong> <span class="payment-status ${stats.paymentStatus}">${this.getPaymentStatusText(stats.paymentStatus)}</span></p>
                        <p><strong>Pagos Registrados:</strong> ${stats.totalPayments}</p>
                        <p><strong>Pagos Pendientes:</strong> ${stats.pendingPayments}</p>
                    </div>
                </div>
            </div>
            
            <div id="grades-tab" class="tab-content">
                <div class="grades-section">
                    <div class="section-header">
                        <h4>Historial de Notas</h4>
                        <button class="btn-primary btn-sm" onclick="window.academicHistoryManager.addGrade('${studentId}')">
                            <i class="fas fa-plus"></i> Agregar Nota
                        </button>
                    </div>
                    <div class="grades-list">
                        ${studentGrades.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay notas registradas</p>' :
                            studentGrades.sort((a, b) => new Date(b.date) - new Date(a.date)).map(grade => `
                                <div class="grade-item">
                                    <div class="grade-info">
                                        <strong>${grade.subject || 'Materia'}</strong>
                                        <span class="grade-value ${this.getGradeClass(grade.grade)}">${grade.grade}</span>
                                    </div>
                                    <div class="grade-details">
                                        <small>Fecha: ${this.formatDate(grade.date)}</small>
                                        <small>Tipo: ${grade.type || 'Evaluación'}</small>
                                        ${grade.description ? `<small>Descripción: ${grade.description}</small>` : ''}
                                    </div>
                                </div>
                            `).join('')
                        }
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
                
                .grade-item, .payment-item, .attendance-item {
                    background: #f8f9fa;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 8px;
                    border: 1px solid #e3e6f0;
                }
                
                .grade-info, .payment-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .grade-value {
                    font-size: 18px;
                    font-weight: bold;
                    padding: 5px 10px;
                    border-radius: 20px;
                }
                
                .grade-excellent { background-color: #28a745; color: white; }
                .grade-good { background-color: #17a2b8; color: white; }
                .grade-average { background-color: #ffc107; color: black; }
                .grade-poor { background-color: #dc3545; color: white; }
                
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

    manageGrades(studentId) {
        const student = this.students[studentId];
        if (!student) return;

        const studentGrades = Object.values(this.grades).filter(grade => grade.studentId === studentId);

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-star"></i> 
                    Gestionar Notas - ${student.firstName} ${student.lastName}
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="grades-management">
                <div class="add-grade-section">
                    <h4>Agregar Nueva Nota</h4>
                    <form id="gradeForm">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                            <div class="form-group">
                                <label for="gradeSubject">Materia *</label>
                                <input type="text" id="gradeSubject" required placeholder="Ej: Anatomía Veterinaria">
                            </div>
                            <div class="form-group">
                                <label for="gradeValue">Nota *</label>
                                <input type="number" id="gradeValue" min="0" max="100" step="0.1" required placeholder="0-100">
                            </div>
                            <div class="form-group">
                                <label for="gradeType">Tipo de Evaluación *</label>
                                <select id="gradeType" required>
                                    <option value="">Seleccionar</option>
                                    <option value="examen">Examen</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="tarea">Tarea</option>
                                    <option value="proyecto">Proyecto</option>
                                    <option value="practica">Práctica</option>
                                    <option value="final">Examen Final</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px;">
                            <div class="form-group">
                                <label for="gradeDate">Fecha *</label>
                                <input type="date" id="gradeDate" required value="${new Date().toISOString().slice(0, 10)}">
                            </div>
                            <div class="form-group">
                                <label for="gradeDescription">Descripción</label>
                                <input type="text" id="gradeDescription" placeholder="Descripción opcional">
                            </div>
                        </div>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-plus"></i> Agregar Nota
                        </button>
                    </form>
                </div>
                
                <div class="existing-grades-section">
                    <h4>Notas Existentes (${studentGrades.length})</h4>
                    <div class="grades-list">
                        ${studentGrades.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay notas registradas</p>' :
                            studentGrades.sort((a, b) => new Date(b.date) - new Date(a.date)).map((grade, index) => `
                                <div class="grade-item">
                                    <div class="grade-header">
                                        <strong>${grade.subject}</strong>
                                        <span class="grade-value ${this.getGradeClass(grade.grade)}">${grade.grade}</span>
                                        <button class="btn-danger btn-sm" onclick="window.academicHistoryManager.deleteGrade('${Object.keys(this.grades).find(id => this.grades[id] === grade)}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                    <div class="grade-details">
                                        <small>Tipo: ${grade.type} | Fecha: ${this.formatDate(grade.date)}</small>
                                        ${grade.description ? `<small>Descripción: ${grade.description}</small>` : ''}
                                    </div>
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
            </div>
            
            <style>
                .grades-management {
                    max-height: 600px;
                    overflow-y: auto;
                }
                
                .add-grade-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                
                .grade-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .grade-item {
                    background: white;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 8px;
                    border: 1px solid #e3e6f0;
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const gradeForm = document.getElementById('gradeForm');
            if (gradeForm) {
                gradeForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveGrade(studentId);
                });
            }
        }, 100);
    }

    async saveGrade(studentId) {
        const gradeData = {
            studentId: studentId,
            subject: document.getElementById('gradeSubject').value.trim(),
            grade: parseFloat(document.getElementById('gradeValue').value),
            type: document.getElementById('gradeType').value,
            date: document.getElementById('gradeDate').value,
            description: document.getElementById('gradeDescription').value.trim(),
            createdAt: new Date().toISOString()
        };

        // Validaciones
        if (!gradeData.subject || !gradeData.grade || !gradeData.type || !gradeData.date) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        if (gradeData.grade < 0 || gradeData.grade > 100) {
            if (window.app) {
                window.app.showNotification('La nota debe estar entre 0 y 100', 'error');
            }
            return;
        }

        try {
            const gradesRef = ref(db, 'grades');
            await push(gradesRef, gradeData);

            if (window.app) {
                window.app.showNotification('Nota agregada exitosamente', 'success');
            }

            // Recargar modal
            setTimeout(() => this.manageGrades(studentId), 500);

        } catch (error) {
            console.error('Error al guardar nota:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la nota', 'error');
            }
        }
    }

    async deleteGrade(gradeId) {
        if (!confirm('¿Está seguro de que desea eliminar esta nota?')) return;

        try {
            const gradeRef = ref(db, `grades/${gradeId}`);
            await remove(gradeRef);

            if (window.app) {
                window.app.showNotification('Nota eliminada exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar nota:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar la nota', 'error');
            }
        }
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
        const studentGrades = Object.values(this.grades).filter(grade => grade.studentId === studentId);
        const studentPayments = Object.values(this.payments).filter(payment => payment.studentId === studentId);
        const studentAttendance = Object.values(this.attendance).filter(attendance => attendance.studentId === studentId);

        // Obtener información del grupo
        const studentGroup = Object.values(this.groups).find(group => 
            group.students && group.students.includes(studentId)
        );

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
                        <p><strong>Grupo:</strong> ${studentGroup ? `${studentGroup.groupName} (${studentGroup.groupCode})` : 'Sin asignar'}</p>
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
                        <div class="performance-value ${this.getGradeClass(stats.averageGrade)}">${stats.averageGrade || 'N/A'}</div>
                        <div class="performance-label">Promedio</div>
                        <small>${stats.totalGrades} evaluaciones</small>
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
            
            <div class="student-profile-section">
                <h4><i class="fas fa-star"></i> Últimas Evaluaciones</h4>
                <div style="max-height: 200px; overflow-y: auto; margin-top: 15px;">
                    ${studentGrades.length === 0 ? 
                        '<p style="color: #6c757d; text-align: center;">No hay notas registradas</p>' :
                        studentGrades
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 5)
                            .map(grade => `
                                <div class="grade-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: #f8f9fa; border-radius: 6px;">
                                    <div>
                                        <strong>${grade.subject}</strong><br>
                                        <small>${grade.type} - ${this.formatDate(grade.date)}</small>
                                    </div>
                                    <span class="grade-value ${this.getGradeClass(grade.grade)}">${grade.grade}</span>
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
                <button type="button" class="btn-success" onclick="window.academicHistoryManager.manageGrades('${studentId}')">
                    <i class="fas fa-star"></i> Gestionar Notas
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

    getGradeClass(grade) {
        const numGrade = parseFloat(grade);
        if (numGrade >= 90) return 'grade-excellent';
        if (numGrade >= 80) return 'grade-good';
        if (numGrade >= 70) return 'grade-average';
        return 'grade-poor';
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
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('academicHistoryTable')) {
        window.academicHistoryManager = new AcademicHistoryManager();
        await window.academicHistoryManager.init();
    }
});

export default AcademicHistoryManager; 