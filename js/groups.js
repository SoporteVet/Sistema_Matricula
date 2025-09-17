import { 
    ref, 
    push, 
    set, 
    get, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class GroupsManager {
    constructor() {
        this.groups = {};
        this.students = {};
        this.courses = {};
        this.filteredGroups = {};
        // No inicializar automáticamente, esperar a que la autenticación esté lista
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadData(); // Cargar estudiantes primero
            await this.loadGroups(); // Luego cargar grupos
        } catch (error) {
            console.warn('Error al inicializar GroupsManager:', error);
        }
    }

    setupEventListeners() {
        // Botón para agregar nuevo grupo
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => {
                this.showGroupModal();
            });
        }

        // Filtros
        const groupAcademicLevelFilter = document.getElementById('groupAcademicLevelFilter');
        if (groupAcademicLevelFilter) {
            groupAcademicLevelFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const groupPeriodFilter = document.getElementById('groupPeriodFilter');
        if (groupPeriodFilter) {
            groupPeriodFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        const groupsRef = ref(db, 'groups');
        onValue(groupsRef, (snapshot) => {
            if (snapshot.exists()) {
                this.groups = snapshot.val();
                this.applyFilters();
            } else {
                this.groups = {};
                this.renderGroupsTable();
            }
        });
    }

    async loadGroups() {
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
            
            this.applyFilters();
        } catch (error) {
            console.error('Error al cargar grupos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar grupos', 'error');
            }
        }
    }

    async loadData() {
        try {
            // Verificar que la base de datos esté disponible
            if (!db) {
                console.warn('Base de datos no disponible para grupos');
                return;
            }

            // Cargar estudiantes
            const studentsRef = ref(db, 'students');
            const studentsSnapshot = await get(studentsRef);
            if (studentsSnapshot.exists()) {
                this.students = studentsSnapshot.val();
            } else {
                this.students = {};
            }

            // Ya no necesitamos cargar cursos, usamos niveles académicos fijos
        } catch (error) {
            console.error('Error al cargar datos:', error);
            // Solo mostrar notificación si no es un error de permisos
            if (window.app && error.code !== 'PERMISSION_DENIED') {
                window.app.showNotification('Error al cargar datos', 'error');
            }
        }
    }

    applyFilters() {
        const academicLevelFilter = document.getElementById('groupAcademicLevelFilter')?.value || '';
        const periodFilter = document.getElementById('groupPeriodFilter')?.value || '';

        this.filteredGroups = Object.fromEntries(
            Object.entries(this.groups).filter(([id, group]) => {
                const matchesAcademicLevel = !academicLevelFilter || 
                    group.academicLevel === academicLevelFilter || 
                    group.courseName === academicLevelFilter; // Compatibilidad con datos existentes
                const matchesPeriod = !periodFilter || group.period === periodFilter;
                
                return matchesAcademicLevel && matchesPeriod;
            })
        );

        this.renderGroupsTable();
    }

    renderGroupsTable() {
        const tbody = document.querySelector('#groupsTable tbody');
        if (!tbody) return;

        const groupsToShow = Object.keys(this.filteredGroups).length > 0 ? 
            this.filteredGroups : this.groups;

        if (Object.keys(groupsToShow).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-users fa-3x mb-3"></i>
                            <h4>No hay grupos creados</h4>
                            <p>Comience creando un nuevo grupo</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(groupsToShow)
            .sort(([,a], [,b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .map(([id, group]) => {
                const studentCount = this.getGroupStudentCount(id, group);
                
                return `
                <tr>
                    <td><strong>${group.groupCode}</strong></td>
                    <td>${group.groupName}</td>
                    <td>${group.academicLevel || group.courseName || 'N/A'}</td>
                    <td><span class="badge ${group.period}">${this.getPeriodText(group.period)}</span></td>
                    <td>${group.year}</td>
                    <td>${studentCount} estudiantes</td>
                    <td>
                        <span class="status-badge ${group.status}">
                            ${this.getStatusText(group.status)}
                        </span>
                    </td>
                    <td>
                        <button class="btn-info" onclick="window.groupsManager.viewGroupDetails('${id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-warning" onclick="window.groupsManager.editGroup('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-success" onclick="window.groupsManager.manageStudents('${id}')">
                            <i class="fas fa-users"></i>
                        </button>
                        <button class="btn-danger" onclick="window.groupsManager.deleteGroup('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            }).join('');
    }

    showGroupModal(groupId = null) {
        const group = groupId ? this.groups[groupId] : null;
        const isEdit = group !== null;

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-users"></i> 
                    ${isEdit ? 'Editar' : 'Crear'} Grupo
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="groupForm" class="handled">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="groupCode">Código del Grupo *</label>
                        <input 
                            type="text" 
                            id="groupCode" 
                            value="${group?.groupCode || ''}" 
                            required
                            placeholder="Ej: VET-2024-S1-A"
                            ${isEdit ? 'readonly' : ''}
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="groupName">Nombre del Grupo *</label>
                        <input 
                            type="text" 
                            id="groupName" 
                            value="${group?.groupName || ''}" 
                            required
                            placeholder="Ej: Grupo A - Primer Semestre"
                        >
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="groupAcademicLevel">Nivel Académico *</label>
                        <select id="groupAcademicLevel" required>
                            <option value="">Seleccionar nivel académico</option>
                            <option value="Asistente Técnico Veterinario" ${group?.academicLevel === 'Asistente Técnico Veterinario' ? 'selected' : ''}>
                                Asistente Técnico Veterinario
                            </option>
                            <option value="Diplomado" ${group?.academicLevel === 'Diplomado' ? 'selected' : ''}>
                                Diplomado
                            </option>
                            <option value="Curso Libre" ${group?.academicLevel === 'Curso Libre' ? 'selected' : ''}>
                                Curso Libre
                            </option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="groupPeriod">Período Académico *</label>
                        <select id="groupPeriod" required>
                            <option value="">Seleccionar período</option>
                            <option value="mensual" ${group?.period === 'mensual' ? 'selected' : ''}>Mensual</option>
                            <option value="trimestral" ${group?.period === 'trimestral' ? 'selected' : ''}>Trimestral</option>
                            <option value="cuatrimestral" ${group?.period === 'cuatrimestral' ? 'selected' : ''}>Cuatrimestral</option>
                            <option value="semestral" ${group?.period === 'semestral' ? 'selected' : ''}>Semestral</option>
                            <option value="anual" ${group?.period === 'anual' ? 'selected' : ''}>Anual</option>
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="groupYear">Año *</label>
                        <input 
                            type="number" 
                            id="groupYear" 
                            value="${group?.year || new Date().getFullYear()}" 
                            required
                            min="2020"
                            max="2030"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="groupStartDate">Fecha de Inicio *</label>
                        <input 
                            type="date" 
                            id="groupStartDate" 
                            value="${group?.startDate || ''}" 
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="groupEndDate">Fecha de Fin *</label>
                        <input 
                            type="date" 
                            id="groupEndDate" 
                            value="${group?.endDate || ''}" 
                            required
                        >
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="groupDescription">Descripción</label>
                    <textarea 
                        id="groupDescription" 
                        placeholder="Descripción del grupo..."
                    >${group?.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="groupStatus">Estado</label>
                    <select id="groupStatus" required>
                        <option value="active" ${group?.status === 'active' ? 'selected' : ''}>Activo</option>
                        <option value="inactive" ${group?.status === 'inactive' ? 'selected' : ''}>Congelado</option>
                        <option value="completed" ${group?.status === 'completed' ? 'selected' : ''}>Completado</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> 
                        ${isEdit ? 'Actualizar' : 'Crear'} Grupo
                    </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        setTimeout(() => {
            const groupForm = document.getElementById('groupForm');
            if (groupForm) {
                groupForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveGroup(groupId);
                });
            }
        }, 100);
    }

    async saveGroup(groupId = null) {
        const form = document.getElementById('groupForm');
        if (!form) return;

        const groupData = {
            groupCode: document.getElementById('groupCode').value.trim(),
            groupName: document.getElementById('groupName').value.trim(),
            academicLevel: document.getElementById('groupAcademicLevel').value,
            period: document.getElementById('groupPeriod').value,
            year: parseInt(document.getElementById('groupYear').value),
            startDate: document.getElementById('groupStartDate').value,
            endDate: document.getElementById('groupEndDate').value,
            description: document.getElementById('groupDescription').value.trim(),
            status: document.getElementById('groupStatus').value,
            students: groupId && this.groups[groupId] ? this.groups[groupId].students || [] : [],
            updatedAt: new Date().toISOString()
        };

        // Validaciones
        if (!groupData.groupCode || !groupData.groupName || !groupData.academicLevel || 
            !groupData.period || !groupData.year || !groupData.startDate || !groupData.endDate) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Validar fechas
        if (new Date(groupData.startDate) >= new Date(groupData.endDate)) {
            if (window.app) {
                window.app.showNotification('La fecha de inicio debe ser anterior a la fecha de fin', 'error');
            }
            return;
        }

        // Verificar código duplicado
        const isDuplicate = Object.entries(this.groups).some(([id, group]) => 
            group.groupCode.toLowerCase() === groupData.groupCode.toLowerCase() && id !== groupId
        );

        if (isDuplicate) {
            if (window.app) {
                window.app.showNotification('El código del grupo ya existe', 'error');
            }
            return;
        }

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (groupId) {
                // Actualizar grupo existente
                const groupRef = ref(db, `groups/${groupId}`);
                await set(groupRef, groupData);
            } else {
                // Crear nuevo grupo
                groupData.createdAt = new Date().toISOString();
                const groupsRef = ref(db, 'groups');
                await push(groupsRef, groupData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Grupo ${groupId ? 'actualizado' : 'creado'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar grupo:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar el grupo', 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${groupId ? 'Actualizar' : 'Crear'} Grupo`;
            }
        }
    }

    manageStudents(groupId) {
        const group = this.groups[groupId];
        if (!group) return;

        const availableStudents = Object.entries(this.students)
            .filter(([id, student]) => 
                student.status === 'active' && 
                student.course === (group.academicLevel || group.courseName) &&
                !(group.students || []).includes(id)
            );

        // Usar el mismo método que en el conteo de la tabla
        let groupStudents = [];
        
        if (group.students && group.students.length > 0) {
            // Método 1: Usar array group.students
            groupStudents = group.students
                .map(studentId => this.students[studentId])
                .filter(student => student && student.status === 'active');
        } else {
            // Método 2: Buscar estudiantes por campo group
            const groupName = group.groupName || group.groupCode || '';
            const groupCode = group.groupCode || '';
            
            groupStudents = Object.entries(this.students)
                .filter(([studentId, student]) => {
                    if (!student || student.status !== 'active') return false;
                    
                    const belongsToGroupById = student.group === groupId;
                    const belongsToGroupByName = student.group === groupName;
                    const belongsToGroupByCode = student.group === groupCode;
                    
                    return belongsToGroupById || belongsToGroupByName || belongsToGroupByCode;
                })
                .map(([studentId, student]) => ({ id: studentId, ...student }));
        }

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-users"></i> 
                    Gestionar Estudiantes - ${group.groupName}
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px;">
                <div>
                    <h4>Estudiantes Disponibles</h4>
                    <div id="availableStudents" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; max-height: 300px; overflow-y: auto;">
                        ${availableStudents.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay estudiantes disponibles</p>' :
                            availableStudents.map(([id, student]) => `
                                <div class="student-item" style="padding: 10px; margin: 5px 0; border: 1px solid #eee; border-radius: 4px; cursor: pointer;" 
                                     onclick="window.groupsManager.addStudentToGroup('${groupId}', '${id}')">
                                    <strong>${student.firstName} ${student.lastName}</strong><br>
                                    <small>${student.studentId} - ${student.email}</small>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
                
                <div>
                    <h4>Estudiantes en el Grupo (${groupStudents.length})</h4>
                    <div id="groupStudents" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; max-height: 300px; overflow-y: auto;">
                        ${groupStudents.length === 0 ? 
                            '<p style="color: #6c757d; text-align: center;">No hay estudiantes en este grupo</p>' :
                            groupStudents.map(student => `
                                <div class="student-item" style="padding: 10px; margin: 5px 0; border: 1px solid #eee; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${student.firstName} ${student.lastName}</strong><br>
                                        <small>${student.studentId} - ${student.email}</small>
                                    </div>
                                    <button class="btn-danger btn-sm" onclick="window.groupsManager.removeStudentFromGroup('${groupId}', '${Object.keys(this.students).find(id => this.students[id] === student)}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
            </div>
            
            <style>
                .student-item:hover {
                    background-color: #f8f9fa;
                }
                .btn-sm {
                    padding: 5px 8px;
                    font-size: 12px;
                }
            </style>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }
    }

    async addStudentToGroup(groupId, studentId) {
        try {
            const group = this.groups[groupId];
            if (!group) return;

            const updatedStudents = [...(group.students || []), studentId];
            
            const groupRef = ref(db, `groups/${groupId}`);
            await set(groupRef, {
                ...group,
                students: updatedStudents,
                updatedAt: new Date().toISOString()
            });

            if (window.app) {
                window.app.showNotification('Estudiante agregado al grupo', 'success');
            }

            // Recargar modal
            setTimeout(() => this.manageStudents(groupId), 500);

        } catch (error) {
            console.error('Error al agregar estudiante al grupo:', error);
            if (window.app) {
                window.app.showNotification('Error al agregar estudiante', 'error');
            }
        }
    }

    async removeStudentFromGroup(groupId, studentId) {
        try {
            const group = this.groups[groupId];
            if (!group) return;

            const updatedStudents = (group.students || []).filter(id => id !== studentId);
            
            const groupRef = ref(db, `groups/${groupId}`);
            await set(groupRef, {
                ...group,
                students: updatedStudents,
                updatedAt: new Date().toISOString()
            });

            if (window.app) {
                window.app.showNotification('Estudiante removido del grupo', 'success');
            }

            // Recargar modal
            setTimeout(() => this.manageStudents(groupId), 500);

        } catch (error) {
            console.error('Error al remover estudiante del grupo:', error);
            if (window.app) {
                window.app.showNotification('Error al remover estudiante', 'error');
            }
        }
    }

    editGroup(groupId) {
        this.showGroupModal(groupId);
    }

    async deleteGroup(groupId) {
        const group = this.groups[groupId];
        if (!group) return;

        const confirmed = confirm(
            `¿Está seguro de que desea eliminar el grupo "${group.groupName}"?\n\n` +
            'Esta acción no se puede deshacer.'
        );

        if (!confirmed) return;

        try {
            const groupRef = ref(db, `groups/${groupId}`);
            await remove(groupRef);

            if (window.app) {
                window.app.showNotification('Grupo eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar grupo:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el grupo', 'error');
            }
        }
    }

    viewGroupDetails(groupId) {
        const group = this.groups[groupId];
        if (!group) return;

        // Usar el mismo método de conteo que en la tabla
        const studentCount = this.getGroupStudentCount(groupId, group);
        
        let groupStudents = [];
        if (group.students && group.students.length > 0) {
            groupStudents = group.students
                .map(studentId => this.students[studentId])
                .filter(student => student && student.status === 'active');
        } else {
            const groupName = group.groupName || group.groupCode || '';
            const groupCode = group.groupCode || '';
            groupStudents = Object.entries(this.students)
                .filter(([studentId, student]) => {
                    if (!student || student.status !== 'active') return false;
                    const belongsToGroupById = student.group === groupId;
                    const belongsToGroupByName = student.group === groupName;
                    const belongsToGroupByCode = student.group === groupCode;
                    return belongsToGroupById || belongsToGroupByName || belongsToGroupByCode;
                })
                .map(([studentId, student]) => ({ id: studentId, ...student }));
        }

        const modalContent = `
            <div class="modal-header">
                <h3>
                    <i class="fas fa-users"></i> 
                    Detalles del Grupo
                </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="group-details">
                <div class="detail-section">
                    <h4>Información General</h4>
                    <div class="detail-grid">
                        <div><strong>Código:</strong> ${group.groupCode}</div>
                        <div><strong>Nombre:</strong> ${group.groupName}</div>
                        <div><strong>Nivel Académico:</strong> ${group.academicLevel || group.courseName || 'N/A'}</div>
                        <div><strong>Período:</strong> ${this.getPeriodText(group.period)}</div>
                        <div><strong>Año:</strong> ${group.year}</div>
                        <div><strong>Estado:</strong> <span class="status-badge ${group.status}">${this.getStatusText(group.status)}</span></div>
                        <div><strong>Fecha de Inicio:</strong> ${this.formatDate(group.startDate)}</div>
                        <div><strong>Fecha de Fin:</strong> ${this.formatDate(group.endDate)}</div>
                    </div>
                </div>
                
                ${group.description ? `
                <div class="detail-section">
                    <h4>Descripción</h4>
                    <p>${group.description}</p>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h4>Estudiantes (${groupStudents.length})</h4>
                    <div class="students-list">
                        ${groupStudents.length === 0 ? 
                            '<p style="color: #6c757d;">No hay estudiantes en este grupo</p>' :
                            groupStudents.map(student => `
                                <div class="student-card">
                                    <strong>${student.firstName} ${student.lastName}</strong>
                                    <div>${student.studentId}</div>
                                    <div>${student.email}</div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                    Cerrar
                </button>
                <button type="button" class="btn-success" onclick="window.groupsManager.manageStudents('${groupId}')">
                    <i class="fas fa-users"></i> Gestionar Estudiantes
                </button>
                <button type="button" class="btn-primary" onclick="window.groupsManager.editGroup('${groupId}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </div>
            
            <style>
                .group-details .detail-section {
                    margin-bottom: 25px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .group-details .detail-section h4 {
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
                
                .students-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 15px;
                }
                
                .student-card {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #e3e6f0;
                }
                
                @media (max-width: 480px) {
                    .detail-grid, .students-list {
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
            'completed': 'Completado'
        };
        return statusMap[status] || status;
    }

    getPeriodText(period) {
        const periodMap = {
            'mensual': 'Mensual',
            'trimestral': 'Trimestral',
            'cuatrimestral': 'Cuatrimestral',
            'semestral': 'Semestral',
            'anual': 'Anual'
        };
        return periodMap[period] || period;
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

    // Obtener grupos activos
    getActiveGroups() {
        return Object.entries(this.groups)
            .filter(([id, group]) => group.status === 'active')
            .map(([id, group]) => ({
                id,
                groupCode: group.groupCode,
                groupName: group.groupName,
                academicLevel: group.academicLevel || group.courseName,
                period: group.period,
                year: group.year
            }));
    }

    // Obtener grupo por ID
    getGroup(groupId) {
        return this.groups[groupId] || null;
    }

    getGroupStudentCount(groupId, group) {
        // Método 1: Usar array group.students si existe y tiene elementos
        if (group.students && group.students.length > 0) {
            // Contar solo estudiantes activos
            const activeStudents = group.students.filter(studentId => {
                const student = this.students[studentId];
                return student && student.status === 'active';
            });
            return activeStudents.length;
        }
        
        // Método 2: Buscar estudiantes por campo group
        const groupName = group.groupName || group.groupCode || '';
        const groupCode = group.groupCode || '';
        
        const studentsInGroup = Object.entries(this.students || {})
            .filter(([studentId, student]) => {
                if (!student || student.status !== 'active') return false;
                
                // Comparar con el ID del grupo, nombre del grupo, o código del grupo
                const belongsToGroupById = student.group === groupId;
                const belongsToGroupByName = student.group === groupName;
                const belongsToGroupByCode = student.group === groupCode;
                
                return belongsToGroupById || belongsToGroupByName || belongsToGroupByCode;
            });
            
        return studentsInGroup.length;
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('groupsTable')) {
        window.groupsManager = new GroupsManager();
        // No inicializar automáticamente, esperar a que la app esté lista
    }
});

export default GroupsManager; 