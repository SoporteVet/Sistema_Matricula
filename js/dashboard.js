import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class DashboardManager {
    constructor() {
        this.charts = {};
        this.stats = {
            totalStudents: 0,
            totalCourses: 0,
            monthlyRevenue: 0,
            pendingPayments: 0
        };
        this.paymentCheckInterval = null;
        this.init();
    }

    init() {
        this.setupChartJS();
        this.setupRealTimeUpdates();
        this.setupPaymentDateChecker();
    }

    setupChartJS() {
        // Configuración global de Chart.js
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            Chart.defaults.plugins.legend.position = 'bottom';
            Chart.defaults.plugins.legend.labels.padding = 20;
        }
    }

    setupRealTimeUpdates() {
        // Suscribirse a actualizaciones en tiempo real para estadísticas
        this.unsubscribeStudents = realtimeManager.subscribe('students', (students) => {
            this.stats.totalStudents = Object.keys(students).length;
            this.updateStatsDisplay();
            // Actualizar gráfico de estudiantes cuando cambien los datos
            this.loadStudentsChart();
        });
        
        this.unsubscribeCourses = realtimeManager.subscribe('courses', (courses) => {
            const activeCourses = Object.values(courses).filter(course => 
                course.status === 'active'
            );
            this.stats.totalCourses = activeCourses.length;
            this.updateStatsDisplay();
        });
        
        this.unsubscribeGroups = realtimeManager.subscribe('groups', (groups) => {
            // Actualizar gráfico de estudiantes cuando cambien los grupos
            this.loadStudentsChart();
        });
        
        this.unsubscribePayments = realtimeManager.subscribe('payments', (payments) => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            let monthlyRevenue = 0;
            let pendingPayments = 0;
            
            Object.values(payments).forEach(payment => {
                if (payment.paymentDate && payment.paymentDate.startsWith(currentMonth) && payment.status === 'paid') {
                    monthlyRevenue += payment.amount || 0;
                }
                
                if (payment.status === 'pending' || payment.status === 'overdue') {
                    pendingPayments++;
                }
            });
            
            this.stats.monthlyRevenue = monthlyRevenue;
            this.stats.pendingPayments = pendingPayments;
            this.updateStatsDisplay();
            // Actualizar gráfico de pagos cuando cambien los datos
            this.loadPaymentsChart();
        });
        
        // Suscribirse a cambios de estudiantes para actualizar el gráfico de pagos
        this.unsubscribeStudentsForPayments = realtimeManager.subscribe('students', (students) => {
            // Actualizar gráfico de pagos cuando cambien los estudiantes
            this.loadPaymentsChart();
        });
    }

    async loadStats() {
        try {
            await Promise.all([
                this.loadStudentsStats(),
                this.loadCoursesStats(),
                this.loadPaymentsStats()
            ]);
            
            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    }

    async loadStudentsStats() {
        try {
            const studentsRef = ref(db, 'students');
            const snapshot = await get(studentsRef);
            
            if (snapshot.exists()) {
                const students = snapshot.val();
                this.stats.totalStudents = Object.keys(students).length;
            } else {
                this.stats.totalStudents = 0;
            }
        } catch (error) {
            console.error('Error al cargar estadísticas de estudiantes:', error);
            this.stats.totalStudents = 0;
        }
    }

    async loadCoursesStats() {
        try {
            const coursesRef = ref(db, 'courses');
            const snapshot = await get(coursesRef);
            
            if (snapshot.exists()) {
                const courses = snapshot.val();
                const activeCourses = Object.values(courses).filter(course => 
                    course.status === 'active'
                );
                this.stats.totalCourses = activeCourses.length;
            } else {
                this.stats.totalCourses = 0;
            }
        } catch (error) {
            console.error('Error al cargar estadísticas de cursos:', error);
            this.stats.totalCourses = 0;
        }
    }

    async loadPaymentsStats() {
        try {
            const paymentsRef = ref(db, 'payments');
            const snapshot = await get(paymentsRef);
            
            if (snapshot.exists()) {
                const payments = snapshot.val();
                const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                
                let monthlyRevenue = 0;
                let pendingPayments = 0;
                
                Object.values(payments).forEach(payment => {
                    // Calcular ingresos del mes actual
                    if (payment.paymentDate && payment.paymentDate.startsWith(currentMonth) && payment.status === 'paid') {
                        monthlyRevenue += payment.amount || 0;
                    }
                    
                    // Contar pagos pendientes y atrasados
                    if (payment.status === 'pending' || payment.status === 'overdue') {
                        pendingPayments++;
                    }
                });
                
                this.stats.monthlyRevenue = monthlyRevenue;
                this.stats.pendingPayments = pendingPayments;
            } else {
                this.stats.monthlyRevenue = 0;
                this.stats.pendingPayments = 0;
            }
        } catch (error) {
            console.error('Error al cargar estadísticas de pagos:', error);
            this.stats.monthlyRevenue = 0;
            this.stats.pendingPayments = 0;
        }
    }

    updateStatsDisplay() {
        const totalStudentsElement = document.getElementById('totalStudents');
        const totalCoursesElement = document.getElementById('totalCourses');
        const monthlyRevenueElement = document.getElementById('monthlyRevenue');
        const pendingPaymentsElement = document.getElementById('pendingPayments');

        if (totalStudentsElement) {
            totalStudentsElement.textContent = this.stats.totalStudents;
        }
        
        if (totalCoursesElement) {
            totalCoursesElement.textContent = this.stats.totalCourses;
        }
        
        if (monthlyRevenueElement) {
            monthlyRevenueElement.textContent = this.formatCurrency(this.stats.monthlyRevenue);
        }
        
        if (pendingPaymentsElement) {
            pendingPaymentsElement.textContent = this.stats.pendingPayments;
        }
    }

    async loadCharts() {
        try {
            await Promise.all([
                this.loadStudentsChart(),
                this.loadPaymentsChart()
            ]);
        } catch (error) {
            console.error('Error al cargar gráficos:', error);
        }
    }

    async loadStudentsChart() {
        try {
            const studentsRef = ref(db, 'students');
            const groupsRef = ref(db, 'groups');
            
            const [studentsSnapshot, groupsSnapshot] = await Promise.all([
                get(studentsRef),
                get(groupsRef)
            ]);

            const groupData = {};
            
            // Inicializar contadores de grupos activos
            if (groupsSnapshot.exists()) {
                const groups = groupsSnapshot.val();
                Object.entries(groups).forEach(([groupId, group]) => {
                    // Usar el nombre del grupo o código como identificador
                    const groupLabel = group.groupName || group.groupCode || groupId;
                    groupData[groupLabel] = {
                        count: 0,
                        groupId: groupId,
                        groupCode: group.groupCode || '',
                        groupName: group.groupName || ''
                    };
                });
            }

            // Contar estudiantes por grupo
            if (studentsSnapshot.exists()) {
                const students = studentsSnapshot.val();
                Object.values(students).forEach(student => {
                    if (!student.group) return;
                    
                    // Buscar el grupo correspondiente
                    // El campo student.group puede ser: ID del grupo, nombre del grupo, o código del grupo
                    let matchedGroup = null;
                    
                    for (const [groupLabel, groupInfo] of Object.entries(groupData)) {
                        const groupId = groupInfo.groupId;
                        const groupCode = groupInfo.groupCode;
                        const groupName = groupInfo.groupName;
                        
                        // Verificar si el estudiante pertenece a este grupo
                        if (student.group === groupId || 
                            student.group === groupLabel ||
                            student.group === groupCode ||
                            student.group === groupName) {
                            matchedGroup = groupLabel;
                            break;
                        }
                    }
                    
                    // Si no se encontró coincidencia exacta, intentar crear una entrada nueva
                    if (!matchedGroup && student.group) {
                        // Crear una entrada para grupos que no están en la base de datos pero tienen estudiantes
                        const groupLabel = student.group;
                        if (!groupData[groupLabel]) {
                            groupData[groupLabel] = {
                                count: 0,
                                groupId: null,
                                groupCode: '',
                                groupName: groupLabel
                            };
                        }
                        matchedGroup = groupLabel;
                    }
                    
                    if (matchedGroup && student.status === 'active') {
                        groupData[matchedGroup].count++;
                    }
                });
            }

            // Convertir a formato simple para el gráfico
            const chartData = {};
            Object.entries(groupData).forEach(([label, info]) => {
                // Solo mostrar grupos que tienen estudiantes o que están definidos en la BD
                if (info.count > 0 || info.groupId) {
                    chartData[label] = info.count;
                }
            });

            this.renderStudentsChart(chartData);
        } catch (error) {
            console.error('Error al cargar gráfico de estudiantes:', error);
        }
    }

    renderStudentsChart(data) {
        let ctx = document.getElementById('studentsChart');
        const chartContainer = ctx ? ctx.parentElement : null;
        if (!chartContainer) return;

        // Si el canvas no existe, restaurarlo
        if (!ctx) {
            // Restaurar el canvas si fue eliminado
            chartContainer.innerHTML = `
                <h3>Estudiantes por Grupo</h3>
                <canvas id="studentsChart"></canvas>
            `;
            ctx = document.getElementById('studentsChart');
        }

        // Destruir gráfico existente
        if (this.charts.students) {
            this.charts.students.destroy();
        }

        const labels = Object.keys(data);
        const values = Object.values(data);

        // Si no hay datos, mostrar mensaje
        if (labels.length === 0 || values.every(v => v === 0)) {
            chartContainer.innerHTML = `
                <h3>Estudiantes por Grupo</h3>
                <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: #666;">
                    <p>No hay estudiantes asignados a grupos aún</p>
                </div>
            `;
            return;
        }

        // Ordenar por cantidad de estudiantes (descendente)
        const sortedEntries = Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Mostrar solo los top 10 grupos

        const sortedLabels = sortedEntries.map(([label]) => label);
        const sortedValues = sortedEntries.map(([, value]) => value);

        this.charts.students = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedLabels,
                datasets: [{
                    label: 'Estudiantes Activos',
                    data: sortedValues,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(23, 162, 184, 0.8)',
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(201, 203, 207, 0.8)',
                        'rgba(54, 162, 235, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(40, 167, 69, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)',
                        'rgba(23, 162, 184, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(201, 203, 207, 1)',
                        'rgba(54, 162, 235, 1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Estudiantes: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Cantidad de Estudiantes'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {
                            display: true,
                            text: 'Grupos'
                        }
                    }
                }
            }
        });
    }

    // Verificar automáticamente si hay pagos que deben marcarse como atrasados
    setupPaymentDateChecker() {
        // Verificar cada hora si hay pagos pendientes que deben marcarse como atrasados
        this.paymentCheckInterval = setInterval(() => {
            this.loadPaymentsChart();
        }, 60 * 60 * 1000); // Cada hora

        // También verificar inmediatamente al cargar
        this.loadPaymentsChart();
    }

    // Determinar si un pago está atrasado basado en el status y la fecha del mes
    isPaymentOverdue(payment, currentDate = new Date()) {
        // Si el pago ya está marcado como atrasado, retornar true
        if (payment.status === 'overdue') {
            return true;
        }

        // Si el pago está pagado, no está atrasado
        if (payment.status === 'paid') {
            return false;
        }

        // Si el pago está pendiente, verificar si ya pasó el mes del pago
        if (payment.status === 'pending') {
            const paymentMonth = payment.month; // Formato: YYYY-MM
            if (!paymentMonth) return false;

            const [year, month] = paymentMonth.split('-').map(Number);
            // Considerar atrasado si ya pasó el mes del pago (final del mes)
            const monthEnd = new Date(year, month, 0); // Último día del mes
            
            // Si la fecha actual es después del final del mes del pago, está atrasado
            return currentDate > monthEnd;
        }

        return false;
    }

    // Obtener el estado de pago de un estudiante para el mes actual
    getStudentPaymentStatus(studentId, payments, currentDate = new Date()) {
        const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
        
        // Buscar pagos del estudiante para el mes actual
        const studentPayments = Object.values(payments).filter(payment => 
            payment.studentId === studentId && payment.month === currentMonth
        );

        if (studentPayments.length === 0) {
            // No hay pago registrado para este mes
            // Si ya pasó el mes actual, está atrasado; si no, está pendiente
            const [year, month] = currentMonth.split('-').map(Number);
            const monthEnd = new Date(year, month, 0); // Último día del mes actual
            
            return currentDate > monthEnd ? 'Atrasado' : 'Pendiente';
        }

        // Verificar si tiene algún pago pagado
        const hasPaid = studentPayments.some(p => p.status === 'paid');
        if (hasPaid) {
            return 'Pagado';
        }

        // Verificar si tiene algún pago atrasado (status overdue o pending que pasó su mes)
        const hasOverdue = studentPayments.some(p => this.isPaymentOverdue(p, currentDate));
        if (hasOverdue) {
            return 'Atrasado';
        }

        // Si tiene pagos pendientes pero no están atrasados
        const hasPending = studentPayments.some(p => p.status === 'pending');
        if (hasPending) {
            return 'Pendiente';
        }

        // Por defecto, pendiente
        return 'Pendiente';
    }

    async loadPaymentsChart() {
        try {
            const studentsRef = ref(db, 'students');
            const paymentsRef = ref(db, 'payments');
            
            const [studentsSnapshot, paymentsSnapshot] = await Promise.all([
                get(studentsRef),
                get(paymentsRef)
            ]);

            const statusData = {
                'Pagado': 0,
                'Pendiente': 0,
                'Atrasado': 0
            };

            if (!studentsSnapshot.exists()) {
                this.renderPaymentsChart(statusData);
                return;
            }

            const students = studentsSnapshot.val();
            const payments = paymentsSnapshot.exists() ? paymentsSnapshot.val() : {};
            const currentDate = new Date();

            // Contar estudiantes activos por estado de pago
            Object.entries(students).forEach(([studentId, student]) => {
                // Solo contar estudiantes activos
                if (student.status !== 'active') {
                    return;
                }

                const paymentStatus = this.getStudentPaymentStatus(
                    studentId,
                    payments,
                    currentDate
                );

                if (statusData.hasOwnProperty(paymentStatus)) {
                    statusData[paymentStatus]++;
                }
            });

            this.renderPaymentsChart(statusData);
        } catch (error) {
            console.error('Error al cargar gráfico de pagos:', error);
        }
    }

    renderPaymentsChart(data) {
        let ctx = document.getElementById('paymentsChart');
        const chartContainer = ctx ? ctx.parentElement : null;
        if (!chartContainer) return;

        // Si el canvas no existe, restaurarlo
        if (!ctx) {
            chartContainer.innerHTML = `
                <h3>Estado de Pagos</h3>
                <canvas id="paymentsChart"></canvas>
            `;
            ctx = document.getElementById('paymentsChart');
        }

        // Destruir gráfico existente
        if (this.charts.payments) {
            this.charts.payments.destroy();
        }

        // Ordenar los datos: Pagado, Pendiente, Atrasado
        const labels = ['Pagado', 'Pendiente', 'Atrasado'];
        const values = labels.map(label => data[label] || 0);

        // Calcular total de estudiantes activos
        const totalStudents = values.reduce((sum, val) => sum + val, 0);

        // Si no hay estudiantes activos, mostrar mensaje
        if (totalStudents === 0) {
            chartContainer.innerHTML = `
                <h3>Estado de Pagos</h3>
                <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: #666;">
                    <p>No hay estudiantes activos</p>
                </div>
            `;
            return;
        }

        this.charts.payments = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',   // Pagado - Verde
                        'rgba(255, 193, 7, 0.8)',   // Pendiente - Amarillo
                        'rgba(220, 53, 69, 0.8)'    // Atrasado - Rojo
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} estudiantes (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    // Método para refrescar todos los datos
    async refresh() {
        try {
            await this.loadStats();
            await this.loadCharts();
        } catch (error) {
            console.error('Error al refrescar dashboard:', error);
        }
    }

    // Limpiar suscripciones al destruir el módulo
    destroy() {
        if (this.unsubscribeStudents) {
            this.unsubscribeStudents();
        }
        if (this.unsubscribeCourses) {
            this.unsubscribeCourses();
        }
        if (this.unsubscribeGroups) {
            this.unsubscribeGroups();
        }
        if (this.unsubscribePayments) {
            this.unsubscribePayments();
        }
        if (this.unsubscribeStudentsForPayments) {
            this.unsubscribeStudentsForPayments();
        }
        if (this.paymentCheckInterval) {
            clearInterval(this.paymentCheckInterval);
        }
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

export default DashboardManager;
