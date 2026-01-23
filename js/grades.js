import { 
    ref, 
    push, 
    set, 
    get, 
    remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class GradesManager {
    constructor() {
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.grades = {};
        this.evaluations = {};
        this.attendance = {};
        this.filteredStudents = {};
        this.currentGroup = null;
        this.currentEvaluation = null;
        
        // Propiedades para asistencia integrada
        this.currentStudentsForAttendance = [];
        this.currentAttendanceData = {};
        this.dateColumns = [];
        this.selectedDates = [];
        this.currentCalendarDate = new Date();
        
        this.setupEventListeners();
        this.setupTabsEventListeners();
    }

    async init() {
        try {
            await this.loadAllData();
            this.initializeAttendanceCalendar();
        } catch (error) {
            console.warn('Error al inicializar GradesManager:', error);
        }
    }

    setupTabsEventListeners() {
        // Configurar tabs dentro de la sección de notas
        const tabButtons = document.querySelectorAll('#grades .tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        // Actualizar botones de tabs
        const tabButtons = document.querySelectorAll('#grades .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            }
        });

        // Actualizar contenido de tabs
        const tabContents = document.querySelectorAll('#grades .tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
            }
        });
    }

    setupEventListeners() {
        // Botón para agregar nueva evaluación
        const addEvaluationBtn = document.getElementById('addEvaluationBtn');
        if (addEvaluationBtn) {
            // Remover listeners existentes para evitar duplicación
            addEvaluationBtn.removeEventListener('click', this.handleAddEvaluationClick);
            this.handleAddEvaluationClick = () => {
                console.log('Botón Nueva Evaluación clickeado');
                this.showEvaluationModal();
            };
            addEvaluationBtn.addEventListener('click', this.handleAddEvaluationClick);
        } else {
            console.error('Botón addEvaluationBtn no encontrado en el DOM');
        }

        // Filtros de evaluaciones
        const groupFilter = document.getElementById('gradesGroupFilter');
        if (groupFilter) {
            // Remover listeners existentes para evitar duplicación
            groupFilter.removeEventListener('change', this.handleGroupFilterChange);
            this.handleGroupFilterChange = () => {
                this.applyFilters();
            };
            groupFilter.addEventListener('change', this.handleGroupFilterChange);
        }

        const evaluationFilter = document.getElementById('evaluationFilter');
        if (evaluationFilter) {
            // Remover listeners existentes para evitar duplicación
            evaluationFilter.removeEventListener('change', this.handleEvaluationFilterChange);
            this.handleEvaluationFilterChange = () => {
                this.applyFilters();
            };
            evaluationFilter.addEventListener('change', this.handleEvaluationFilterChange);
        }

        // ============ Eventos de Asistencia Integrada ============
        
        // Filtros de asistencia
        const attendanceGroupFilter = document.getElementById('gradesAttendanceGroupFilter');
        if (attendanceGroupFilter) {
            attendanceGroupFilter.addEventListener('change', () => {
                this.loadStudentsInAttendanceTable();
            });
        }

        const attendanceCourseFilter = document.getElementById('gradesAttendanceCourseFilter');
        if (attendanceCourseFilter) {
            attendanceCourseFilter.addEventListener('change', () => {
                this.loadStudentsInAttendanceTable();
            });
        }

        const attendanceTeacherFilter = document.getElementById('gradesAttendanceTeacherFilter');
        if (attendanceTeacherFilter) {
            attendanceTeacherFilter.addEventListener('change', () => {
                this.loadStudentsInAttendanceTable();
            });
        }

        const attendanceSchedule = document.getElementById('gradesAttendanceSchedule');
        if (attendanceSchedule) {
            attendanceSchedule.addEventListener('change', () => {
                this.loadStudentsInAttendanceTable();
            });
        }

        // Botón de guardar asistencia
        const saveAttendanceBtn = document.getElementById('saveGradesAttendanceBtn');
        if (saveAttendanceBtn) {
            saveAttendanceBtn.addEventListener('click', () => {
                this.saveAllAttendance();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    // ============ Métodos de Asistencia Integrada ============

    initializeAttendanceCalendar() {
        this.selectedDates = [];
        this.currentCalendarDate = new Date();
        this.renderAttendanceCalendar();
        this.setupAttendanceCalendarEventListeners();
    }

    setupAttendanceCalendarEventListeners() {
        const prevMonthBtn = document.getElementById('gradesAttendancePrevMonth');
        const nextMonthBtn = document.getElementById('gradesAttendanceNextMonth');
        const clearDatesBtn = document.getElementById('gradesAttendanceClearDates');
        const selectTodayBtn = document.getElementById('gradesAttendanceSelectToday');

        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
                this.renderAttendanceCalendar();
            });
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
                this.renderAttendanceCalendar();
            });
        }

        if (clearDatesBtn) {
            clearDatesBtn.addEventListener('click', () => {
                this.selectedDates = [];
                this.dateColumns = [];
                this.renderAttendanceCalendar();
                this.updateAttendanceTableHeader();
                this.loadStudentsInAttendanceTable();
            });
        }

        if (selectTodayBtn) {
            selectTodayBtn.addEventListener('click', () => {
                const today = new Date();
                const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                
                if (!this.selectedDates.includes(todayStr)) {
                    this.selectedDates.push(todayStr);
                }
                
                if (!this.dateColumns.includes(todayStr)) {
                    this.dateColumns.push(todayStr);
                }
                
                if (today.getMonth() !== this.currentCalendarDate.getMonth() || 
                    today.getFullYear() !== this.currentCalendarDate.getFullYear()) {
                    this.currentCalendarDate = new Date(today);
                }
                
                this.renderAttendanceCalendar();
                this.updateAttendanceTableHeader();
                this.loadStudentsInAttendanceTable();
            });
        }
    }

    renderAttendanceCalendar() {
        const calendarGrid = document.getElementById('gradesAttendanceMonthYear');
        const calendarBody = document.getElementById('gradesAttendanceCalendarGrid');
        
        if (!calendarGrid || !calendarBody) return;

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        const monthNames = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        calendarGrid.textContent = `${monthNames[month]} de ${year}`;

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

        const prevMonth = new Date(year, month, 0);
        const daysInPrevMonth = prevMonth.getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            calendarHTML += `<div class="attendance-calendar-day prev-month" data-date="${day}">${day}</div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}`;
            const isSelected = this.selectedDates.includes(dateStr);
            const isToday = this.isToday(year, month, day);
            
            calendarHTML += `
                <div class="attendance-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
                     data-date="${day}" 
                     data-date-str="${dateStr}"
                     onclick="window.gradesManager.toggleAttendanceDate('${dateStr}')">
                    ${day}
                </div>
            `;
        }

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
        const [day, month] = dateStr.split('-');
        const currentYear = new Date().getFullYear();
        const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const currentTeacherId = this.getCurrentTeacherId();
        
        return Object.values(this.attendance).some(record => 
            (record.date === fullDate || record.displayDate === dateStr) &&
            record.teacherId === currentTeacherId
        );
    }

    getSavedAttendanceValue(studentId, dateStr) {
        const [day, month] = dateStr.split('-');
        const currentYear = new Date().getFullYear();
        const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const currentTeacherId = this.getCurrentTeacherId();
        
        const record = Object.values(this.attendance).find(att => 
            att.studentId === studentId && 
            (att.date === fullDate || att.displayDate === dateStr) &&
            att.teacherId === currentTeacherId
        );
        
        return record ? record.status : null;
    }

    getCurrentTeacherId() {
        if (window.currentUser && window.currentUser.id) {
            return window.currentUser.id;
        }
        
        if (window.auth && window.auth.getCurrentUserId) {
            return window.auth.getCurrentUserId();
        }
        
        console.warn('No se pudo obtener el ID del profesor actual');
        return 'unknown_teacher';
    }

    isCurrentUserAdmin() {
        if (window.currentUser && window.currentUser.role) {
            return window.currentUser.role === 'admin';
        }
        
        if (window.auth && window.auth.isAdmin) {
            return window.auth.isAdmin();
        }
        
        return true;
    }

    toggleAttendanceDate(dateStr) {
        const index = this.selectedDates.indexOf(dateStr);
        if (index > -1) {
            if (this.hasSavedAttendanceForDate(dateStr)) {
                if (window.app) {
                    window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
                }
                return;
            }
            
            this.selectedDates.splice(index, 1);
            const dateIndex = this.dateColumns.indexOf(dateStr);
            if (dateIndex > -1) {
                this.dateColumns.splice(dateIndex, 1);
            }
        } else {
            this.selectedDates.push(dateStr);
            if (!this.dateColumns.includes(dateStr)) {
                this.dateColumns.push(dateStr);
            }
            
            this.selectedDates.sort((a, b) => {
                const [dayA, monthA] = a.split('-');
                const [dayB, monthB] = b.split('-');
                const currentYear = new Date().getFullYear();
                const dateA = new Date(currentYear, parseInt(monthA) - 1, parseInt(dayA));
                const dateB = new Date(currentYear, parseInt(monthB) - 1, parseInt(dayB));
                return dateA - dateB;
            });
            
            this.dateColumns = [...this.selectedDates];
        }
        this.renderAttendanceCalendar();
        this.updateAttendanceTableHeader();
        this.loadStudentsInAttendanceTable();
    }

    updateSelectedDatesList() {
        const selectedDatesList = document.getElementById('gradesSelectedDatesList');
        if (!selectedDatesList) return;

        if (this.selectedDates.length === 0) {
            selectedDatesList.innerHTML = '<p style="color: #6c757d; font-style: italic;">No hay fechas seleccionadas</p>';
        } else {
            selectedDatesList.innerHTML = this.selectedDates.map(date => {
                const hasSavedData = this.hasSavedAttendanceForDate(date);
                return `
                    <div class="selected-date-item ${hasSavedData ? 'locked' : ''}">
                        <span>${date} ${hasSavedData ? '(Guardada)' : ''}</span>
                        ${hasSavedData ? '' : `<button class="btn-danger btn-sm" onclick="window.gradesManager.removeSelectedAttendanceDate('${date}')">
                            <i class="fas fa-times"></i>
                        </button>`}
                    </div>
                `;
            }).join('');
        }
    }

    removeSelectedAttendanceDate(dateStr) {
        if (this.hasSavedAttendanceForDate(dateStr)) {
            if (window.app) {
                window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
            }
            return;
        }
        
        const index = this.selectedDates.indexOf(dateStr);
        if (index > -1) {
            this.selectedDates.splice(index, 1);
            this.renderAttendanceCalendar();
        }
    }

    updateAttendanceTableHeader() {
        const thead = document.querySelector('#gradesAttendanceTable thead tr');
        if (!thead) return;

        const existingDateHeaders = thead.querySelectorAll('.date-column-header');
        existingDateHeaders.forEach(header => header.remove());

        const dateHeaders = this.dateColumns.map((date, index) => {
            const th = document.createElement('th');
            th.className = 'date-column-header';
            
            const hasSavedData = this.hasSavedAttendanceForDate(date);
            
            th.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>${date}</span>
                    ${hasSavedData ? '' : `<button class="btn-danger btn-sm" onclick="window.gradesManager.removeAttendanceDateColumn(${index})" style="margin-left: 5px;">
                        <i class="fas fa-times"></i>
                    </button>`}
                </div>
            `;
            return th;
        });

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

    removeAttendanceDateColumn(index) {
        const dateToRemove = this.dateColumns[index];
        
        if (this.hasSavedAttendanceForDate(dateToRemove)) {
            if (window.app) {
                window.app.showNotification('No se puede eliminar una fecha que ya tiene asistencia guardada', 'error');
            }
            return;
        }
        
        this.dateColumns.splice(index, 1);
        
        const selectedIndex = this.selectedDates.indexOf(dateToRemove);
        if (selectedIndex > -1) {
            this.selectedDates.splice(selectedIndex, 1);
        }
        
        this.renderAttendanceCalendar();
        this.updateAttendanceTableHeader();
        this.loadStudentsInAttendanceTable();
    }

    updateAttendanceGroupFilter() {
        const attendanceGroupFilter = document.getElementById('gradesAttendanceGroupFilter');
        
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

    async loadStudentsInAttendanceTable() {
        const groupFilter = document.getElementById('gradesAttendanceGroupFilter');
        const courseFilter = document.getElementById('gradesAttendanceCourseFilter');
        const teacherFilter = document.getElementById('gradesAttendanceTeacherFilter');
        const scheduleFilter = document.getElementById('gradesAttendanceSchedule');
        
        if (!groupFilter || !groupFilter.value) {
            this.renderEmptyAttendanceTable();
            return;
        }

        if (Object.keys(this.students).length === 0 || Object.keys(this.groups).length === 0) {
            await this.loadAllData();
        }

        const selectedGroup = groupFilter.value;
        const selectedCourse = courseFilter ? courseFilter.value : '';
        const selectedTeacher = teacherFilter ? teacherFilter.value : '';
        const selectedSchedule = scheduleFilter ? scheduleFilter.value : '';

        try {
            let studentsToShow = [];

            const group = this.groups[selectedGroup];
            
            if (group) {
                if (group.students && group.students.length > 0) {
                    const mappedStudents = group.students.map(studentId => {
                        const studentData = this.students[studentId];
                        return { id: studentId, ...studentData };
                    });
                    
                    studentsToShow = mappedStudents.filter(student => {
                        return student && student.firstName && student.lastName && student.status === 'active';
                    });
                    
                } else {
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
            
            this.renderStudentsInAttendanceTable(studentsToShow, selectedGroup, selectedCourse, selectedTeacher, selectedSchedule);
            
            const saveBtn = document.getElementById('saveGradesAttendanceBtn');
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

    renderEmptyAttendanceTable() {
        const tbody = document.querySelector('#gradesAttendanceTable tbody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-calendar-check fa-3x mb-3"></i>
                            <h4>Seleccione un grupo para comenzar</h4>
                            <p>Elija un grupo y fecha para cargar los estudiantes</p>
                        </div>
                </td>
            </tr>
        `;

        const saveBtn = document.getElementById('saveGradesAttendanceBtn');
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
    }

    renderStudentsInAttendanceTable(students, groupId, course, teacher, schedule) {
        const tbody = document.querySelector('#gradesAttendanceTable tbody');
        if (!tbody) return;

        if (students.length === 0) {
            const colspan = 11 + this.dateColumns.length;
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
            const dateColumns = this.dateColumns.map(date => {
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

    async saveAllAttendance() {
        if (!this.isCurrentUserAdmin()) {
            if (window.app) {
                window.app.showNotification('Solo los administradores pueden guardar asistencia', 'error');
            }
            return;
        }

        const groupFilter = document.getElementById('gradesAttendanceGroupFilter');
        const courseFilter = document.getElementById('gradesAttendanceCourseFilter');
        const teacherFilter = document.getElementById('gradesAttendanceTeacherFilter');
        const scheduleFilter = document.getElementById('gradesAttendanceSchedule');
        
        if (!groupFilter || !groupFilter.value) {
            if (window.app) {
                window.app.showNotification('Seleccione un grupo', 'error');
            }
            return;
        }

        try {
            const group = groupFilter.value;
            const course = courseFilter ? courseFilter.value : '';
            const teacher = teacherFilter ? teacherFilter.value : '';
            const schedule = scheduleFilter ? scheduleFilter.value : '';
            
            const attendanceRecords = [];
            const updates = [];

            this.currentStudentsForAttendance.forEach(student => {
                this.dateColumns.forEach(date => {
                    const statusSelect = document.querySelector(`#gradesAttendanceTable select[data-student-id="${student.id}"][data-date="${date}"]`);
                    const finalGradeInput = document.querySelector(`#gradesAttendanceTable input.final-grade-input[data-student-id="${student.id}"]`);
                    const studentStatusSelect = document.querySelector(`#gradesAttendanceTable select.student-status-select[data-student-id="${student.id}"]`);
                
                    if (!statusSelect) return;

                    const status = statusSelect.value;
                    const finalGrade = finalGradeInput ? finalGradeInput.value.trim() : '';
                    const studentStatus = studentStatusSelect ? studentStatusSelect.value : 'ACTIVO';

                    const [day, month] = date.split('-');
                    const currentYear = new Date().getFullYear();
                    const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    
                    const dateObj = new Date(fullDate);
                    const weekNumber = this.getWeekNumber(dateObj);

                    const attendanceData = {
                        studentId: student.id,
                        studentName: `${student.firstName} ${student.lastName}`,
                        course: course,
                        teacher: teacher,
                        teacherId: this.getCurrentTeacherId(),
                        schedule: schedule,
                        date: fullDate,
                        displayDate: date,
                        status: status,
                        finalGrade: finalGrade,
                        studentStatus: studentStatus,
                        group: group,
                        week: weekNumber,
                        year: currentYear,
                        updatedAt: new Date().toISOString()
                    };

                    const existingRecord = Object.entries(this.attendance).find(([id, record]) => 
                        record.studentId === student.id && 
                        record.date === fullDate && 
                        record.group === group &&
                        record.teacherId === this.getCurrentTeacherId()
                    );

                    if (existingRecord) {
                        updates.push({ id: existingRecord[0], data: attendanceData });
                    } else {
                        attendanceData.createdAt = new Date().toISOString();
                        attendanceRecords.push(attendanceData);
                    }
                });
            });

            const attendanceRef = ref(db, 'attendance');
            for (const record of attendanceRecords) {
                await push(attendanceRef, record);
            }

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

            setTimeout(() => {
                this.loadStudentsInAttendanceTable();
            }, 500);

        } catch (error) {
            console.error('Error al guardar asistencia:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la asistencia', 'error');
            }
        }
    }

    setupRealTimeUpdates() {
        // Suscribirse a actualizaciones en tiempo real de estudiantes
        this.unsubscribeStudents = realtimeManager.subscribe('students', (students) => {
            this.students = students || {};
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de cursos
        this.unsubscribeCourses = realtimeManager.subscribe('courses', (courses) => {
            this.courses = courses || {};
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de grupos
        this.unsubscribeGroups = realtimeManager.subscribe('groups', (groups) => {
            this.groups = groups || {};
            this.updateAttendanceGroupFilter();
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de notas
        this.unsubscribeGrades = realtimeManager.subscribe('grades', (grades) => {
            this.grades = grades || {};
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de asistencia
        this.unsubscribeAttendance = realtimeManager.subscribe('attendance', (attendance) => {
            this.attendance = attendance || {};
            // Solo actualizar la tabla de asistencia si está visible
            if (document.getElementById('integratedAttendanceTable')) {
                this.loadAttendanceStudentsInTable();
            }
        });
    }

    // Limpiar suscripciones al destruir el módulo
    destroy() {
        if (this.unsubscribeStudents) this.unsubscribeStudents();
        if (this.unsubscribeCourses) this.unsubscribeCourses();
        if (this.unsubscribeGroups) this.unsubscribeGroups();
        if (this.unsubscribeGrades) this.unsubscribeGrades();
        if (this.unsubscribeAttendance) this.unsubscribeAttendance();
    }

    async loadAllData() {
        try {
            if (!db) {
                console.warn('Base de datos no disponible para notas');
                return;
            }

            const collections = ['students', 'courses', 'groups', 'grades', 'evaluations', 'attendance'];
            
            const promises = collections.map(async (collection) => {
                const collectionRef = ref(db, collection);
                const snapshot = await get(collectionRef);
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    // Para evaluaciones y notas, agregar el ID de Firebase a cada elemento
                    if (collection === 'evaluations' || collection === 'grades') {
                        this[collection] = Object.fromEntries(
                            Object.entries(data).map(([id, item]) => [
                                id, 
                                { ...item, id: id }
                            ])
                        );
                    } else {
                        this[collection] = data;
                    }
                } else {
                    this[collection] = {};
                }
            });

            await Promise.all(promises);
            this.updateFilters();
            this.updateAttendanceGroupFilter();
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar datos de notas:', error);
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar datos de notas', 'error');
            }
        }
    }

    updateFilters() {
        // Actualizar filtro de grupos
        const groupFilter = document.getElementById('gradesGroupFilter');
        if (groupFilter) {
            const activeGroups = Object.entries(this.groups)
                .filter(([id, group]) => group.status === 'active')
                .map(([id, group]) => ({
                    id,
                    name: `${group.groupName} (${group.academicLevel || group.courseName || 'N/A'})`
                }));

            groupFilter.innerHTML = '<option value="">Seleccionar grupo</option>' +
                activeGroups.map(group => 
                    `<option value="${group.id}">${group.name}</option>`
                ).join('');
        }

        // Actualizar filtro de evaluaciones
        const evaluationFilter = document.getElementById('evaluationFilter');
        if (evaluationFilter) {
            const evaluations = Object.values(this.evaluations);
            const uniqueTypes = [...new Set(evaluations.map(evaluation => evaluation.type))];
            
            evaluationFilter.innerHTML = '<option value="">Todas las evaluaciones</option>' +
                uniqueTypes.map(type => 
                    `<option value="${type}">${this.getEvaluationTypeText(type)}</option>`
                ).join('');
        }
    }

    applyFilters() {
        const groupFilter = document.getElementById('gradesGroupFilter')?.value || '';
        const evaluationFilter = document.getElementById('evaluationFilter')?.value || '';

        if (!groupFilter) {
            this.filteredStudents = {};
            this.renderGradesTable();
            return;
        }

        const group = this.groups[groupFilter];
        if (!group) return;

        // Buscar estudiantes que pertenecen a este grupo
        const groupStudents = Object.entries(this.students)
            .filter(([studentId, student]) => {
                if (!student || student.status !== 'active') return false;
                
                const groupName = group.groupName || group.name || '';
                const groupCode = group.groupCode || '';
                
                // Comparar con el ID del grupo, nombre del grupo, o código del grupo
                const belongsToGroupById = student.group === groupFilter;
                const belongsToGroupByName = student.group === groupName;
                const belongsToGroupByCode = student.group === groupCode;
                
                // También verificar si el estudiante tiene el grupo en el campo course
                const belongsToGroupByCourse = student.course === groupName || student.course === groupCode;
                
                return belongsToGroupById || belongsToGroupByName || belongsToGroupByCode || belongsToGroupByCourse;
            })
            .map(([studentId, student]) => ({ id: studentId, ...student }));

        this.filteredStudents = Object.fromEntries(
            groupStudents.map(student => [student.id, student])
        );

        this.currentGroup = groupFilter;
        this.renderGradesTable();
    }

    renderGradesTable() {
        const tbody = document.querySelector('#gradesTable tbody');
        if (!tbody) return;

        if (!this.currentGroup || Object.keys(this.filteredStudents).length === 0) {
            const debugInfo = this.currentGroup ? 
                `Grupo seleccionado: ${this.currentGroup}, Estudiantes encontrados: ${Object.keys(this.filteredStudents).length}` : 
                'No hay grupo seleccionado';
                
            tbody.innerHTML = `
                <tr>
                    <td colspan="100" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-graduation-cap fa-3x mb-3"></i>
                            <h4>Seleccione un grupo para ver las notas</h4>
                            <p>Use el filtro de grupos para comenzar</p>
                            <small style="color: #999; margin-top: 10px; display: block;">Debug: ${debugInfo}</small>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const group = this.groups[this.currentGroup];
        const evaluations = Object.values(this.evaluations)
            .filter(evaluation => evaluation.groupId === this.currentGroup)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Crear encabezados dinámicos
        const headerRow = `
            <tr>
                <th>Estudiante</th>
                <th>ID</th>
                ${evaluations.map(evaluation => `
                    <th>
                        <div class="evaluation-header">
                            <div class="eval-info">
                                <div class="eval-type">${this.getEvaluationTypeText(evaluation.type)}</div>
                                <div class="eval-date">${this.formatDate(evaluation.date)}</div>
                                <div class="eval-weight">${evaluation.weight}%</div>
                            </div>
                            <div class="eval-actions">
                                <button 
                                    class="btn-danger btn-sm" 
                                    onclick="window.gradesManager.deleteEvaluation('${evaluation.id}')"
                                    title="Eliminar evaluación"
                                >
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </th>
                `).join('')}
                <th>Promedio</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
        `;

        // Actualizar encabezados
        const thead = document.querySelector('#gradesTable thead');
        if (thead) {
            thead.innerHTML = headerRow;
        }

        // Crear filas de estudiantes
        const studentRows = Object.values(this.filteredStudents).map(student => {
            const studentGrades = this.getStudentGrades(student.studentId, evaluations);
            const average = this.calculateStudentAverage(studentGrades);
            const status = this.getStudentStatus(average);

            return `
                <tr>
                    <td><strong>${student.firstName} ${student.lastName}</strong></td>
                    <td>${student.studentId}</td>
                    ${evaluations.map(evaluation => {
                        const grade = studentGrades.find(g => g.evaluationId === evaluation.id);
                        return `
                            <td class="grade-cell" data-student="${student.studentId}" data-evaluation="${evaluation.id}">
                                ${grade ? grade.score : '-'}
                            </td>
                        `;
                    }).join('')}
                    <td class="average-cell">
                        <strong>${average.toFixed(1)}%</strong>
                    </td>
                    <td>
                        <span class="status-badge ${status}">
                            ${this.getStatusText(status)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-warning btn-sm" onclick="window.gradesManager.editStudentGrades('${student.studentId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-info btn-sm" onclick="window.gradesManager.viewStudentDetails('${student.studentId}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = studentRows;

        // Agregar eventos de clic para editar notas
        this.setupGradeCellEvents();
    }

    setupGradeCellEvents() {
        const gradeCells = document.querySelectorAll('.grade-cell');
        gradeCells.forEach(cell => {
            cell.addEventListener('click', () => {
                const studentId = cell.dataset.student;
                const evaluationId = cell.dataset.evaluation;
                this.editGrade(studentId, evaluationId);
            });
        });
    }

    getStudentGrades(studentId, evaluations) {
        return Object.values(this.grades)
            .filter(grade => grade.studentId === studentId && 
                           evaluations.some(evaluation => evaluation.id === grade.evaluationId));
    }

    calculateStudentAverage(studentGrades) {
        if (studentGrades.length === 0) return 0;

        const totalWeight = studentGrades.reduce((sum, grade) => {
            const evaluation = Object.values(this.evaluations)
                .find(evaluation => evaluation.id === grade.evaluationId);
            return sum + (evaluation ? evaluation.weight : 0);
        }, 0);

        if (totalWeight === 0) return 0;

        const weightedSum = studentGrades.reduce((sum, grade) => {
            const evaluation = Object.values(this.evaluations)
                .find(evaluation => evaluation.id === grade.evaluationId);
            const weight = evaluation ? evaluation.weight : 0;
            return sum + (grade.score * weight / 100);
        }, 0);

        return (weightedSum / totalWeight) * 100;
    }

    getStudentStatus(average) {
        if (average >= 70) return 'approved';
        if (average >= 60) return 'conditional';
        return 'failed';
    }

    showEvaluationModal(evaluationId = null) {
        console.log('showEvaluationModal ejecutándose');
        const evaluation = evaluationId ? this.evaluations[evaluationId] : null;
        const isEdit = evaluation !== null;

        const activeGroups = Object.entries(this.groups)
            .filter(([id, group]) => group.status === 'active')
            .map(([id, group]) => ({
                id,
                name: `${group.groupName} (${group.academicLevel || group.courseName || 'N/A'})`
            }));

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-clipboard-check"></i> 
                    ${isEdit ? 'Editar' : 'Crear'} Evaluación
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="evaluationForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="evaluationTitle">Título de la Evaluación *</label>
                        <input 
                            type="text" 
                            id="evaluationTitle" 
                            value="${evaluation?.title || ''}" 
                            required
                            placeholder="Ej: Examen Parcial 1"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="evaluationType">Tipo de Evaluación *</label>
                        <select id="evaluationType" required>
                            <option value="">Seleccionar tipo</option>
                            <option value="exam" ${evaluation?.type === 'exam' ? 'selected' : ''}>Examen</option>
                            <option value="assignment" ${evaluation?.type === 'assignment' ? 'selected' : ''}>Tarea</option>
                            <option value="project" ${evaluation?.type === 'project' ? 'selected' : ''}>Proyecto</option>
                            <option value="participation" ${evaluation?.type === 'participation' ? 'selected' : ''}>Participación</option>
                            <option value="attendance" ${evaluation?.type === 'attendance' ? 'selected' : ''}>Asistencia</option>
                            <option value="quiz" ${evaluation?.type === 'quiz' ? 'selected' : ''}>Quiz</option>
                            <option value="lab" ${evaluation?.type === 'lab' ? 'selected' : ''}>Laboratorio</option>
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="evaluationGroup">Grupo *</label>
                        <select id="evaluationGroup" required>
                            <option value="">Seleccionar grupo</option>
                            ${activeGroups.map(group => `
                                <option value="${group.id}" ${evaluation?.groupId === group.id ? 'selected' : ''}>
                                    ${group.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="evaluationWeight">Peso (%) *</label>
                        <input 
                            type="number" 
                            id="evaluationWeight" 
                            value="${evaluation?.weight || ''}" 
                            required
                            min="1"
                            max="100"
                            placeholder="Ej: 25"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="evaluationDate">Fecha de Evaluación *</label>
                        <input 
                            type="date" 
                            id="evaluationDate" 
                            value="${evaluation?.date || ''}" 
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="evaluationMaxScore">Puntaje Máximo *</label>
                        <input 
                            type="number" 
                            id="evaluationMaxScore" 
                            value="${evaluation?.maxScore || 100}" 
                            required
                            min="1"
                            placeholder="Ej: 100"
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="evaluationDescription">Descripción</label>
                    <textarea 
                        id="evaluationDescription" 
                        placeholder="Descripción de la evaluación..."
                    >${evaluation?.description || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Crear'} Evaluación
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const evaluationForm = document.getElementById('evaluationForm');
            if (evaluationForm) {
                evaluationForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveEvaluation(evaluationId);
                });
            }
        }, 100);
    }

    async saveEvaluation(evaluationId = null) {
        const form = document.getElementById('evaluationForm');
        if (!form) return;

        // Prevenir múltiples envíos
        if (form.dataset.saving === 'true') {
            console.log('Ya se está guardando una evaluación, ignorando envío duplicado');
            return;
        }

        const evaluationData = {
            title: document.getElementById('evaluationTitle').value.trim(),
            type: document.getElementById('evaluationType').value,
            groupId: document.getElementById('evaluationGroup').value,
            weight: parseInt(document.getElementById('evaluationWeight').value),
            date: document.getElementById('evaluationDate').value,
            maxScore: parseInt(document.getElementById('evaluationMaxScore').value),
            description: document.getElementById('evaluationDescription').value.trim(),
            updatedAt: new Date().toISOString()
        };

        // Validaciones
        if (!evaluationData.title || !evaluationData.type || !evaluationData.groupId || 
            !evaluationData.weight || !evaluationData.date || !evaluationData.maxScore) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Validar peso
        if (evaluationData.weight < 1 || evaluationData.weight > 100) {
            if (window.app) {
                window.app.showNotification('El peso debe estar entre 1 y 100', 'error');
            }
            return;
        }

        try {
            // Marcar formulario como guardando
            form.dataset.saving = 'true';
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (evaluationId) {
                // Actualizar evaluación existente
                const evaluationRef = ref(db, `evaluations/${evaluationId}`);
                await set(evaluationRef, evaluationData);
            } else {
                // Verificar si ya existe una evaluación similar para evitar duplicados
                const existingEvaluations = Object.values(this.evaluations);
                const duplicate = existingEvaluations.find(evaluation => 
                    evaluation.title === evaluationData.title && 
                    evaluation.groupId === evaluationData.groupId && 
                    evaluation.type === evaluationData.type &&
                    evaluation.date === evaluationData.date
                );

                if (duplicate) {
                    if (window.app) {
                        window.app.showNotification('Ya existe una evaluación con el mismo título, tipo y fecha para este grupo', 'warning');
                    }
                    return;
                }

                // Crear nueva evaluación
                evaluationData.createdAt = new Date().toISOString();
                const evaluationsRef = ref(db, 'evaluations');
                const newEvaluationRef = await push(evaluationsRef, evaluationData);
                
                // Obtener el ID generado por Firebase y actualizar el objeto
                const evaluationId = newEvaluationRef.key;
                await set(ref(db, `evaluations/${evaluationId}/id`), evaluationId);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Evaluación ${evaluationId ? 'actualizada' : 'creada'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar evaluación:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la evaluación', 'error');
            }
        } finally {
            // Limpiar flag de guardando
            form.dataset.saving = 'false';
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${evaluationId ? 'Actualizar' : 'Crear'} Evaluación`;
            }
        }
    }

    editGrade(studentId, evaluationId) {
        const student = Object.values(this.students).find(s => s.studentId === studentId);
        const evaluation = this.evaluations[evaluationId];
        const existingGrade = Object.values(this.grades)
            .find(g => g.studentId === studentId && g.evaluationId === evaluationId);

        if (!student || !evaluation) return;

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-edit"></i> 
                    Editar Nota
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="gradeForm" class="handled">
                <div class="grade-info">
                    <h4>${student.firstName} ${student.lastName}</h4>
                    <p><strong>Evaluación:</strong> ${evaluation.title}</p>
                    <p><strong>Tipo:</strong> ${this.getEvaluationTypeText(evaluation.type)}</p>
                    <p><strong>Peso:</strong> ${evaluation.weight}%</p>
                    <p><strong>Puntaje Máximo:</strong> ${evaluation.maxScore}</p>
                </div>
                
                <div class="form-group">
                    <label for="gradeScore">Nota *</label>
                    <input 
                        type="number" 
                        id="gradeScore" 
                        value="${existingGrade ? existingGrade.score : ''}" 
                        required
                        min="0"
                        max="${evaluation.maxScore}"
                        step="0.1"
                        placeholder="Ingrese la nota"
                    >
                </div>
                
                <div class="form-group">
                    <label for="gradeComments">Comentarios</label>
                    <textarea 
                        id="gradeComments" 
                        placeholder="Comentarios sobre la nota..."
                    >${existingGrade ? existingGrade.comments || '' : ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> Guardar Nota
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const gradeForm = document.getElementById('gradeForm');
            if (gradeForm) {
                gradeForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveGrade(studentId, evaluationId);
                });
            }
        }, 100);
    }

    async saveGrade(studentId, evaluationId) {
        const form = document.getElementById('gradeForm');
        if (!form) return;

        const score = parseFloat(document.getElementById('gradeScore').value);
        const comments = document.getElementById('gradeComments').value.trim();

        if (isNaN(score) || score < 0) {
            if (window.app) {
                window.app.showNotification('Ingrese una nota válida', 'error');
            }
            return;
        }

        const evaluation = this.evaluations[evaluationId];
        if (score > evaluation.maxScore) {
            if (window.app) {
                window.app.showNotification(`La nota no puede ser mayor a ${evaluation.maxScore}`, 'error');
            }
            return;
        }

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const gradeData = {
                studentId,
                evaluationId,
                score,
                comments,
                updatedAt: new Date().toISOString()
            };

            // Buscar si ya existe una nota para este estudiante y evaluación
            const existingGrade = Object.entries(this.grades)
                .find(([id, grade]) => grade.studentId === studentId && grade.evaluationId === evaluationId);

            if (existingGrade) {
                // Actualizar nota existente
                const gradeRef = ref(db, `grades/${existingGrade[0]}`);
                await set(gradeRef, gradeData);
            } else {
                // Crear nueva nota
                gradeData.createdAt = new Date().toISOString();
                const gradesRef = ref(db, 'grades');
                await push(gradesRef, gradeData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification('Nota guardada exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al guardar nota:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar la nota', 'error');
            }
        } finally {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Nota';
            }
        }
    }

    viewStudentDetails(studentId) {
        const student = Object.values(this.students).find(s => s.studentId === studentId);
        if (!student) return;

        const studentGrades = Object.values(this.grades)
            .filter(grade => grade.studentId === studentId);

        const evaluations = Object.values(this.evaluations)
            .filter(evaluation => studentGrades.some(grade => grade.evaluationId === evaluation.id))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Agrupar por tipo de evaluación
        const gradesByType = {};
        evaluations.forEach(evaluation => {
            if (!gradesByType[evaluation.type]) {
                gradesByType[evaluation.type] = [];
            }
            const grade = studentGrades.find(g => g.evaluationId === evaluation.id);
            gradesByType[evaluation.type].push({
                evaluation: evaluation,
                grade: grade
            });
        });

        // Calcular promedios por tipo
        const averagesByType = {};
        Object.entries(gradesByType).forEach(([type, grades]) => {
            const validGrades = grades.filter(g => g.grade);
            if (validGrades.length > 0) {
                const totalWeight = validGrades.reduce((sum, g) => sum + g.evaluation.weight, 0);
                const weightedSum = validGrades.reduce((sum, g) => 
                    sum + (g.grade.score * g.evaluation.weight / 100), 0);
                averagesByType[type] = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
            } else {
                averagesByType[type] = 0;
            }
        });

        // Calcular promedio general
        const totalWeight = evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0);
        const weightedSum = evaluations.reduce((sum, evaluation) => {
            const grade = studentGrades.find(g => g.evaluationId === evaluation.id);
            return sum + (grade ? grade.score * evaluation.weight / 100 : 0);
        }, 0);
        const generalAverage = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-user-graduate"></i> 
                    Detalles Académicos - ${student.firstName} ${student.lastName}
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="student-academic-details">
                <div class="detail-section">
                    <h4>Información del Estudiante</h4>
                    <div class="detail-grid">
                        <div><strong>ID:</strong> ${student.studentId}</div>
                        <div><strong>Nombre:</strong> ${student.firstName} ${student.lastName}</div>
                        <div><strong>Email:</strong> ${student.email}</div>
                        <div><strong>Curso:</strong> ${student.course || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Promedio General</h4>
                    <div class="general-average">
                        <div class="average-score ${this.getAverageClass(generalAverage)}">
                            <span class="score">${generalAverage.toFixed(1)}%</span>
                            <span class="status">${this.getStatusText(this.getStudentStatus(generalAverage))}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Promedios por Rubro</h4>
                    <div class="rubric-averages">
                        ${Object.entries(averagesByType).map(([type, average]) => `
                            <div class="rubric-item">
                                <div class="rubric-type">${this.getEvaluationTypeText(type)}</div>
                                <div class="rubric-score ${this.getAverageClass(average)}">
                                    ${average.toFixed(1)}%
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Detalle de Evaluaciones</h4>
                    <div class="evaluations-detail">
                        ${Object.entries(gradesByType).map(([type, grades]) => `
                            <div class="evaluation-type-group">
                                <h5>${this.getEvaluationTypeText(type)}</h5>
                                <div class="evaluation-list">
                                    ${grades.map(({evaluation, grade}) => `
                                        <div class="evaluation-item">
                                            <div class="eval-info">
                                                <div class="eval-title">${evaluation.title}</div>
                                                <div class="eval-date">${this.formatDate(evaluation.date)}</div>
                                                <div class="eval-weight">Peso: ${evaluation.weight}%</div>
                                            </div>
                                            <div class="eval-grade ${grade ? this.getGradeClass(grade.score) : 'no-grade'}">
                                                ${grade ? grade.score : 'Sin calificar'}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-primary" onclick="window.gradesManager.editStudentGrades('${studentId}')">
                    <i class="fas fa-edit"></i> Editar Notas
                </button>
            </div>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    editStudentGrades(studentId) {
        const student = Object.values(this.students).find(s => s.studentId === studentId);
        if (!student) return;

        const evaluations = Object.values(this.evaluations)
            .filter(evaluation => evaluation.groupId === this.currentGroup)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const studentGrades = Object.values(this.grades)
            .filter(grade => grade.studentId === studentId);

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-edit"></i> 
                    Editar Notas - ${student.firstName} ${student.lastName}
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="studentGradesForm" class="handled">
                <div class="student-info">
                    <h4>${student.firstName} ${student.lastName}</h4>
                    <p>ID: ${student.studentId}</p>
                </div>
                
                <div class="grades-form">
                    ${evaluations.map(evaluation => {
                        const grade = studentGrades.find(g => g.evaluationId === evaluation.id);
                        return `
                            <div class="grade-input-group">
                                <div class="grade-info">
                                    <label>${evaluation.title}</label>
                                    <small>${this.getEvaluationTypeText(evaluation.type)} - ${this.formatDate(evaluation.date)} - Peso: ${evaluation.weight}%</small>
                                </div>
                                <div class="grade-input">
                                    <input 
                                        type="number" 
                                        id="grade_${evaluation.id}" 
                                        value="${grade ? grade.score : ''}" 
                                        min="0"
                                        max="${evaluation.maxScore}"
                                        step="0.1"
                                        placeholder="Nota"
                                    >
                                    <span class="max-score">/ ${evaluation.maxScore}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> Guardar Todas las Notas
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const gradesForm = document.getElementById('studentGradesForm');
            if (gradesForm) {
                gradesForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveStudentGrades(studentId, evaluations);
                });
            }
        }, 100);
    }

    async saveStudentGrades(studentId, evaluations) {
        const form = document.getElementById('studentGradesForm');
        if (!form) return;

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const gradesToSave = [];

            for (const evaluation of evaluations) {
                // Validar que evaluation.id existe
                if (!evaluation.id) {
                    console.error('evaluation.id es undefined para evaluación:', evaluation);
                    continue;
                }

                const input = document.getElementById(`grade_${evaluation.id}`);
                const score = parseFloat(input.value);
                
                if (!isNaN(score) && score >= 0 && score <= evaluation.maxScore) {
                    gradesToSave.push({
                        evaluationId: evaluation.id,
                        score: score
                    });
                }
            }

            // Guardar todas las notas
            console.log('Guardando notas:', gradesToSave);
            for (const gradeData of gradesToSave) {
                // Validar que evaluationId no sea undefined
                if (!gradeData.evaluationId) {
                    console.error('evaluationId es undefined para:', gradeData);
                    continue;
                }

                const existingGrade = Object.entries(this.grades)
                    .find(([id, grade]) => grade.studentId === studentId && grade.evaluationId === gradeData.evaluationId);

                const fullGradeData = {
                    studentId,
                    evaluationId: gradeData.evaluationId,
                    score: gradeData.score,
                    updatedAt: new Date().toISOString()
                };

                console.log('Guardando nota:', fullGradeData);

                if (existingGrade) {
                    // Actualizar nota existente
                    console.log('Actualizando nota existente:', existingGrade[0]);
                    const gradeRef = ref(db, `grades/${existingGrade[0]}`);
                    await set(gradeRef, fullGradeData);
                } else {
                    // Crear nueva nota
                    console.log('Creando nueva nota');
                    fullGradeData.createdAt = new Date().toISOString();
                    const gradesRef = ref(db, 'grades');
                    const newGradeRef = await push(gradesRef, fullGradeData);
                    console.log('Nota creada con ID:', newGradeRef.key);
                }
            }

            // Recargar datos para mostrar las notas actualizadas
            await this.loadAllData();

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification('Notas guardadas exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al guardar notas:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar las notas', 'error');
            }
        } finally {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Todas las Notas';
            }
        }
    }

    getEvaluationTypeText(type) {
        const typeMap = {
            'exam': 'Examen',
            'assignment': 'Tarea',
            'project': 'Proyecto',
            'participation': 'Participación',
            'attendance': 'Asistencia',
            'quiz': 'Quiz',
            'lab': 'Laboratorio'
        };
        return typeMap[type] || type;
    }

    getStatusText(status) {
        const statusMap = {
            'approved': 'Aprobado',
            'conditional': 'Condicional',
            'failed': 'Reprobado'
        };
        return statusMap[status] || status;
    }

    getAverageClass(average) {
        if (average >= 90) return 'excellent';
        if (average >= 80) return 'good';
        if (average >= 70) return 'average';
        return 'poor';
    }

    getGradeClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'average';
        return 'poor';
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    async deleteEvaluation(evaluationId) {
        const evaluation = this.evaluations[evaluationId];
        if (!evaluation) {
            console.error('Evaluación no encontrada:', evaluationId);
            return;
        }

        // Mostrar confirmación
        const confirmed = confirm(
            `¿Está seguro de que desea eliminar la evaluación "${evaluation.title}"?\n\n` +
            `Tipo: ${this.getEvaluationTypeText(evaluation.type)}\n` +
            `Fecha: ${this.formatDate(evaluation.date)}\n` +
            `Peso: ${evaluation.weight}%\n\n` +
            `Esta acción también eliminará todas las notas asociadas a esta evaluación y no se puede deshacer.`
        );

        if (!confirmed) return;

        try {
            // Mostrar indicador de carga
            if (window.app) {
                window.app.showNotification('Eliminando evaluación...', 'info');
            }

            // Eliminar todas las notas asociadas a esta evaluación
            const gradesToDelete = Object.entries(this.grades)
                .filter(([id, grade]) => grade.evaluationId === evaluationId);

            console.log(`Eliminando ${gradesToDelete.length} notas asociadas a la evaluación`);

            for (const [gradeId, grade] of gradesToDelete) {
                const gradeRef = ref(db, `grades/${gradeId}`);
                await remove(gradeRef);
            }

            // Eliminar la evaluación
            const evaluationRef = ref(db, `evaluations/${evaluationId}`);
            await remove(evaluationRef);

            // Recargar datos para actualizar la vista
            await this.loadAllData();

            if (window.app) {
                window.app.showNotification(
                    `Evaluación "${evaluation.title}" eliminada exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al eliminar evaluación:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar la evaluación', 'error');
            }
        }
    }
}

// Crear instancia global - evitar duplicación
if (!window.gradesManager) {
    const initializeGradesManager = () => {
        const gradesTable = document.getElementById('gradesTable');
        
        if (gradesTable && !window.gradesManager) {
            try {
                window.gradesManager = new GradesManager();
                console.log('GradesManager inicializado correctamente');
            } catch (error) {
                console.error('GradesManager: Error al crear instancia:', error);
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGradesManager);
    } else {
        initializeGradesManager();
    }
}

export default GradesManager;
