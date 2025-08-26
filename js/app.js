import { auth } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class App {
    constructor() {
        this.currentSection = 'dashboard';
        this.initialized = false;
        this.realtimeManager = realtimeManager;
        this.init();
    }

    async init() {
        try {
            await this.setupEventListeners();
            await this.setupNavigation();
            
            // Inicializar sistema de tiempo real
            this.realtimeManager.init();
            
            // Configurar indicador de estado en tiempo real
            this.setupRealtimeStatusIndicator();
            
            console.log('Aplicación inicializada correctamente');
            this.initialized = true;
        } catch (error) {
            console.error('Error al inicializar la aplicación:', error);
        }
    }

    setupEventListeners() {
        // Event listener para cambios de autenticación
        auth.onAuthStateChanged((user) => {
            if (user && this.initialized) {
                this.loadDashboardData();
            }
        });

        // Event listeners para modales
        this.setupModalListeners();
        
        // Event listeners para formularios
        this.setupFormListeners();
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });
    }

    setupRealtimeStatusIndicator() {
        const indicator = document.getElementById('realtimeIndicator');
        const text = document.getElementById('realtimeText');
        
        if (!indicator || !text) return;
        
        // Función para actualizar el estado
        const updateStatus = (status, message) => {
            indicator.className = `status-indicator ${status}`;
            text.textContent = message;
        };
        
        // Estado inicial
        updateStatus('connecting', 'Conectando...');
        
        // Verificar estado cada 5 segundos
        setInterval(() => {
            if (this.realtimeManager.isConnected()) {
                updateStatus('connected', 'Conectado');
            } else {
                updateStatus('disconnected', 'Desconectado');
            }
        }, 5000);
        
        // Verificar estado inmediatamente
        setTimeout(() => {
            if (this.realtimeManager.isConnected()) {
                updateStatus('connected', 'Conectado');
            } else {
                updateStatus('connecting', 'Conectando...');
            }
        }, 1000);
    }

    navigateToSection(sectionName) {
        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar la sección seleccionada
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Actualizar navegación
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        this.currentSection = sectionName;

        // Cargar datos específicos de la sección
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        try {
            switch (sectionName) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'courses':
                    if (window.coursesManager) {
                        await window.coursesManager.loadCourses();
                    }
                    break;
                case 'students':
                    if (window.studentsManager) {
                        await window.studentsManager.loadStudents();
                        await window.studentsManager.loadCourseOptions();
                    }
                    break;
                case 'payments':
                    if (window.paymentsManager) {
                        await window.paymentsManager.loadPayments();
                        await window.paymentsManager.loadFilters();
                    }
                    break;
                case 'attendance':
                    if (window.attendanceManager) {
                        await window.attendanceManager.loadAllData();
                    }
                    break;
                case 'reports':
                    if (window.reportsManager) {
                        await window.reportsManager.loadReports();
                    }
                    break;
                case 'users':
                    if (window.usersManager && window.authManager.isAdmin()) {
                        await window.usersManager.loadUsers();
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error al cargar datos de la sección ${sectionName}:`, error);
            this.showNotification('Error al cargar los datos', 'error');
        }
    }

    async loadDashboardData() {
        try {
            // Cargar estadísticas del dashboard
            if (window.dashboardManager) {
                await window.dashboardManager.loadStats();
                await window.dashboardManager.loadCharts();
            }
        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
        }
    }

    setupModalListeners() {
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeModal();
                }
            });
        }

        // Event listener para cerrar modal con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    setupFormListeners() {
        // Los formularios específicos se configuran en sus respectivos managers
        // Aquí solo configuramos listeners globales
        
        document.addEventListener('submit', (e) => {
            // Prevenir envío de formularios no manejados
            if (!e.target.classList.contains('handled')) {
                e.preventDefault();
            }
        });
    }

    // Utilidades para modales
    showModal(content) {
        const modalContent = document.getElementById('modalContent');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (modalContent && modalOverlay) {
            modalContent.innerHTML = content;
            modalOverlay.classList.add('show');
            
            // Configurar botón de cerrar
            const closeBtn = modalContent.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }
        }
    }

    closeModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
        }
    }

    // Sistema de notificaciones
    showNotification(message, type = 'info', duration = 3000) {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="close-notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Agregar estilos si no existen
        this.addNotificationStyles();

        // Agregar al DOM
        document.body.appendChild(notification);

        // Mostrar con animación
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto-ocultar
        const hideTimeout = setTimeout(() => {
            this.hideNotification(notification);
        }, duration);

        // Botón de cerrar
        const closeBtn = notification.querySelector('.close-notification');
        closeBtn.addEventListener('click', () => {
            clearTimeout(hideTimeout);
            this.hideNotification(notification);
        });
    }

    hideNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                color: #333;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                min-width: 300px;
                max-width: 400px;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-success {
                border-left: 4px solid #28a745;
            }
            
            .notification-error {
                border-left: 4px solid #dc3545;
            }
            
            .notification-warning {
                border-left: 4px solid #ffc107;
            }
            
            .notification-info {
                border-left: 4px solid #17a2b8;
            }
            
            .notification i {
                font-size: 18px;
            }
            
            .notification-success i {
                color: #28a745;
            }
            
            .notification-error i {
                color: #dc3545;
            }
            
            .notification-warning i {
                color: #ffc107;
            }
            
            .notification-info i {
                color: #17a2b8;
            }
            
            .close-notification {
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
            }
            
            .close-notification:hover {
                color: #333;
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Utilidades de validación
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    // Formateo de datos
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(date));
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

    // Utilidades de loading
    showLoading(element, text = 'Cargando...') {
        element.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${text}</span>
            </div>
        `;
    }

    hideLoading(element, originalContent) {
        element.innerHTML = originalContent;
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

export default App;
