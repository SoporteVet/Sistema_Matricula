// js/modulos/recepcion.js
import { renderSidebar, renderSection } from '../helpers.js';

export default function loadRecepcionModule() {
  renderSidebar([
    { id: 'matricula', label: 'Matrícula' },
    { id: 'estudiantes', label: 'Estudiantes' },
    { id: 'asistencia', label: 'Asistencia' },
    { id: 'logout', label: 'Cerrar sesión', special: true }
  ]);

  renderSection('Bienvenido/a al módulo de Recepción. Selecciona una opción del menú.');

  document.getElementById('sidebar').onclick = (e) => {
    if (e.target.dataset.id) {
      if (e.target.dataset.id === 'logout') {
        window.logout();
        return;
      }
      renderSection(`Cargando módulo: <b>${e.target.textContent}</b> (aquí irá la interfaz real)`);
    }
  };
}
