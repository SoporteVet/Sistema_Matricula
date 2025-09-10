import { 
    ref, 
    push, 
    set, 
    get, 
    remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class StudentsManager {
    constructor() {
        this.students = {};
        this.filteredStudents = {};
        this.courses = {};
        this.groups = {};
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadStudents();
            await this.loadCourseOptions();
            await this.loadGroupOptions();
        } catch (error) {
            console.warn('Error al inicializar StudentsManager:', error);
        }
    }

    setupEventListeners() {
        // Botón para agregar nuevo estudiante
        const addStudentBtn = document.getElementById('addStudentBtn');
        if (addStudentBtn) {
            addStudentBtn.addEventListener('click', () => {
                this.showStudentModal();
            });
        }

        // Filtros
        const groupFilter = document.getElementById('groupFilter');
        if (groupFilter) {
            groupFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const studentSearch = document.getElementById('studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', () => {
                this.applyFilters();
            });
        }

        const insuranceDateFilter = document.getElementById('insuranceDateFilter');
        if (insuranceDateFilter) {
            insuranceDateFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        // Suscribirse a actualizaciones en tiempo real de estudiantes
        this.unsubscribeStudents = realtimeManager.subscribe('students', (students) => {
            this.students = students;
            this.applyFilters();
        });
        
        // Suscribirse a actualizaciones en tiempo real de cursos para las opciones
        this.unsubscribeCourses = realtimeManager.subscribe('courses', (courses) => {
            this.courses = courses;
            this.updateCourseOptions();
        });
        
        // Suscribirse a actualizaciones en tiempo real de grupos
        this.unsubscribeGroups = realtimeManager.subscribe('groups', (groups) => {
            this.groups = groups;
            this.updateGroupOptions();
        });
    }

    async loadStudents() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para estudiantes');
                return;
            }

            const studentsRef = ref(db, 'students');
            const snapshot = await get(studentsRef);
            
            if (snapshot.exists()) {
                this.students = snapshot.val();
            } else {
                this.students = {};
            }
            
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar estudiantes', 'error');
            }
        }
    }

    async loadCourseOptions() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para cursos');
                return;
            }

            const coursesRef = ref(db, 'courses');
            const snapshot = await get(coursesRef);
            
            if (snapshot.exists()) {
                this.courses = snapshot.val();
            } else {
                this.courses = {};
            }
            
            this.updateCourseSelects();
        } catch (error) {
            console.error('Error al cargar cursos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                console.warn('Error al cargar opciones de cursos:', error);
            }
            this.courses = {};
        }
    }

    async loadGroupOptions() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para grupos');
                return;
            }

            const groupsRef = ref(db, 'groups');
            const snapshot = await get(groupsRef);
            
            if (snapshot.exists()) {
                this.groups = snapshot.val();
            } else {
                this.groups = {};
            }
            
            this.updateGroupSelects();
        } catch (error) {
            console.error('Error al cargar grupos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                console.warn('Error al cargar opciones de grupos:', error);
            }
            this.groups = {};
        }
    }

    updateCourseSelects() {
        // Mantener para compatibilidad con otros módulos
    }

    updateGroupSelects() {
        const groupFilter = document.getElementById('groupFilter');
        
        if (groupFilter) {
            const activeGroups = Object.values(this.groups)
                .filter(group => group.status === 'active')
                .sort((a, b) => a.groupCode.localeCompare(b.groupCode));
            
            groupFilter.innerHTML = '<option value="">Todos los grupos</option>' +
                activeGroups.map(group => 
                    `<option value="${group.groupCode}">${group.groupCode} - ${group.groupName}</option>`
                ).join('');
        }
    }

    // Método para actualizar opciones de cursos (usado por el sistema de tiempo real)
    updateCourseOptions() {
        this.updateCourseSelects();
    }

    // Método para actualizar opciones de grupos (usado por el sistema de tiempo real)
    updateGroupOptions() {
        this.updateGroupSelects();
    }

    // Limpiar suscripciones al destruir el módulo
    destroy() {
        if (this.unsubscribeStudents) {
            this.unsubscribeStudents();
        }
        if (this.unsubscribeCourses) {
            this.unsubscribeCourses();
        }
        if (this.unsubscribeGroups) {
            this.unsubscribeGroups();
        }
    }

    applyFilters() {
        const groupFilter = document.getElementById('groupFilter')?.value || '';
        const searchText = document.getElementById('studentSearch')?.value.toLowerCase() || '';
        const insuranceDateFilter = document.getElementById('insuranceDateFilter')?.value || '';

        this.filteredStudents = Object.fromEntries(
            Object.entries(this.students).filter(([id, student]) => {
                const matchesGroup = !groupFilter || student.group === groupFilter;
                const matchesSearch = !searchText || 
                    student.firstName.toLowerCase().includes(searchText) ||
                    student.lastName.toLowerCase().includes(searchText) ||
                    student.email.toLowerCase().includes(searchText) ||
                    student.studentId.toLowerCase().includes(searchText) ||
                    (student.group && student.group.toLowerCase().includes(searchText));
                const matchesInsuranceDate = !insuranceDateFilter || student.insuranceDate === insuranceDateFilter;
                
                return matchesGroup && matchesSearch && matchesInsuranceDate;
            })
        );

        this.renderStudentsTable();
    }

    renderStudentsTable() {
        const tbody = document.querySelector('#studentsTable tbody');
        if (!tbody) return;

        const studentsToShow = Object.keys(this.filteredStudents).length > 0 ? 
            this.filteredStudents : this.students;

        if (Object.keys(studentsToShow).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-user-graduate fa-3x mb-3"></i>
                            <h4>No hay estudiantes veterinarios registrados</h4>
                            <p>Comience agregando un nuevo estudiante veterinario</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(studentsToShow)
            .map(([id, student]) => `
                <tr>
                    <td>
                        <strong>${student.studentId}</strong>
                        <br>
                        <small style="color: #666;">Grupo: ${student.group || 'N/A'}</small>
                    </td>
                    <td>${student.cedula || 'N/A'}</td>
                    <td>${student.firstName} ${student.lastName}</td>
                    <td>${student.email}</td>
                    <td>${this.formatPhone(student.phone)}</td>
                    <td>${student.course || 'N/A'}</td>
                    <td>
                        <span class="status-badge ${student.status}">
                            ${this.getStatusText(student.status)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-warning" onclick="window.studentsManager.editStudent('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger" onclick="window.studentsManager.deleteStudent('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-success" onclick="window.studentsManager.viewStudentDetails('${id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
    }

    showStudentModal(studentId = null) {
        const student = studentId ? this.students[studentId] : null;
        const isEdit = student !== null;

        // Verificar que los cursos y grupos estén cargados
        if (Object.keys(this.courses).length === 0 || Object.keys(this.groups).length === 0) {
            Promise.all([
                this.loadCourseOptions(),
                this.loadGroupOptions()
            ]).then(() => {
                // Recursivamente llamar a showStudentModal después de cargar los datos
                this.showStudentModal(studentId);
            });
            return;
        }

        const activeCourses = Object.values(this.courses)
            .filter(course => course.status === 'active');
        
        const activeGroups = Object.values(this.groups)
            .filter(group => group.status === 'active')
            .sort((a, b) => a.groupCode.localeCompare(b.groupCode));

        // Verificar que hay cursos y grupos disponibles
        if (activeCourses.length === 0) {
            if (window.app) {
                window.app.showModal(`
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> No hay cursos disponibles</h3>
                        <button class="close-modal"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="padding: 20px;">
                        <p>No se pueden crear estudiantes sin cursos veterinarios activos.</p>
                        <p>Por favor, primero cree al menos un curso veterinario.</p>
                        <div style="text-align: center; margin-top: 20px;">
                            <button class="btn-primary" onclick="window.app.closeModal(); window.app.navigateToSection('courses');">
                                <i class="fas fa-book"></i> Ir a Cursos
                            </button>
                        </div>
                    </div>
                `);
            }
            return;
        }
        
        if (activeGroups.length === 0) {
            if (window.app) {
                window.app.showModal(`
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> No hay grupos disponibles</h3>
                        <button class="close-modal"><i class="fas fa-times"></i></button>
                    </div>
                    <div style="padding: 20px;">
                        <p>No se pueden crear estudiantes sin grupos activos.</p>
                        <p>Por favor, primero cree al menos un grupo.</p>
                        <div style="text-align: center; margin-top: 20px;">
                            <button class="btn-primary" onclick="window.app.closeModal(); window.app.navigateToSection('groups');">
                                <i class="fas fa-users"></i> Ir a Grupos
                            </button>
                        </div>
                    </div>
                `);
            }
            return;
        }

        const modalContent = `
            <div class="modal-header">
                                    <h3>
                        <i class="fas fa-user-graduate"></i> 
                        ${isEdit ? 'Editar' : 'Nuevo'} Estudiante Veterinario
                    </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="studentForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="studentId">ID del Estudiante *</label>
                        <input 
                            type="text" 
                            id="studentId" 
                            value="${student?.studentId || ''}" 
                            required
                            placeholder="Ej: EST001"
                        >
                        ${isEdit ? '<small></small>' : ''}
                    </div>
                    
                    <div class="form-group">
                        <label for="studentGroup">Grupo *</label>
                        <select id="studentGroup" required>
                            <option value="">Seleccionar grupo</option>
                            ${activeGroups.map(group => `
                                <option value="${group.groupCode}" ${student?.group === group.groupCode ? 'selected' : ''}>
                                    ${group.groupCode} - ${group.groupName}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="studentCedula">Cédula *</label>
                        <input 
                            type="text" 
                            id="studentCedula" 
                            value="${student?.cedula || ''}" 
                            required
                            placeholder="Ej: 123456789"
                            pattern="[0-9]{9,12}"
                            title="La cédula debe tener entre 9 y 12 dígitos numéricos"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="studentCourse">Nivel Académico *</label>
                        <select id="studentCourse" required>
                            <option value="">Seleccionar nivel académico</option>
                            <option value="Asistente Técnico Veterinario" ${student?.course === 'Asistente Técnico Veterinario' ? 'selected' : ''}>
                                Asistente Técnico Veterinario
                            </option>
                            <option value="Diplomado" ${student?.course === 'Diplomado' ? 'selected' : ''}>
                                Diplomado
                            </option>
                            <option value="Curso Libre" ${student?.course === 'Curso Libre' ? 'selected' : ''}>
                                Curso Libre
                            </option>
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="firstName">Nombre *</label>
                        <input 
                            type="text" 
                            id="firstName" 
                            value="${student?.firstName || ''}" 
                            required
                            placeholder="Nombre"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="lastName">Apellidos *</label>
                        <input 
                            type="text" 
                            value="${student?.lastName || ''}" 
                            required
                            placeholder="Apellidos"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="lastName">Apellidos *</label>
                        <input 
                            type="text" 
                            id="lastName" 
                            value="${student?.lastName || ''}" 
                            required
                            placeholder="Apellidos"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email *</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email"
                            value="${student?.email || ''}" 
                            required
                            placeholder="email@ejemplo.com"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="phone">Teléfono Principal</label>
                        <input 
                            type="tel" 
                            id="phone" 
                            value="${student?.phone || ''}" 
                            placeholder="5524-2121"
                            pattern="[0-9]{8}|[0-9]{4}-[0-9]{4}"
                            title="El teléfono debe tener 8 dígitos"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="secondaryPhone">Teléfono Secundario</label>
                        <input 
                            type="tel" 
                            id="secondaryPhone" 
                            value="${student?.secondaryPhone || ''}" 
                            placeholder="5524-2121"
                            pattern="[0-9]{8}|[0-9]{4}-[0-9]{4}"
                            title="El teléfono debe tener 8 dígitos"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="birthDate">Fecha de Nacimiento</label>
                        <input 
                            type="date" 
                            id="birthDate" 
                            value="${student?.birthDate || ''}"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="enrollmentDate">Fecha de Matrícula</label>
                        <input 
                            type="date" 
                            id="enrollmentDate" 
                            value="${student?.enrollmentDate || new Date().toISOString().slice(0, 10)}"
                            required
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="insuranceDate">Fecha de Inscripción del Seguro</label>
                        <input 
                            type="date" 
                            id="insuranceDate" 
                            value="${student?.insuranceDate || ''}"
                            placeholder="Fecha de inscripción del seguro"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="graduationDate">Fecha de Graduación</label>
                        <input 
                            type="date" 
                            id="graduationDate" 
                            value="${student?.graduationDate || ''}"
                            placeholder="Fecha de graduación"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="address">Dirección</label>
                        <textarea 
                            id="address" 
                            placeholder="Dirección completa..."
                        >${student?.address || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="notes">Observaciones</label>
                        <textarea 
                            id="notes" 
                            placeholder="Notas adicionales..."
                        >${student?.notes || ''}</textarea>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="studentStatus">Estado</label>
                    <select id="studentStatus" required>
                        <option value="active" ${student?.status === 'active' ? 'selected' : ''}>Activo</option>
                        <option value="inactive" ${student?.status === 'inactive' ? 'selected' : ''}>Congelado</option>
                        <option value="graduated" ${student?.status === 'graduated' ? 'selected' : ''}>Graduado</option>
                        <option value="dropped" ${student?.status === 'dropped' ? 'selected' : ''}>Abandonó</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Crear'} Estudiante Veterinario
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario con un pequeño delay para asegurar que el modal esté renderizado
        setTimeout(() => {
            const studentForm = document.getElementById('studentForm');
            if (studentForm) {
                studentForm.addEventListener('submit', (e) => {
                    try {
                        e.preventDefault();
                        this.saveStudent(studentId);
                    } catch (error) {
                        console.error('Error en el evento submit del formulario:', error);
                        if (window.app) {
                            window.app.showNotification('Error al procesar el formulario: ' + error.message, 'error');
                        }
                    }
                });
            }
        }, 100);
    }

    async saveStudent(studentId = null) {
        const form = document.getElementById('studentForm');
        if (!form) return;

        // Debug: verificar que el formulario existe
        console.log('Formulario encontrado:', form);

        // Capturar el email usando FormData (que SÍ funciona)
        const formData = new FormData(form);
        const emailValue = formData.get('email') || '';
        
        console.log('=== FORMDATA DEBUG ===');
        console.log('Email desde FormData:', formData.get('email'));
        console.log('Email value final:', emailValue);
        console.log('========================');
        
        const studentData = {
            studentId: document.getElementById('studentId').value.trim(),
            group: document.getElementById('studentGroup').value,
            cedula: document.getElementById('studentCedula').value.trim(),
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            email: emailValue,
            phone: document.getElementById('phone').value.trim(),
            secondaryPhone: document.getElementById('secondaryPhone').value.trim(),
            course: document.getElementById('studentCourse').value,
            birthDate: document.getElementById('birthDate').value,
            enrollmentDate: document.getElementById('enrollmentDate').value,
            insuranceDate: document.getElementById('insuranceDate').value,
            graduationDate: document.getElementById('graduationDate').value,
            address: document.getElementById('address').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            status: document.getElementById('studentStatus').value,
            updatedAt: new Date().toISOString()
        };

        // Verificar que todos los elementos del formulario existen
        const formElements = {
            studentId: document.getElementById('studentId'),
            studentGroup: document.getElementById('studentGroup'),
            studentCedula: document.getElementById('studentCedula'),
            firstName: document.getElementById('firstName'),
            lastName: document.getElementById('lastName'),
            email: document.getElementById('email'),
            phone: document.getElementById('phone'),
            secondaryPhone: document.getElementById('secondaryPhone'),
            studentCourse: document.getElementById('studentCourse'),
            birthDate: document.getElementById('birthDate'),
            enrollmentDate: document.getElementById('enrollmentDate'),
            insuranceDate: document.getElementById('insuranceDate'),
            graduationDate: document.getElementById('graduationDate'),
            address: document.getElementById('address'),
            notes: document.getElementById('notes'),
            studentStatus: document.getElementById('studentStatus')
        };
        
        // Verificar si algún elemento no se encontró
        const missingElements = Object.entries(formElements)
            .filter(([name, element]) => !element)
            .map(([name]) => name);
            
        if (missingElements.length > 0) {
            console.error('Elementos del formulario no encontrados:', missingElements);
            if (window.app) {
                window.app.showNotification(`Error: Elementos del formulario no encontrados: ${missingElements.join(', ')}`, 'error');
            }
            return;
        }

        // Validaciones
        if (!studentData.studentId || !studentData.group || !studentData.cedula || !studentData.firstName || !studentData.lastName || 
            !studentData.email || !studentData.course || !studentData.enrollmentDate) {
            if (window.app) {
                // Mostrar qué campos están vacíos para debugging
                const emptyFields = [];
                if (!studentData.studentId) emptyFields.push('ID del Estudiante');
                if (!studentData.group) emptyFields.push('Número de Grupo');
                if (!studentData.cedula) emptyFields.push('Cédula');
                if (!studentData.firstName) emptyFields.push('Nombre');
                if (!studentData.lastName) emptyFields.push('Apellidos');
                if (!studentData.email) emptyFields.push('Email');
                if (!studentData.course) emptyFields.push('Curso');
                if (!studentData.enrollmentDate) emptyFields.push('Fecha de Matrícula');
                
                console.log('Campos vacíos detectados:', emptyFields);
                console.log('Valor del curso seleccionado:', studentData.course);
                console.log('Elemento del curso:', document.getElementById('studentCourse'));
                
                // Debug adicional para email
                if (!studentData.email) {
                    console.log('=== EMAIL VACÍO DEBUG ===');
                    const emailField = document.getElementById('email');
                    if (emailField) {
                        console.log('Email field existe pero value está vacío');
                        console.log('Email field value directo:', emailField.value);
                        console.log('Email field valueAsString:', emailField.valueAsString);
                        console.log('Email field defaultValue:', emailField.defaultValue);
                        console.log('Email field getAttribute value:', emailField.getAttribute('value'));
                    } else {
                        console.log('Email field no existe en el DOM');
                    }
                    console.log('========================');
                }
                
                window.app.showNotification(`Complete todos los campos requeridos: ${emptyFields.join(', ')}`, 'error');
            }
            return;
        }

        // Validar cédula (debe tener entre 9 y 12 dígitos)
        if (!/^\d{9,12}$/.test(studentData.cedula)) {
            if (window.app) {
                window.app.showNotification('La cédula debe tener entre 9 y 12 dígitos numéricos', 'error');
            }
            return;
        }

        // Validar email
        if (!this.validateEmail(studentData.email)) {
            if (window.app) {
                window.app.showNotification('Ingrese un email válido', 'error');
            }
            return;
        }

        // Verificar que el ID no esté duplicado
        const isDuplicate = Object.entries(this.students).some(([id, student]) => 
            student.studentId.toLowerCase() === studentData.studentId.toLowerCase() && id !== studentId
        );

        if (isDuplicate) {
            if (window.app) {
                window.app.showNotification('El ID del estudiante ya existe', 'error');
            }
            return;
        }

        // Verificar que la cédula no esté duplicada
        const isCedulaDuplicate = Object.entries(this.students).some(([id, student]) => 
            student.cedula === studentData.cedula && id !== studentId
        );

        if (isCedulaDuplicate) {
            if (window.app) {
                window.app.showNotification('La cédula ya está registrada para otro estudiante', 'error');
            }
            return;
        }

        // Validar teléfono principal (debe tener 8 dígitos, permitiendo espacios o guiones)
        if (studentData.phone) {
            const cleanPhone = studentData.phone.replace(/[\s-]/g, '');
            if (!/^\d{8}$/.test(cleanPhone)) {
                if (window.app) {
                    window.app.showNotification('El teléfono principal debe tener exactamente 8 dígitos (ej: 72654651, 7265-4651)', 'error');
                }
                return;
            }
            // Guardar el teléfono limpio (solo números)
            studentData.phone = cleanPhone;
        }

        // Validar teléfono secundario (opcional, pero si se proporciona debe tener 8 dígitos)
        if (studentData.secondaryPhone) {
            const cleanSecondaryPhone = studentData.secondaryPhone.replace(/[\s-]/g, '');
            if (!/^\d{8}$/.test(cleanSecondaryPhone)) {
                if (window.app) {
                    window.app.showNotification('El teléfono secundario debe tener exactamente 8 dígitos (ej: 72654651, 7265-4651)', 'error');
                }
                return;
            }
            // Guardar el teléfono secundario limpio (solo números)
            studentData.secondaryPhone = cleanSecondaryPhone;
        }

        console.log('Todas las validaciones pasaron, procediendo a guardar...');

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (studentId) {
                // Actualizar estudiante existente
                const studentRef = ref(db, `students/${studentId}`);
                await set(studentRef, studentData);
            } else {
                // Crear nuevo estudiante
                studentData.createdAt = new Date().toISOString();
                const studentsRef = ref(db, 'students');
                await push(studentsRef, studentData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Estudiante ${studentId ? 'actualizado' : 'creado'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar estudiante:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar el estudiante', 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${studentId ? 'Actualizar' : 'Crear'} Estudiante`;
            }
        }
    }

    editStudent(studentId) {
        this.showStudentModal(studentId);
    }

    async deleteStudent(studentId) {
        const student = this.students[studentId];
        if (!student) return;

        const confirmed = confirm(
            `¿Está seguro de que desea eliminar al estudiante "${student.firstName} ${student.lastName}"?\n\n` +
            'Esta acción no se puede deshacer y eliminará todos los datos relacionados.'
        );

        if (!confirmed) return;

        try {
            // Eliminar estudiante
            const studentRef = ref(db, `students/${studentId}`);
            await remove(studentRef);

            // TODO: También eliminar datos relacionados (pagos, asistencia)

            if (window.app) {
                window.app.showNotification('Estudiante eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar estudiante:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el estudiante', 'error');
            }
        }
    }

    viewStudentDetails(studentId) {
        const student = this.students[studentId];
        if (!student) return;

        const modalContent = `
            <div class="modal-header">
                                    <h3>
                        <i class="fas fa-user-graduate"></i> 
                        Detalles del Estudiante Veterinario
                    </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="student-details">
                <div class="detail-section">
                    <h4>Información Personal</h4>
                    <div class="detail-grid">
                        <div><strong>ID:</strong> ${student.studentId}</div>
                        <div><strong>Número de Grupo:</strong> ${student.group || 'No especificado'}</div>
                        <div><strong>Cédula:</strong> ${student.cedula || 'No especificada'}</div>
                        <div><strong>Nombre:</strong> ${student.firstName} ${student.lastName}</div>
                        <div><strong>Email:</strong> ${student.email}</div>
                        <div><strong>Teléfono Principal:</strong> ${this.formatPhone(student.phone)}</div>
                        <div><strong>Teléfono Secundario:</strong> ${student.secondaryPhone ? this.formatPhone(student.secondaryPhone) : 'No especificado'}</div>
                        <div><strong>Fecha de Nacimiento:</strong> ${student.birthDate ? this.formatDate(student.birthDate) : 'No especificada'}</div>
                        <div><strong>Dirección:</strong> ${student.address || 'No especificada'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Información Académica</h4>
                    <div class="detail-grid">
                        <div><strong>Nivel Académico:</strong> ${student.course || 'No especificado'}</div>
                        <div><strong>Estado:</strong> <span class="status-badge ${student.status}">${this.getStatusText(student.status)}</span></div>
                        <div><strong>Fecha de Matrícula:</strong> ${this.formatDate(student.enrollmentDate)}</div>
                        <div><strong>Fecha de Inscripción del Seguro:</strong> ${student.insuranceDate ? this.formatDate(student.insuranceDate) : 'No especificada'}</div>
                        <div><strong>Fecha de Graduación:</strong> ${student.graduationDate ? this.formatDate(student.graduationDate) : 'No especificada'}</div>
                        <div><strong>Fecha de Registro:</strong> ${student.createdAt ? this.formatDateTime(student.createdAt) : 'No disponible'}</div>
                    </div>
                </div>
                
                ${student.notes ? `
                <div class="detail-section">
                    <h4>Observaciones</h4>
                    <p>${student.notes}</p>
                </div>
                ` : ''}
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-primary" onclick="window.studentsManager.editStudent('${studentId}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </div>
            
            <style>
                .student-details .detail-section {
                    margin-bottom: 25px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .student-details .detail-section h4 {
                    margin-bottom: 15px;
                    color: #2c3e50;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 5px;
                }
                
                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                
                @media (max-width: 480px) {
                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'Activo',
            'inactive': 'Congelado',
            'graduated': 'Graduado',
            'dropped': 'Abandonó'
        };
        return statusMap[status] || status;
    }

    validateEmail(email) {
        if (!email) {
            return false;
        }
        
        if (typeof email !== 'string') {
            return false;
        }
        
        if (email.trim() === '') {
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES').format(new Date(date));
    }

    formatDateTime(date) {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    formatPhone(phone) {
        if (!phone) return 'N/A';
        // Formatear como 7265-4651 en una sola línea
        return phone.replace(/(\d{4})(\d{4})/, '$1-$2');
    }

    // Obtener lista de estudiantes activos
    getActiveStudents() {
        return Object.entries(this.students)
            .filter(([id, student]) => student.status === 'active')
            .map(([id, student]) => ({
                id,
                name: `${student.firstName} ${student.lastName}`,
                studentId: student.studentId,
                level: student.course,
                email: student.email
            }));
    }

    // Obtener estudiante por ID
    getStudent(studentId) {
        return this.students[studentId] || null;
    }

    // Exportar lista de estudiantes
    exportStudents() {
        const exportData = Object.values(this.students).map(student => ({
            'ID': student.studentId,
            'Número de Grupo': student.group || 'N/A',
            'Cédula': student.cedula,
            'Nombre': `${student.firstName} ${student.lastName}`,
            'Email': student.email,
            'Teléfono Principal': student.phone ? this.formatPhone(student.phone) : 'N/A',
            'Teléfono Secundario': student.secondaryPhone ? this.formatPhone(student.secondaryPhone) : 'N/A',
            'Nivel Académico': student.course || 'N/A',
            'Estado': this.getStatusText(student.status),
            'Fecha de Matrícula': student.enrollmentDate ? this.formatDate(student.enrollmentDate) : 'N/A',
            'Fecha de Seguro': student.insuranceDate ? this.formatDate(student.insuranceDate) : 'N/A',
            'Fecha de Graduación': student.graduationDate ? this.formatDate(student.graduationDate) : 'N/A',
            'Dirección': student.address || 'N/A',
            'Observaciones': student.notes || 'N/A'
        }));

        // Crear archivo Excel
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes');
        
        // Descargar archivo
        XLSX.writeFile(wb, `estudiantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }






}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('studentsTable')) {
        window.studentsManager = new StudentsManager();
        // No inicializar automáticamente, esperar a que la app esté lista
    }
});

export default StudentsManager;
