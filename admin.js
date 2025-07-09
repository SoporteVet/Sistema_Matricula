// admin.js
export default function loadAdminModule() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h2>Panel de Administración</h2>
    <nav>
      <button onclick="showSection('cursos')">Cursos</button>
      <button onclick="showSection('grupos')">Grupos</button>
      <button onclick="showSection('pagos')">Pagos</button>
      <button onclick="showSection('reportes')">Reportes</button>
      <button onclick="logout()" style="float:right;">Cerrar sesión</button>
    </nav>
    <section id="admin-section">
      <p>Selecciona un módulo para gestionar.</p>
    </section>
  `;
  window.showSection = function(section) {
    const sectionDiv = document.getElementById('admin-section');
    switch(section) {
      case 'cursos':
        sectionDiv.innerHTML = '<h3>Gestión de Cursos</h3><p>Ejemplo de interfaz de cursos.</p>';
        break;
      case 'grupos':
        sectionDiv.innerHTML = '<h3>Gestión de Grupos</h3><p>Ejemplo de interfaz de grupos.</p>';
        break;
      case 'pagos':
        sectionDiv.innerHTML = '<h3>Gestión de Pagos</h3><p>Ejemplo de interfaz de pagos.</p>';
        break;
      case 'reportes':
        sectionDiv.innerHTML = '<h3>Reportes</h3><p>Ejemplo de reportes administrativos.</p>';
        break;
      default:
        sectionDiv.innerHTML = '<p>Selecciona un módulo para gestionar.</p>';
    }
  };
  window.logout = async function() {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const { auth } = await import('./firebase-config.js');
    await signOut(auth);
    location.reload();
  };
}
