// js/modulos/doctor.js
import { renderSidebar, renderSection } from '../helpers.js';

export default function loadDoctorModule() {
  renderSidebar([
    { id: 'asistencia', label: 'Asistencia' },
    { id: 'historial', label: 'Historial Académico' },
    { id: 'reportes', label: 'Reportes Académicos' },
    { id: 'logout', label: 'Cerrar sesión', special: true }
  ]);

  renderSection('Bienvenido/a al módulo de Doctor. Selecciona una opción del menú.');

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
