import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    ref, 
    set, 
    get, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from './firebase-config.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.setupAuthListener();
        this.setupLoginForm();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userRole = await this.getUserRole(user.uid);
                    this.currentUser = user;
                    this.userRole = userRole;
                    this.showDashboard();
                    this.updateUserInterface();
                } catch (error) {
                    console.error('Error al obtener rol del usuario:', error);
                    this.showError('Error al cargar los datos del usuario');
                }
            } else {
                this.currentUser = null;
                this.userRole = null;
                this.showLogin();
            }
        });
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        if (!email || !password) {
            this.showError('Por favor, complete todos los campos');
            return;
        }

        try {
            // Deshabilitar el botón de submit
            const submitBtn = document.querySelector('#loginForm button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';

            await signInWithEmailAndPassword(auth, email, password);
            
            // El listener de onAuthStateChanged se encargará de mostrar el dashboard
            
        } catch (error) {
            console.error('Error de autenticación:', error);
            let errorMessage = 'Error al iniciar sesión';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no encontrado';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Demasiados intentos fallidos. Intente más tarde';
                    break;
                default:
                    errorMessage = 'Error al iniciar sesión. Verifique sus credenciales';
            }
            
            this.showError(errorMessage);
        } finally {
            // Rehabilitar el botón
            const submitBtn = document.querySelector('#loginForm button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        }
    }

    async handleLogout() {
        try {
            await signOut(auth);
            // El listener de onAuthStateChanged se encargará de mostrar el login
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            this.showError('Error al cerrar sesión');
        }
    }

    async getUserRole(uid) {
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return snapshot.val().role || 'user';
        } else {
            // Si el usuario no existe en la base de datos, crear con rol de usuario
            await this.createUserProfile(uid, 'user');
            return 'user';
        }
    }

    async createUserProfile(uid, role = 'user') {
        const userRef = ref(db, `users/${uid}`);
        const userData = {
            email: auth.currentUser.email,
            role: role,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        await set(userRef, userData);
        return userData;
    }

    // Función para crear usuarios (solo admin)
    async createUser(email, password, role = 'user') {
        if (this.userRole !== 'admin') {
            throw new Error('No tienes permisos para crear usuarios');
        }

        try {
            // Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Crear perfil en la base de datos
            await this.createUserProfile(user.uid, role);
            
            return user;
        } catch (error) {
            throw error;
        }
    }

    showLogin() {
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('dashboardPage').classList.remove('active');
        document.body.classList.remove('user-role-admin', 'user-role-user');
        
        // Limpiar formulario
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').classList.remove('show');
    }

    showDashboard() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('dashboardPage').classList.add('active');
    }

    updateUserInterface() {
        const userEmailElement = document.getElementById('userEmail');
        const userRoleElement = document.getElementById('userRole');
        
        if (userEmailElement) {
            userEmailElement.textContent = this.currentUser.email;
        }
        
        if (userRoleElement) {
            const roleText = this.userRole === 'admin' ? 'Administrador' : 
                           this.userRole === 'recepcion' ? 'Recepción' : 'Usuario';
            userRoleElement.textContent = roleText;
            userRoleElement.className = `role-badge ${this.userRole}`;
        }

        // Agregar clase al body para controlar visibilidad de elementos admin
        document.body.classList.remove('user-role-admin', 'user-role-user', 'user-role-recepcion');
        document.body.classList.add(`user-role-${this.userRole}`);

        // Configurar permisos usando el sistema de permisos
        if (window.permissionsManager) {
            window.permissionsManager.setUserRole(this.userRole);
            window.permissionsManager.applyUIPermissions();
        } else {
            // Fallback al método anterior si el sistema de permisos no está disponible
            this.updateUIPermissions();
        }
    }

    updateUIPermissions() {
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        const receptionRestrictedElements = document.querySelectorAll('.nav-link[data-section="reports"], .nav-link[data-section="users"]');
        
        // Manejar elementos solo para admin
        adminOnlyElements.forEach(element => {
            if (this.userRole === 'admin') {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        // Manejar elementos restringidos para recepción
        receptionRestrictedElements.forEach(element => {
            if (this.userRole === 'admin') {
                element.style.display = '';
            } else if (this.userRole === 'recepcion') {
                element.style.display = 'none';
            } else {
                // Usuario regular - mantener comportamiento actual
                element.style.display = '';
            }
        });
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
            
            // Ocultar error después de 5 segundos
            setTimeout(() => {
                errorDiv.classList.remove('show');
            }, 5000);
        }
    }

    // Verificar si el usuario está autenticado
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Verificar si el usuario es admin
    isAdmin() {
        return this.userRole === 'admin';
    }

    // Verificar si el usuario es recepción
    isRecepcion() {
        return this.userRole === 'recepcion';
    }

    // Obtener información del usuario actual
    getCurrentUser() {
        return {
            user: this.currentUser,
            role: this.userRole
        };
    }

    // Inicializar usuarios admin por defecto (solo para desarrollo)
    async initializeDefaultUsers() {
        // Crear admin por defecto si no existe
        const adminEmail = 'admin@institutosmp.com';
        const adminPassword = 'admin123456';
        
        try {
            // Verificar si ya existe
            const adminRef = ref(db, 'users');
            const snapshot = await get(adminRef);
            
            let adminExists = false;
            if (snapshot.exists()) {
                const users = snapshot.val();
                adminExists = Object.values(users).some(user => 
                    user.email === adminEmail && user.role === 'admin'
                );
            }
            
            if (!adminExists) {
                // Crear admin
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                await this.createUserProfile(userCredential.user.uid, 'admin');
                console.log('Usuario admin creado:', adminEmail);
            }
        } catch (error) {
            console.log('Admin ya existe o error al crear:', error.message);
        }

        // Crear recepción por defecto si no existe
        const recepcionEmail = 'recepcion@institutosmp.com';
        const recepcionPassword = 'recepcion123456';
        
        try {
            // Verificar si ya existe
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            
            let recepcionExists = false;
            if (snapshot.exists()) {
                const users = snapshot.val();
                recepcionExists = Object.values(users).some(user => 
                    user.email === recepcionEmail && user.role === 'recepcion'
                );
            }
            
            if (!recepcionExists) {
                // Crear recepción
                const userCredential = await createUserWithEmailAndPassword(auth, recepcionEmail, recepcionPassword);
                await this.createUserProfile(userCredential.user.uid, 'recepcion');
                console.log('Usuario recepción creado:', recepcionEmail);
            }
        } catch (error) {
            console.log('Recepción ya existe o error al crear:', error.message);
        }
    }
}

// Crear instancia global del manejador de autenticación
window.authManager = new AuthManager();

// Inicializar usuarios por defecto (solo en desarrollo)
// window.authManager.initializeDefaultUsers();

export default AuthManager;

