// js/modulos/cursos-nuevo.js
import { renderSection } from '../helpers.js';
import { db } from '../firebase-config.js';
import { ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let cursosRef = ref(db, 'cursos');
let cursos = [];
let cursoEditando = null;

export default function loadCursosModule() {
  renderSection(renderCursos());
  cargarCursos();
  configurarEventos();
}

function renderCursos() {
  return `
    <div class="main-content animate-fade-in">
      <!-- Header -->
      <div class="header">
        <h1>Gestión de Cursos</h1>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="abrirModalCrearCurso()">
            <i class="fas fa-plus"></i>
            Nuevo Curso
          </button>
        </div>
      </div>

      <!-- Cards de Estadísticas -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon blue">
              <i class="fas fa-graduation-cap"></i>
            </div>
            <div class="stat-card-menu">
              <i class="fas fa-ellipsis-h"></i>
            </div>
          </div>
          <div class="stat-card-value" id="total-cursos">0</div>
          <div class="stat-card-label">Total Cursos</div>
          <div class="stat-card-change positive">
            <i class="fas fa-arrow-up"></i>
            +12% vs mes anterior
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon green">
              <i class="fas fa-users"></i>
            </div>
            <div class="stat-card-menu">
              <i class="fas fa-ellipsis-h"></i>
            </div>
          </div>
          <div class="stat-card-value" id="estudiantes-matriculados">0</div>
          <div class="stat-card-label">Estudiantes Matriculados</div>
          <div class="stat-card-change positive">
            <i class="fas fa-arrow-up"></i>
            +8% vs mes anterior
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon purple">
              <i class="fas fa-play-circle"></i>
            </div>
            <div class="stat-card-menu">
              <i class="fas fa-ellipsis-h"></i>
            </div>
          </div>
          <div class="stat-card-value" id="cursos-activos">0</div>
          <div class="stat-card-label">Cursos Activos</div>
          <div class="stat-card-change positive">
            <i class="fas fa-arrow-up"></i>
            +3% vs mes anterior
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon orange">
              <i class="fas fa-dollar-sign"></i>
            </div>
            <div class="stat-card-menu">
              <i class="fas fa-ellipsis-h"></i>
            </div>
          </div>
          <div class="stat-card-value">$24,580</div>
          <div class="stat-card-label">Ingresos Mensuales</div>
          <div class="stat-card-change positive">
            <i class="fas fa-arrow-up"></i>
            +15% vs mes anterior
          </div>
        </div>
      </div>

      <!-- Sección Principal con Tabs -->
      <div class="main-section">
        <div class="section-header">
          <h2 class="section-title">Lista de Cursos</h2>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab active" onclick="cambiarTab('todos')" data-tab="todos">
            Todos los Cursos
          </button>
          <button class="tab" onclick="cambiarTab('activos')" data-tab="activos">
            Activos
          </button>
          <button class="tab" onclick="cambiarTab('inactivos')" data-tab="inactivos">
            Inactivos
          </button>
          <button class="tab" onclick="cambiarTab('proximos')" data-tab="proximos">
            Próximos
          </button>
        </div>

        <!-- Buscador -->
        <div class="search-section">
          <div class="search-bar">
            <input 
              type="text" 
              class="search-input" 
              placeholder="Buscar cursos..."
              id="buscar-curso"
              onkeyup="buscarCursos()"
            >
            <button class="search-btn" onclick="buscarCursos()">
              <i class="fas fa-search"></i>
              Buscar
            </button>
          </div>
        </div>

        <!-- Tabla de Cursos -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Código</th>
                <th>Duración</th>
                <th>Modalidad</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="lista-cursos">
              <!-- Los cursos se cargarán aquí dinámicamente -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal para Crear/Editar Curso -->
    <div id="modal-curso" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title" id="titulo-modal">Nuevo Curso</h3>
          <button class="modal-close" onclick="cerrarModalCurso()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="form-curso">
            <div class="form-group">
              <label class="form-label">Código del Curso</label>
              <input type="text" class="form-input" id="curso-codigo" placeholder="Código del curso" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre del Curso</label>
              <input type="text" class="form-input" id="curso-nombre" placeholder="Nombre del curso" required>
            </div>
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea class="form-textarea" id="curso-descripcion" placeholder="Descripción del curso" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Duración (meses)</label>
              <input type="number" class="form-input" id="curso-duracion" placeholder="Duración en meses" min="1" max="60" required>
            </div>
            <div class="form-group">
              <label class="form-label">Modalidad</label>
              <select class="form-select" id="curso-modalidad">
                <option value="Presencial">Presencial</option>
                <option value="Virtual">Virtual</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cupo Máximo</label>
              <input type="number" class="form-input" id="curso-cupo" placeholder="Cupo máximo" min="1" max="200" required>
            </div>
            <div class="form-group">
              <label class="form-label">Estado</label>
              <select class="form-select" id="curso-estado">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="cerrarModalCurso()">
            Cancelar
          </button>
          <button class="btn btn-primary" onclick="guardarCurso()">
            <i class="fas fa-save"></i>
            Guardar Curso
          </button>
        </div>
      </div>
    </div>
  `;
}

function configurarEventos() {
  // Hacer funciones globales para que puedan ser llamadas desde el HTML
  window.abrirModalCrearCurso = abrirModalCrearCurso;
  window.cerrarModalCurso = cerrarModalCurso;
  window.guardarCurso = guardarCurso;
  window.editarCurso = editarCurso;
  window.eliminarCurso = eliminarCurso;
  window.verCurso = verCurso;
  window.cambiarTab = cambiarTab;
  window.buscarCursos = buscarCursos;
}

function cargarCursos() {
  onValue(cursosRef, (snapshot) => {
    cursos = [];
    snapshot.forEach(child => {
      cursos.push({
        id: child.key,
        ...child.val()
      });
    });
    actualizarEstadisticas();
    mostrarCursos(cursos);
  });
}

function actualizarEstadisticas() {
  const total = cursos.length;
  const activos = cursos.filter(c => c.estado === 'Activo').length;
  
  const totalElement = document.getElementById('total-cursos');
  const activosElement = document.getElementById('cursos-activos');
  const estudiantesElement = document.getElementById('estudiantes-matriculados');
  
  if (totalElement) totalElement.textContent = total;
  if (activosElement) activosElement.textContent = activos;
  if (estudiantesElement) estudiantesElement.textContent = total * 15; // Estimación
}

function mostrarCursos(cursosAMostrar) {
  const lista = document.getElementById('lista-cursos');
  if (!lista) return;
  
  let html = '';
  
  if (cursosAMostrar.length === 0) {
    html = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-graduation-cap" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
          <br>No hay cursos registrados
        </td>
      </tr>
    `;
  } else {
    cursosAMostrar.forEach(curso => {
      html += `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${curso.nombre}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${curso.descripcion || 'Sin descripción'}</div>
          </td>
          <td>
            <span style="font-family: monospace; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">
              ${curso.codigo}
            </span>
          </td>
          <td>${curso.duracion || '-'} meses</td>
          <td>
            <span class="badge ${getModalidadBadge(curso.modalidad)}">${curso.modalidad || '-'}</span>
          </td>
          <td>${curso.cupo || '-'}</td>
          <td>
            <span class="badge ${curso.estado === 'Activo' ? 'success' : 'danger'}">
              ${curso.estado}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm btn-secondary" onclick="verCurso('${curso.id}')" title="Ver detalles">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-sm btn-primary" onclick="editarCurso('${curso.id}')" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="eliminarCurso('${curso.id}')" title="Eliminar">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  }
  
  lista.innerHTML = html;
}

function getModalidadBadge(modalidad) {
  switch (modalidad) {
    case 'Virtual': return 'info';
    case 'Presencial': return 'success';
    case 'Mixta': return 'warning';
    default: return 'secondary';
  }
}

function abrirModalCrearCurso() {
  cursoEditando = null;
  const tituloElement = document.getElementById('titulo-modal');
  if (tituloElement) tituloElement.textContent = 'Nuevo Curso';
  limpiarFormulario();
  const modal = document.getElementById('modal-curso');
  if (modal) modal.style.display = 'flex';
}

function cerrarModalCurso() {
  const modal = document.getElementById('modal-curso');
  if (modal) modal.style.display = 'none';
  limpiarFormulario();
}

function guardarCurso() {
  const codigo = document.getElementById('curso-codigo')?.value.trim();
  const nombre = document.getElementById('curso-nombre')?.value.trim();
  const descripcion = document.getElementById('curso-descripcion')?.value.trim();
  const duracion = document.getElementById('curso-duracion')?.value.trim();
  const modalidad = document.getElementById('curso-modalidad')?.value;
  const cupo = document.getElementById('curso-cupo')?.value.trim();
  const estado = document.getElementById('curso-estado')?.value;
  
  if (!codigo || !nombre || !duracion || !cupo) {
    alert('Por favor complete todos los campos requeridos.');
    return;
  }
  
  const data = {
    codigo,
    nombre,
    descripcion,
    duracion: parseInt(duracion),
    modalidad,
    cupo: parseInt(cupo),
    estado,
    fechaCreacion: new Date().toISOString()
  };
  
  if (cursoEditando) {
    update(ref(db, 'cursos/' + cursoEditando), data);
  } else {
    const nuevoRef = push(cursosRef);
    set(nuevoRef, data);
  }
  
  cerrarModalCurso();
}

function editarCurso(id) {
  const curso = cursos.find(c => c.id === id);
  if (!curso) return;
  
  cursoEditando = id;
  const tituloElement = document.getElementById('titulo-modal');
  if (tituloElement) tituloElement.textContent = 'Editar Curso';
  
  const codigoElement = document.getElementById('curso-codigo');
  const nombreElement = document.getElementById('curso-nombre');
  const descripcionElement = document.getElementById('curso-descripcion');
  const duracionElement = document.getElementById('curso-duracion');
  const modalidadElement = document.getElementById('curso-modalidad');
  const cupoElement = document.getElementById('curso-cupo');
  const estadoElement = document.getElementById('curso-estado');
  
  if (codigoElement) codigoElement.value = curso.codigo || '';
  if (nombreElement) nombreElement.value = curso.nombre || '';
  if (descripcionElement) descripcionElement.value = curso.descripcion || '';
  if (duracionElement) duracionElement.value = curso.duracion || '';
  if (modalidadElement) modalidadElement.value = curso.modalidad || 'Presencial';
  if (cupoElement) cupoElement.value = curso.cupo || '';
  if (estadoElement) estadoElement.value = curso.estado || 'Activo';
  
  const modal = document.getElementById('modal-curso');
  if (modal) modal.style.display = 'flex';
}

function eliminarCurso(id) {
  const curso = cursos.find(c => c.id === id);
  if (!curso) return;
  
  if (confirm(`¿Está seguro de que desea eliminar el curso "${curso.nombre}"?`)) {
    remove(ref(db, 'cursos/' + id));
  }
}

function verCurso(id) {
  const curso = cursos.find(c => c.id === id);
  if (!curso) return;
  
  renderSection(`
    <div class="main-content animate-fade-in">
      <div class="header">
        <h1>Detalles del Curso</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="window.loadCursosModuleNuevo()">
            <i class="fas fa-arrow-left"></i>
            Volver
          </button>
          <button class="btn btn-primary" onclick="editarCurso('${curso.id}')">
            <i class="fas fa-edit"></i>
            Editar
          </button>
        </div>
      </div>
      
      <div class="main-section">
        <div class="section-header">
          <h2 class="section-title">${curso.nombre}</h2>
        </div>
        
        <div style="padding: 24px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
            <div>
              <h4 style="margin-bottom: 16px; color: var(--text-primary);">Información General</h4>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div><strong>Código:</strong> <span style="font-family: monospace; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${curso.codigo}</span></div>
                <div><strong>Duración:</strong> ${curso.duracion} meses</div>
                <div><strong>Modalidad:</strong> <span class="badge ${getModalidadBadge(curso.modalidad)}">${curso.modalidad}</span></div>
                <div><strong>Cupo máximo:</strong> ${curso.cupo} estudiantes</div>
                <div><strong>Estado:</strong> <span class="badge ${curso.estado === 'Activo' ? 'success' : 'danger'}">${curso.estado}</span></div>
              </div>
            </div>
            
            <div>
              <h4 style="margin-bottom: 16px; color: var(--text-primary);">Descripción</h4>
              <p style="color: var(--text-secondary); line-height: 1.6;">
                ${curso.descripcion || 'Sin descripción disponible.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
  
  // Mantener las funciones globales
  window.loadCursosModuleNuevo = loadCursosModule;
  window.editarCurso = editarCurso;
}

function cambiarTab(filtro) {
  // Actualizar tabs activos
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const tabActivo = document.querySelector(`[data-tab="${filtro}"]`);
  if (tabActivo) {
    tabActivo.classList.add('active');
  }
  
  // Filtrar cursos
  let cursosFiltrados = cursos;
  
  switch (filtro) {
    case 'activos':
      cursosFiltrados = cursos.filter(c => c.estado === 'Activo');
      break;
    case 'inactivos':
      cursosFiltrados = cursos.filter(c => c.estado === 'Inactivo');
      break;
    case 'proximos':
      cursosFiltrados = cursos.filter(c => c.estado === 'Activo');
      break;
    default:
      cursosFiltrados = cursos;
  }
  
  mostrarCursos(cursosFiltrados);
}

function buscarCursos() {
  const inputElement = document.getElementById('buscar-curso');
  if (!inputElement) return;
  
  const termino = inputElement.value.toLowerCase().trim();
  
  if (!termino) {
    mostrarCursos(cursos);
    return;
  }
  
  const cursosFiltrados = cursos.filter(curso => 
    curso.nombre.toLowerCase().includes(termino) ||
    curso.codigo.toLowerCase().includes(termino) ||
    (curso.descripcion && curso.descripcion.toLowerCase().includes(termino)) ||
    curso.modalidad.toLowerCase().includes(termino)
  );
  
  mostrarCursos(cursosFiltrados);
}

function limpiarFormulario() {
  const elementos = ['curso-codigo', 'curso-nombre', 'curso-descripcion', 'curso-duracion', 'curso-cupo'];
  elementos.forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.value = '';
  });
  
  const modalidadElement = document.getElementById('curso-modalidad');
  const estadoElement = document.getElementById('curso-estado');
  
  if (modalidadElement) modalidadElement.value = 'Presencial';
  if (estadoElement) estadoElement.value = 'Activo';
}
