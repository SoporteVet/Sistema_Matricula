import { 
    ref, 
    push, 
    set, 
    get, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class AttendanceManager {
    constructor() {
        this.attendance = {};
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.currentStudentsForAttendance = [];
        this.currentAttendanceData = {};
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadAllData();
        } catch (error) {
            console.warn('Error al inicializar AttendanceManager:', error);
        }
    }

    setupEventListeners() {
        // Filtros principales que cargan estudiantes automáticamente
        const attendanceGroupFilter = document.getElementById('attendanceGroupFilter');
        if (attendanceGroupFilter) {
            attendanceGroupFilter.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
        }

        const attendanceCourseFilter = document.getElementById('attendanceCourseFilter');
        if (attendanceCourseFilter) {
            attendanceCourseFilter.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
        }

        const attendanceTeacherFilter = document.getElementById('attendanceTeacherFilter');
        if (attendanceTeacherFilter) {
            attendanceTeacherFilter.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
        }

        const attendanceSchedule = document.getElementById('attendanceSchedule');
        if (attendanceSchedule) {
            attendanceSchedule.addEventListener('change', () => {
                this.loadStudentsInTable();
            });
        }

        // Botón de guardar asistencia
        const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
        if (saveAttendanceBtn) {
            saveAttendanceBtn.addEventListener('click', () => {
                this.saveAllAttendance();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
        
        // Inicializar columnas de fechas y calendario
        this.dateColumns = [];
        this.initializeCalendar();
    }


    initializeCalendar() {
        this.selectedDates = [];
        this.currentCalendarDate = new Date();
        this.renderCalendar();
        this.setupCalendarEventListeners();
    }

    setupCalendarEventListeners() {
        const prevMonthBtn = document.getElementById('attendancePrevMonth');
        const nextMonthBtn = document.getElementById('attendanceNextMonth');
        const clearDatesBtn = document.getElementById('clearAllDates');
        const selectTodayBtn = document.getElementById('selectToday');

        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
                this.renderCalendar();
            });
        }

        if (clearDatesBtn) {
            clearDatesBtn.addEventListener('click', () => {
                this.selectedDates = [];
                this.dateColumns = [];
                this.renderCalendar();
                this.updateTableHeader();
                this.loadStudentsInTable();
            });
        }

        if (selectTodayBtn) {
            selectTodayBtn.addEventListener('click', () => {
                const today = new Date();
                const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                
                if (!this.selectedDates.includes(todayStr)) {
                    this.selectedDates.push(todayStr);
                }
                
                // Agregar a las columnas de fechas si no está
                if (!this.dateColumns.includes(todayStr)) {
                    this.dateColumns.push(todayStr);
                }
                
                // Cambiar al mes actual si no estamos en él
                if (today.getMonth() !== this.currentCalendarDate.getMonth() || 
                    today.getFullYear() !== this.currentCalendarDate.getFullYear()) {
                    this.currentCalendarDate = new Date(today);
                }
                
                this.renderCalendar();
                this.updateTableHeader();
                this.loadStudentsInTable();
            });
        }
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('attendanceCurrentMonthYear');
        const calendarBody = document.getElementById('attendanceCalendarGrid');
        
        if (!calendarGrid || !calendarBody) return;

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        // Actualizar encabezado
        const monthNames = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        calendarGrid.textContent = `${monthNames[month]} de ${year}`;

        // Generar calendario
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        let calendarHTML = `
            <div class="attendance-calendar-weekdays">
                <div>LU</div>
                <div>MA</div>
                <div>MI</div>
                <div>JU</div>
                <div>VI</div>
                <div>SA</div>
                <div>DO</div>
            </div>
            <div class="attendance-calendar-days">
        `;

        // Días del mes anterior (grises)
        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            calendarHTML += `<div class="attendance-calendar-day prev-month" data-date="${day}">${day}</div>`;
        }

        // Días del mes actual
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}`;
            const isSelected = this.selectedDates.includes(dateStr);
            const isToday = this.isToday(year, month, day);
            
            calendarHTML += `
                <div class="attendance-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
                     data-date="${day}" 
                     data-date-str="${dateStr}"
                     onclick="window.attendanceManager.toggleDate('${dateStr}')">
                    ${day}
                </div>
            `;
        }

        // Días del mes siguiente (grises)
        const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            calendarHTML += `<div class="attendance-calendar-day next-month" data-date="${day}">${day}</div>`;
        }

        calendarHTML += '</div>';
        calendarBody.innerHTML = calendarHTML;
        
        this.updateSelectedDatesList();
    }

    isToday(year, month, day) {
        const today = new Date();
        return today.getFullYear() === year && 
               today.getMonth() === month && 
               today.getDate() === day;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    hasSavedAttendanceForDate(dateStr) {
        // Convertir fecha DD-MM a formato completo para buscar
        const [day, month] = dateStr.split('-');
        const currentYear = new Date().getFullYear();
        const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        // Buscar si hay registros de asistencia para esta fecha
        return Object.values(this.attendance).some(record => 
            record.date === fullDate || record.displayDate === dateStr
        );
    }

    getSavedAttendanceValue(studentId, dateStr) {
        // Convertir fecha DD-MM a formato completo para buscar
        const [day, month] = dateStr.split('-');
        const currentYear = new Date().getFullYear();
        const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        // Buscar el registro de asistencia para este estudiante y fecha
        const record = Object.values(this.attendance).find(att => 
            att.studentId === studentId && 
            (att.date === fullDate || att.displayDate === dateStr)
        );
        
        return record ? record.status : null;
    }

    isCurrentUserAdmin() {
        // Verificar si el usuario actual es administrador
        // Esto dependerá de cómo tengas implementado el sistema de autenticación
        // Por ahora, asumiré que hay una función global o propiedad que indica si es admin
        if (window.currentUser && window.currentUser.role) {
            return window.currentUser.role === 'admin';
        }
        
        // Fallback: verificar si existe una función de autenticación
        if (window.auth && window.auth.isAdmin) {
            return window.auth.isAdmin();
        }
        
        // Por defecto, permitir edición (esto se puede cambiar según tu sistema)
        return true;
    }

    toggleDate(dateStr) {
        const index = this.selectedDates.indexOf(dateStr);
        if (index > -1) {
            // Verificar si esta fecha tiene datos guardados antes de permitir eliminación
            if (this.hasSavedAttendanceForDate(dateStr)) {
                if (window.app) {
                    window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
                }
                return;
            }
            
            this.selectedDates.splice(index, 1);
            // También remover de las columnas de fechas
            const dateIndex = this.dateColumns.indexOf(dateStr);
            if (dateIndex > -1) {
                this.dateColumns.splice(dateIndex, 1);
            }
        } else {
            this.selectedDates.push(dateStr);
            // También agregar a las columnas de fechas
            if (!this.dateColumns.includes(dateStr)) {
                this.dateColumns.push(dateStr);
            }
            
            // Ordenar fechas cronológicamente
            this.selectedDates.sort((a, b) => {
                // Convertir DD-MM a MM-DD para comparación correcta
                const [dayA, monthA] = a.split('-');
                const [dayB, monthB] = b.split('-');
                const currentYear = new Date().getFullYear();
                const dateA = new Date(currentYear, parseInt(monthA) - 1, parseInt(dayA));
                const dateB = new Date(currentYear, parseInt(monthB) - 1, parseInt(dayB));
                return dateA - dateB;
            });
            
            // Actualizar dateColumns para que coincida con el orden de selectedDates
            this.dateColumns = [...this.selectedDates];
        }
        this.renderCalendar();
        this.updateTableHeader();
        this.loadStudentsInTable();
    }

    updateSelectedDatesList() {
        const selectedDatesList = document.getElementById('selectedDatesList');
        if (!selectedDatesList) return;

        if (this.selectedDates.length === 0) {
            selectedDatesList.innerHTML = '<p style="color: #6c757d; font-style: italic;">No hay fechas seleccionadas</p>';
        } else {
            selectedDatesList.innerHTML = this.selectedDates.map(date => {
                const hasSavedData = this.hasSavedAttendanceForDate(date);
                return `
                    <div class="selected-date-item ${hasSavedData ? 'locked' : ''}">
                        <span>${date} ${hasSavedData ? '(Guardada)' : ''}</span>
                        ${hasSavedData ? '' : `<button class="btn-danger btn-sm" onclick="window.attendanceManager.removeSelectedDate('${date}')">
                            <i class="fas fa-times"></i>
                        </button>`}
                    </div>
                `;
            }).join('');
        }
    }

    removeSelectedDate(dateStr) {
        // Verificar si esta fecha tiene datos guardados
        if (this.hasSavedAttendanceForDate(dateStr)) {
            if (window.app) {
                window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
            }
            return;
        }
        
        const index = this.selectedDates.indexOf(dateStr);
        if (index > -1) {
            this.selectedDates.splice(index, 1);
            this.renderCalendar();
        }
    }


    updateTableHeader() {
        const thead = document.querySelector('#attendanceTable thead tr');
        if (!thead) return;

        // Remover columnas de fechas existentes
        const existingDateHeaders = thead.querySelectorAll('.date-column-header');
        existingDateHeaders.forEach(header => header.remove());

        // Crear todas las columnas de fechas primero
        const dateHeaders = this.dateColumns.map((date, index) => {
            const th = document.createElement('th');
            th.className = 'date-column-header';
            
            // Verificar si esta fecha tiene datos guardados
            const hasSavedData = this.hasSavedAttendanceForDate(date);
            
            th.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>${date}</span>
                    ${hasSavedData ? '' : `<button class="btn-danger btn-sm" onclick="window.attendanceManager.removeDateColumn(${index})" style="margin-left: 5px;">
                        <i class="fas fa-times"></i>
                    </button>`}
                </div>
            `;
            return th;
        });

        // Insertar todas las columnas de fechas antes de la columna de Materia
        const materiaHeader = thead.querySelector('th:nth-child(7)');
        if (materiaHeader) {
            dateHeaders.forEach(th => {
                thead.insertBefore(th, materiaHeader);
            });
        } else {
            dateHeaders.forEach(th => {
                thead.appendChild(th);
            });
        }
    }

    removeDateColumn(index) {
        const dateToRemove = this.dateColumns[index];
        
        // Verificar si esta fecha tiene datos guardados
        if (this.hasSavedAttendanceForDate(dateToRemove)) {
            if (window.app) {
                window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
            }
            return;
        }
        
        this.dateColumns.splice(index, 1);
        
        // También remover de selectedDates
        const selectedIndex = this.selectedDates.indexOf(dateToRemove);
        if (selectedIndex > -1) {
            this.selectedDates.splice(selectedIndex, 1);
        }
        
        this.renderCalendar();
        this.updateTableHeader();
        this.loadStudentsInTable();
    }

    setupRealTimeUpdates() {
        const collections = ['attendance', 'students', 'courses', 'groups'];
        
        collections.forEach(collection => {
            const collectionRef = ref(db, collection);
            onValue(collectionRef, (snapshot) => {
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
                
                if (collection === 'groups') {
                    this.updateGroupFilter();
                }
            });
        });
    }

    async loadAllData() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para asistencia');
                return;
            }

            const collections = ['attendance', 'students', 'courses', 'groups'];
            
            const promises = collections.map(async (collection) => {
                const collectionRef = ref(db, collection);
                const snapshot = await get(collectionRef);
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
            });

            await Promise.all(promises);
            this.updateGroupFilter();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar datos', 'error');
            }
        }
    }

    updateGroupFilter() {
        const attendanceGroupFilter = document.getElementById('attendanceGroupFilter');
        
        if (attendanceGroupFilter) {
            const activeGroups = Object.entries(this.groups)
                .filter(([id, group]) => group.status === 'active')
                .map(([id, group]) => ({ id, ...group }));
            
            attendanceGroupFilter.innerHTML = '<option value="">Seleccionar grupo</option>' +
                activeGroups.map(group => 
                    `<option value="${group.id}">${group.groupCode} - ${group.groupName}</option>`
                ).join('');
        }
    }

    // Método eliminado - ya no necesitamos cargar grupos por curso

    async loadStudentsInTable() {
        const groupFilter = document.getElementById('attendanceGroupFilter');
        const courseFilter = document.getElementById('attendanceCourseFilter');
        const teacherFilter = document.getElementById('attendanceTeacherFilter');
        const scheduleFilter = document.getElementById('attendanceSchedule');
        
        // Si no hay grupo seleccionado, mostrar tabla vacía
        if (!groupFilter.value) {
            this.renderEmptyTable();
            return;
        }

        // Verificar si los datos están cargados
        if (Object.keys(this.students).length === 0 || Object.keys(this.groups).length === 0) {
            await this.loadAllData();
        }

        const selectedGroup = groupFilter.value;
        const selectedCourse = courseFilter.value;
        const selectedTeacher = teacherFilter.value;
        const selectedSchedule = scheduleFilter.value;

        try {
            let studentsToShow = [];

            // Obtener estudiantes del grupo específico
            const group = this.groups[selectedGroup];
            
            if (group) {
                if (group.students && group.students.length > 0) {
                    // Mapear estudiantes con información detallada
                    const mappedStudents = group.students.map(studentId => {
                        const studentData = this.students[studentId];
                        return { id: studentId, ...studentData };
                    });
                    
                    studentsToShow = mappedStudents.filter(student => {
                        return student && student.firstName && student.lastName && student.status === 'active';
                    });
                    
                } else {
                    // Buscar estudiantes que tengan este grupo asignado en su campo 'group'
                    const groupName = group.groupName || group.groupCode || '';
                    
                    studentsToShow = Object.entries(this.students)
                        .filter(([studentId, student]) => {
                            const belongsToGroupById = student.group === selectedGroup;
                            const belongsToGroupByName = student.group === groupName;
                            const belongsToGroupByCode = student.group === group.groupCode;
                            const belongsToGroup = belongsToGroupById || belongsToGroupByName || belongsToGroupByCode;
                            
                            return belongsToGroup && student && student.firstName && student.lastName && student.status === 'active';
                        })
                        .map(([studentId, student]) => ({ id: studentId, ...student }));
                }
            }

            this.currentStudentsForAttendance = studentsToShow;
            
            this.renderStudentsInTable(studentsToShow, selectedGroup, selectedCourse, selectedTeacher, selectedSchedule);
            
            // Mostrar botón de guardar si hay estudiantes
            const saveBtn = document.getElementById('saveAttendanceBtn');
            if (saveBtn) {
                saveBtn.style.display = studentsToShow.length > 0 ? 'block' : 'none';
            }

        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar estudiantes', 'error');
            }
        }
    }

    renderEmptyTable() {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-calendar-check fa-3x mb-3"></i>
                            <h4>Seleccione un grupo para comenzar</h4>
                            <p>Elija un grupo y fecha para cargar los estudiantes</p>
                        </div>
                </td>
            </tr>
        `;

        // Ocultar botón de guardar
        const saveBtn = document.getElementById('saveAttendanceBtn');
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
    }

    renderStudentsInTable(students, groupId, course, teacher, schedule) {
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        if (students.length === 0) {
            const colspan = 7 + this.dateColumns.length; // Columnas fijas + columnas de fechas
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-user-graduate fa-3x mb-3"></i>
                            <h4>No hay estudiantes</h4>
                            <p>No se encontraron estudiantes para los criterios seleccionados</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const group = this.groups[groupId];
        const groupCode = group ? group.groupCode : 'N/A';
        const groupStartDate = group ? this.formatDate(group.startDate) : 'N/A';

        tbody.innerHTML = students.map(student => {
            // Generar columnas de fechas dinámicas
            const dateColumns = this.dateColumns.map(date => {
                // Buscar valor guardado para esta fecha y estudiante
                const savedValue = this.getSavedAttendanceValue(student.id, date);
                const isAdmin = this.isCurrentUserAdmin();
                
                return `
                    <td class="attendance-date-cell">
                        <select class="attendance-status-select" data-student-id="${student.id}" data-date="${date}" ${!isAdmin && savedValue ? 'disabled' : ''}>
                            <option value="P" ${savedValue === 'P' ? 'selected' : ''}>P</option>
                            <option value="A" ${savedValue === 'A' ? 'selected' : ''}>A</option>
                            <option value="T" ${savedValue === 'T' ? 'selected' : ''}>T</option>
                            <option value="CONGELADO" ${savedValue === 'CONGELADO' ? 'selected' : ''}>CONGELADO</option>
                        </select>
                    </td>
                `;
            }).join('');

            return `
                <tr data-student-id="${student.id}">
                    <td>${groupCode}</td>
                    <td>${groupStartDate}</td>
                    <td>${student.firstName} ${student.lastName}</td>
                    <td>${student.cedula || student.studentId}</td>
                    <td>${student.phone || 'N/A'}</td>
                    <td>${student.email}</td>
                    ${dateColumns}
                    <td>${course || 'N/A'}</td>
                    <td>${teacher || 'N/A'}</td>
                    <td>${schedule || 'N/A'}</td>
                    <td>
                        <input type="text" class="final-grade-input" data-student-id="${student.id}" 
                               placeholder="Nota" style="width: 60px; text-align: center;">
                    </td>
                    <td>
                        <select class="student-status-select" data-student-id="${student.id}">
                            <option value="ACTIVO">ACTIVO</option>
                            <option value="CONGELADO">CONGELADO</option>
                            <option value="GRADUADO">GRADUADO</option>
                            <option value="ABANDONO">ABANDONO</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStudentStatus(studentId, status) {
        // Actualizar datos internos
        if (!this.currentAttendanceData[studentId]) {
            this.currentAttendanceData[studentId] = {};
        }
        this.currentAttendanceData[studentId].status = status;

        // Actualizar visualmente la fila
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (row) {
            // Remover clases de estado anteriores
            row.classList.remove('status-present', 'status-absent', 'status-late');
            // Agregar nueva clase de estado
            row.classList.add(`status-${status}`);
        }
    }

    async saveAllAttendance() {
        // Verificar si el usuario es administrador
        if (!this.isCurrentUserAdmin()) {
            if (window.app) {
                window.app.showNotification('Solo los administradores pueden guardar asistencia', 'error');
            }
            return;
        }

        const groupFilter = document.getElementById('attendanceGroupFilter');
        const courseFilter = document.getElementById('attendanceCourseFilter');
        const teacherFilter = document.getElementById('attendanceTeacherFilter');
        const scheduleFilter = document.getElementById('attendanceSchedule');
        
        if (!groupFilter.value) {
            if (window.app) {
                window.app.showNotification('Seleccione un grupo', 'error');
            }
            return;
        }

        try {
            const group = groupFilter.value;
            const course = courseFilter.value;
            const teacher = teacherFilter.value;
            const schedule = scheduleFilter.value;
            
            const attendanceRecords = [];
            const updates = [];

            // Recopilar datos de todos los estudiantes
            this.currentStudentsForAttendance.forEach(student => {
                // Recopilar datos de cada columna de fecha
                this.dateColumns.forEach(date => {
                    const statusSelect = document.querySelector(`select[data-student-id="${student.id}"][data-date="${date}"]`);
                    const finalGradeInput = document.querySelector(`input.final-grade-input[data-student-id="${student.id}"]`);
                    const studentStatusSelect = document.querySelector(`select.student-status-select[data-student-id="${student.id}"]`);
                
                if (!statusSelect) return;

                const status = statusSelect.value;
                    const finalGrade = finalGradeInput ? finalGradeInput.value.trim() : '';
                    const studentStatus = studentStatusSelect ? studentStatusSelect.value : 'ACTIVO';

                // Convertir fecha DD-MM a formato completo para guardar
                const [day, month] = date.split('-');
                const currentYear = new Date().getFullYear();
                const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                
                // Calcular semana del año
                const dateObj = new Date(fullDate);
                const weekNumber = this.getWeekNumber(dateObj);

                const attendanceData = {
                    studentId: student.id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    course: course,
                        teacher: teacher,
                        schedule: schedule,
                    date: fullDate,
                    displayDate: date, // Mantener formato DD-MM para mostrar
                    status: status,
                        finalGrade: finalGrade,
                        studentStatus: studentStatus,
                    group: group,
                    week: weekNumber,
                    year: currentYear,
                    updatedAt: new Date().toISOString()
                };

                    // Verificar si ya existe un registro para esta fecha y estudiante
                    const existingRecord = Object.entries(this.attendance).find(([id, record]) => 
                        record.studentId === student.id && 
                        record.date === fullDate && 
                        record.group === group
                    );

                    if (existingRecord) {
                    // Actualizar registro existente
                        updates.push({ id: existingRecord[0], data: attendanceData });
                } else {
                    // Crear nuevo registro
                    attendanceData.createdAt = new Date().toISOString();
                    attendanceRecords.push(attendanceData);
                }
                });
            });

            // Guardar nuevos registros
            const attendanceRef = ref(db, 'attendance');
            for (const record of attendanceRecords) {
                await push(attendanceRef, record);
            }

            // Actualizar registros existentes
            for (const update of updates) {
                const recordRef = ref(db, `attendance/${update.id}`);
                await set(recordRef, update.data);
            }

            if (window.app) {
                window.app.showNotification(
                    `Asistencia guardada para ${this.currentStudentsForAttendance.length} estudiantes`, 
                    'success'
                );
            }

            // Recargar datos para reflejar cambios
            setTimeout(() => {
                this.loadStudentsInTable();
            }, 500);

        } catch (error) {
            console.error('Error al guardar asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la asistencia', 'error');
            }
        }
    }

    viewStudentProfile(studentId) {
        const student = this.students[studentId];
        if (!student) {
            if (window.app) {
                window.app.showNotification('Estudiante no encontrado', 'error');
            }
            return;
        }

        // Calcular estadísticas del estudiante
        const studentAttendance = Object.values(this.attendance).filter(record => record.studentId === studentId);
        const totalClasses = studentAttendance.length;
        const presentClasses = studentAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
        const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

        // Obtener información adicional si está disponible
        const payments = window.paymentsManager ? 
            Object.values(window.paymentsManager.payments || {}).filter(p => p.studentId === studentId) : [];
        const grades = window.academicHistoryManager ? 
            Object.values(window.academicHistoryManager.grades || {}).filter(g => g.studentId === studentId) : [];

        const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue').length;
        const averageGrade = grades.length > 0 ? 
            (grades.reduce((sum, grade) => sum + parseFloat(grade.grade), 0) / grades.length).toFixed(1) : 'N/A';

        const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-user-graduate"></i> 
                    Perfil del Estudiante
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="student-profile-section">
                <div class="student-profile-header">
                    <div class="student-profile-avatar">${initials}</div>
                    <div class="student-profile-info">
                        <h3>${student.firstName} ${student.lastName}</h3>
                        <p><strong>ID:</strong> ${student.studentId}</p>
                        <p><strong>Email:</strong> ${student.email}</p>
                        <p><strong>Teléfono:</strong> ${student.phone || 'No registrado'}</p>
                        <p><strong>Curso:</strong> ${student.course}</p>
                    </div>
                </div>
                
                <div class="performance-metrics">
                    <div class="performance-card">
                        <div class="performance-value ${this.getPerformanceClass(attendancePercentage, 'attendance')}">${attendancePercentage}%</div>
                        <div class="performance-label">Asistencia</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value ${this.getPerformanceClass(averageGrade, 'grade')}">${averageGrade}</div>
                        <div class="performance-label">Promedio</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value ${pendingPayments > 0 ? 'poor' : 'excellent'}">${pendingPayments}</div>
                        <div class="performance-label">Pagos Pendientes</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-value excellent">${totalClasses}</div>
                        <div class="performance-label">Total Clases</div>
                    </div>
                </div>
            </div>
            
            <div class="student-profile-section">
                <h4><i class="fas fa-calendar-check"></i> Asistencia Reciente</h4>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 15px;">
                    ${studentAttendance.length === 0 ? 
                        '<p style="color: #6c757d; text-align: center;">No hay registros de asistencia</p>' :
                        studentAttendance
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 10)
                            .map(record => `
                                <div class="attendance-item">
                                    <span class="attendance-date">${this.formatDate(record.date)}</span>
                                    <span class="status-badge ${record.status}">
                                        ${this.getStatusText(record.status)}
                                    </span>
                                    ${record.notes ? `<small>${record.notes}</small>` : ''}
                                </div>
                            `).join('')
                    }
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                ${window.academicHistoryManager ? `
                    <button type="button" class="btn-primary" onclick="window.academicHistoryManager.viewDetailedHistory('${studentId}')">
                        <i class="fas fa-graduation-cap"></i> Ver Historial Completo
                    </button>
                ` : ''}
            </div>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    getPerformanceClass(value, type) {
        if (type === 'attendance') {
            if (value >= 90) return 'excellent';
            if (value >= 80) return 'good';
            if (value >= 70) return 'average';
            return 'poor';
        } else if (type === 'grade') {
            if (value === 'N/A') return 'average';
            const numValue = parseFloat(value);
            if (numValue >= 90) return 'excellent';
            if (numValue >= 80) return 'good';
            if (numValue >= 70) return 'average';
            return 'poor';
        }
        return 'average';
    }

    getStatusText(status) {
        const statusMap = {
            'present': 'Presente',
            'absent': 'Ausente',
            'late': 'Tardanza'
        };
        return statusMap[status] || status;
    }

    formatDate(date) {
        // Si la fecha viene en formato YYYY-MM-DD, parsearla correctamente
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = date.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            return new Intl.DateTimeFormat('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(dateObj);
        }
        
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    }

    setCurrentDate() {
        const attendanceDate = document.getElementById('attendanceDate');
        if (attendanceDate) {
            // Establecer fecha actual en formato YYYY-MM-DD
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const currentDate = `${year}-${month}-${day}`;
            
            attendanceDate.value = currentDate;
        }
    }

    // Obtener estadísticas de asistencia
    getAttendanceStats(studentId, month = null) {
        const studentRecords = Object.values(this.attendance).filter(record => {
            const matchesStudent = record.studentId === studentId;
            const matchesMonth = !month || record.date.startsWith(month);
            return matchesStudent && matchesMonth;
        });

        const stats = {
            total: studentRecords.length,
            present: studentRecords.filter(r => r.status === 'present').length,
            absent: studentRecords.filter(r => r.status === 'absent').length,
            late: studentRecords.filter(r => r.status === 'late').length
        };

        stats.percentage = stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) : 0;

        return stats;
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('attendanceTable')) {
        window.attendanceManager = new AttendanceManager();
        // No inicializar automáticamente, esperar a que la app esté lista
    }
});

export default AttendanceManager;