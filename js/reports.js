import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class ReportsManager {
    constructor() {
        this.data = {
            students: {},
            courses: {},
            payments: {},
            attendance: {}
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
        console.log('ReportsManager.loadReports() llamado desde:', new Error().stack);
        
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para reportes');
                return;
            }

            // Verificar que el usuario esté autenticado
            if (!window.auth || !window.auth.currentUser) {
                console.warn('ReportsManager: Usuario no autenticado, no se pueden cargar reportes');
                return;
            }

            // Verificar que la aplicación esté inicializada
            if (!window.app || !window.app.initialized) {
                console.warn('ReportsManager: Aplicación no inicializada, esperando...');
                setTimeout(() => this.loadReports(), 2000);
                return;
            }

            // Verificación adicional: asegurar que no se ejecute múltiples veces
            if (this.isLoading) {
                console.log('ReportsManager: Ya se está cargando, saltando...');
                return;
            }

            this.isLoading = true;
            console.log('ReportsManager: Iniciando carga de datos...');

            // Cargar todos los datos necesarios para los reportes
            const [studentsSnapshot, coursesSnapshot, paymentsSnapshot, attendanceSnapshot] = await Promise.all([
                get(ref(db, 'students')),
                get(ref(db, 'courses')),
                get(ref(db, 'payments')),
                get(ref(db, 'attendance'))
            ]);

            this.data.students = studentsSnapshot.exists() ? studentsSnapshot.val() : {};
            this.data.courses = coursesSnapshot.exists() ? coursesSnapshot.val() : {};
            this.data.payments = paymentsSnapshot.exists() ? paymentsSnapshot.val() : {};
            this.data.attendance = attendanceSnapshot.exists() ? attendanceSnapshot.val() : {};

            console.log('Datos de reportes cargados correctamente');

        } catch (error) {
            console.error('Error al cargar datos para reportes:', error);
            // Solo mostrar notificación si es un error crítico y la app está inicializada
            if (window.app && window.app.initialized && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar datos para reportes', 'error');
            }
        } finally {
            this.isLoading = false;
        }
    }

    showReportModal(reportType) {
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
            default:
                return;
        }

        if (window.app) {
            window.app.showModal(modalContent);
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
        return `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-graduation-cap"></i> 
                    Historial Académico
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="academicReportForm" class="handled">
                <div class="form-group">
                    <label for="academicStudent">Estudiante</label>
                    <select id="academicStudent" required>
                        <option value="">Seleccionar estudiante</option>
                        <option value="all">Todos los estudiantes</option>
                        ${Object.entries(this.data.students).map(([id, student]) => `
                            <option value="${id}">${student.firstName} ${student.lastName} - ${student.studentId}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Información a Incluir</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                        <label><input type="checkbox" id="includeStudentInfo" checked> Información del Estudiante</label>
                        <label><input type="checkbox" id="includeCourseInfo" checked> Información del Curso</label>
                        <label><input type="checkbox" id="includePaymentHistory" checked> Historial de Pagos</label>
                        <label><input type="checkbox" id="includeAttendanceHistory" checked> Historial de Asistencia</label>
                        <label><input type="checkbox" id="includePerformanceStats" checked> Estadísticas de Rendimiento</label>
                        <label><input type="checkbox" id="includeProgressNotes"> Notas de Progreso</label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="academicFormat">Formato de Exportación</label>
                    <select id="academicFormat" required>
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel (.xlsx)</option>
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
                    endDate: document.getElementById('financialEndDate').value,
                    course: document.getElementById('financialCourse').value
                };
                const format = document.getElementById('financialFormat').value;
                
                try {
                    await window.reportsManager.generateFinancialReport(filters, format);
                } catch (error) {
                    if (window.app) {
                        window.app.showNotification('Error al generar el reporte', 'error');
                    }
                }
            }
            
            // Configurar otros formularios de reportes de manera similar...
        });
    }
});

export default ReportsManager;
