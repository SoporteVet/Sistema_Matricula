import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class ReportsManager {
    constructor() {
        this.data = {
            students: {},
            courses: {},
            payments: {},
            attendance: {},
            evaluations: {},
            grades: {},
            groups: {}
        };
        this.isLoading = false;
        // No inicializar automáticamente, esperar a que la app esté lista
        this.setupEventListeners();
        // No llamar a init() aquí
    }

    init() {
        // Solo cargar reportes si la aplicación está inicializada
        if (window.app && window.app.initialized) {
            this.loadReports();
        } else {
            // Esperar a que la aplicación se inicialice
            setTimeout(() => {
                if (window.app && window.app.initialized) {
                    this.loadReports();
                }
            }, 2000);
        }
    }

    // Método público para inicializar manualmente
    initializeAfterAuth() {
        // Verificar que la autenticación esté completa
        if (!window.auth || !window.auth.currentUser) {
            setTimeout(() => this.initializeAfterAuth(), 1000);
            return;
        }
        
        // Inicializar después de la autenticación
        setTimeout(() => {
            this.loadReports();
        }, 1500);
    }

    setupEventListeners() {
        // Event listeners para los botones de reportes
        const reportButtons = document.querySelectorAll('[data-report]');
        reportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const reportType = button.getAttribute('data-report');
                this.showReportModal(reportType);
            });
        });
    }

    async loadReports() {
        if (!db) {
            console.warn('ReportsManager: base de datos no disponible');
            return;
        }

        // Si ya hay una carga en curso, esperar a que termine
        if (this.isLoading) {
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (!this.isLoading) { clearInterval(interval); resolve(); }
                }, 100);
            });
            return;
        }

        this.isLoading = true;
        try {
            const [studentsSnap, coursesSnap, paymentsSnap, attendanceSnap, evaluationsSnap, gradesSnap, groupsSnap] = await Promise.all([
                get(ref(db, 'students')),
                get(ref(db, 'courses')),
                get(ref(db, 'payments')),
                get(ref(db, 'attendance')),
                get(ref(db, 'evaluations')),
                get(ref(db, 'grades')),
                get(ref(db, 'groups'))
            ]);

            this.data.students    = studentsSnap.exists()    ? studentsSnap.val()    : {};
            this.data.courses     = coursesSnap.exists()     ? coursesSnap.val()     : {};
            this.data.payments    = paymentsSnap.exists()    ? paymentsSnap.val()    : {};
            this.data.attendance  = attendanceSnap.exists()  ? attendanceSnap.val()  : {};
            this.data.evaluations = evaluationsSnap.exists() ? evaluationsSnap.val() : {};
            this.data.grades      = gradesSnap.exists()      ? gradesSnap.val()      : {};
            this.data.groups      = groupsSnap.exists()      ? groupsSnap.val()      : {};
        } catch (error) {
            console.error('Error al cargar datos para reportes:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async showReportModal(reportType) {
        // Mostrar modal de carga mientras se obtienen los datos
        if (window.app) {
            window.app.showModal(`
                <div class="modal-header">
                    <h3><i class="fas fa-spinner fa-spin"></i> Cargando datos…</h3>
                </div>
                <div style="padding:30px;text-align:center;color:#6c757d;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top:12px;">Obteniendo información, un momento…</p>
                </div>
            `);
        }

        await this.loadReports();

        let modalContent = '';

        switch (reportType) {
            case 'financial':
                modalContent = this.getFinancialReportModal();
                break;
            case 'students':
                modalContent = this.getStudentsReportModal();
                break;
            case 'attendance':
                modalContent = this.getAttendanceReportModal();
                break;
            case 'academic':
                modalContent = this.getAcademicReportModal();
                break;
            case 'grades-report':
                modalContent = this.getGradesReportModal();
                break;
            default:
                return;
        }

        if (window.app) {
            window.app.showModal(modalContent);
            // Conectar listeners que no pueden ir como <script> dentro del innerHTML
            this.setupModalListeners(reportType);
        }
    }

    setupModalListeners(reportType) {
        if (reportType === 'grades-report') {
            const scope      = document.getElementById('grReportScope');
            const groupRow   = document.getElementById('grGroupRow');
            const studentRow = document.getElementById('grStudentRow');
            if (!scope) return;

            const toggleRows = () => {
                if (groupRow)   groupRow.style.display   = scope.value === 'group'   ? '' : 'none';
                if (studentRow) studentRow.style.display = scope.value === 'student' ? '' : 'none';
            };

            scope.addEventListener('change', toggleRows);
            toggleRows(); // aplicar estado inicial
        }
    }

    getFinancialReportModal() {
        return `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-chart-line"></i> 
                    Reporte Financiero
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="financialReportForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="financialStartDate">Fecha Inicio</label>
                        <input 
                            type="date" 
                            id="financialStartDate" 
                            value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="financialEndDate">Fecha Fin</label>
                        <input 
                            type="date" 
                            id="financialEndDate" 
                            value="${new Date().toISOString().slice(0, 10)}"
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="financialCourse">Curso (Opcional)</label>
                    <select id="financialCourse">
                        <option value="">Todos los cursos</option>
                        ${Object.values(this.data.courses).map(course => `
                            <option value="${course.name}">${course.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="financialFormat">Formato de Exportación</label>
                    <select id="financialFormat" required>
                        <option value="excel">Excel (.xlsx)</option>
                        <option value="pdf">PDF</option>
                        <option value="preview">Vista Previa</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-download"></i> 
                        Generar Reporte
                    </button>
                </div>
            </form>
        `;
    }

    getStudentsReportModal() {
        return `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-users"></i> 
                    Reporte de Estudiantes
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="studentsReportForm" class="handled">
                <div class="form-group">
                    <label for="studentsReportCourse">Curso</label>
                    <select id="studentsReportCourse">
                        <option value="">Todos los cursos</option>
                        ${Object.values(this.data.courses).map(course => `
                            <option value="${course.name}">${course.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="studentsReportStatus">Estado</label>
                    <select id="studentsReportStatus">
                        <option value="">Todos los estados</option>
                        <option value="active">Activo</option>
                        <option value="inactive">Congelado</option>
                        <option value="graduated">Graduado</option>
                        <option value="dropped">Abandonó</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Información a Incluir</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                        <label><input type="checkbox" id="includePersonalInfo" checked> Información Personal</label>
                        <label><input type="checkbox" id="includeContactInfo" checked> Información de Contacto</label>
                        <label><input type="checkbox" id="includeAcademicInfo" checked> Información Académica</label>
                        <label><input type="checkbox" id="includePaymentStatus"> Estado de Pagos</label>
                        <label><input type="checkbox" id="includeAttendanceStats"> Estadísticas de Asistencia</label>
                        <label><input type="checkbox" id="includeNotes"> Observaciones</label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="studentsFormat">Formato de Exportación</label>
                    <select id="studentsFormat" required>
                        <option value="excel">Excel (.xlsx)</option>
                        <option value="pdf">PDF</option>
                        <option value="preview">Vista Previa</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-download"></i> 
                        Generar Reporte
                    </button>
                </div>
            </form>
        `;
    }

    getAttendanceReportModal() {
        return `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-calendar-alt"></i> 
                    Reporte de Asistencia
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="attendanceReportForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="attendanceStartDate">Fecha Inicio</label>
                        <input 
                            type="date" 
                            id="attendanceStartDate" 
                            value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="attendanceEndDate">Fecha Fin</label>
                        <input 
                            type="date" 
                            id="attendanceEndDate" 
                            value="${new Date().toISOString().slice(0, 10)}"
                            required
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="attendanceReportCourse">Curso</label>
                    <select id="attendanceReportCourse">
                        <option value="">Todos los cursos</option>
                        ${Object.values(this.data.courses).map(course => `
                            <option value="${course.name}">${course.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="attendanceReportType">Tipo de Reporte</label>
                    <select id="attendanceReportType" required>
                        <option value="summary">Resumen por Estudiante</option>
                        <option value="detailed">Detallado por Fecha</option>
                        <option value="statistics">Estadísticas Generales</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="attendanceFormat">Formato de Exportación</label>
                    <select id="attendanceFormat" required>
                        <option value="excel">Excel (.xlsx)</option>
                        <option value="pdf">PDF</option>
                        <option value="preview">Vista Previa</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-download"></i> 
                        Generar Reporte
                    </button>
                </div>
            </form>
        `;
    }

    getAcademicReportModal() {
        const sortedStudents = Object.entries(this.data.students)
            .map(([id, s]) => ({ id, ...s }))
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

        const studentOptions = sortedStudents.map(s =>
            `<option value="${s.id}">${s.firstName} ${s.lastName}${s.studentId ? ' — ' + s.studentId : ''}</option>`
        ).join('');

        return `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-graduation-cap"></i>
                    Historial Académico — PDF por Estudiante
                </h3>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>

            <form id="academicReportForm" class="handled">
                <div class="form-group">
                    <label for="academicStudent">Estudiante</label>
                    <select id="academicStudent" required>
                        <option value="">Seleccionar estudiante…</option>
                        ${studentOptions}
                    </select>
                    <small style="color:#6c757d;margin-top:4px;display:block;">
                        Se genera un PDF individual para el estudiante seleccionado.
                    </small>
                </div>

                <div class="form-group">
                    <label>Información a Incluir</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                        <label><input type="checkbox" id="includeStudentInfo"      checked> Información del Estudiante</label>
                        <label><input type="checkbox" id="includeCourseInfo"       checked> Información del Curso</label>
                        <label><input type="checkbox" id="includePaymentHistory"   checked> Historial de Pagos</label>
                        <label><input type="checkbox" id="includeAttendanceHistory" checked> Historial de Asistencia</label>
                        <label><input type="checkbox" id="includePerformanceStats" checked> Notas y Evaluaciones</label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-file-pdf"></i> Generar PDF
                    </button>
                </div>
            </form>
        `;
    }

    async generateFinancialReport(filters, format) {
        try {
            const { startDate, endDate, course } = filters;
            
            // Filtrar pagos según los criterios
            let filteredPayments = Object.values(this.data.payments).filter(payment => {
                const paymentDate = new Date(payment.paymentDate || payment.createdAt);
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                const isInDateRange = paymentDate >= start && paymentDate <= end;
                const matchesCourse = !course || payment.course === course;
                
                return isInDateRange && matchesCourse;
            });

            // Preparar datos del reporte
            const reportData = {
                title: 'Reporte Financiero',
                period: `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`,
                course: course || 'Todos los cursos',
                summary: this.getFinancialSummary(filteredPayments),
                details: filteredPayments.map(payment => ({
                    fecha: payment.paymentDate ? this.formatDate(payment.paymentDate) : 'Pendiente',
                    estudiante: payment.studentName,
                    curso: payment.course,
                    mes: this.formatMonth(payment.month),
                    monto: payment.amount,
                    estado: this.getPaymentStatusText(payment.status),
                    metodo: payment.paymentMethod || 'N/A'
                }))
            };

            return this.exportReport(reportData, format, 'reporte_financiero');

        } catch (error) {
            console.error('Error al generar reporte financiero:', error);
            throw error;
        }
    }

    async generateStudentsReport(filters, format) {
        try {
            const { course, status, includeOptions } = filters;
            
            // Filtrar estudiantes
            let filteredStudents = Object.entries(this.data.students).filter(([id, student]) => {
                const matchesCourse = !course || student.course === course;
                const matchesStatus = !status || student.status === status;
                return matchesCourse && matchesStatus;
            });

            // Preparar datos del reporte
            const reportData = {
                title: 'Reporte de Estudiantes',
                course: course || 'Todos los cursos',
                status: status || 'Todos los estados',
                students: await Promise.all(filteredStudents.map(async ([id, student]) => {
                    const studentData = {
                        id: student.studentId,
                        cedula: student.cedula || 'N/A',
                        nombre: `${student.firstName} ${student.lastName}`,
                        curso: student.course,
                        estado: this.getStudentStatusText(student.status)
                    };

                    if (includeOptions.personalInfo) {
                        studentData.fechaNacimiento = student.birthDate || 'N/A';
                        studentData.direccion = student.address || 'N/A';
                    }

                    if (includeOptions.contactInfo) {
                        studentData.email = student.email;
                        studentData.telefono = this.formatPhone(student.phone);
                    }

                    if (includeOptions.academicInfo) {
                        studentData.fechaMatricula = this.formatDate(student.enrollmentDate);
                    }

                    if (includeOptions.paymentStatus) {
                        studentData.estadoPagos = await this.getStudentPaymentStatus(id);
                    }

                    if (includeOptions.attendanceStats) {
                        studentData.asistencia = await this.getStudentAttendanceStats(id);
                    }

                    if (includeOptions.notes && student.notes) {
                        studentData.observaciones = student.notes;
                    }

                    return studentData;
                }))
            };

            return this.exportReport(reportData, format, 'reporte_estudiantes');

        } catch (error) {
            console.error('Error al generar reporte de estudiantes:', error);
            throw error;
        }
    }

    async generateAttendanceReport(filters, format) {
        try {
            const { startDate, endDate, course, reportType } = filters;
            
            // Filtrar asistencia
            let filteredAttendance = Object.values(this.data.attendance).filter(record => {
                const recordDate = new Date(record.date);
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                const isInDateRange = recordDate >= start && recordDate <= end;
                const matchesCourse = !course || record.course === course;
                
                return isInDateRange && matchesCourse;
            });

            let reportData = {
                title: 'Reporte de Asistencia',
                period: `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`,
                course: course || 'Todos los cursos',
                type: reportType
            };

            switch (reportType) {
                case 'summary':
                    reportData.data = this.getAttendanceSummary(filteredAttendance);
                    break;
                case 'detailed':
                    reportData.data = this.getAttendanceDetailed(filteredAttendance);
                    break;
                case 'statistics':
                    reportData.data = this.getAttendanceStatistics(filteredAttendance);
                    break;
            }

            return this.exportReport(reportData, format, 'reporte_asistencia');

        } catch (error) {
            console.error('Error al generar reporte de asistencia:', error);
            throw error;
        }
    }

    async generateAcademicReport(filters, format) {
        try {
            const { studentId, includeOptions } = filters;
            
            let reportData = {
                title: 'Historial Académico',
                students: []
            };

            if (studentId === 'all') {
                // Generar para todos los estudiantes
                const studentIds = Object.keys(this.data.students);
                for (const id of studentIds) {
                    const studentData = await this.getStudentAcademicData(id, includeOptions);
                    reportData.students.push(studentData);
                }
            } else {
                // Generar para un estudiante específico
                const studentData = await this.getStudentAcademicData(studentId, includeOptions);
                reportData.students = [studentData];
            }

            return this.exportReport(reportData, format, 'historial_academico');

        } catch (error) {
            console.error('Error al generar historial académico:', error);
            throw error;
        }
    }

    async exportReport(reportData, format, filename) {
        switch (format) {
            case 'excel':
                return this.exportToExcel(reportData, filename);
            case 'pdf':
                return this.exportToPDF(reportData, filename);
            case 'preview':
                return this.showReportPreview(reportData);
            default:
                throw new Error('Formato no soportado');
        }
    }

    exportToExcel(reportData, filename) {
        try {
            const wb = XLSX.utils.book_new();
            
            // Crear hoja principal con los datos
            let worksheetData = [];
            
            if (reportData.students) {
                // Reporte de estudiantes o académico
                worksheetData = reportData.students;
            } else if (reportData.details) {
                // Reporte financiero
                worksheetData = reportData.details;
            } else if (reportData.data) {
                // Reporte de asistencia
                worksheetData = reportData.data;
            }

            const ws = XLSX.utils.json_to_sheet(worksheetData);
            XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
            
            // Descargar archivo
            XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            
            if (window.app) {
                window.app.closeModal();
                window.app.showNotification('Reporte exportado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            if (window.app) {
                window.app.showNotification('Error al exportar el reporte', 'error');
            }
        }
    }

    exportToPDF(reportData, filename) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Configurar fuente
            doc.setFont('helvetica');
            
            // Título
            doc.setFontSize(18);
            doc.text(reportData.title, 20, 20);
            
            // Información del reporte
            doc.setFontSize(12);
            let yPosition = 40;
            
            if (reportData.period) {
                doc.text(`Período: ${reportData.period}`, 20, yPosition);
                yPosition += 10;
            }
            
            if (reportData.course) {
                doc.text(`Curso: ${reportData.course}`, 20, yPosition);
                yPosition += 10;
            }
            
            yPosition += 10;
            
            // Contenido del reporte (simplificado para PDF)
            doc.setFontSize(10);
            
            if (reportData.summary) {
                // Resumen financiero
                doc.text('RESUMEN FINANCIERO:', 20, yPosition);
                yPosition += 10;
                doc.text(`Total Ingresos: ${this.formatCurrency(reportData.summary.totalIncome)}`, 20, yPosition);
                yPosition += 8;
                doc.text(`Pagos Pendientes: ${reportData.summary.pendingPayments}`, 20, yPosition);
                yPosition += 8;
                doc.text(`Pagos Atrasados: ${reportData.summary.overduePayments}`, 20, yPosition);
            }
            
            // Descargar PDF
            doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
            
            if (window.app) {
                window.app.closeModal();
                window.app.showNotification('Reporte exportado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al exportar a PDF:', error);
            if (window.app) {
                window.app.showNotification('Error al exportar el reporte', 'error');
            }
        }
    }

    showReportPreview(reportData) {
        // Mostrar vista previa del reporte en modal
        let previewHTML = `
            <div class="modal-header">
                <h3>${reportData.title}</h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="report-preview">
                <div class="report-info">
                    ${reportData.period ? `<p><strong>Período:</strong> ${reportData.period}</p>` : ''}
                    ${reportData.course ? `<p><strong>Curso:</strong> ${reportData.course}</p>` : ''}
                </div>
                <div class="report-content">
                    <!-- Contenido específico según el tipo de reporte -->
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-primary" onclick="window.reportsManager.exportFromPreview('excel')">
                    <i class="fas fa-file-excel"></i> Exportar Excel
                </button>
                <button type="button" class="btn-primary" onclick="window.reportsManager.exportFromPreview('pdf')">
                    <i class="fas fa-file-pdf"></i> Exportar PDF
                </button>
            </div>
        `;

        if (window.app) {
            window.app.showModal(previewHTML);
        }
        
        // Almacenar datos para exportación posterior
        this.currentReportData = reportData;
    }

    // Métodos auxiliares
    getFinancialSummary(payments) {
        const summary = {
            totalIncome: 0,
            paidPayments: 0,
            pendingPayments: 0,
            overduePayments: 0,
            totalPayments: payments.length
        };

        payments.forEach(payment => {
            if (payment.status === 'paid') {
                summary.totalIncome += payment.amount;
                summary.paidPayments++;
            } else if (payment.status === 'pending') {
                summary.pendingPayments++;
            } else if (payment.status === 'overdue') {
                summary.overduePayments++;
            }
        });

        return summary;
    }

    async getStudentPaymentStatus(studentId) {
        const studentPayments = Object.values(this.data.payments)
            .filter(payment => payment.studentId === studentId);
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentPayment = studentPayments.find(p => p.month === currentMonth);
        
        return currentPayment ? this.getPaymentStatusText(currentPayment.status) : 'Sin pagos';
    }

    async getStudentAttendanceStats(studentId) {
        const studentAttendance = Object.values(this.data.attendance)
            .filter(record => record.studentId === studentId);
        
        const totalRecords = studentAttendance.length;
        const presentRecords = studentAttendance.filter(r => r.status === 'present').length;
        const percentage = totalRecords > 0 ? ((presentRecords / totalRecords) * 100).toFixed(1) : 0;
        
        return `${percentage}% (${presentRecords}/${totalRecords})`;
    }

    async getStudentAcademicData(studentId, includeOptions) {
        const student = this.data.students[studentId];
        if (!student) return null;

        const academicData = {
            nombre: `${student.firstName} ${student.lastName}`,
            id: student.studentId,
            cedula: student.cedula || 'N/A'
        };

        if (includeOptions.studentInfo) {
            academicData.email = student.email;
            academicData.telefono = this.formatPhone(student.phone);
            academicData.fechaMatricula = this.formatDate(student.enrollmentDate);
        }

        if (includeOptions.courseInfo) {
            academicData.curso = student.course;
            academicData.estado = this.getStudentStatusText(student.status);
        }

        // Más opciones según sea necesario...

        return academicData;
    }

    // Métodos de formateo
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    formatPhone(phone) {
        if (!phone) return 'N/A';
        // Formatear como 7265 4651
        return phone.replace(/(\d{4})(\d{4})/, '$1 $2');
    }

    formatMonth(month) {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'long'
        }).format(date);
    }

    getPaymentStatusText(status) {
        const statusMap = {
            'paid': 'Pagado',
            'pending': 'Pendiente',
            'overdue': 'Atrasado'
        };
        return statusMap[status] || status;
    }

    getStudentStatusText(status) {
        const statusMap = {
            'active': 'Activo',
            'inactive': 'Congelado',
            'graduated': 'Graduado',
            'dropped': 'Abandonó'
        };
        return statusMap[status] || status;
    }

    // ─── Reporte General de Notas ────────────────────────────────────────────

    getGradesReportModal() {
        const groupOptions = Object.entries(this.data.groups)
            .filter(([, g]) => g.status === 'active')
            .map(([id, g]) => `<option value="${id}">${g.groupCode || ''} - ${g.groupName || ''}</option>`)
            .join('');

        const studentOptions = Object.entries(this.data.students)
            .map(([id, s]) => `<option value="${id}">${s.firstName} ${s.lastName} — ${s.studentId || ''}</option>`)
            .join('');

        return `
            <div class="modal-header">
                <h3><i class="fas fa-file-alt"></i> Reporte General de Notas</h3>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <form id="gradesReportForm" class="handled">
                <div class="form-group">
                    <label for="grReportScope">¿Para quién generar?</label>
                    <select id="grReportScope" required>
                        <option value="all">Todos los estudiantes</option>
                        <option value="group">Por grupo</option>
                        <option value="student">Estudiante específico</option>
                    </select>
                </div>
                <div class="form-group" id="grGroupRow" style="display:none;">
                    <label for="grReportGroup">Grupo</label>
                    <select id="grReportGroup">
                        <option value="">Seleccionar grupo</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group" id="grStudentRow" style="display:none;">
                    <label for="grReportStudent">Estudiante</label>
                    <select id="grReportStudent">
                        <option value="">Seleccionar estudiante</option>
                        ${studentOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Incluir en el PDF</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                        <label><input type="checkbox" id="grIncludeInfo"       checked> Datos del estudiante</label>
                        <label><input type="checkbox" id="grIncludeEvals"      checked> Evaluaciones por rubro</label>
                        <label><input type="checkbox" id="grIncludeAttendance" checked> Asistencia</label>
                        <label><input type="checkbox" id="grIncludeAverage"    checked> Promedio final</label>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-file-pdf"></i> Generar PDF
                    </button>
                </div>
            </form>
        `;
    }

    async generateGradesReportPDF(filters) {
        const { scope, groupId, studentId, includeInfo, includeEvals, includeAttendance, includeAverage } = filters;

        if (!window.jspdf) {
            if (window.app) window.app.showNotification('Librería PDF no disponible', 'error');
            return;
        }

        let studentsToReport = [];

        if (scope === 'student' && studentId) {
            const s = this.data.students[studentId];
            if (s) studentsToReport = [{ id: studentId, ...s }];
        } else if (scope === 'group' && groupId) {
            const group = this.data.groups[groupId];
            if (!group) return;
            studentsToReport = Object.entries(this.data.students)
                .filter(([, s]) => s.group === groupId || s.group === group.groupName || s.group === group.groupCode)
                .map(([id, s]) => ({ id, ...s }));
        } else {
            studentsToReport = Object.entries(this.data.students).map(([id, s]) => ({ id, ...s }));
        }

        if (studentsToReport.length === 0) {
            if (window.app) window.app.showNotification('No se encontraron estudiantes para los criterios seleccionados', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MX = 12;
        const RIGHT = PAGE_W - MX;
        const MAX_Y = PAGE_H - 14;
        const COLORS = {
            primary: [30, 60, 114],   // #1e3c72
            secondary: [42, 82, 152], // #2a5298
            accent: [96, 165, 250],   // #60a5fa
            text: [31, 41, 55],
            muted: [107, 114, 128],
            light: [239, 246, 255],
            border: [203, 213, 225],
            white: [255, 255, 255]
        };
        const logoDataUrl = await this.loadPdfLogoDataUrl();
        const evalTypeLabel = {
            exam: 'Examen',
            quiz: 'Quiz',
            assignment: 'Tarea',
            project: 'Proyecto',
            participation: 'Participacion',
            attendance: 'Asistencia',
            lab: 'Laboratorio'
        };
        const safeDate = (v) => {
            try { return new Intl.DateTimeFormat('es-ES').format(new Date(v)); } catch { return v || '-'; }
        };
        const statusFromAverage = (avg) => avg >= 70 ? 'Aprobado' : avg >= 60 ? 'Condicional' : 'Reprobado';

        let currentStudentName = '';
        const drawHeader = () => {
            // Base header bands
            doc.setFillColor(...COLORS.primary);
            doc.rect(0, 0, PAGE_W, 30, 'F');
            doc.setFillColor(...COLORS.secondary);
            doc.rect(0, 30, PAGE_W, 5, 'F');
            doc.setFillColor(...COLORS.accent);
            doc.rect(0, 35, PAGE_W, 1.2, 'F');

            if (logoDataUrl) {
                try { doc.addImage(logoDataUrl, 'PNG', MX, 6, 16, 16); } catch {}
            }

            // Institution text
            doc.setTextColor(...COLORS.white);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text('Instituto SMP', MX + 22, 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('Sistema de Gestion Academica', MX + 22, 18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('Historial Academico de Notas', MX + 22, 25);

            // Right-side metadata (sin recuadro)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.6);
            doc.setTextColor(...COLORS.white);
            doc.text(`Web: www.institutosmp.com`, RIGHT, 11.5, { align: 'right' });
            doc.text(`Correo: institutosanmartin01@gmail.com`, RIGHT, 16.8, { align: 'right' });
            doc.text(`Telefono: +506 8369-9183`, RIGHT, 22.1, { align: 'right' });
            doc.text(`Fecha: ${safeDate(new Date().toISOString())}`, RIGHT, 27.4, { align: 'right' });
        };

        const sectionTitle = (text, y, filled = true) => {
            if (filled) {
                doc.setFillColor(...COLORS.light);
            } else {
                doc.setFillColor(...COLORS.white);
            }
            doc.setDrawColor(...COLORS.border);
            doc.roundedRect(MX, y - 5, RIGHT - MX, 8, 1.5, 1.5, 'FD');
            doc.setTextColor(...COLORS.primary);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(text, MX + 2, y);
            return y + 6;
        };

        const ensureSpace = (y, needed) => {
            if (y + needed <= MAX_Y) return y;
            doc.addPage();
            drawHeader();
            return 44;
        };

        const drawTableHeader = (y, columns) => {
            doc.setFillColor(...COLORS.secondary);
            doc.rect(MX, y - 4.5, RIGHT - MX, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...COLORS.white);
            columns.forEach(c => doc.text(c.label, c.x, y));
            return y + 5.5;
        };

        const drawTableRow = (y, columns, row, zebra) => {
            if (zebra) {
                doc.setFillColor(248, 250, 252);
                doc.rect(MX, y - 4, RIGHT - MX, 6, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.text);
            columns.forEach(c => {
                const value = row[c.key] ?? '-';
                const wrapped = doc.splitTextToSize(String(value), c.maxWidth || 30);
                doc.text(wrapped[0] || '-', c.x, y);
            });
            return y + 6;
        };

        for (let i = 0; i < studentsToReport.length; i++) {
            if (i > 0) doc.addPage();
            let y = 44;
            const student = studentsToReport[i];
            currentStudentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || '-';
            drawHeader();

            const studentIdValue = student.studentId || student.id || '-';
            const studentGrades = Object.values(this.data.grades).filter(g => g.studentId === studentIdValue);
            const evals = Object.entries(this.data.evaluations)
                .map(([id, ev]) => ({ id, ...ev }))
                .filter(ev => studentGrades.some(g => g.evaluationId === ev.id))
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            const gradeRows = evals.map(ev => {
                const grade = studentGrades.find(g => g.evaluationId === ev.id);
                return { ...ev, score: grade ? Number(grade.score) : null, comments: grade?.comments || '' };
            });
            const studentSubject = evals.find(ev => ev.course)?.course || student.course || '-';

            let totalWeight = 0;
            let weightedScore = 0;
            gradeRows.forEach(r => {
                if (typeof r.score !== 'number') return;
                const w = Number(r.weight || 0);
                totalWeight += w;
                weightedScore += (r.score * w / 100);
            });
            const average = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;

            const perType = {};
            gradeRows.forEach(r => {
                if (!perType[r.type]) perType[r.type] = [];
                perType[r.type].push(r);
            });

            const attendanceRecords = Object.values(this.data.attendance)
                .filter(r => r.studentId === studentIdValue)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            const attendanceCounts = { P: 0, A: 0, T: 0 };
            attendanceRecords.forEach(r => {
                if (attendanceCounts[r.status] !== undefined) attendanceCounts[r.status] += 1;
            });
            const attendanceTotal = attendanceRecords.length;
            const attendancePct = attendanceTotal > 0 ? (attendanceCounts.P / attendanceTotal) * 100 : 0;

            y = sectionTitle('Informacion del Estudiante', y, true);
            doc.setDrawColor(...COLORS.border);
            doc.rect(MX, y - 2, RIGHT - MX, 22);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.text);
            doc.text(`Nombre: ${currentStudentName}`, MX + 2, y + 3);
            doc.text(`ID: ${studentIdValue}`, MX + 2, y + 8);
            doc.text(`Cedula: ${student.cedula || '-'}`, MX + 2, y + 13);
            doc.text(`Curso/Grupo: ${student.course || student.group || '-'}`, MX + 96, y + 3);
            doc.text(`Correo: ${student.email || '-'}`, MX + 96, y + 8);
            doc.text(`Materia: ${studentSubject}`, MX + 96, y + 13);
            if (includeAverage) {
                doc.setFont('helvetica', 'bold');
                doc.text(`Promedio Final: ${average.toFixed(1)} (${statusFromAverage(average)})`, MX + 2, y + 18);
            }
            y += 26;

            if (includeAttendance) {
                y = ensureSpace(y, 20);
                y = sectionTitle('Asistencia', y);
                const attColumns = [
                    { key: 'metric', label: 'Metrica', x: MX + 2, maxWidth: 70 },
                    { key: 'value', label: 'Valor', x: MX + 80, maxWidth: 40 }
                ];
                y = drawTableHeader(y, attColumns);
                const attRows = [
                    { metric: 'Total registros', value: attendanceTotal },
                    { metric: 'Presentes (P)', value: attendanceCounts.P },
                    { metric: 'Ausentes (A)', value: attendanceCounts.A },
                    { metric: 'Tardias (T)', value: attendanceCounts.T },
                    { metric: 'Porcentaje asistencia', value: `${attendancePct.toFixed(1)}%` }
                ];
                attRows.forEach((r, idx) => { y = drawTableRow(y, attColumns, r, idx % 2 === 1); });
                y += 2;
            }

            if (includeEvals) {
                y = ensureSpace(y, 24);
                y = sectionTitle('Resumen por Tipo de Evaluacion', y);
                const sumCols = [
                    { key: 'type', label: 'Tipo', x: MX + 2, maxWidth: 40 },
                    { key: 'avg', label: 'Promedio', x: MX + 58, maxWidth: 22 },
                    { key: 'count', label: 'Eval. con nota', x: MX + 90, maxWidth: 35 },
                    { key: 'weight', label: 'Peso acumulado', x: MX + 130, maxWidth: 30 }
                ];
                y = drawTableHeader(y, sumCols);
                const summaryRows = Object.entries(perType).map(([type, rows]) => {
                    const graded = rows.filter(r => typeof r.score === 'number');
                    const tw = graded.reduce((s, r) => s + Number(r.weight || 0), 0);
                    const ts = graded.reduce((s, r) => s + (r.score * Number(r.weight || 0) / 100), 0);
                    const tavg = tw > 0 ? (ts / tw) * 100 : 0;
                    return {
                        type: evalTypeLabel[type] || type,
                        avg: tavg.toFixed(1),
                        count: `${graded.length}/${rows.length}`,
                        weight: `${tw.toFixed(1)}%`
                    };
                });
                summaryRows.forEach((r, idx) => { y = drawTableRow(y, sumCols, r, idx % 2 === 1); });
                y += 2;

                y = ensureSpace(y, 20);
                y = sectionTitle('Detalle de Evaluaciones', y);
                const detailCols = [
                    { key: 'date', label: 'Fecha', x: MX + 2, maxWidth: 20 },
                    { key: 'type', label: 'Tipo', x: MX + 24, maxWidth: 22 },
                    { key: 'title', label: 'Evaluacion', x: MX + 48, maxWidth: 56 },
                    { key: 'weight', label: 'Peso', x: MX + 106, maxWidth: 14 },
                    { key: 'score', label: 'Nota', x: MX + 122, maxWidth: 14 },
                    { key: 'comments', label: 'Observacion', x: MX + 140, maxWidth: 56 }
                ];
                y = drawTableHeader(y, detailCols);
                gradeRows.forEach((r, idx) => {
                    y = ensureSpace(y, 7);
                    const row = {
                        date: safeDate(r.date),
                        type: evalTypeLabel[r.type] || r.type,
                        title: r.title || '-',
                        weight: `${r.weight || 0}%`,
                        score: typeof r.score === 'number' ? r.score.toFixed(1) : 'Sin nota',
                        comments: r.comments || '-'
                    };
                    y = drawTableRow(y, detailCols, row, idx % 2 === 1);
                });
            }

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(...COLORS.muted);
            doc.text('Documento generado automaticamente por Instituto SMP', RIGHT, PAGE_H - 6, { align: 'right' });
        }

        const today = new Date().toISOString().split('T')[0];
        doc.save(`reporte_notas_${today}.pdf`);

        if (window.app) {
            window.app.closeModal();
            window.app.showNotification(`PDF generado con ${studentsToReport.length} estudiante(s)`, 'success');
        }
    }

    async loadPdfLogoDataUrl() {
        if (this._pdfLogoDataUrl) return this._pdfLogoDataUrl;

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('No se pudo obtener contexto de canvas'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => reject(new Error('No se pudo cargar empresa.ico'));
                img.src = 'empresa.ico';
            });

            this._pdfLogoDataUrl = dataUrl;
            return dataUrl;
        } catch (error) {
            console.warn('No se pudo preparar el logo para PDF:', error);
            return null;
        }
    }
}

// Configurar event listeners cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-report]')) {
        window.reportsManager = new ReportsManager();
        
        // Configurar formularios de reportes
        document.addEventListener('submit', async (e) => {
            if (e.target.id === 'financialReportForm') {
                e.preventDefault();
                const filters = {
                    startDate: document.getElementById('financialStartDate').value,
                    endDate:   document.getElementById('financialEndDate').value,
                    course:    document.getElementById('financialCourse').value
                };
                const format = document.getElementById('financialFormat').value;
                try {
                    await window.reportsManager.generateFinancialReport(filters, format);
                } catch (error) {
                    if (window.app) window.app.showNotification('Error al generar el reporte', 'error');
                }
            }

            if (e.target.id === 'gradesReportForm') {
                e.preventDefault();
                const scope     = document.getElementById('grReportScope').value;
                const groupId   = document.getElementById('grReportGroup')?.value   || '';
                const studentId = document.getElementById('grReportStudent')?.value || '';

                if (scope === 'group' && !groupId) {
                    if (window.app) window.app.showNotification('Seleccione un grupo', 'error');
                    return;
                }
                if (scope === 'student' && !studentId) {
                    if (window.app) window.app.showNotification('Seleccione un estudiante', 'error');
                    return;
                }

                const filters = {
                    scope,
                    groupId,
                    studentId,
                    includeInfo:       document.getElementById('grIncludeInfo')?.checked       ?? true,
                    includeEvals:      document.getElementById('grIncludeEvals')?.checked      ?? true,
                    includeAttendance: document.getElementById('grIncludeAttendance')?.checked ?? true,
                    includeAverage:    document.getElementById('grIncludeAverage')?.checked    ?? true,
                };

                try {
                    await window.reportsManager.loadReports();
                    await window.reportsManager.generateGradesReportPDF(filters);
                } catch (error) {
                    console.error(error);
                    if (window.app) window.app.showNotification('Error al generar el PDF de notas', 'error');
                }
            }

            if (e.target.id === 'academicReportForm') {
                e.preventDefault();
                const studentId = document.getElementById('academicStudent')?.value;

                if (!studentId) {
                    if (window.app) window.app.showNotification('Seleccione un estudiante', 'error');
                    return;
                }

                const filters = {
                    scope:             'student',
                    groupId:           '',
                    studentId,
                    includeInfo:       document.getElementById('includeStudentInfo')?.checked       ?? true,
                    includeEvals:      document.getElementById('includePerformanceStats')?.checked  ?? true,
                    includeAttendance: document.getElementById('includeAttendanceHistory')?.checked ?? true,
                    includeAverage:    true,
                };

                try {
                    await window.reportsManager.loadReports();
                    await window.reportsManager.generateGradesReportPDF(filters);
                } catch (error) {
                    console.error(error);
                    if (window.app) window.app.showNotification('Error al generar el PDF', 'error');
                }
            }
        });
    }
});

export default ReportsManager;
