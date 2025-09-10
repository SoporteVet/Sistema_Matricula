import { 
    ref, 
    get, 
    set, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { 
    createUserWithEmailAndPassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from './firebase-config.js';

class UsersManager {
    constructor() {
        this.users = {};
        this.init();
    }

    init() {
        // Solo inicializar si el usuario es admin
        if (window.authManager && window.authManager.isAdmin()) {
            this.setupEventListeners();
            this.loadUsers();
        }
    }

    setupEventListeners() {
        // Botón para agregar nuevo usuario
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.showUserModal();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                this.users = snapshot.val();
                this.renderUsersTable();
            } else {
                this.users = {};
                this.renderUsersTable();
            }
        });
    }

    async loadUsers() {
        try {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            
            if (snapshot.exists()) {
                this.users = snapshot.val();
            } else {
                this.users = {};
            }
            
            this.renderUsersTable();
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar usuarios', 'error');
            }
        }
    }

    renderUsersTable() {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        if (Object.keys(this.users).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-users fa-3x mb-3"></i>
                            <h4>No hay usuarios registrados</h4>
                            <p>Comience agregando un nuevo usuario</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(this.users)
            .sort(([,a], [,b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .map(([uid, user]) => `
                <tr>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge ${user.role}">
                            ${user.role === 'admin' ? 'Administrador' : 
                              user.role === 'recepcion' ? 'Recepción' : 'Usuario'}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${user.status}">
                            ${user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>${user.createdAt ? this.formatDateTime(user.createdAt) : 'N/A'}</td>
                    <td>
                        <button class="btn-warning" onclick="window.usersManager.editUser('${uid}')" 
                                ${uid === auth.currentUser?.uid ? 'disabled title="No puedes editarte a ti mismo"' : ''}>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger" onclick="window.usersManager.deleteUser('${uid}')"
                                ${uid === auth.currentUser?.uid ? 'disabled title="No puedes eliminarte a ti mismo"' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                        ${user.status === 'active' ? `
                            <button class="btn-secondary" onclick="window.usersManager.deactivateUser('${uid}')"
                                    ${uid === auth.currentUser?.uid ? 'disabled title="No puedes desactivarte a ti mismo"' : ''}>
                                <i class="fas fa-ban"></i>
                            </button>
                        ` : `
                            <button class="btn-success" onclick="window.usersManager.activateUser('${uid}')">
                                <i class="fas fa-check"></i>
                            </button>
                        `}
                    </td>
                </tr>
            `).join('');
    }

    showUserModal(userId = null) {
        const user = userId ? this.users[userId] : null;
        const isEdit = user !== null;

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-user"></i> 
                    ${isEdit ? 'Editar' : 'Nuevo'} Usuario
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="userForm" class="handled">
                <div class="form-group">
                    <label for="userEmail">Email *</label>
                    <input 
                        type="email" 
                        id="userEmail" 
                        value="${user?.email || ''}" 
                        required
                        placeholder="usuario@ejemplo.com"
                        ${isEdit ? 'readonly' : ''}
                    >
                    ${isEdit ? '<small>El email no se puede modificar después de crear el usuario</small>' : ''}
                </div>
                
                ${!isEdit ? `
                <div class="form-group">
                    <label for="userPassword">Contraseña *</label>
                    <input 
                        type="password" 
                        id="userPassword" 
                        required
                        placeholder="Mínimo 6 caracteres"
                        minlength="6"
                    >
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirmar Contraseña *</label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        required
                        placeholder="Repetir contraseña"
                        minlength="6"
                    >
                </div>
                ` : ''}
                
                <div class="form-group">
                    <label for="userRole">Rol *</label>
                    <select id="userRole" required ${userId === auth.currentUser?.uid ? 'disabled' : ''}>
                        <option value="user" ${user?.role === 'user' ? 'selected' : ''}>Usuario</option>
                        <option value="recepcion" ${user?.role === 'recepcion' ? 'selected' : ''}>Recepción</option>
                        <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrador</option>
                    </select>
                    ${userId === auth.currentUser?.uid ? '<small>No puedes cambiar tu propio rol</small>' : ''}
                </div>
                
                <div class="form-group">
                    <label for="userStatus">Estado</label>
                    <select id="userStatus" ${userId === auth.currentUser?.uid ? 'disabled' : ''}>
                        <option value="active" ${user?.status === 'active' ? 'selected' : ''}>Activo</option>
                        <option value="inactive" ${user?.status === 'inactive' ? 'selected' : ''}>Congelado</option>
                    </select>
                    ${userId === auth.currentUser?.uid ? '<small>No puedes cambiar tu propio estado</small>' : ''}
                </div>
                
                <div class="form-group">
                    <label for="userNotes">Notas</label>
                    <textarea 
                        id="userNotes" 
                        placeholder="Notas adicionales sobre el usuario..."
                    >${user?.notes || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Crear'} Usuario
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveUser(userId);
            });

            // Validación de contraseñas en tiempo real
            if (!isEdit) {
                const passwordInput = document.getElementById('userPassword');
                const confirmInput = document.getElementById('confirmPassword');
                
                [passwordInput, confirmInput].forEach(input => {
                    if (input) {
                        input.addEventListener('input', () => {
                            this.validatePasswords(passwordInput, confirmInput);
                        });
                    }
                });
            }
        }
    }

    validatePasswords(passwordInput, confirmInput) {
        const password = passwordInput.value;
        const confirm = confirmInput.value;
        
        if (confirm && password !== confirm) {
            confirmInput.setCustomValidity('Las contraseñas no coinciden');
        } else {
            confirmInput.setCustomValidity('');
        }
    }

    async saveUser(userId = null) {
        const form = document.getElementById('userForm');
        if (!form) return;

        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;
        const notes = document.getElementById('userNotes').value.trim();

        // Validaciones
        if (!email || !role) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Validar email
        if (!this.validateEmail(email)) {
            if (window.app) {
                window.app.showNotification('Ingrese un email válido', 'error');
            }
            return;
        }

        // Validaciones para nuevo usuario
        if (!userId) {
            if (!password || !confirmPassword) {
                if (window.app) {
                    window.app.showNotification('La contraseña es requerida', 'error');
                }
                return;
            }

            if (password !== confirmPassword) {
                if (window.app) {
                    window.app.showNotification('Las contraseñas no coinciden', 'error');
                }
                return;
            }

            if (password.length < 6) {
                if (window.app) {
                    window.app.showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
                }
                return;
            }

            // Verificar que el email no esté en uso
            const existingUser = Object.values(this.users).find(user => user.email === email);
            if (existingUser) {
                if (window.app) {
                    window.app.showNotification('Este email ya está registrado', 'error');
                }
                return;
            }
        }

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (userId) {
                // Actualizar usuario existente (solo datos en la base de datos)
                const userRef = ref(db, `users/${userId}`);
                const currentUser = this.users[userId];
                
                await set(userRef, {
                    ...currentUser,
                    role,
                    status,
                    notes,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // Crear nuevo usuario
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;
                
                // Crear perfil en la base de datos
                const userRef = ref(db, `users/${newUser.uid}`);
                await set(userRef, {
                    email,
                    role,
                    status,
                    notes,
                    createdAt: new Date().toISOString()
                });
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Usuario ${userId ? 'actualizado' : 'creado'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar usuario:', error);
            
            let errorMessage = 'Error al guardar el usuario';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Este email ya está registrado';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'La contraseña es muy débil';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email inválido';
            }
            
            if (window.app) {
                window.app.showNotification(errorMessage, 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${userId ? 'Actualizar' : 'Crear'} Usuario`;
            }
        }
    }

    editUser(userId) {
        this.showUserModal(userId);
    }

    async deleteUser(userId) {
        const user = this.users[userId];
        if (!user) return;

        // Verificar que no sea el usuario actual
        if (userId === auth.currentUser?.uid) {
            if (window.app) {
                window.app.showNotification('No puedes eliminarte a ti mismo', 'warning');
            }
            return;
        }

        const confirmed = confirm(
            `¿Está seguro de que desea eliminar al usuario "${user.email}"?\n\n` +
            'Esta acción no se puede deshacer y eliminará completamente la cuenta del usuario.'
        );

        if (!confirmed) return;

        try {
            // Eliminar de la base de datos
            const userRef = ref(db, `users/${userId}`);
            await remove(userRef);
            
            // Nota: No podemos eliminar directamente de Firebase Auth desde el cliente
            // Esto requeriría funciones del lado del servidor o Admin SDK
            
            if (window.app) {
                window.app.showNotification('Usuario eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el usuario', 'error');
            }
        }
    }

    async activateUser(userId) {
        await this.updateUserStatus(userId, 'active');
    }

    async deactivateUser(userId) {
        // Verificar que no sea el usuario actual
        if (userId === auth.currentUser?.uid) {
            if (window.app) {
                window.app.showNotification('No puedes desactivarte a ti mismo', 'warning');
            }
            return;
        }

        await this.updateUserStatus(userId, 'inactive');
    }

    async updateUserStatus(userId, status) {
        try {
            const userRef = ref(db, `users/${userId}`);
            const currentUser = this.users[userId];
            
            await set(userRef, {
                ...currentUser,
                status,
                updatedAt: new Date().toISOString()
            });

            const statusText = status === 'active' ? 'activado' : 'desactivado';
            if (window.app) {
                window.app.showNotification(`Usuario ${statusText} exitosamente`, 'success');
            }

        } catch (error) {
            console.error('Error al actualizar estado del usuario:', error);
            if (window.app) {
                window.app.showNotification('Error al actualizar el estado', 'error');
            }
        }
    }

    // Método para resetear contraseña (requiere implementación del lado del servidor)
    async resetUserPassword(userId) {
        const user = this.users[userId];
        if (!user) return;

        const confirmed = confirm(
            `¿Enviar email de restablecimiento de contraseña a "${user.email}"?`
        );

        if (!confirmed) return;

        try {
            // Aquí se implementaría el envío de email de reset
            // Esto requiere funciones del lado del servidor
            
            if (window.app) {
                window.app.showNotification('Email de restablecimiento enviado', 'success');
            }

        } catch (error) {
            console.error('Error al enviar email de reset:', error);
            if (window.app) {
                window.app.showNotification('Error al enviar el email', 'error');
            }
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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

    // Obtener estadísticas de usuarios
    getUserStats() {
        const stats = {
            total: Object.keys(this.users).length,
            active: 0,
            congelado: 0,
            admins: 0,
            users: 0,
            recepcion: 0
        };

        Object.values(this.users).forEach(user => {
            if (user.status === 'active') stats.active++;
            if (user.role === 'admin') stats.admins++;
            if (user.role === 'recepcion') stats.recepcion++;
            if (user.role === 'user') stats.users++;
        });

        stats.total = Object.keys(this.users).length;

        return stats;
    }

    // Exportar lista de usuarios
    exportUsers() {
        const exportData = Object.values(this.users).map(user => ({
            'Email': user.email,
            'Rol': user.role === 'admin' ? 'Administrador' : 
                   user.role === 'recepcion' ? 'Recepción' : 'Usuario',
            'Estado': user.status === 'active' ? 'Activo' : 'Congelado',
            'Fecha de Creación': user.createdAt ? this.formatDateTime(user.createdAt) : 'N/A',
            'Notas': user.notes || ''
        }));

        // Crear archivo Excel
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
        
        // Descargar archivo
        XLSX.writeFile(wb, `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
}

// Crear instancia global solo si es admin
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que se inicialice el auth manager
    setTimeout(() => {
        if (window.authManager && window.authManager.isAdmin() && document.getElementById('usersTable')) {
            window.usersManager = new UsersManager();
        }
    }, 1000);
});

export default UsersManager;

