import { 
    ref, 
    push, 
    set, 
    get, 
    remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class PaymentsManager {
    constructor() {
        this.payments = {};
        this.students = {};
        this.courses = {};
        this.filteredPayments = {};
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadPayments();
            await this.loadFilters();
        } catch (error) {
            console.warn('Error al inicializar PaymentsManager:', error);
        }
    }

    setupEventListeners() {
        // Botón para agregar nuevo pago
        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => {
                this.showPaymentModal();
            });
        }

        // Filtros
        const paymentCourseFilter = document.getElementById('paymentCourseFilter');
        if (paymentCourseFilter) {
            paymentCourseFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const paymentStatusFilter = document.getElementById('paymentStatusFilter');
        if (paymentStatusFilter) {
            paymentStatusFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const paymentMonthFilter = document.getElementById('paymentMonthFilter');
        if (paymentMonthFilter) {
            paymentMonthFilter.addEventListener('change', () => {
                this.applyFilters();
            });
            // Establecer mes actual por defecto
            const currentMonth = new Date().toISOString().slice(0, 7);
            paymentMonthFilter.value = currentMonth;
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        // Suscribirse a actualizaciones en tiempo real de pagos
        this.unsubscribePayments = realtimeManager.subscribe('payments', (payments) => {
            this.payments = payments;
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de estudiantes
        this.unsubscribeStudents = realtimeManager.subscribe('students', (students) => {
            this.students = students;
            this.updateStudentOptions();
        });
        
        // Suscribirse a actualizaciones en tiempo real de cursos
        this.unsubscribeCourses = realtimeManager.subscribe('courses', (courses) => {
            this.courses = courses;
            this.updateCourseOptions();
        });
    }

    async loadPayments() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para pagos');
                return;
            }

            const paymentsRef = ref(db, 'payments');
            const snapshot = await get(paymentsRef);
            
            if (snapshot.exists()) {
                this.payments = snapshot.val();
            } else {
                this.payments = {};
            }
            
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar pagos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar pagos', 'error');
            }
        }
    }

    async loadFilters() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para filtros');
                return;
            }

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
            console.error('Error al cargar filtros:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                console.warn('Error al cargar filtros de pagos:', error);
            }
        }
    }

    updateCourseFilter() {
        const paymentCourseFilter = document.getElementById('paymentCourseFilter');
        
        if (paymentCourseFilter) {
            const activeCourses = Object.values(this.courses)
                .filter(course => course.status === 'active');
            
            paymentCourseFilter.innerHTML = '<option value="">Todos los cursos</option>' +
                activeCourses.map(course => 
                    `<option value="${course.name}">${course.name}</option>`
                ).join('');
        }
    }

    applyFilters() {
        const courseFilter = document.getElementById('paymentCourseFilter')?.value || '';
        const statusFilter = document.getElementById('paymentStatusFilter')?.value || '';
        const monthFilter = document.getElementById('paymentMonthFilter')?.value || '';

        this.filteredPayments = Object.fromEntries(
            Object.entries(this.payments).filter(([id, payment]) => {
                const matchesCourse = !courseFilter || payment.course === courseFilter;
                const matchesStatus = !statusFilter || payment.status === statusFilter;
                const matchesMonth = !monthFilter || payment.month === monthFilter;
                
                return matchesCourse && matchesStatus && matchesMonth;
            })
        );

        this.renderPaymentsTable();
    }

    renderPaymentsTable() {
        const tbody = document.querySelector('#paymentsTable tbody');
        if (!tbody) return;

        const paymentsToShow = Object.keys(this.filteredPayments).length > 0 ? 
            this.filteredPayments : this.payments;

        if (Object.keys(paymentsToShow).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-credit-card fa-3x mb-3"></i>
                            <h4>No hay pagos registrados</h4>
                            <p>Comience registrando un nuevo pago</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(paymentsToShow)
            .sort(([,a], [,b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .map(([id, payment]) => `
                <tr>
                    <td>${payment.studentName}</td>
                    <td>${payment.course}</td>
                    <td>${this.formatMonth(payment.month)}</td>
                    <td>${this.formatCurrency(payment.amount)}</td>
                    <td>
                        <span class="status-badge ${payment.status}">
                            ${this.getStatusText(payment.status)}
                        </span>
                    </td>
                    <td>${payment.paymentDate ? this.formatDate(payment.paymentDate) : '-'}</td>
                    <td>${this.getPaymentMethodText(payment.paymentMethod)}</td>
                    <td>
                        <button class="btn-warning" onclick="window.paymentsManager.editPayment('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger" onclick="window.paymentsManager.deletePayment('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        ${payment.status !== 'paid' ? `
                            <button class="btn-success" onclick="window.paymentsManager.markAsPaid('${id}')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');
    }

    showPaymentModal(paymentId = null) {
        const payment = paymentId ? this.payments[paymentId] : null;
        const isEdit = payment !== null;

        const activeStudents = Object.entries(this.students)
            .filter(([id, student]) => student.status === 'active')
            .map(([id, student]) => ({
                id,
                name: `${student.firstName} ${student.lastName}`,
                course: student.course
            }));

        const activeCourses = Object.values(this.courses)
            .filter(course => course.status === 'active');

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-credit-card"></i> 
                    ${isEdit ? 'Editar' : 'Registrar'} Pago
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="paymentForm" class="handled">
                <div class="form-group">
                    <label for="paymentStudent">Estudiante *</label>
                    <select id="paymentStudent" required ${isEdit ? 'disabled' : ''}>
                        <option value="">Seleccionar estudiante</option>
                        ${activeStudents.map(student => `
                            <option value="${student.id}" data-course="${student.course}" 
                                ${payment?.studentId === student.id ? 'selected' : ''}>
                                ${student.name} - ${student.course}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="paymentCourse">Curso *</label>
                        <input 
                            type="text" 
                            id="paymentCourse" 
                            value="${payment?.course || ''}" 
                            readonly
                            placeholder="Se seleccionará automáticamente"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentMonth">Mes *</label>
                        <input 
                            type="month" 
                            id="paymentMonth" 
                            value="${payment?.month || new Date().toISOString().slice(0, 7)}" 
                            required
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="paymentAmount">Monto *</label>
                        <input 
                            type="number" 
                            id="paymentAmount" 
                            value="${payment?.amount || ''}" 
                            required
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentStatus">Estado *</label>
                        <select id="paymentStatus" required>
                            <option value="pending" ${payment?.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="paid" ${payment?.status === 'paid' ? 'selected' : ''}>Pagado</option>
                            <option value="overdue" ${payment?.status === 'overdue' ? 'selected' : ''}>Atrasado</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="paymentDate">Fecha de Pago</label>
                    <input 
                        type="date" 
                        id="paymentDate" 
                        value="${payment?.paymentDate || ''}"
                    >
                    <small>Solo requerido si el estado es "Pagado"</small>
                </div>
                
                <div class="form-group">
                    <label for="paymentMethod">Método de Pago</label>
                    <select id="paymentMethod">
                        <option value="">Seleccionar método</option>
                        <option value="cash" ${payment?.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo</option>
                        <option value="transfer" ${payment?.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option>
                        <option value="card" ${payment?.paymentMethod === 'card' ? 'selected' : ''}>Tarjeta</option>
                        <option value="sinpe_movil" ${payment?.paymentMethod === 'sinpe_movil' ? 'selected' : ''}>Sinpe Móvil</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="paymentNotes">Observaciones</label>
                    <textarea 
                        id="paymentNotes" 
                        placeholder="Notas adicionales sobre el pago..."
                    >${payment?.notes || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Registrar'} Pago
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar eventos del formulario
        this.setupPaymentFormEvents(paymentId);
    }

    setupPaymentFormEvents(paymentId) {
        const studentSelect = document.getElementById('paymentStudent');
        const courseInput = document.getElementById('paymentCourse');
        const amountInput = document.getElementById('paymentAmount');
        const statusSelect = document.getElementById('paymentStatus');
        const paymentDateInput = document.getElementById('paymentDate');
        const form = document.getElementById('paymentForm');

        // Actualizar curso y precio cuando se selecciona estudiante
        if (studentSelect) {
            studentSelect.addEventListener('change', () => {
                const selectedOption = studentSelect.options[studentSelect.selectedIndex];
                if (selectedOption.value) {
                    const courseName = selectedOption.dataset.course;
                    courseInput.value = courseName;
                    
                    // Buscar precio del curso
                    const course = Object.values(this.courses).find(c => c.name === courseName);
                    if (course && amountInput.value === '') {
                        amountInput.value = course.price;
                    }
                } else {
                    courseInput.value = '';
                }
            });
        }

        // Manejar cambio de estado
        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                if (statusSelect.value === 'paid' && !paymentDateInput.value) {
                    paymentDateInput.value = new Date().toISOString().slice(0, 10);
                }
            });
        }

        // Configurar envío del formulario
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePayment(paymentId);
            });
        }
    }

    async savePayment(paymentId = null) {
        const form = document.getElementById('paymentForm');
        if (!form) return;

        const studentSelect = document.getElementById('paymentStudent');
        const selectedStudent = studentSelect.options[studentSelect.selectedIndex];
        
        const paymentData = {
            studentId: studentSelect.value,
            studentName: selectedStudent.text.split(' - ')[0],
            course: document.getElementById('paymentCourse').value,
            month: document.getElementById('paymentMonth').value,
            amount: parseFloat(document.getElementById('paymentAmount').value) || 0,
            status: document.getElementById('paymentStatus').value,
            paymentDate: document.getElementById('paymentDate').value || null,
            paymentMethod: document.getElementById('paymentMethod').value || null,
            notes: document.getElementById('paymentNotes').value.trim(),
            updatedAt: new Date().toISOString()
        };

        // Validaciones
        if (!paymentData.studentId || !paymentData.course || !paymentData.month || 
            !paymentData.amount || !paymentData.status) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Validar que si está pagado, tenga fecha de pago
        if (paymentData.status === 'paid' && !paymentData.paymentDate) {
            if (window.app) {
                window.app.showNotification('Debe especificar la fecha de pago si el estado es "Pagado"', 'error');
            }
            return;
        }

        // Verificar pagos duplicados
        if (!paymentId) {
            const isDuplicate = Object.values(this.payments).some(payment => 
                payment.studentId === paymentData.studentId && 
                payment.month === paymentData.month &&
                payment.course === paymentData.course
            );

            if (isDuplicate) {
                if (window.app) {
                    window.app.showNotification('Ya existe un pago para este estudiante en este mes', 'error');
                }
                return;
            }
        }

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (paymentId) {
                // Actualizar pago existente
                const paymentRef = ref(db, `payments/${paymentId}`);
                await set(paymentRef, paymentData);
            } else {
                // Crear nuevo pago
                paymentData.createdAt = new Date().toISOString();
                const paymentsRef = ref(db, 'payments');
                await push(paymentsRef, paymentData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Pago ${paymentId ? 'actualizado' : 'registrado'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar pago:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar el pago', 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${paymentId ? 'Actualizar' : 'Registrar'} Pago`;
            }
        }
    }

    editPayment(paymentId) {
        this.showPaymentModal(paymentId);
    }

    async markAsPaid(paymentId) {
        const payment = this.payments[paymentId];
        if (!payment) return;

        try {
            const paymentRef = ref(db, `payments/${paymentId}`);
            await set(paymentRef, {
                ...payment,
                status: 'paid',
                paymentDate: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString()
            });

            if (window.app) {
                window.app.showNotification('Pago marcado como pagado', 'success');
            }

        } catch (error) {
            console.error('Error al marcar pago como pagado:', error);
            if (window.app) {
                window.app.showNotification('Error al actualizar el pago', 'error');
            }
        }
    }

    async deletePayment(paymentId) {
        const payment = this.payments[paymentId];
        if (!payment) return;

        const confirmed = confirm(
            `¿Está seguro de que desea eliminar el pago de ${payment.studentName} para ${this.formatMonth(payment.month)}?\n\n` +
            'Esta acción no se puede deshacer.'
        );

        if (!confirmed) return;

        try {
            const paymentRef = ref(db, `payments/${paymentId}`);
            await remove(paymentRef);

            if (window.app) {
                window.app.showNotification('Pago eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar pago:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el pago', 'error');
            }
        }
    }

    getStatusText(status) {
        const statusMap = {
            'paid': 'Pagado',
            'pending': 'Pendiente',
            'overdue': 'Atrasado'
        };
        return statusMap[status] || status;
    }

    getPaymentMethodText(method) {
        const methodMap = {
            'cash': 'Efectivo',
            'transfer': 'Transferencia',
            'card': 'Tarjeta',
            'sinpe_movil': 'Sinpe Móvil'
        };
        return methodMap[method] || method || 'No especificado';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    formatMonth(month) {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'long'
        }).format(date);
    }

    // Generar pagos automáticamente para un mes
    async generateMonthlyPayments(month) {
        try {
            const activeStudents = Object.entries(this.students)
                .filter(([id, student]) => student.status === 'active');

            const paymentsToCreate = [];

            for (const [studentId, student] of activeStudents) {
                // Verificar si ya existe pago para este mes
                const existingPayment = Object.values(this.payments).find(payment => 
                    payment.studentId === studentId && 
                    payment.month === month &&
                    payment.course === student.course
                );

                if (!existingPayment) {
                    // Buscar precio del curso
                    const course = Object.values(this.courses).find(c => c.name === student.course);
                    const amount = course ? course.price : 0;

                    paymentsToCreate.push({
                        studentId,
                        studentName: `${student.firstName} ${student.lastName}`,
                        course: student.course,
                        month,
                        amount,
                        status: 'pending',
                        paymentDate: null,
                        paymentMethod: null,
                        notes: 'Generado automáticamente',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // Crear pagos en batch
            const paymentsRef = ref(db, 'payments');
            for (const paymentData of paymentsToCreate) {
                await push(paymentsRef, paymentData);
            }

            if (window.app) {
                window.app.showNotification(
                    `Se generaron ${paymentsToCreate.length} pagos para ${this.formatMonth(month)}`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al generar pagos mensuales:', error);
            if (window.app) {
                window.app.showNotification('Error al generar los pagos', 'error');
            }
        }
    }

    // Método para actualizar opciones de estudiantes (usado por el sistema de tiempo real)
    updateStudentOptions() {
        // Actualizar filtros y opciones que dependan de estudiantes
        this.loadFilters();
    }

    // Método para actualizar opciones de cursos (usado por el sistema de tiempo real)
    updateCourseOptions() {
        // Actualizar filtros y opciones que dependan de cursos
        this.loadFilters();
    }

    // Limpiar suscripciones al destruir el módulo
    destroy() {
        if (this.unsubscribePayments) {
            this.unsubscribePayments();
        }
        if (this.unsubscribeStudents) {
            this.unsubscribeStudents();
        }
        if (this.unsubscribeCourses) {
            this.unsubscribeCourses();
        }
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('paymentsTable')) {
        window.paymentsManager = new PaymentsManager();
        // No inicializar automáticamente, esperar a que la app esté lista
    }
});

export default PaymentsManager;
