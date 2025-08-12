import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class DashboardManager {
    constructor() {
        this.charts = {};
        this.stats = {
            totalStudents: 0,
            totalCourses: 0,
            monthlyRevenue: 0,
            pendingPayments: 0
        };
        this.init();
    }

    init() {
        this.setupChartJS();
    }

    setupChartJS() {
        // Configuración global de Chart.js
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            Chart.defaults.plugins.legend.position = 'bottom';
            Chart.defaults.plugins.legend.labels.padding = 20;
        }
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
            const coursesRef = ref(db, 'courses');
            
            const [studentsSnapshot, coursesSnapshot] = await Promise.all([
                get(studentsRef),
                get(coursesRef)
            ]);

            const courseData = {};
            
            // Inicializar contadores de cursos
            if (coursesSnapshot.exists()) {
                const courses = coursesSnapshot.val();
                Object.values(courses).forEach(course => {
                    if (course.status === 'active') {
                        courseData[course.name] = 0;
                    }
                });
            }

            // Contar estudiantes por curso
            if (studentsSnapshot.exists()) {
                const students = studentsSnapshot.val();
                Object.values(students).forEach(student => {
                    if (student.course && courseData.hasOwnProperty(student.course)) {
                        courseData[student.course]++;
                    }
                });
            }

            this.renderStudentsChart(courseData);
        } catch (error) {
            console.error('Error al cargar gráfico de estudiantes:', error);
        }
    }

    renderStudentsChart(data) {
        const ctx = document.getElementById('studentsChart');
        if (!ctx) return;

        // Destruir gráfico existente
        if (this.charts.students) {
            this.charts.students.destroy();
        }

        const labels = Object.keys(data);
        const values = Object.values(data);

        this.charts.students = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Estudiantes',
                    data: values,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(23, 162, 184, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(40, 167, 69, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)',
                        'rgba(23, 162, 184, 1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async loadPaymentsChart() {
        try {
            const paymentsRef = ref(db, 'payments');
            const snapshot = await get(paymentsRef);

            const statusData = {
                'Pagado': 0,
                'Pendiente': 0,
                'Atrasado': 0
            };

            if (snapshot.exists()) {
                const payments = snapshot.val();
                Object.values(payments).forEach(payment => {
                    switch (payment.status) {
                        case 'paid':
                            statusData['Pagado']++;
                            break;
                        case 'pending':
                            statusData['Pendiente']++;
                            break;
                        case 'overdue':
                            statusData['Atrasado']++;
                            break;
                    }
                });
            }

            this.renderPaymentsChart(statusData);
        } catch (error) {
            console.error('Error al cargar gráfico de pagos:', error);
        }
    }

    renderPaymentsChart(data) {
        const ctx = document.getElementById('paymentsChart');
        if (!ctx) return;

        // Destruir gráfico existente
        if (this.charts.payments) {
            this.charts.payments.destroy();
        }

        const labels = Object.keys(data);
        const values = Object.values(data);

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
                plugins: {
                    legend: {
                        position: 'bottom'
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

    // Actualizar datos en tiempo real
    setupRealTimeUpdates() {
        // Escuchar cambios en estudiantes
        const studentsRef = ref(db, 'students');
        onValue(studentsRef, () => {
            this.loadStats();
            this.loadStudentsChart();
        });

        // Escuchar cambios en cursos
        const coursesRef = ref(db, 'courses');
        onValue(coursesRef, () => {
            this.loadStats();
            this.loadStudentsChart();
        });

        // Escuchar cambios en pagos
        const paymentsRef = ref(db, 'payments');
        onValue(paymentsRef, () => {
            this.loadStats();
            this.loadPaymentsChart();
        });
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
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

export default DashboardManager;
