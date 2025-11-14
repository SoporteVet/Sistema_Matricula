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
        this.currentFilters = {};
        this.listenersSetup = false;
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        // Los event listeners se configurarán cuando se navegue a la sección
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
        // Evitar duplicar listeners
        if (this.listenersSetup) {
            console.log('Event listeners ya configurados');
            return;
        }

        // Botón para agregar nuevo pago
        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) {
            // Remover listener anterior si existe
            const newAddPaymentBtn = addPaymentBtn.cloneNode(true);
            addPaymentBtn.parentNode.replaceChild(newAddPaymentBtn, addPaymentBtn);
            newAddPaymentBtn.addEventListener('click', () => {
                console.log('Click en registrar pago');
                this.showPaymentModal();
            });
            console.log('Listener de agregar pago configurado');
        } else {
            console.warn('Botón addPaymentBtn no encontrado');
        }

        // Botón para agregar nueva gira
        const addGiraBtn = document.getElementById('addGiraBtn');
        if (addGiraBtn) {
            // Remover listener anterior si existe
            const newAddGiraBtn = addGiraBtn.cloneNode(true);
            addGiraBtn.parentNode.replaceChild(newAddGiraBtn, addGiraBtn);
            newAddGiraBtn.addEventListener('click', () => {
                console.log('Click en nueva gira');
                this.showGiraModal();
            });
            console.log('Listener de agregar gira configurado');
        } else {
            console.warn('Botón addGiraBtn no encontrado');
        }

        // Filtros - usar delegación de eventos para evitar duplicados
        const paymentsTab = document.getElementById('payments-tab');
        if (paymentsTab) {
            paymentsTab.addEventListener('change', (e) => {
                if (e.target.id === 'paymentGroupFilter' || 
                    e.target.id === 'paymentStatusFilter' || 
                    e.target.id === 'paymentMonthFilter') {
                this.applyFilters();
                }
            });
            paymentsTab.addEventListener('input', (e) => {
                if (e.target.id === 'paymentStudentSearch') {
                this.applyFilters();
        }
            });
        }

        // Filtros para giras
        const girasTab = document.getElementById('giras-tab');
        if (girasTab) {
            girasTab.addEventListener('change', (e) => {
                if (e.target.id === 'giraGroupFilter' || 
                    e.target.id === 'giraStatusFilter' || 
                    e.target.id === 'giraDateFilter') {
                this.applyGiraFilters();
                }
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
        
        this.listenersSetup = true;
        console.log('Todos los event listeners configurados');
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
                console.log('Pagos cargados:', Object.keys(this.payments).length);
            } else {
                this.payments = {};
                console.warn('No se encontraron pagos en la base de datos');
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
                console.log('Estudiantes cargados:', Object.keys(this.students).length);
            } else {
                console.warn('No se encontraron estudiantes en la base de datos');
                this.students = {};
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
            
            // Renderizar tabla después de cargar datos
            this.renderPaymentsTable();
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
        const studentSearch = document.getElementById('paymentStudentSearch')?.value.toLowerCase() || '';

        this.filteredPayments = Object.fromEntries(
            Object.entries(this.payments).filter(([id, payment]) => {
                const matchesGroup = !groupFilter || payment.group === groupFilter;
                const matchesCourse = !courseFilter || payment.course === courseFilter;
                const matchesStatus = !statusFilter || payment.status === statusFilter;
                const matchesMonth = !monthFilter || payment.month === monthFilter;
                const matchesStudent = !studentSearch || 
                    (payment.studentName && payment.studentName.toLowerCase().includes(studentSearch)) ||
                    (payment.studentCedula && payment.studentCedula.toString().includes(studentSearch));
                
                return matchesGroup && matchesCourse && matchesStatus && matchesMonth && matchesStudent;
            })
        );

        // Guardar filtros para usar en renderPaymentsTable
        this.currentFilters = {
            groupFilter,
            statusFilter,
            studentSearch
        };

        this.renderPaymentsTable();
    }

    renderPaymentsTable() {
        const container = document.getElementById('paymentsTableContainer');
        if (!container) {
            console.warn('Container paymentsTableContainer no encontrado');
            return;
        }

        console.log('Renderizando tabla de pagos...', {
            students: Object.keys(this.students || {}).length,
            payments: Object.keys(this.payments || {}).length,
            filteredPayments: Object.keys(this.filteredPayments || {}).length
        });

        // Materias disponibles (orden según ATV)
        const subjects = [
            { key: 'anatomia', code: 'ATV-001', label: 'ANATOMIA' },
            { key: 'zootecnia', code: 'ATV-002', label: 'ZOOTECNIA Y NUTRICIÓN' },
            { key: 'fisiologia', code: 'ATV-003', label: 'FISIOLOGÍA' },
            { key: 'patologia', code: 'ATV-004', label: 'PATOLOGÍA' },
            { key: 'terminologia', code: 'ATV-005', label: 'TERMINOLOGÍA Y ÉTICA PROFESIONAL' },
            { key: 'infecciosas', code: 'ATV-006', label: 'ENFERMEDADES INFECCIOSAS' },
            { key: 'parasitarias', code: 'ATV-007', label: 'PARASITARIAS' },
            { key: 'farmacologia', code: 'ATV-008', label: 'FARMACOLOGÍA' },
            { key: 'lab_clinico', code: 'ATV-009', label: 'LABORATORIO CLÍNICO' },
            { key: 'consulta_externa', code: 'ATV-010', label: 'ASISTENTE DE CONSULTA EXTERNA' },
            { key: 'medicina_interna', code: 'ATV-011', label: 'ASISTENTE DE MEDICINA INTERNA' },
            { key: 'quirofano', code: 'ATV-012', label: 'ASISTENTE DE QUIRÓFANO' },
            { key: 'proyecto_final', code: 'ATV-013', label: 'PROYECTO FINAL' }
        ];

        // Agrupar estudiantes por grupo
        const studentsByGroup = {};
        const paymentsToShow = Object.keys(this.filteredPayments).length > 0 ? 
            this.filteredPayments : this.payments;

        // Aplicar filtros a estudiantes
        const groupFilter = this.currentFilters?.groupFilter || '';
        const studentSearch = this.currentFilters?.studentSearch || '';

        // Primero, obtener todos los estudiantes activos
        // Si no hay estudiantes cargados, intentar mostrar al menos los que tienen pagos
        const studentsWithPayments = new Set();
        Object.values(paymentsToShow).forEach(payment => {
            if (payment.studentId) {
                studentsWithPayments.add(payment.studentId);
            }
        });

        // Si hay estudiantes cargados, usarlos (incluir todos, incluso los que abandonaron)
        if (Object.keys(this.students || {}).length > 0) {
            Object.entries(this.students).forEach(([studentId, student]) => {
                // Mostrar todos los estudiantes, sin importar su estado
                // if (student.status !== 'active') return; // REMOVIDO - mostrar todos
                
                // Aplicar filtro de grupo
                const studentGroup = student.group || 'Sin grupo';
                if (groupFilter && studentGroup !== groupFilter) return;
                
                // Aplicar filtro de búsqueda
                const studentName = `${student.firstName} ${student.lastName}`.toLowerCase();
                const studentCedula = (student.cedula || '').toString().toLowerCase();
                if (studentSearch && !studentName.includes(studentSearch) && !studentCedula.includes(studentSearch)) {
                    return;
                }
                
                const groupValue = studentGroup;
                if (!studentsByGroup[groupValue]) {
                    studentsByGroup[groupValue] = [];
                }
                
                studentsByGroup[groupValue].push({
                    id: studentId,
                    name: `${student.firstName} ${student.lastName}`,
                    cedula: student.cedula || '',
                    group: groupValue,
                    status: student.status || 'active' // Incluir el estado del estudiante
                });
            });
        } else if (studentsWithPayments.size > 0) {
            // Si no hay estudiantes cargados pero sí hay pagos, crear entradas temporales
            studentsWithPayments.forEach(studentId => {
                const studentPayments = Object.values(paymentsToShow).filter(p => p.studentId === studentId);
                if (studentPayments.length === 0) return;
                
                const firstPayment = studentPayments[0];
                const studentGroup = firstPayment.group || 'Sin grupo';
                
                if (groupFilter && studentGroup !== groupFilter) return;
                
                if (!studentsByGroup[studentGroup]) {
                    studentsByGroup[studentGroup] = [];
                }
                
                studentsByGroup[studentGroup].push({
                    id: studentId,
                    name: firstPayment.studentName || 'Estudiante desconocido',
                    cedula: firstPayment.studentCedula || '',
                    group: studentGroup
                });
            });
        }

        // Si no hay estudiantes, mostrar mensaje vacío
        if (Object.keys(studentsByGroup).length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-credit-card fa-3x mb-3"></i>
                    <h4>No hay estudiantes o pagos registrados</h4>
                    <p>Comience registrando un nuevo pago o estudiante</p>
                    <small style="display: block; margin-top: 10px; color: #999;">
                        Estudiantes cargados: ${Object.keys(this.students || {}).length} | 
                        Pagos cargados: ${Object.keys(this.payments || {}).length}
                    </small>
                        </div>
            `;
            return;
        }

        // Renderizar tabla por grupo
        let html = '';
        
        Object.entries(studentsByGroup).sort().forEach(([groupValue, students]) => {
            const groupLabel = this.getGroupLabel(groupValue);
            const groupNumber = groupValue.match(/\d+/)?.[0] || '';
            
            html += `
                <div class="payments-group-section">
                    <div class="payments-group-header">
                        <h3>GRUPO ${groupNumber || groupValue}</h3>
                    </div>
                    <div class="payments-table-wrapper">
                        <table class="payments-data-table">
                            <thead>
                                <tr>
                                    <th>ALUMNO</th>
                                    <th>ID</th>
                                    <th>MATRICULA</th>
                                    <th>N</th>
                                    <th>ESTADO</th>
                                    ${subjects.map(subject => `
                                        <th>${subject.label}</th>
                                        <th>Pagado</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${students.map(student => {
                                    // Obtener pagos del estudiante
                                    const studentPayments = Object.entries(paymentsToShow)
                                        .filter(([id, payment]) => payment.studentId === student.id)
                                        .map(([id, payment]) => payment);
                                    
                                    // Crear mapa de pagos por materia
                                    const paymentsBySubject = {};
                                    studentPayments.forEach(payment => {
                                        const courseName = (payment.course || '').toLowerCase().trim();
                                        const courseCode = (payment.courseCode || '').toLowerCase().trim();
                                        // Mapear nombres de cursos a materias usando códigos y nombres
                                        let subjectKey = null;
                                        
                                        // Buscar por código primero (más preciso)
                                        if (courseCode.includes('atv-001') || courseName.includes('atv-001') || 
                                            courseName.includes('anatom') || courseName.includes('anatomía')) {
                                            subjectKey = 'anatomia';
                                        }
                                        // ATV-002 ZOOTECNIA Y NUTRICIÓN
                                        else if (courseCode.includes('atv-002') || courseName.includes('atv-002') || 
                                                 courseName.includes('zootecn') || courseName.includes('zootecnia') || 
                                                 (courseName.includes('nutricion') || courseName.includes('nutrición'))) {
                                            subjectKey = 'zootecnia';
                                        }
                                        // ATV-003 FISIOLOGÍA
                                        else if (courseCode.includes('atv-003') || courseName.includes('atv-003') || 
                                                 courseName.includes('fisiol') || courseName.includes('fisiología')) {
                                            subjectKey = 'fisiologia';
                                        }
                                        // ATV-004 PATOLOGÍA
                                        else if (courseCode.includes('atv-004') || courseName.includes('atv-004') || 
                                                 courseName.includes('patol') || courseName.includes('patología')) {
                                            subjectKey = 'patologia';
                                        }
                                        // ATV-005 TERMINOLOGÍA Y ÉTICA PROFESIONAL
                                        else if (courseCode.includes('atv-005') || courseName.includes('atv-005') || 
                                                 courseName.includes('terminol') || courseName.includes('terminología') || 
                                                 courseName.includes('etica') || courseName.includes('ética') ||
                                                 courseName.includes('profesional')) {
                                            subjectKey = 'terminologia';
                                        }
                                        // ATV-006 ENFERMEDADES INFECCIOSAS
                                        else if (courseCode.includes('atv-006') || courseName.includes('atv-006') || 
                                                 courseName.includes('infeccios') || courseName.includes('infecciosa')) {
                                            subjectKey = 'infecciosas';
                                        }
                                        // ATV-007 PARASITARIAS
                                        else if (courseCode.includes('atv-007') || courseName.includes('atv-007') || 
                                                 courseName.includes('parasit') || courseName.includes('parasitaria') || 
                                                 courseName.includes('parasitología')) {
                                            subjectKey = 'parasitarias';
                                        }
                                        // ATV-008 FARMACOLOGÍA
                                        else if (courseCode.includes('atv-008') || courseName.includes('atv-008') || 
                                                 courseName.includes('farmacol') || courseName.includes('farmacología')) {
                                            subjectKey = 'farmacologia';
                                        }
                                        // ATV-009 LABORATORIO CLÍNICO
                                        else if (courseCode.includes('atv-009') || courseName.includes('atv-009') || 
                                                 courseName.includes('laboratorio') || courseName.includes('lab') || 
                                                 (courseName.includes('clínico') || courseName.includes('clinico'))) {
                                            subjectKey = 'lab_clinico';
                                        }
                                        // ATV-010 ASISTENTE DE CONSULTA EXTERNA
                                        else if (courseCode.includes('atv-010') || courseName.includes('atv-010') || 
                                                 (courseName.includes('consulta') && courseName.includes('externa'))) {
                                            subjectKey = 'consulta_externa';
                                        }
                                        // ATV-011 ASISTENTE DE MEDICINA INTERNA
                                        else if (courseCode.includes('atv-011') || courseName.includes('atv-011') || 
                                                 (courseName.includes('medicina') && courseName.includes('interna'))) {
                                            subjectKey = 'medicina_interna';
                                        }
                                        // ATV-012 ASISTENTE DE QUIRÓFANO
                                        else if (courseCode.includes('atv-012') || courseName.includes('atv-012') || 
                                                 courseName.includes('quirofano') || courseName.includes('quirófano')) {
                                            subjectKey = 'quirofano';
                                        }
                                        // ATV-013 PROYECTO FINAL
                                        else if (courseCode.includes('atv-013') || courseName.includes('atv-013') || 
                                                 (courseName.includes('proyecto') && courseName.includes('final'))) {
                                            subjectKey = 'proyecto_final';
                                        }
                                        
                                        if (subjectKey) {
                                            if (!paymentsBySubject[subjectKey]) {
                                                paymentsBySubject[subjectKey] = [];
                                            }
                                            paymentsBySubject[subjectKey].push(payment);
                                        }
                                    });
                                    
                                    // Determinar estado general del estudiante
                                    // Priorizar: ATRASADO > CONGELA > PENDIENTE > PAGADO
                                    const hasOverdue = studentPayments.some(p => p.status === 'overdue');
                                    const hasCongela = studentPayments.some(p => p.status === 'congela' || p.notes?.toLowerCase().includes('congela'));
                                    const hasPending = studentPayments.some(p => p.status === 'pending');
                                    const hasPaid = studentPayments.some(p => p.status === 'paid');
                                    
                                    let generalStatus = '';
                                    if (hasOverdue) {
                                        generalStatus = 'ATRASADO';
                                    } else if (hasCongela) {
                                        generalStatus = 'CONGELA';
                                    } else if (hasPending) {
                                        generalStatus = 'PENDIENTE';
                                    } else if (hasPaid && studentPayments.length > 0) {
                                        generalStatus = 'PAGADO';
                                    }
                                    
                                    // Calcular matrícula (usar el primer pago o valor por defecto)
                                    const matriculaAmount = studentPayments.length > 0 ? 
                                        (studentPayments[0].amount || 50000) : 50000;
                                    const matricula = `₡${matriculaAmount.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                                    
                                    // Determinar si el estudiante abandonó
                                    const studentData = this.students[student.id];
                                    const studentStatus = studentData?.status || student.status || 'active';
                                    const isDropped = studentStatus === 'dropped' || studentStatus === 'inactive';
                                    const rowClass = isDropped ? 'student-dropped' : '';
                                    
                                    return `
                                        <tr class="${rowClass}">
                                            <td>${student.name}${isDropped ? ' <span style="color: #dc3545; font-size: 10px;">(Abandonó)</span>' : ''}</td>
                                            <td>${student.cedula || student.id}</td>
                                            <td>${matricula}</td>
                                            <td class="checkbox-cell">
                                                <input type="checkbox" ${studentPayments.length > 0 ? 'checked' : ''}>
                    </td>
                                            <td class="status-cell editable-status-cell ${generalStatus.toLowerCase()}" 
                                                data-student-id="${student.id}"
                                                data-current-status="${generalStatus.toLowerCase() || ''}"
                                                onclick="window.paymentsManager.editStudentStatus(this)"
                                                style="cursor: pointer; position: relative;">
                                                ${generalStatus || '<span style="color: #999; font-size: 11px;">Click para agregar</span>'}
                                            </td>
                                            ${subjects.map(subject => {
                                                const subjectPayments = paymentsBySubject[subject.key] || [];
                                                const latestPayment = subjectPayments.sort((a, b) => {
                                                    // Comparar fechas sin problemas de zona horaria
                                                    const dateA = a.paymentDate || a.createdAt || '0';
                                                    const dateB = b.paymentDate || b.createdAt || '0';
                                                    return dateB.localeCompare(dateA); // Comparación de strings YYYY-MM-DD
                                                })[0];
                                                
                                                let cellContent = '';
                                                let cellClass = '';
                                                let isChecked = false;
                                                let paidAmount = '';
                                                let paymentId = '';
                                                let currentDate = '';
                                                
                                                if (latestPayment) {
                                                    paymentId = Object.keys(paymentsToShow).find(id => paymentsToShow[id] === latestPayment) || '';
                                                    
                                                    if (latestPayment.paymentDate) {
                                                        // Parsear fecha sin problemas de zona horaria
                                                        const dateStr = latestPayment.paymentDate;
                                                        const [year, month, day] = dateStr.split('-').map(Number);
                                                        const date = new Date(year, month - 1, day); // Usar constructor local
                                                        const dayNum = date.getDate();
                                                        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
                                                        const monthName = monthNames[date.getMonth()];
                                                        const yearShort = date.getFullYear().toString().slice(-2);
                                                        cellContent = `${dayNum} ${monthName} ${yearShort}`;
                                                        cellClass = 'date-cell editable-date-cell';
                                                        isChecked = true;
                                                        currentDate = latestPayment.paymentDate;
                                                        // Mostrar monto pagado
                                                        if (latestPayment.amount) {
                                                            paidAmount = `₡${latestPayment.amount.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                                                        }
                                                    } else if (latestPayment.status === 'congela' || latestPayment.notes?.toLowerCase().includes('congela')) {
                                                        cellContent = 'CONGELA';
                                                        cellClass = 'status-cell congela';
                                                    } else if (latestPayment.status === 'overdue') {
                                                        cellContent = 'ATRASADO';
                                                        cellClass = 'status-cell atrasado';
                                                    } else if (latestPayment.notes) {
                                                        cellContent = latestPayment.notes.substring(0, 30);
                                                        cellClass = 'status-cell note';
                                                    }
                                                }
                                                
                                                // Si no hay pago, crear una celda editable vacía
                                                if (!latestPayment) {
                                                    cellClass = 'editable-date-cell empty-date-cell';
                                                }
                                                
                                                return `
                                                    <td class="${cellClass}" 
                                                        data-student-id="${student.id}" 
                                                        data-subject-key="${subject.key}"
                                                        data-subject-code="${subject.code}"
                                                        data-payment-id="${paymentId}"
                                                        data-current-date="${currentDate}"
                                                        onclick="window.paymentsManager.editSubjectDate(this)"
                                                        style="cursor: pointer; position: relative;">
                                                        ${cellContent || '<span style="color: #999; font-size: 11px;">Click para agregar</span>'}
                                                        ${cellContent ? `<input type="date" class="date-input-hidden" value="${currentDate}" style="display: none;">` : `<input type="date" class="date-input-hidden" style="display: none;">`}
                                                    </td>
                                                    <td class="checkbox-cell paid-amount-cell">
                                                        ${isChecked ? `<input type="checkbox" checked><br><small style="font-size: 10px; color: #28a745; font-weight: 600;">${paidAmount}</small>` : '<input type="checkbox">'}
                                                    </td>
                                                `;
                                            }).join('')}
                </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
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
        // También renderizar la tabla si estamos en la sección de pagos
        this.renderPaymentsTable();
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

    async editSubjectDate(cell) {
        const studentId = cell.dataset.studentId;
        const subjectKey = cell.dataset.subjectKey;
        const subjectCode = cell.dataset.subjectCode;
        const paymentId = cell.dataset.paymentId;
        const currentDate = cell.dataset.currentDate;
        
        // Crear input de fecha
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'date-input-visible';
        dateInput.style.cssText = 'width: 100%; padding: 4px; border: 2px solid #3b82f6; border-radius: 4px; font-size: 12px;';
        if (currentDate) {
            dateInput.value = currentDate;
        }
        
        // Reemplazar contenido de la celda temporalmente
        const originalContent = cell.innerHTML;
        cell.innerHTML = '';
        cell.appendChild(dateInput);
        dateInput.focus();
        dateInput.select();
        
        const saveDate = async () => {
            const selectedDate = dateInput.value;
            if (!selectedDate) {
                cell.innerHTML = originalContent;
                return;
            }
            
            // Buscar el curso correspondiente a esta materia
            const courseName = this.getCourseNameForSubject(subjectCode, subjectKey);
            
            // Buscar si ya existe un pago para este estudiante y materia
            let existingPayment = null;
            if (paymentId && this.payments[paymentId]) {
                existingPayment = this.payments[paymentId];
            } else {
                // Buscar pago existente
                existingPayment = Object.values(this.payments).find(p => 
                    p.studentId === studentId && 
                    p.course && p.course.toLowerCase().includes(subjectKey.toLowerCase())
                );
            }
            
            try {
                if (existingPayment) {
                    // Actualizar pago existente
                    const paymentRef = ref(db, `payments/${Object.keys(this.payments).find(id => this.payments[id] === existingPayment)}`);
                    await set(paymentRef, {
                        ...existingPayment,
                        paymentDate: selectedDate,
                        status: 'paid',
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // Crear nuevo pago
                    const student = this.students[studentId];
                    if (!student) {
                        console.error('Estudiante no encontrado');
                        cell.innerHTML = originalContent;
                        return;
                    }
                    
                    // Buscar precio del curso
                    const course = Object.values(this.courses).find(c => 
                        c.name && (c.name.toLowerCase().includes(subjectKey.toLowerCase()) || 
                                   c.code === subjectCode)
                    );
                    
                    const paymentData = {
                        studentId: studentId,
                        studentName: `${student.firstName} ${student.lastName}`,
                        studentCedula: student.cedula || '',
                        group: student.group || '',
                        course: courseName,
                        courseCode: subjectCode,
                        month: selectedDate.slice(0, 7), // YYYY-MM
                        amount: course ? course.price : 50000,
                        status: 'paid',
                        paymentDate: selectedDate,
                        paymentMethod: null,
                        notes: `Pago de ${this.getSubjectLabel(subjectKey)}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    const paymentsRef = ref(db, 'payments');
                    await push(paymentsRef, paymentData);
                }
                
                // Recargar pagos y renderizar
                await this.loadPayments();
                this.renderPaymentsTable();
                
                if (window.app) {
                    window.app.showNotification('Fecha guardada correctamente', 'success');
                }
            } catch (error) {
                console.error('Error al guardar fecha:', error);
                cell.innerHTML = originalContent;
                if (window.app) {
                    window.app.showNotification('Error al guardar la fecha', 'error');
                }
            }
        };
        
        const cancelEdit = () => {
            cell.innerHTML = originalContent;
        };
        
        dateInput.addEventListener('blur', saveDate);
        dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveDate();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }
    
    getCourseNameForSubject(subjectCode, subjectKey) {
        // Buscar curso por código o nombre
        const course = Object.values(this.courses).find(c => 
            (c.code && c.code.toLowerCase() === subjectCode.toLowerCase()) ||
            (c.name && c.name.toLowerCase().includes(subjectKey.toLowerCase()))
        );
        
        if (course) {
            return course.name;
        }
        
        // Si no se encuentra, usar el código como nombre
        const subjectLabels = {
            'anatomia': 'ATV-001 ANATOMIA',
            'zootecnia': 'ATV-002 ZOOTECNIA Y NUTRICIÓN',
            'fisiologia': 'ATV-003 FISIOLOGÍA',
            'patologia': 'ATV-004 PATOLOGÍA',
            'terminologia': 'ATV-005 TERMINOLOGÍA Y ÉTICA PROFESIONAL',
            'infecciosas': 'ATV-006 ENFERMEDADES INFECCIOSAS',
            'parasitarias': 'ATV-007 PARASITARIAS',
            'farmacologia': 'ATV-008 FARMACOLOGÍA',
            'lab_clinico': 'ATV-009 LABORATORIO CLÍNICO',
            'consulta_externa': 'ATV-010 ASISTENTE DE CONSULTA EXTERNA',
            'medicina_interna': 'ATV-011 ASISTENTE DE MEDICINA INTERNA',
            'quirofano': 'ATV-012 ASISTENTE DE QUIRÓFANO',
            'proyecto_final': 'ATV-013 PROYECTO FINAL'
        };
        
        return subjectLabels[subjectKey] || subjectCode;
    }
    
    getSubjectLabel(subjectKey) {
        const subjectLabels = {
            'anatomia': 'ANATOMIA',
            'zootecnia': 'ZOOTECNIA Y NUTRICIÓN',
            'fisiologia': 'FISIOLOGÍA',
            'patologia': 'PATOLOGÍA',
            'terminologia': 'TERMINOLOGÍA Y ÉTICA PROFESIONAL',
            'infecciosas': 'ENFERMEDADES INFECCIOSAS',
            'parasitarias': 'PARASITARIAS',
            'farmacologia': 'FARMACOLOGÍA',
            'lab_clinico': 'LABORATORIO CLÍNICO',
            'consulta_externa': 'ASISTENTE DE CONSULTA EXTERNA',
            'medicina_interna': 'ASISTENTE DE MEDICINA INTERNA',
            'quirofano': 'ASISTENTE DE QUIRÓFANO',
            'proyecto_final': 'PROYECTO FINAL'
        };
        
        return subjectLabels[subjectKey] || subjectKey;
    }

    async editStudentStatus(cell) {
        // Evitar múltiples ediciones simultáneas
        if (cell.dataset.editing === 'true') {
            return;
        }
        cell.dataset.editing = 'true';
        
        const studentId = cell.dataset.studentId;
        const currentStatus = cell.dataset.currentStatus || '';
        
        // Guardar contenido original
        const originalContent = cell.innerHTML;
        const originalClasses = cell.className;
        
        // Crear dropdown de estados
        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select-visible';
        statusSelect.style.cssText = 'width: 100%; padding: 6px; border: 2px solid #3b82f6; border-radius: 4px; font-size: 12px; background: white; font-weight: 600; cursor: pointer; z-index: 1000;';
        
        const statusOptions = [
            { value: '', label: 'Seleccionar estado' },
            { value: 'pagado', label: 'PAGADO' },
            { value: 'pendiente', label: 'PENDIENTE' },
            { value: 'atrasado', label: 'ATRASADO' },
            { value: 'congela', label: 'CONGELADO' }
        ];
        
        statusOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value === currentStatus) {
                optionElement.selected = true;
            }
            statusSelect.appendChild(optionElement);
        });
        
        // Reemplazar contenido de la celda
        cell.innerHTML = '';
        cell.className = 'status-cell editable-status-cell';
        cell.appendChild(statusSelect);
        
        // Variables para controlar el guardado
        let isSaving = false;
        let hasChanged = false;
        
        const saveStatus = async () => {
            if (isSaving) return;
            
            const selectedStatus = statusSelect.value;
            if (!selectedStatus) {
                // Si no se seleccionó nada, restaurar contenido original
                cell.innerHTML = originalContent;
                cell.className = originalClasses;
                cell.dataset.editing = 'false';
                return;
            }
            
            isSaving = true;
            
            // Obtener todos los pagos del estudiante
            const studentPayments = Object.entries(this.payments).filter(([id, payment]) => 
                payment.studentId === studentId
            );
            
            try {
                // Mapear estado seleccionado al formato de la base de datos
                const dbStatus = selectedStatus === 'pagado' ? 'paid' : 
                                selectedStatus === 'pendiente' ? 'pending' :
                                selectedStatus === 'atrasado' ? 'overdue' : 'congela';
                
                // Si no hay pagos, crear uno nuevo con el estado seleccionado
                if (studentPayments.length === 0) {
                    const student = this.students[studentId];
                    if (!student) {
                        throw new Error('Estudiante no encontrado');
                    }
                    
                    // Crear un pago genérico para el estudiante
                    const paymentData = {
                        studentId: studentId,
                        studentName: `${student.firstName} ${student.lastName}`,
                        studentCedula: student.cedula || '',
                        group: student.group || '',
                        course: 'Estado General',
                        month: new Date().toISOString().slice(0, 7),
                        amount: 0,
                        status: dbStatus,
                        paymentDate: null,
                        paymentMethod: null,
                        notes: `Estado: ${selectedStatus.toUpperCase()}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    const paymentsRef = ref(db, 'payments');
                    await push(paymentsRef, paymentData);
                } else {
                    // Actualizar el estado de todos los pagos del estudiante
                    const updates = [];
                    for (const [paymentId, payment] of studentPayments) {
                        const paymentRef = ref(db, `payments/${paymentId}`);
                        const updatedPayment = {
                            ...payment,
                            status: dbStatus,
                            updatedAt: new Date().toISOString()
                        };
                        updates.push(set(paymentRef, updatedPayment));
                    }
                    
                    if (updates.length > 0) {
                        await Promise.all(updates);
                    }
                }
                
                // Recargar pagos y renderizar
                await this.loadPayments();
                this.renderPaymentsTable();
                
                if (window.app) {
                    window.app.showNotification('Estado actualizado correctamente', 'success');
                }
            } catch (error) {
                console.error('Error al guardar estado:', error);
                cell.innerHTML = originalContent;
                cell.className = originalClasses;
                if (window.app) {
                    window.app.showNotification('Error al guardar el estado', 'error');
                }
            } finally {
                isSaving = false;
                cell.dataset.editing = 'false';
            }
        };
        
        const cancelEdit = () => {
            if (isSaving) return;
            cell.innerHTML = originalContent;
            cell.className = originalClasses;
            cell.dataset.editing = 'false';
        };
        
        // Evento change - guardar inmediatamente cuando se selecciona
        statusSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            hasChanged = true;
            saveStatus();
        });
        
        // Evento blur - solo si no se ha cambiado ya
        statusSelect.addEventListener('blur', (e) => {
            e.stopPropagation();
            // Delay para permitir que el evento change se procese primero
            setTimeout(() => {
                if (!hasChanged && document.body.contains(statusSelect) && !isSaving) {
                    cancelEdit();
                }
            }, 150);
        });
        
        // Evento keydown
        statusSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
            }
        });
        
        // Enfocar y abrir el dropdown
        setTimeout(() => {
            statusSelect.focus();
            statusSelect.click();
        }, 10);
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    // Crear instancia si existe el contenedor de pagos o la sección de pagos
    if (document.getElementById('paymentsTableContainer') || document.getElementById('payments')) {
        window.paymentsManager = new PaymentsManager();
        console.log('PaymentsManager creado');
        // No inicializar automáticamente, esperar a que la app esté lista
    } else {
        console.warn('No se encontró el contenedor de pagos');
    }
});

export default PaymentsManager;
