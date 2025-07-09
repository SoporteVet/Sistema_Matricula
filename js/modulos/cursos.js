// js/modulos/cursos.js
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
  renderSection(`
    <div class="grid fade-in">
      <div class="card hover-card">
        <h2 class="paw-icon">Gestión de Cursos</h2>
        <p class="text-muted">Administra los cursos del instituto: crea, edita, elimina y visualiza información detallada de cada curso.</p>
        <form id="curso-form" class="card scale-in" style="margin-top:20px; box-shadow:none; border-top:none;">
          <input type="hidden" id="curso-id">
          <div class="grid">
            <div>
              <label for="curso-codigo">Código</label>
              <input type="text" id="curso-codigo" placeholder="Código del curso" required>
            </div>
            <div>
              <label for="curso-nombre">Nombre</label>
              <input type="text" id="curso-nombre" placeholder="Nombre del curso" required>
            </div>
          </div>
          <div class="grid">
            <div>
              <label for="curso-duracion">Duración (meses)</label>
              <input type="number" id="curso-duracion" placeholder="Duración" min="1" max="60" required>
            </div>
            <div>
              <label for="curso-modalidad">Modalidad</label>
              <select id="curso-modalidad">
                <option value="Presencial">Presencial</option>
                <option value="Virtual">Virtual</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
          </div>
          <div class="grid">
            <div>
              <label for="curso-cupo">Cupo máximo</label>
              <input type="number" id="curso-cupo" placeholder="Cupo máximo" min="1" max="200" required>
            </div>
            <div>
              <label for="curso-estado">Estado</label>
              <select id="curso-estado">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <label for="curso-descripcion">Descripción</label>
          <textarea id="curso-descripcion" placeholder="Descripción del curso" rows="2"></textarea>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="btn-accent">Guardar</button>
            <button type="button" id="curso-cancelar" class="btn-secondary" style="display:none;">Cancelar</button>
          </div>
        </form>
      </div>
      <div class="card hover-card">
        <h3>Cursos Registrados</h3>
        <div id="cursos-lista"></div>
      </div>
    </div>
    <div class="card hover-card" style="margin-top:30px;">
      <h3>Estadísticas de Cursos</h3>
      <div id="cursos-stats" class="grid"></div>
    </div>
  `);
  cargarCursos();
  document.getElementById('curso-form').onsubmit = guardarCurso;
  document.getElementById('curso-cancelar').onclick = limpiarFormulario;
}

function cargarCursos() {
  const lista = document.getElementById('cursos-lista');
  const statsDiv = document.getElementById('cursos-stats');
  onValue(cursosRef, (snapshot) => {
    let html = `<table class="fade-in"><thead><tr><th>Código</th><th>Nombre</th><th>Duración</th><th>Modalidad</th><th>Cupo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>`;
    let total = 0, activos = 0, virtuales = 0, presenciales = 0, mixtos = 0;
    snapshot.forEach(child => {
      const curso = child.val();
      total++;
      if (curso.estado === 'Activo') activos++;
      if (curso.modalidad === 'Virtual') virtuales++;
      if (curso.modalidad === 'Presencial') presenciales++;
      if (curso.modalidad === 'Mixta') mixtos++;
      html += `<tr>
        <td>${curso.codigo}</td>
        <td><b>${curso.nombre}</b><br><small class="text-muted">${curso.descripcion || ''}</small></td>
        <td>${curso.duracion || '-'} meses</td>
        <td>${curso.modalidad || '-'}</td>
        <td>${curso.cupo || '-'}</td>
        <td><span class="badge badge-${curso.estado === 'Activo' ? 'success' : 'error'}">${curso.estado}</span></td>
        <td>
          <button class="action-btn view-btn" data-tooltip="Ver" data-id="${child.key}"></button>
          <button class="action-btn edit-btn" data-tooltip="Editar" data-id="${child.key}"></button>
          <button class="action-btn delete-btn" data-tooltip="Eliminar" data-id="${child.key}"></button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
    lista.innerHTML = html;
    lista.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = editarCurso);
    lista.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = eliminarCurso);
    lista.querySelectorAll('.view-btn').forEach(btn => btn.onclick = verCurso);
    // Estadísticas
    if (statsDiv) {
      statsDiv.innerHTML = `
        <div class="card hover-card"><b>Total cursos:</b> ${total}</div>
        <div class="card hover-card"><b>Activos:</b> ${activos}</div>
        <div class="card hover-card"><b>Virtuales:</b> ${virtuales}</div>
        <div class="card hover-card"><b>Presenciales:</b> ${presenciales}</div>
        <div class="card hover-card"><b>Mixtos:</b> ${mixtos}</div>
      `;
    }
  });
}

function guardarCurso(e) {
  e.preventDefault();
  const id = document.getElementById('curso-id').value;
  const codigo = document.getElementById('curso-codigo').value.trim();
  const nombre = document.getElementById('curso-nombre').value.trim();
  const duracion = document.getElementById('curso-duracion').value.trim();
  const modalidad = document.getElementById('curso-modalidad').value;
  const cupo = document.getElementById('curso-cupo').value.trim();
  const estado = document.getElementById('curso-estado').value;
  const descripcion = document.getElementById('curso-descripcion').value.trim();
  if (!codigo || !nombre || !duracion || !modalidad || !cupo || !estado) return;
  const data = { codigo, nombre, duracion, modalidad, cupo, estado, descripcion };
  if (id) {
    update(ref(db, 'cursos/' + id), data);
  } else {
    const nuevoRef = push(cursosRef);
    set(nuevoRef, data);
  }
  limpiarFormulario();
}

function editarCurso(e) {
  const id = e.currentTarget.dataset.id;
  onValue(ref(db, 'cursos/' + id), (snap) => {
    const curso = snap.val();
    document.getElementById('curso-id').value = id;
    document.getElementById('curso-codigo').value = curso.codigo;
    document.getElementById('curso-nombre').value = curso.nombre;
    document.getElementById('curso-duracion').value = curso.duracion || '';
    document.getElementById('curso-modalidad').value = curso.modalidad || 'Presencial';
    document.getElementById('curso-cupo').value = curso.cupo || '';
    document.getElementById('curso-estado').value = curso.estado || 'Activo';
    document.getElementById('curso-descripcion').value = curso.descripcion || '';
    document.getElementById('curso-cancelar').style.display = 'inline-block';
  }, { onlyOnce: true });
}

function eliminarCurso(e) {
  const id = e.currentTarget.dataset.id;
  if (confirm('¿Eliminar este curso?')) {
    remove(ref(db, 'cursos/' + id));
  }
}

function verCurso(e) {
  const id = e.currentTarget.dataset.id;
  onValue(ref(db, 'cursos/' + id), (snap) => {
    const curso = snap.val();
    renderSection(`
      <div class="card scale-in">
        <h2 class="paw-icon">${curso.nombre}</h2>
        <div class="grid">
          <div><b>Código:</b> ${curso.codigo}</div>
          <div><b>Duración:</b> ${curso.duracion} meses</div>
          <div><b>Modalidad:</b> ${curso.modalidad}</div>
          <div><b>Cupo máximo:</b> ${curso.cupo}</div>
          <div><b>Estado:</b> <span class="badge badge-${curso.estado === 'Activo' ? 'success' : 'error'}">${curso.estado}</span></div>
        </div>
        <p style="margin-top:20px;"><b>Descripción:</b><br>${curso.descripcion || '<i>Sin descripción</i>'}</p>
        <button class="btn btn-accent" onclick="window.loadCursosModule()">Volver a la lista</button>
      </div>
    `);
    window.loadCursosModule = loadCursosModule;
  }, { onlyOnce: true });
}

function limpiarFormulario() {
  document.getElementById('curso-id').value = '';
  document.getElementById('curso-codigo').value = '';
  document.getElementById('curso-nombre').value = '';
  document.getElementById('curso-duracion').value = '';
  document.getElementById('curso-modalidad').value = 'Presencial';
  document.getElementById('curso-cupo').value = '';
  document.getElementById('curso-estado').value = 'Activo';
  document.getElementById('curso-descripcion').value = '';
  document.getElementById('curso-cancelar').style.display = 'none';
}
