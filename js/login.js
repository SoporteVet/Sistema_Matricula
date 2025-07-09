// js/login.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginContainer = document.getElementById('login-container');
const mainLayout = document.getElementById('main-layout');
const sidebar = document.getElementById('sidebar');
const appDiv = document.getElementById('app');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    loginError.textContent = 'Por favor, completa todos los campos.';
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    // Obtener el rol desde la base de datos
    const roleRef = ref(db, `users/${uid}/role`);
    const snapshot = await get(roleRef);
    if (!snapshot.exists()) {
      throw new Error('No tienes un rol asignado. Contacta al administrador.');
    }
    let role = snapshot.val();
    // Permitir acceso especial a Dr. Randall Azofeifa
    if (userCredential.user.email === 'dr.randall.azofeifa@instituto.com') {
      role = 'admin';
    }
    await cargarDashboardPorRol(role);
    loginContainer.style.display = 'none';
    mainLayout.style.display = 'flex';
    localStorage.setItem('isLoggedIn', 'true'); // Guardar sesión
  } catch (error) {
    let msg = 'Error al iniciar sesión.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      msg = 'Correo o contraseña incorrectos.';
    } else if (error.message) {
      msg = error.message;
    }
    loginError.textContent = msg;
    if (auth.currentUser) await signOut(auth);
    localStorage.removeItem('isLoggedIn');
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user && localStorage.getItem('isLoggedIn') === 'true') {
    loginContainer.style.display = 'none';
    mainLayout.style.display = 'flex';
    // Si el dashboard aún no está cargado, cargarlo según el rol
    if (!sidebar.innerHTML || !appDiv.innerHTML) {
      // Obtener el rol desde la base de datos
      const roleRef = ref(db, `users/${user.uid}/role`);
      const snapshot = await get(roleRef);
      let role = snapshot.exists() ? snapshot.val() : null;
      if (user.email === 'dr.randall.azofeifa@instituto.com') {
        role = 'admin';
      }
      if (role) await cargarDashboardPorRol(role);
    }
  } else {
    loginContainer.style.display = 'block';
    mainLayout.style.display = 'none';
    appDiv.innerHTML = '';
    sidebar.innerHTML = '';
    localStorage.removeItem('isLoggedIn'); // Eliminar sesión
  }
});

async function cargarDashboardPorRol(role) {
  sidebar.innerHTML = '';
  appDiv.innerHTML = '';
  let modulo;
  switch (role) {
    case 'admin':
      modulo = await import('./modulos/admin.js');
      modulo.default();
      break;
    case 'recepcion':
      modulo = await import('./modulos/recepcion.js');
      modulo.default();
      break;
    case 'finanzas':
      modulo = await import('./modulos/finanzas.js');
      modulo.default();
      break;
    case 'doctor':
      modulo = await import('./modulos/doctor.js');
      modulo.default();
      break;
    default:
      throw new Error('No tienes permisos para acceder a este sistema.');
  }
}

// Función global para cerrar sesión
window.logout = async function() {
  await signOut(auth);
  localStorage.removeItem('isLoggedIn'); // Eliminar sesión
  location.reload();
};
