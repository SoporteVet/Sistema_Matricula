import { 
    ref, 
    push, 
    set, 
    get, 
    remove, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';

class GradesManager {
    constructor() {
        this.students = {};
        this.courses = {};
        this.groups = {};
        this.grades = {};
        this.evaluations = {};
        this.filteredStudents = {};
        this.currentGroup = null;
        this.currentEvaluation = null;
        this.setupEventListeners();
    }

    async init() {
        try {
            await this.loadAllData();
        } catch (error) {
            console.warn('Error al inicializar GradesManager:', error);
        }
    }

    setupEventListeners() {
        // Botón para agregar nueva evaluación
        const addEvaluationBtn = document.getElementById('addEvaluationBtn');
        if (addEvaluationBtn) {
            addEvaluationBtn.addEventListener('click', () => {
                this.showEvaluationModal();
            });
        }

        // Filtros
        const groupFilter = document.getElementById('gradesGroupFilter');
        if (groupFilter) {
            groupFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const evaluationFilter = document.getElementById('evaluationFilter');
        if (evaluationFilter) {
            evaluationFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        const collections = ['students', 'courses', 'groups', 'grades', 'evaluations'];
        
        collections.forEach(collection => {
            const collectionRef = ref(db, collection);
            onValue(collectionRef, (snapshot) => {
                if (snapshot.exists()) {
                    this[collection] = snapshot.val();
                } else {
                    this[collection] = {};
                }
                this.applyFilters();
            });
        });
    }

    async loadAllData() {
        try {
            if (!db) {
                console.warn('Base de datos no disponible para notas');
                return;
            }

            const collections = ['students', 'courses', 'groups', 'grades', 'evaluations'];
            
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
            this.updateFilters();
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
                    name: `${group.groupName} (${group.courseName})`
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

        let groupStudents = [];

        // Método 1: Usar array group.students si existe
        if (group.students && group.students.length > 0) {
            groupStudents = group.students
                .map(studentId => this.students[studentId])
                .filter(student => student && student.status === 'active');
        } else {
            // Método 2: Buscar estudiantes por campo group (mismo método que asistencia)
            const groupName = group.groupName || group.groupCode || '';
            
            groupStudents = Object.values(this.students)
                .filter(student => {
                    if (!student || student.status !== 'active') return false;
                    
                    // Comparar con el ID del grupo, nombre del grupo, o código del grupo
                    const belongsToGroupById = student.group === groupFilter;
                    const belongsToGroupByName = student.group === groupName;
                    const belongsToGroupByCode = student.group === group.groupCode;
                    
                    return belongsToGroupById || belongsToGroupByName || belongsToGroupByCode;
                });
        }

        this.filteredStudents = Object.fromEntries(
            groupStudents.map(student => [student.studentId || student.id, student])
        );

        this.currentGroup = groupFilter;
        this.renderGradesTable();
    }

    renderGradesTable() {
        const tbody = document.querySelector('#gradesTable tbody');
        if (!tbody) return;

        if (!this.currentGroup || Object.keys(this.filteredStudents).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="100" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-graduation-cap fa-3x mb-3"></i>
                            <h4>Seleccione un grupo para ver las notas</h4>
                            <p>Use el filtro de grupos para comenzar</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const group = this.groups[this.currentGroup];
        const evaluations = Object.entries(this.evaluations)
            .filter(([id, evaluation]) => evaluation.groupId === this.currentGroup)
            .map(([id, evaluation]) => ({ id, ...evaluation }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Crear encabezados dinámicos
        const headerRow = `
            <tr>
                <th>Estudiante</th>
                <th>ID</th>
                ${evaluations.map(evaluation => `
                    <th>
                        <div class="evaluation-header">
                            <div class="eval-type">${this.getEvaluationTypeText(evaluation.type)}</div>
                            <div class="eval-date">${this.formatDate(evaluation.date)}</div>
                            <div class="eval-weight">${evaluation.weight}%</div>
                            <div class="eval-actions">
                                <button class="btn-warning btn-xs" onclick="window.gradesManager.showEvaluationModal('${evaluation.id}')" title="Editar evaluación">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-danger btn-xs" onclick="window.gradesManager.deleteEvaluation('${evaluation.id}')" title="Eliminar evaluación">
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
                        <div class="average-info">
                            <strong class="${this.getAverageClass(average)}">${average.toFixed(1)}%</strong>
                            <small class="weight-info">${this.getWeightInfo(studentGrades)}</small>
                        </div>
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

        let totalWeightedScore = 0;
        let totalWeight = 0;

        studentGrades.forEach(grade => {
            const evaluation = this.evaluations[grade.evaluationId];
            
            if (evaluation && evaluation.weight > 0) {
                // Convertir la nota a porcentaje si es necesario
                const scorePercentage = (grade.score / evaluation.maxScore) * 100;
                
                // Aplicar el peso del rubro
                totalWeightedScore += scorePercentage * (evaluation.weight / 100);
                totalWeight += evaluation.weight;
            }
        });

        // Si no hay peso total, retornar 0
        if (totalWeight === 0) return 0;

        // Calcular promedio final considerando solo el peso de las evaluaciones calificadas
        return (totalWeightedScore / totalWeight) * 100;
    }

    getStudentStatus(average) {
        if (average >= 70) return 'approved';
        if (average >= 60) return 'conditional';
        return 'failed';
    }

    showEvaluationModal(evaluationId = null, preselectedGroupId = null) {
        const evaluation = evaluationId ? this.evaluations[evaluationId] : null;
        const isEdit = evaluation !== null;
        const selectedGroupId = evaluation?.groupId || preselectedGroupId || '';

        const activeGroups = Object.entries(this.groups)
            .filter(([id, group]) => group.status === 'active')
            .map(([id, group]) => ({
                id,
                name: `${group.groupName} (${group.courseName})`
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
                            <option value="internship" ${evaluation?.type === 'internship' ? 'selected' : ''}>Práctica Profesional</option>
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="evaluationGroup">Grupo *</label>
                        <select id="evaluationGroup" required>
                            <option value="">Seleccionar grupo</option>
                            ${activeGroups.map(group => `
                                <option value="${group.id}" ${selectedGroupId === group.id ? 'selected' : ''}>
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
            if (evaluationForm && !evaluationForm.hasAttribute('data-listener-attached')) {
                evaluationForm.setAttribute('data-listener-attached', 'true');
                evaluationForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveEvaluation(evaluationId, preselectedGroupId);
                });
            }
        }, 100);
    }

    async saveEvaluation(evaluationId = null, preselectedGroupId = null) {
        const form = document.getElementById('evaluationForm');
        if (!form) return;

        // Verificar si ya se está procesando una solicitud
        if (form.hasAttribute('data-saving')) {
            return;
        }
        form.setAttribute('data-saving', 'true');

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
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (evaluationId) {
                // Actualizar evaluación existente
                const evaluationRef = ref(db, `evaluations/${evaluationId}`);
                await set(evaluationRef, evaluationData);
            } else {
                // Crear nueva evaluación
                evaluationData.createdAt = new Date().toISOString();
                const evaluationsRef = ref(db, 'evaluations');
                await push(evaluationsRef, evaluationData);
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
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${evaluationId ? 'Actualizar' : 'Crear'} Evaluación`;
            }
            // Remover el flag de guardando
            form.removeAttribute('data-saving');
        }
    }

    async deleteEvaluation(evaluationId) {
        console.log('=== DEBUG ELIMINAR EVALUACIÓN ===');
        console.log('ID de evaluación recibido:', evaluationId);
        console.log('Todas las evaluaciones:', this.evaluations);
        console.log('IDs disponibles:', Object.keys(this.evaluations));
        
        const evaluation = this.evaluations[evaluationId];
        console.log('Evaluación encontrada:', evaluation);
        
        if (!evaluation) {
            console.log('ERROR: Evaluación no encontrada con ID:', evaluationId);
            if (window.app) {
                window.app.showNotification(`Evaluación no encontrada (ID: ${evaluationId})`, 'error');
            }
            return;
        }

        // Confirmar eliminación
        const confirmMessage = `¿Está seguro de que desea eliminar la evaluación "${evaluation.title}"?\n\nEsta acción también eliminará todas las notas asociadas a esta evaluación y no se puede deshacer.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // Eliminar todas las notas asociadas a esta evaluación
            const gradesToDelete = Object.entries(this.grades)
                .filter(([id, grade]) => grade.evaluationId === evaluationId);

            // Eliminar notas asociadas
            for (const [gradeId, grade] of gradesToDelete) {
                const gradeRef = ref(db, `grades/${gradeId}`);
                await remove(gradeRef);
            }

            // Eliminar la evaluación
            const evaluationRef = ref(db, `evaluations/${evaluationId}`);
            await remove(evaluationRef);

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

        // Verificar si ya se está procesando una solicitud
        if (form.hasAttribute('data-saving')) {
            return;
        }
        form.setAttribute('data-saving', 'true');

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
            // Remover el flag de guardando
            form.removeAttribute('data-saving');
        }
    }

    viewStudentDetails(studentId) {
        const student = Object.values(this.students).find(s => s.studentId === studentId);
        if (!student) return;

        const studentGrades = Object.values(this.grades)
            .filter(grade => grade.studentId === studentId);

        const evaluations = Object.entries(this.evaluations)
            .filter(([id, evaluation]) => studentGrades.some(grade => grade.evaluationId === id))
            .map(([id, evaluation]) => ({ id, ...evaluation }))
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

        const evaluations = Object.entries(this.evaluations)
            .filter(([id, evaluation]) => evaluation.groupId === this.currentGroup)
            .map(([id, evaluation]) => ({ id, ...evaluation }))
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
                    ${evaluations.length > 0 ? evaluations.map(evaluation => {
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
                    }).join('') : `
                        <div class="no-evaluations">
                            <div style="text-align: center; padding: 40px; color: #6c757d;">
                                <i class="fas fa-clipboard-list fa-3x mb-3"></i>
                                <h4>No hay evaluaciones creadas</h4>
                                <p>Primero debe crear evaluaciones para poder asignar notas</p>
                                <button type="button" class="btn-primary" onclick="window.gradesManager.showEvaluationModal(null, '${this.currentGroup}'); window.app.closeModal();">
                                    <i class="fas fa-plus"></i> Crear Primera Evaluación
                                </button>
                            </div>
                        </div>
                    `}
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                    ${evaluations.length > 0 ? `
                        <button type="button" class="btn-info" onclick="window.gradesManager.showEvaluationModal(null, '${this.currentGroup}'); window.app.closeModal();">
                            <i class="fas fa-plus"></i> Agregar Evaluación
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Guardar Todas las Notas
                        </button>
                    ` : ''}
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

        // Verificar si ya se está procesando una solicitud
        if (form.hasAttribute('data-saving')) {
            return;
        }
        form.setAttribute('data-saving', 'true');

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const gradesToSave = [];

            for (const evaluation of evaluations) {
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
            for (const gradeData of gradesToSave) {
                const existingGrade = Object.entries(this.grades)
                    .find(([id, grade]) => grade.studentId === studentId && grade.evaluationId === gradeData.evaluationId);

                const fullGradeData = {
                    studentId,
                    evaluationId: gradeData.evaluationId,
                    score: gradeData.score,
                    updatedAt: new Date().toISOString()
                };

                if (existingGrade) {
                    // Actualizar nota existente
                    const gradeRef = ref(db, `grades/${existingGrade[0]}`);
                    await set(gradeRef, fullGradeData);
                } else {
                    // Crear nueva nota
                    fullGradeData.createdAt = new Date().toISOString();
                    const gradesRef = ref(db, 'grades');
                    await push(gradesRef, fullGradeData);
                }
            }

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
            // Remover el flag de guardando
            form.removeAttribute('data-saving');
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
            'lab': 'Laboratorio',
            'internship': 'Práctica Profesional'
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

    getWeightInfo(studentGrades) {
        const totalWeight = studentGrades.reduce((sum, grade) => {
            const evaluation = this.evaluations[grade.evaluationId];
            return sum + (evaluation ? evaluation.weight : 0);
        }, 0);
        
        return `${totalWeight}% evaluado`;
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
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    const gradesTable = document.getElementById('gradesTable');
    
    if (gradesTable) {
        try {
            window.gradesManager = new GradesManager();
        } catch (error) {
            console.error('GradesManager: Error al crear instancia:', error);
        }
    }
});

// También intentar crear la instancia inmediatamente si el DOM ya está listo
if (document.readyState === 'loading') {
    // Esperar DOMContentLoaded
} else {
    const gradesTable = document.getElementById('gradesTable');
    
    if (gradesTable) {
        try {
            window.gradesManager = new GradesManager();
        } catch (error) {
            console.error('GradesManager: Error al crear instancia inmediatamente:', error);
        }
    }
}

export default GradesManager;
