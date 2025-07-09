// js/modulos/admin.js
import { renderSidebar, renderSection } from '../helpers.js';

export default function loadAdminModule() {
  // Menú lateral para admin
  renderSidebar([
    { id: 'cursos', label: 'Cursos' },
    { id: 'grupos', label: 'Grupos' },
    { id: 'estudiantes', label: 'Estudiantes' },
    { id: 'matricula', label: 'Matrícula' },
    { id: 'pagos', label: 'Pagos' },
    { id: 'asistencia', label: 'Asistencia' },
    { id: 'historial', label: 'Historial Académico' },
    { id: 'reportes', label: 'Reportes' },
    { id: 'exportar', label: 'Exportar Datos' },
    { id: 'logout', label: 'Cerrar sesión', special: true }
  ]);

  // Cargar sección por defecto
  renderSection('Bienvenido/a al panel de administración. Selecciona una opción del menú.');

  // Manejar clicks del menú
  document.getElementById('sidebar').onclick = async (e) => {
    if (e.target.dataset.id) {
      if (e.target.dataset.id === 'logout') {
        window.logout();
        return;
      }
      // Importar módulo real según el id
      switch (e.target.dataset.id) {
        case 'cursos':
          (await import('./cursos-nuevo.js')).default();
          break;
        default:
          renderSection(`Cargando módulo: <b>${e.target.textContent}</b> (aquí irá la interfaz real)`);
      }
    }
  };
}
