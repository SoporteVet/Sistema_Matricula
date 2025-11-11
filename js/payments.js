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
        this.giras = {};
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.filteredPayments = {};
        this.filteredGiras = {};
        this.currentTab = 'payments-tab';
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadPayments();
            await this.loadGiras();
            await this.loadFilters();
            this.setupTabNavigation();
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

        // Botón para agregar nueva gira
        const addGiraBtn = document.getElementById('addGiraBtn');
        if (addGiraBtn) {
            addGiraBtn.addEventListener('click', () => {
                this.showGiraModal();
            });
        }

        // Filtros
        const paymentGroupFilter = document.getElementById('paymentGroupFilter');
        if (paymentGroupFilter) {
            paymentGroupFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

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

        // Filtros para giras
        const giraGroupFilter = document.getElementById('giraGroupFilter');
        if (giraGroupFilter) {
            giraGroupFilter.addEventListener('change', () => {
                this.applyGiraFilters();
            });
        }

        const giraStatusFilter = document.getElementById('giraStatusFilter');
        if (giraStatusFilter) {
            giraStatusFilter.addEventListener('change', () => {
                this.applyGiraFilters();
            });
        }

        const giraDateFilter = document.getElementById('giraDateFilter');
        if (giraDateFilter) {
            giraDateFilter.addEventListener('change', () => {
                this.applyGiraFilters();
            });
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
                this.updatePaymentGroupFilter();
            }

            // Cargar cursos
            const coursesRef = ref(db, 'courses');
            const coursesSnapshot = await get(coursesRef);
            if (coursesSnapshot.exists()) {
                this.courses = coursesSnapshot.val();
                this.updateCourseFilter();
            }

            // Cargar grupos
            const groupsRef = ref(db, 'groups');
            const groupsSnapshot = await get(groupsRef);
            if (groupsSnapshot.exists()) {
                this.groups = groupsSnapshot.val();
                this.updatePaymentGroupFilter();
                this.updateGiraGroupFilter();
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

    updatePaymentGroupFilter() {
        const paymentGroupFilter = document.getElementById('paymentGroupFilter');
        
        if (!paymentGroupFilter) return;

        const groupValues = new Set();

        Object.values(this.students || {}).forEach(student => {
            if (student.status === 'active' && student.group) {
                groupValues.add(student.group);
            }
        });

        const resolveGroupLabel = (groupValue) => {
            if (!groupValue) return 'Sin grupo';

            const groupEntry = Object.entries(this.groups || {}).find(([id, group]) => 
                id === groupValue ||
                group.groupCode === groupValue ||
                group.groupName === groupValue
            );

            if (groupEntry) {
                const [, group] = groupEntry;
                const name = group.groupName || group.groupCode || groupValue;
                const code = group.groupCode && group.groupCode !== name ? group.groupCode : null;
                return code ? `${name} (${code})` : name;
            }

            return groupValue;
        };

        paymentGroupFilter.innerHTML = '<option value="">Todos los grupos</option>' +
            Array.from(groupValues).sort().map(groupValue => `
                <option value="${groupValue}">${resolveGroupLabel(groupValue)}</option>
            `).join('');
    }

    getGroupLabel(groupValue) {
        if (!groupValue) {
            return '-';
        }

        const groupEntry = Object.entries(this.groups || {}).find(([id, group]) =>
            id === groupValue ||
            group.groupCode === groupValue ||
            group.groupName === groupValue
        );

        if (groupEntry) {
            const [, group] = groupEntry;
            const name = group.groupName || group.groupCode || groupValue;
            const code = group.groupCode && group.groupCode !== name ? group.groupCode : null;
            return code ? `${name} (${code})` : name;
        }

        return groupValue;
    }

    applyFilters() {
        const groupFilter = document.getElementById('paymentGroupFilter')?.value || '';
        const courseFilter = document.getElementById('paymentCourseFilter')?.value || '';
        const statusFilter = document.getElementById('paymentStatusFilter')?.value || '';
        const monthFilter = document.getElementById('paymentMonthFilter')?.value || '';

        this.filteredPayments = Object.fromEntries(
            Object.entries(this.payments).filter(([id, payment]) => {
                const matchesGroup = !groupFilter || payment.group === groupFilter;
                const matchesCourse = !courseFilter || payment.course === courseFilter;
                const matchesStatus = !statusFilter || payment.status === statusFilter;
                const matchesMonth = !monthFilter || payment.month === monthFilter;
                
                return matchesGroup && matchesCourse && matchesStatus && matchesMonth;
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
                    <td>
                        ${payment.studentName}
                        ${payment.studentCedula ? `<br><small>Cédula: ${payment.studentCedula}</small>` : ''}
                        ${payment.course ? `<br><small>Curso: ${payment.course}</small>` : ''}
                    </td>
                    <td>${this.getGroupLabel(payment.group)}</td>
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
                course: student.course,
                cedula: student.cedula || '',
                group: student.group || ''
            }));

        const activeCourses = Object.values(this.courses)
            .filter(course => course.status === 'active');

        const paymentCedulaValue = payment && payment.studentId && this.students[payment.studentId]
            ? (this.students[payment.studentId].cedula || '')
            : (payment?.studentCedula || '');

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
                    <label for="paymentStudentCedula">Buscar por cédula</label>
                    <input 
                        type="text" 
                        id="paymentStudentCedula" 
                        list="paymentCedulaList"
                        value="${paymentCedulaValue}"
                        placeholder="Ingrese la cédula del estudiante"
                        autocomplete="off"
                    >
                    <datalist id="paymentCedulaList">
                        ${activeStudents
                            .filter(student => student.cedula)
                            .map(student => `
                                <option value="${student.cedula}" label="${student.name} - Grupo: ${student.group || 'N/A'} - ${student.course}"></option>
                            `).join('')}
                    </datalist>
                </div>

                <div class="form-group">
                    <label for="paymentStudent">Estudiante *</label>
                    <select id="paymentStudent" required ${isEdit ? 'disabled' : ''}>
                        <option value="">Seleccionar estudiante</option>
                        ${activeStudents.map(student => `
                            <option 
                                value="${student.id}" 
                                data-course="${student.course}" 
                                data-cedula="${student.cedula}" 
                                data-group="${student.group}" 
                                ${payment?.studentId === student.id ? 'selected' : ''}>
                                ${student.name} - Cédula: ${student.cedula || 'N/A'} - Grupo: ${student.group || 'N/A'} - ${student.course}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="paymentCourse">Materia *</label>
                        <input 
                            type="text" 
                            id="paymentCourse" 
                            value="${payment?.course || ''}" 
                            list="paymentCourseList"
                            placeholder="Seleccione o ingrese la materia"
                        >
                        <datalist id="paymentCourseList">
                            ${activeCourses.map(course => `
                                <option value="${course.name}"></option>
                            `).join('')}
                        </datalist>
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
        const cedulaInput = document.getElementById('paymentStudentCedula');
        const statusSelect = document.getElementById('paymentStatus');
        const paymentDateInput = document.getElementById('paymentDate');
        const form = document.getElementById('paymentForm');

        if (amountInput && amountInput.value) {
            amountInput.dataset.autoFilled = 'false';
        }

        if (amountInput) {
            amountInput.addEventListener('input', () => {
                amountInput.dataset.autoFilled = 'false';
            });
        }

        if (courseInput) {
            courseInput.addEventListener('input', () => {
                const courseName = courseInput.value.trim();
                const course = Object.values(this.courses).find(c => c.name === courseName);

                if (course) {
                    courseInput.value = course.name;

                    if (amountInput && (!amountInput.value || amountInput.dataset.autoFilled !== 'false')) {
                        amountInput.value = course.price;
                        amountInput.dataset.autoFilled = 'true';
                    }
                }
            });
        }

        const syncCedulaWithStudent = (studentId) => {
            if (!cedulaInput) return;
            if (!studentId) {
                cedulaInput.value = '';
                return;
            }
            let cedulaValue = '';
            if (studentSelect) {
                const option = studentSelect.querySelector(`option[value="${studentId}"]`);
                cedulaValue = option?.dataset?.cedula || '';
            }
            if (!cedulaValue) {
                const studentData = this.students?.[studentId];
                cedulaValue = studentData?.cedula || '';
            }
            if (cedulaValue) {
                cedulaInput.value = cedulaValue;
            }
        };

        const handleCedulaSelection = () => {
            if (!cedulaInput || !studentSelect) return;
            const cedulaValue = cedulaInput.value.trim();
            if (!cedulaValue) return;

            const studentEntry = Object.entries(this.students || {}).find(([id, student]) => 
                (student.cedula || '').toString() === cedulaValue
            );

            if (studentEntry) {
                const [studentId] = studentEntry;
                if (studentSelect.value !== studentId) {
                    studentSelect.value = studentId;
                    studentSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        };

        if (cedulaInput) {
            cedulaInput.addEventListener('change', handleCedulaSelection);
            cedulaInput.addEventListener('blur', handleCedulaSelection);
            cedulaInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCedulaSelection();
                }
            });
        }

        // Actualizar curso y precio cuando se selecciona estudiante
        if (studentSelect) {
            studentSelect.addEventListener('change', () => {
                const selectedOption = studentSelect.options[studentSelect.selectedIndex];
                if (!courseInput) {
                    syncCedulaWithStudent(selectedOption?.value || '');
                    return;
                }

                if (selectedOption.value) {
                    const courseName = selectedOption.dataset.course;
                    courseInput.value = courseName;
                    syncCedulaWithStudent(selectedOption.value);
                    
                    // Buscar precio del curso
                    const course = Object.values(this.courses).find(c => c.name === courseName);
                    if (course && amountInput && (!amountInput.value || amountInput.dataset.autoFilled !== 'false')) {
                        amountInput.value = course.price;
                        amountInput.dataset.autoFilled = 'true';
                    }
                } else if (courseInput) {
                    courseInput.value = '';
                    syncCedulaWithStudent('');
                }
            });

            // Sincronizar valor inicial si ya hay un estudiante seleccionado
            if (studentSelect.value) {
                syncCedulaWithStudent(studentSelect.value);
            }
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
        const cedulaInput = document.getElementById('paymentStudentCedula');
        const selectedStudent = studentSelect.options[studentSelect.selectedIndex];
        if (!selectedStudent) {
            if (window.app) {
                window.app.showNotification('Seleccione un estudiante válido', 'error');
            }
            return;
        }

        const selectedCedula = selectedStudent.dataset?.cedula || 
            this.students?.[studentSelect.value]?.cedula || 
            cedulaInput?.value.trim() || 
            null;

        const selectedGroup = selectedStudent.dataset?.group || 
            this.students?.[studentSelect.value]?.group || 
            (paymentId ? this.payments?.[paymentId]?.group : null) || 
            null;
        
        const paymentData = {
            studentId: studentSelect.value,
            studentName: selectedStudent.text.split(' - ')[0],
            studentCedula: selectedCedula,
            group: selectedGroup,
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
                        studentCedula: student.cedula || null,
                        group: student.group || null,
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

    updateGiraGroupFilter() {
        const giraGroupFilter = document.getElementById('giraGroupFilter');
        
        if (giraGroupFilter) {
            const activeGroups = Object.entries(this.groups)
                .filter(([id, group]) => group.status === 'active')
                .map(([id, group]) => ({
                    id,
                    name: `${group.groupName} (${group.groupCode}) - ${group.academicLevel || group.courseName || 'N/A'}`
                }));
            
            giraGroupFilter.innerHTML = '<option value="">Todos los grupos</option>' +
                activeGroups.map(group => 
                    `<option value="${group.id}">${group.name}</option>`
                ).join('');
        }
    }

    // ============= MÉTODOS PARA GIRAS =============

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Remover clase active de todos los botones y contenidos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Agregar clase active al botón y contenido seleccionado
                button.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                this.currentTab = targetTab;
                
                // Renderizar contenido correspondiente
                if (targetTab === 'giras-tab') {
                    this.renderGirasTable();
                } else if (targetTab === 'payments-tab') {
                    this.renderPaymentsTable();
                }
            });
        });
    }

    async loadGiras() {
        try {
            if (!db) {
                console.warn('Base de datos no disponible para giras');
                return;
            }

            const girasRef = ref(db, 'giras');
            const snapshot = await get(girasRef);
            
            if (snapshot.exists()) {
                this.giras = snapshot.val();
            } else {
                this.giras = {};
            }
            
            this.applyGiraFilters();
            
            // Renderizar tabla inicial si estamos en el tab de giras
            if (this.currentTab === 'giras-tab') {
                this.renderGirasTable();
            }
        } catch (error) {
            console.error('Error al cargar giras:', error);
        }
    }

    applyGiraFilters() {
        const groupFilter = document.getElementById('giraGroupFilter')?.value || '';
        const statusFilter = document.getElementById('giraStatusFilter')?.value || '';
        const dateFilter = document.getElementById('giraDateFilter')?.value || '';

        this.filteredGiras = Object.entries(this.giras).filter(([id, gira]) => {
            const matchesGroup = !groupFilter || gira.groupId === groupFilter;
            const matchesStatus = !statusFilter || gira.status === statusFilter;
            const matchesDate = !dateFilter || gira.date === dateFilter;

            return matchesGroup && matchesStatus && matchesDate;
        }).reduce((acc, [id, gira]) => {
            acc[id] = gira;
            return acc;
        }, {});

        this.renderGirasTable();
    }

    renderGirasTable() {
        const tbody = document.querySelector('#girasTable tbody');
        if (!tbody) return;

        if (Object.keys(this.filteredGiras).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-route fa-3x mb-3"></i>
                            <h4>No hay giras registradas</h4>
                            <p>Comience agregando una nueva gira</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(this.filteredGiras).map(([id, gira]) => {
            const group = this.groups[gira.groupId];
            const groupName = group ? `${group.groupName} (${group.groupCode})` : 'Grupo no encontrado';
            const participantCount = gira.participants ? gira.participants.length : 0;
            
            return `
                <tr>
                    <td><strong>${gira.name}</strong></td>
                    <td>${groupName}</td>
                    <td>${this.formatDate(gira.date)}</td>
                    <td>${gira.destination}</td>
                    <td>${participantCount} estudiantes</td>
                    <td>$${gira.cost ? gira.cost.toLocaleString() : '0'}</td>
                    <td>
                        <span class="status-badge ${gira.status}">
                            ${this.getGiraStatusText(gira.status)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-info btn-sm" onclick="window.paymentsManager.viewGiraDetails('${id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-warning btn-sm" onclick="window.paymentsManager.showGiraModal('${id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger btn-sm" onclick="window.paymentsManager.deleteGira('${id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showGiraModal(giraId = null) {
        const gira = giraId ? this.giras[giraId] : null;
        const isEdit = gira !== null;

        const activeGroups = Object.entries(this.groups)
            .filter(([id, group]) => group.status === 'active')
            .map(([id, group]) => ({
                id,
                name: `${group.groupName} (${group.groupCode}) - ${group.courseName}`
            }));

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-route"></i> 
                    ${isEdit ? 'Editar' : 'Nueva'} Gira
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="giraForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="giraName">Nombre de la Gira *</label>
                        <input 
                            type="text" 
                            id="giraName" 
                            value="${gira?.name || ''}" 
                            required
                            placeholder="Ej: Visita a Zoológico Nacional"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="giraGroup">Grupo *</label>
                        <select id="giraGroup" required>
                            <option value="">Seleccionar grupo</option>
                            ${activeGroups.map(group => `
                                <option value="${group.id}" ${gira?.groupId === group.id ? 'selected' : ''}>
                                    ${group.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="giraDate">Fecha de la Gira *</label>
                        <input 
                            type="date" 
                            id="giraDate" 
                            value="${gira?.date || ''}" 
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="giraCost">Costo por Estudiante</label>
                        <input 
                            type="number" 
                            id="giraCost" 
                            value="${gira?.cost || ''}" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="giraDestination">Destino *</label>
                    <input 
                        type="text" 
                        id="giraDestination" 
                        value="${gira?.destination || ''}" 
                        required
                        placeholder="Ej: Zoológico Nacional, San José"
                    >
                </div>
                
                <div class="form-group">
                    <label for="giraStatus">Estado</label>
                    <select id="giraStatus">
                        <option value="planned" ${gira?.status === 'planned' ? 'selected' : ''}>Planificada</option>
                        <option value="confirmed" ${gira?.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
                        <option value="in-progress" ${gira?.status === 'in-progress' ? 'selected' : ''}>En Progreso</option>
                        <option value="completed" ${gira?.status === 'completed' ? 'selected' : ''}>Completada</option>
                        <option value="cancelled" ${gira?.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="giraDescription">Descripción</label>
                    <textarea 
                        id="giraDescription" 
                        placeholder="Descripción de la gira, actividades, horarios, etc."
                    >${gira?.description || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Crear'} Gira
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const giraForm = document.getElementById('giraForm');
            if (giraForm && !giraForm.hasAttribute('data-listener-attached')) {
                giraForm.setAttribute('data-listener-attached', 'true');
                giraForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveGira(giraId);
                });
            }
        }, 100);
    }

    async saveGira(giraId = null) {
        const form = document.getElementById('giraForm');
        if (!form) return;

        if (form.hasAttribute('data-saving')) return;
        form.setAttribute('data-saving', 'true');

        const giraData = {
            name: document.getElementById('giraName').value.trim(),
            groupId: document.getElementById('giraGroup').value,
            date: document.getElementById('giraDate').value,
            cost: parseFloat(document.getElementById('giraCost').value) || 0,
            destination: document.getElementById('giraDestination').value.trim(),
            status: document.getElementById('giraStatus').value,
            description: document.getElementById('giraDescription').value.trim(),
            updatedAt: new Date().toISOString()
        };

        if (!giraData.name || !giraData.groupId || !giraData.date || !giraData.destination) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            form.removeAttribute('data-saving');
            return;
        }

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (giraId) {
                const giraRef = ref(db, `giras/${giraId}`);
                await set(giraRef, giraData);
            } else {
                giraData.createdAt = new Date().toISOString();
                giraData.participants = [];
                const girasRef = ref(db, 'giras');
                await push(girasRef, giraData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Gira ${giraId ? 'actualizada' : 'creada'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar gira:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la gira', 'error');
            }
        } finally {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${giraId ? 'Actualizar' : 'Crear'} Gira`;
            }
            form.removeAttribute('data-saving');
        }
    }

    async deleteGira(giraId) {
        const gira = this.giras[giraId];
        if (!gira) return;

        if (!confirm(`¿Eliminar la gira "${gira.name}"?`)) return;

        try {
            await remove(ref(db, `giras/${giraId}`));
            if (window.app) {
                window.app.showNotification(`Gira "${gira.name}" eliminada`, 'success');
            }
        } catch (error) {
            console.error('Error al eliminar gira:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar la gira', 'error');
            }
        }
    }

    getGiraStatusText(status) {
        const statusMap = {
            'planned': 'Planificada',
            'confirmed': 'Confirmada',
            'in-progress': 'En Progreso',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };
        return statusMap[status] || status;
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    viewGiraDetails(giraId) {
        const gira = this.giras[giraId];
        if (!gira) return;

        const group = this.groups[gira.groupId];
        const groupName = group ? `${group.groupName} (${group.groupCode})` : 'Grupo no encontrado';

        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-route"></i> Detalles de la Gira</h3>
                <button class="close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="gira-details">
                <h4>${gira.name}</h4>
                <div class="detail-grid">
                    <div><strong>Grupo:</strong> ${groupName}</div>
                    <div><strong>Fecha:</strong> ${this.formatDate(gira.date)}</div>
                    <div><strong>Destino:</strong> ${gira.destination}</div>
                    <div><strong>Costo:</strong> $${gira.cost ? gira.cost.toLocaleString() : '0'}</div>
                    <div><strong>Estado:</strong> 
                        <span class="status-badge ${gira.status}">
                            ${this.getGiraStatusText(gira.status)}
                        </span>
                    </div>
                </div>
                ${gira.description ? `<p><strong>Descripción:</strong> ${gira.description}</p>` : ''}
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">Cerrar</button>
                <button type="button" class="btn-primary" onclick="window.paymentsManager.showGiraModal('${giraId}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </div>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
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
