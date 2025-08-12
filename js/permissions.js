// Configuración de permisos por rol
export const PERMISSIONS = {
    admin: {
        sections: ['dashboard', 'courses', 'students', 'groups', 'payments', 'attendance', 'academic-history', 'reports', 'users'],
        actions: ['create', 'read', 'update', 'delete', 'export', 'manage_users']
    },
    recepcion: {
        sections: ['dashboard', 'courses', 'students', 'groups', 'payments', 'attendance', 'academic-history'],
        actions: ['create', 'read', 'update', 'delete', 'export']
    },
    user: {
        sections: ['dashboard', 'students', 'payments', 'attendance'],
        actions: ['read']
    }
};

class PermissionsManager {
    constructor() {
        this.currentUserRole = null;
    }

    setUserRole(role) {
        this.currentUserRole = role;
    }

    // Verificar si el usuario tiene acceso a una sección
    canAccessSection(section) {
        if (!this.currentUserRole) return false;
        
        const userPermissions = PERMISSIONS[this.currentUserRole];
        return userPermissions && userPermissions.sections.includes(section);
    }

    // Verificar si el usuario puede realizar una acción
    canPerformAction(action) {
        if (!this.currentUserRole) return false;
        
        const userPermissions = PERMISSIONS[this.currentUserRole];
        return userPermissions && userPermissions.actions.includes(action);
    }

    // Obtener secciones permitidas para el rol actual
    getAllowedSections() {
        if (!this.currentUserRole) return [];
        
        const userPermissions = PERMISSIONS[this.currentUserRole];
        return userPermissions ? userPermissions.sections : [];
    }

    // Obtener acciones permitidas para el rol actual
    getAllowedActions() {
        if (!this.currentUserRole) return [];
        
        const userPermissions = PERMISSIONS[this.currentUserRole];
        return userPermissions ? userPermissions.actions : [];
    }

    // Aplicar permisos a la interfaz de usuario
    applyUIPermissions() {
        if (!this.currentUserRole) return;

        // Ocultar/mostrar secciones de navegación
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(link => {
            const section = link.getAttribute('data-section');
            if (this.canAccessSection(section)) {
                link.style.display = '';
                link.parentElement.style.display = '';
            } else {
                link.style.display = 'none';
                link.parentElement.style.display = 'none';
            }
        });

        // Manejar elementos específicos por rol
        this.handleRoleSpecificElements();
    }

    handleRoleSpecificElements() {
        // Elementos solo para admin
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(element => {
            if (this.currentUserRole === 'admin') {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        // Elementos que recepción no puede ver
        const receptionRestrictedElements = document.querySelectorAll('.reception-restricted');
        receptionRestrictedElements.forEach(element => {
            if (this.currentUserRole === 'recepcion') {
                element.style.display = 'none';
            } else {
                element.style.display = '';
            }
        });

        // Ocultar botones de acciones no permitidas
        const actionButtons = document.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            if (this.canPerformAction(action)) {
                button.style.display = '';
            } else {
                button.style.display = 'none';
            }
        });
    }

    // Verificar permisos para operaciones específicas
    checkPermission(section, action = 'read') {
        return this.canAccessSection(section) && this.canPerformAction(action);
    }

    // Obtener mensaje de error para permisos insuficientes
    getPermissionErrorMessage(section, action = 'access') {
        const messages = {
            admin: 'Esta función requiere permisos de administrador.',
            recepcion: 'No tienes permisos para acceder a esta función.',
            user: 'Permisos insuficientes para realizar esta acción.'
        };

        return messages[this.currentUserRole] || 'Permisos insuficientes.';
    }
}

// Crear instancia global
window.permissionsManager = new PermissionsManager();

export default PermissionsManager; 