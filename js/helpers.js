// js/helpers.js

// Renderiza el menú lateral dinámicamente
export function renderSidebar(items) {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `<ul class="sidebar-menu">
    ${items.map(item => `
      <li>
        <button data-id="${item.id}" class="${item.special ? 'logout-btn' : ''}">${item.label}</button>
      </li>`).join('')}
  </ul>`;
}

// Renderiza el contenido principal en #app
export function renderSection(html) {
  const app = document.getElementById('app');
  app.innerHTML = `<section class="main-section">${html}</section>`;
}
