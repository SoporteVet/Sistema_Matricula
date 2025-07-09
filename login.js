// login.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginContainer = document.getElementById('login-container');
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
    const role = snapshot.val();
    // Cargar el módulo correspondiente
    await loadRoleModule(role);
    loginContainer.style.display = 'none';
    appDiv.style.display = 'block';
  } catch (error) {
    let msg = 'Error al iniciar sesión.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      msg = 'Correo o contraseña incorrectos.';
    } else if (error.message) {
      msg = error.message;
    }
    loginError.textContent = msg;
    // Cerrar sesión si hay error de rol
    if (auth.currentUser) await signOut(auth);
  }
});

async function loadRoleModule(role) {
  appDiv.innerHTML = '';
  switch (role) {
    case 'admin':
      await import('./admin.js').then(m => m.default());
      break;
    case 'recepcion':
      // await import('./recepcion.js').then(m => m.default());
      appDiv.innerHTML = '<h2>Módulo Recepción (demo)</h2>';
      break;
    case 'finanzas':
      // await import('./finanzas.js').then(m => m.default());
      appDiv.innerHTML = '<h2>Módulo Finanzas (demo)</h2>';
      break;
    case 'doctor':
      // await import('./doctor.js').then(m => m.default());
      appDiv.innerHTML = '<h2>Módulo Doctor (demo)</h2>';
      break;
    default:
      throw new Error('No tienes permisos para acceder a este sistema.');
  }
}

// Opcional: cerrar sesión si el usuario no está autenticado
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
onAuthStateChanged(auth, (user) => {
  if (!user) {
    loginContainer.style.display = 'block';
    appDiv.style.display = 'none';
    appDiv.innerHTML = '';
  }
});
