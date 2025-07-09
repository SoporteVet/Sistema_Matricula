// js/modulos/finanzas.js
import { renderSidebar, renderSection } from '../helpers.js';

export default function loadFinanzasModule() {
  renderSidebar([
    { id: 'pagos', label: 'Pagos' },
    { id: 'reportes', label: 'Reportes Financieros' },
    { id: 'exportar', label: 'Exportar Datos' },
    { id: 'logout', label: 'Cerrar sesión', special: true }
  ]);

  renderSection('Bienvenido/a al módulo de Finanzas. Selecciona una opción del menú.');

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
