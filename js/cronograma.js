import { db } from './firebase-config.js';
import { 
    ref, 
    get, 
    push, 
    set, 
    remove 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

class CronogramaManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.currentView = 'month';
        this.events = [];
        this.filteredEvents = [];
        this.groups = [];
        this.initialized = false;
        console.log('CronogramaManager constructor ejecutado');
    }

    async init() {
        if (this.initialized) {
            console.log('CronogramaManager ya está inicializado');
            return;
        }
        
        try {
            console.log('Iniciando CronogramaManager...');
            this.setupEventListeners();
            
            // Cargar grupos y eventos en paralelo
            await Promise.all([
                this.loadGroups(),
                this.loadEvents()
            ]);
            
            this.renderCalendar();
            this.loadGroupFilters();
            this.initialized = true;
            console.log('Cronograma Manager inicializado correctamente');
        } catch (error) {
            console.error('Error al inicializar Cronograma Manager:', error);
            // Intentar cargar grupos después si falla
            setTimeout(() => {
                this.loadGroups().then(() => {
                    this.loadGroupFilters();
                });
            }, 2000);
        }
    }

    setupEventListeners() {
        // Navegación del calendario
        document.getElementById('prevMonth')?.addEventListener('click', () => this.previousMonth());
        document.getElementById('nextMonth')?.addEventListener('click', () => this.nextMonth());

        // Vistas del calendario
        document.getElementById('monthView')?.addEventListener('click', () => this.setView('month'));
        document.getElementById('weekView')?.addEventListener('click', () => this.setView('week'));
        document.getElementById('dayView')?.addEventListener('click', () => this.setView('day'));

        // Botón nuevo evento
        document.getElementById('addEventBtn')?.addEventListener('click', () => this.showAddEventModal());

        // Filtros
        document.getElementById('eventTypeFilter')?.addEventListener('change', () => this.filterEvents());
        document.getElementById('eventGroupFilter')?.addEventListener('change', () => this.filterEvents());
        document.getElementById('eventSearch')?.addEventListener('input', () => this.filterEvents());

        // Escuchar cambios en el GroupsManager
        this.setupGroupsSync();
    }

    async loadGroups() {
        try {
            console.log('Cargando grupos desde Realtime Database...');
            
            // Usar la misma fuente que el sistema de grupos (Realtime Database)
            const groupsRef = ref(db, 'groups');
            const snapshot = await get(groupsRef);
            
            this.groups = [];
            if (snapshot.exists()) {
                const groupsData = snapshot.val();
                Object.keys(groupsData).forEach(key => {
                    const groupData = groupsData[key];
                    console.log('Grupo encontrado:', key, groupData);
                    
                    // Buscar el nombre en diferentes campos posibles
                    const groupName = groupData.name || 
                                    groupData.groupName || 
                                    groupData.title || 
                                    groupData.displayName ||
                                    `Grupo ${key}`;
                    
                    this.groups.push({
                        id: key,
                        name: groupName,
                        ...groupData
                    });
                });
            }
            
            console.log('Grupos cargados desde Realtime Database:', this.groups.length);
            
            // Si no hay grupos, usar los del GroupsManager si está disponible
            if (this.groups.length === 0 && window.groupsManager && window.groupsManager.groups) {
                console.log('Usando grupos del GroupsManager...');
                this.groups = Object.keys(window.groupsManager.groups).map(key => {
                    const groupData = window.groupsManager.groups[key];
                    return {
                        id: key,
                        name: groupData.name || groupData.groupName || `Grupo ${key}`,
                        ...groupData
                    };
                });
            }
            
            // Si aún no hay grupos, crear algunos de ejemplo
            if (this.groups.length === 0) {
                this.groups = [
                    { id: 'general', name: 'General' },
                    { id: 'grupo1', name: 'Grupo 1' },
                    { id: 'grupo2', name: 'Grupo 2' }
                ];
                console.log('Usando grupos de ejemplo:', this.groups);
            }
            
        } catch (error) {
            console.error('Error al cargar grupos:', error);
            // Fallback a grupos de ejemplo
            this.groups = [
                { id: 'general', name: 'General' },
                { id: 'grupo1', name: 'Grupo 1' },
                { id: 'grupo2', name: 'Grupo 2' }
            ];
            console.log('Usando grupos de ejemplo por error:', this.groups);
        }
    }

    loadGroupFilters() {
        const groupFilter = document.getElementById('eventGroupFilter');
        if (groupFilter) {
            groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
            this.groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                groupFilter.appendChild(option);
            });
            console.log('Filtros de grupos actualizados:', this.groups.length, 'grupos');
        }
    }

    // Método para recargar grupos cuando sea necesario
    async refreshGroups() {
        await this.loadGroups();
        this.loadGroupFilters();
    }

    // Método para sincronizar con el GroupsManager
    syncWithGroupsManager() {
        if (window.groupsManager && window.groupsManager.groups) {
            console.log('Sincronizando con GroupsManager...');
            this.groups = Object.keys(window.groupsManager.groups).map(key => {
                const groupData = window.groupsManager.groups[key];
                console.log('Grupo del GroupsManager:', key, groupData);
                
                // Buscar el nombre en diferentes campos posibles
                const groupName = groupData.name || 
                                groupData.groupName || 
                                groupData.title || 
                                groupData.displayName ||
                                `Grupo ${key}`;
                
                return {
                    id: key,
                    name: groupName,
                    ...groupData
                };
            });
            this.loadGroupFilters();
            console.log('Grupos sincronizados:', this.groups.length);
            console.log('Nombres de grupos:', this.groups.map(g => g.name));
        }
    }

    // Configurar sincronización automática con GroupsManager
    setupGroupsSync() {
        // Verificar periódicamente si el GroupsManager está disponible
        const checkGroupsManager = () => {
            if (window.groupsManager && window.groupsManager.groups) {
                this.syncWithGroupsManager();
            } else {
                // Reintentar en 2 segundos
                setTimeout(checkGroupsManager, 2000);
            }
        };
        
        // Iniciar verificación después de 1 segundo
        setTimeout(checkGroupsManager, 1000);
    }

    async loadEvents() {
        try {
            console.log('Cargando eventos desde Realtime Database...');
            const eventsRef = ref(db, 'cronograma_events');
            const snapshot = await get(eventsRef);
            
            this.events = [];
            if (snapshot.exists()) {
                const eventsData = snapshot.val();
                Object.keys(eventsData).forEach(key => {
                    const eventData = eventsData[key];
                    // Crear fecha local sin problemas de zona horaria
                    let eventDate;
                    if (eventData.date) {
                        // Si es solo fecha (YYYY-MM-DD), crear fecha local
                        if (eventData.date.includes('T')) {
                            eventDate = new Date(eventData.date);
                        } else {
                            // Crear fecha local para evitar problemas de zona horaria
                            const [year, month, day] = eventData.date.split('-');
                            eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                            
                            // Si hay hora, agregarla
                            if (eventData.time) {
                                const [hours, minutes] = eventData.time.split(':');
                                eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            }
                        }
                    } else {
                        eventDate = new Date();
                    }
                    
                    this.events.push({
                        id: key,
                        ...eventData,
                        date: eventDate
                    });
                });
                
                // Ordenar por fecha
                this.events.sort((a, b) => new Date(a.date) - new Date(b.date));
            }
            
            this.filteredEvents = [...this.events];
            this.renderCalendar();
            this.renderEventsTable();
            console.log('Eventos cargados:', this.events.length);
        } catch (error) {
            console.error('Error al cargar eventos:', error);
        }
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }

    setView(view) {
        this.currentView = view;
        
        // Actualizar botones activos
        document.querySelectorAll('.calendar-views button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${view}View`)?.classList.add('active');

        this.renderCalendar();
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        const currentMonth = document.getElementById('currentMonth');
        
        if (!calendar || !currentMonth) return;

        // Actualizar título del mes
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        currentMonth.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;

        if (this.currentView === 'month') {
            this.renderMonthView(calendar);
        } else if (this.currentView === 'week') {
            this.renderWeekView(calendar);
        } else {
            this.renderDayView(calendar);
        }
    }

    renderMonthView(calendar) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Primer día del mes y último día
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '<div class="calendar-month">';
        
        // Encabezados de días
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        html += '<div class="calendar-header-days">';
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        html += '</div>';

        // Generar días del calendario
        html += '<div class="calendar-days">';
        const currentDate = new Date(startDate);
        
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = currentDate.getMonth() === month;
                const isToday = this.isToday(currentDate);
                const isSelected = this.isSameDate(currentDate, this.selectedDate);
                
                const dayEvents = this.getEventsForDate(currentDate);
                
                html += `
                    <div class="calendar-day ${isCurrentMonth ? 'current-month' : 'other-month'} 
                         ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
                         data-date="${currentDate.toISOString().split('T')[0]}"
                         onclick="cronogramaManager.selectDate('${currentDate.toISOString()}')">
                        <div class="day-number">${currentDate.getDate()}</div>
                        <div class="day-events">
                            ${dayEvents.slice(0, 3).map(event => 
                                `<div class="event-indicator ${event.type}" title="${event.title}">${event.title.substring(0, 15)}${event.title.length > 15 ? '...' : ''}</div>`
                            ).join('')}
                            ${dayEvents.length > 3 ? `<div class="more-events">+${dayEvents.length - 3} más</div>` : ''}
                        </div>
                    </div>
                `;
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        
        html += '</div></div>';
        calendar.innerHTML = html;
    }

    renderWeekView(calendar) {
        // Implementación básica de vista semanal
        const startOfWeek = new Date(this.selectedDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        let html = '<div class="calendar-week">';
        html += '<div class="week-header">';
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            const isToday = this.isToday(day);
            
            html += `
                <div class="week-day-header ${isToday ? 'today' : ''}">
                    <div class="day-name">${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][i]}</div>
                    <div class="day-number">${day.getDate()}</div>
                </div>
            `;
        }
        
        html += '</div>';
        html += '<div class="week-content">';
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            const dayEvents = this.getEventsForDate(day);
            
            html += `
                <div class="week-day" data-date="${day.toISOString().split('T')[0]}">
                    ${dayEvents.map(event => 
                        `<div class="week-event ${event.type}" onclick="cronogramaManager.showEventDetails('${event.id}')">
                            <div class="event-time">${this.formatTime(event.date)}</div>
                            <div class="event-title">${event.title}</div>
                        </div>`
                    ).join('')}
                </div>
            `;
        }
        
        html += '</div></div>';
        calendar.innerHTML = html;
    }

    renderDayView(calendar) {
        const dayEvents = this.getEventsForDate(this.selectedDate);
        
        let html = `
            <div class="calendar-day-view">
                <h3>${this.formatDate(this.selectedDate)}</h3>
                <div class="day-events-list">
        `;
        
        if (dayEvents.length === 0) {
            html += '<p class="no-events">No hay eventos programados para este día</p>';
        } else {
            dayEvents.forEach(event => {
                html += `
                    <div class="day-event ${event.type}" onclick="cronogramaManager.showEventDetails('${event.id}')">
                        <div class="event-time">${this.formatTime(event.date)}</div>
                        <div class="event-info">
                            <h4>${event.title}</h4>
                            <p>${event.description || ''}</p>
                            <span class="event-group">${this.getGroupName(event.groupId)}</span>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div></div>';
        calendar.innerHTML = html;
    }

    selectDate(dateString) {
        this.selectedDate = new Date(dateString);
        this.renderCalendar();
        this.updateEventsList();
    }

    updateEventsList() {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList) return;

        const dayEvents = this.getEventsForDate(this.selectedDate);
        
        if (dayEvents.length === 0) {
            eventsList.innerHTML = '<p class="no-events">No hay eventos para este día</p>';
        } else {
            eventsList.innerHTML = dayEvents.map(event => `
                <div class="event-item ${event.type}" onclick="cronogramaManager.showEventDetails('${event.id}')">
                    <div class="event-time">${this.formatTime(event.date)}</div>
                    <div class="event-details">
                        <h5>${event.title}</h5>
                        <p>${event.description || ''}</p>
                        <span class="event-group">${this.getGroupName(event.groupId)}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    getEventsForDate(date) {
        return this.filteredEvents.filter(event => 
            this.isSameDate(event.date, date)
        );
    }

    filterEvents() {
        const typeFilter = document.getElementById('eventTypeFilter')?.value || '';
        const groupFilter = document.getElementById('eventGroupFilter')?.value || '';
        const searchFilter = document.getElementById('eventSearch')?.value.toLowerCase() || '';

        this.filteredEvents = this.events.filter(event => {
            const matchesType = !typeFilter || event.type === typeFilter;
            const matchesGroup = !groupFilter || event.groupId === groupFilter;
            const matchesSearch = !searchFilter || 
                event.title.toLowerCase().includes(searchFilter) ||
                (event.description && event.description.toLowerCase().includes(searchFilter));

            return matchesType && matchesGroup && matchesSearch;
        });

        this.renderCalendar();
        this.renderEventsTable();
    }

    renderEventsTable() {
        const tbody = document.querySelector('#eventsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = this.filteredEvents.map(event => `
            <tr>
                <td>${this.formatDate(event.date)}</td>
                <td>${event.title}</td>
                <td><span class="status-badge ${event.type}">${this.getEventTypeLabel(event.type)}</span></td>
                <td>${this.getGroupName(event.groupId)}</td>
                <td>${event.description || '-'}</td>
                <td><span class="status-badge ${event.status || 'active'}">${this.getStatusLabel(event.status)}</span></td>
                <td>
                    <button class="btn-info" onclick="cronogramaManager.showEventDetails('${event.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-warning" onclick="cronogramaManager.editEvent('${event.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="cronogramaManager.deleteEvent('${event.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async showAddEventModal() {
        // Primero intentar sincronizar con GroupsManager
        this.syncWithGroupsManager();
        
        // Si no hay grupos, recargar desde la base de datos
        if (this.groups.length === 0) {
            await this.refreshGroups();
        }
        
        const modalContent = `
            <div class="modal-header">
                <h3>Nuevo Evento</h3>
                <button class="close-modal" onclick="app.closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="addEventForm" class="handled">
                <div class="form-group">
                    <label for="eventTitle">Título *</label>
                    <input type="text" id="eventTitle" required>
                </div>
                <div class="form-group">
                    <label for="eventType">Tipo *</label>
                    <input type="text" id="eventType" placeholder="Ej: Clase, Examen, Tarea, Evento, etc." required>
                </div>
                <div class="form-group">
                    <label for="eventDate">Fecha *</label>
                    <input type="date" id="eventDate" required>
                </div>
                <div class="form-group">
                    <label for="eventTime">Hora</label>
                    <input type="time" id="eventTime">
                </div>
                <div class="form-group">
                    <label for="eventGroup">Grupo</label>
                    <select id="eventGroup">
                        <option value="">Sin grupo específico</option>
                        ${this.groups.map(group => 
                            `<option value="${group.id}">${group.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="eventDescription">Descripción</label>
                    <textarea id="eventDescription" rows="3"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">Guardar Evento</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);

        // Configurar fecha por defecto
        const eventDate = document.getElementById('eventDate');
        if (eventDate) {
            eventDate.value = this.selectedDate.toISOString().split('T')[0];
        }

        // Configurar formulario
        document.getElementById('addEventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEvent();
        });
    }

    async saveEvent(eventId = null) {
        try {
            const title = document.getElementById('eventTitle').value;
            const type = document.getElementById('eventType').value;
            const dateStr = document.getElementById('eventDate').value;
            const timeStr = document.getElementById('eventTime').value;
            const groupId = document.getElementById('eventGroup').value;
            const description = document.getElementById('eventDescription').value;

            // Combinar fecha y hora - manejar zona horaria local
            let eventDate = new Date(dateStr + 'T00:00:00');
            if (timeStr) {
                const [hours, minutes] = timeStr.split(':');
                eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }

            const eventData = {
                title,
                type,
                date: eventDate.toISOString().split('T')[0], // Solo la fecha YYYY-MM-DD
                time: timeStr || null,
                groupId: groupId || null,
                description,
                status: 'active',
                createdAt: new Date().toISOString()
            };

            if (eventId) {
                // Actualizar evento existente
                const eventRef = ref(db, `cronograma_events/${eventId}`);
                await set(eventRef, eventData);
                window.app.showNotification('Evento actualizado correctamente', 'success');
            } else {
                // Crear nuevo evento
                const eventsRef = ref(db, 'cronograma_events');
                await push(eventsRef, eventData);
                window.app.showNotification('Evento creado correctamente', 'success');
            }

            window.app.closeModal();
            await this.loadEvents();
        } catch (error) {
            console.error('Error al guardar evento:', error);
            window.app.showNotification('Error al guardar el evento', 'error');
        }
    }

    async editEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        // Primero intentar sincronizar con GroupsManager
        this.syncWithGroupsManager();
        
        // Si no hay grupos, recargar desde la base de datos
        if (this.groups.length === 0) {
            await this.refreshGroups();
        }

        const modalContent = `
            <div class="modal-header">
                <h3>Editar Evento</h3>
                <button class="close-modal" onclick="app.closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="editEventForm" class="handled">
                <div class="form-group">
                    <label for="eventTitle">Título *</label>
                    <input type="text" id="eventTitle" value="${event.title}" required>
                </div>
                <div class="form-group">
                    <label for="eventType">Tipo *</label>
                    <input type="text" id="eventType" value="${event.type}" placeholder="Ej: Clase, Examen, Tarea, Evento, etc." required>
                </div>
                <div class="form-group">
                    <label for="eventDate">Fecha *</label>
                    <input type="date" id="eventDate" value="${this.formatDateForInput(event.date)}" required>
                </div>
                <div class="form-group">
                    <label for="eventTime">Hora</label>
                    <input type="time" id="eventTime" value="${this.formatTimeForInput(event.date)}">
                </div>
                <div class="form-group">
                    <label for="eventGroup">Grupo</label>
                    <select id="eventGroup">
                        <option value="">Sin grupo específico</option>
                        ${this.groups.map(group => 
                            `<option value="${group.id}" ${event.groupId === group.id ? 'selected' : ''}>${group.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="eventDescription">Descripción</label>
                    <textarea id="eventDescription" rows="3">${event.description || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">Actualizar Evento</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);

        document.getElementById('editEventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEvent(eventId);
        });
    }

    async deleteEvent(eventId) {
        if (!confirm('¿Está seguro de que desea eliminar este evento?')) return;

        try {
            const eventRef = ref(db, `cronograma_events/${eventId}`);
            await remove(eventRef);
            window.app.showNotification('Evento eliminado correctamente', 'success');
            await this.loadEvents();
        } catch (error) {
            console.error('Error al eliminar evento:', error);
            window.app.showNotification('Error al eliminar el evento', 'error');
        }
    }

    showEventDetails(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const modalContent = `
            <div class="modal-header">
                <h3>Detalles del Evento</h3>
                <button class="close-modal" onclick="app.closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="event-details-modal">
                <div class="detail-row">
                    <strong>Título:</strong> ${event.title}
                </div>
                <div class="detail-row">
                    <strong>Tipo:</strong> <span class="status-badge ${event.type}">${this.getEventTypeLabel(event.type)}</span>
                </div>
                <div class="detail-row">
                    <strong>Fecha:</strong> ${this.formatDate(event.date)}
                </div>
                <div class="detail-row">
                    <strong>Hora:</strong> ${this.formatTime(event.date)}
                </div>
                <div class="detail-row">
                    <strong>Grupo:</strong> ${this.getGroupName(event.groupId)}
                </div>
                <div class="detail-row">
                    <strong>Descripción:</strong> ${event.description || 'Sin descripción'}
                </div>
                <div class="detail-row">
                    <strong>Estado:</strong> <span class="status-badge ${event.status}">${this.getStatusLabel(event.status)}</span>
                </div>
            </div>
            <div class="form-actions">
                <button class="btn-warning" onclick="cronogramaManager.editEvent('${eventId}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-danger" onclick="cronogramaManager.deleteEvent('${eventId}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="btn-secondary" onclick="app.closeModal()">Cerrar</button>
            </div>
        `;

        window.app.showModal(modalContent);
    }

    // Utilidades
    isToday(date) {
        const today = new Date();
        return this.isSameDate(date, today);
    }

    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatDateForInput(date) {
        const eventDate = new Date(date);
        const year = eventDate.getFullYear();
        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
        const day = String(eventDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatTimeForInput(date) {
        const eventDate = new Date(date);
        const hours = String(eventDate.getHours()).padStart(2, '0');
        const minutes = String(eventDate.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    getGroupName(groupId) {
        if (!groupId) return 'General';
        const group = this.groups.find(g => g.id === groupId);
        return group ? group.name : 'Grupo no encontrado';
    }

    getEventTypeLabel(type) {
        const types = {
            'clase': 'Clase',
            'examen': 'Examen',
            'tarea': 'Tarea',
            'evento': 'Evento',
            'feriado': 'Feriado',
            'reunion': 'Reunión'
        };
        return types[type] || type;
    }

    getStatusLabel(status) {
        const statuses = {
            'active': 'Activo',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return statuses[status] || 'Activo';
    }
}

// Inicializar el manager cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando CronogramaManager...');
    const cronogramaManager = new CronogramaManager();
    window.cronogramaManager = cronogramaManager;
    
    // Inicializar después de un pequeño retraso para asegurar que todos los elementos estén disponibles
    setTimeout(() => {
        cronogramaManager.init().catch(error => {
            console.error('Error al inicializar cronograma:', error);
        });
    }, 1000);
});

// También crear una instancia inmediatamente para compatibilidad
if (!window.cronogramaManager) {
    const cronogramaManager = new CronogramaManager();
    window.cronogramaManager = cronogramaManager;
    console.log('CronogramaManager creado inmediatamente');
}

// Verificar que el módulo se cargó correctamente
console.log('Módulo de Cronograma cargado correctamente');

export default CronogramaManager;
