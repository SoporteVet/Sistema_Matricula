import { 
    ref, 
    push, 
    set, 
    get, 
    remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from './firebase-config.js';
import { realtimeManager } from './realtime-manager.js';

class CoursesManager {
    constructor() {
        this.courses = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCourses();
    }

    setupEventListeners() {
        // Botón para agregar nuevo curso
        const addCourseBtn = document.getElementById('addCourseBtn');
        if (addCourseBtn) {
            addCourseBtn.addEventListener('click', () => {
                this.showCourseModal();
            });
        }

        // Configurar actualización en tiempo real
        this.setupRealTimeUpdates();
    }

    setupRealTimeUpdates() {
        // Suscribirse a actualizaciones en tiempo real de cursos
        this.unsubscribeCourses = realtimeManager.subscribe('courses', (courses) => {
            this.courses = courses;
            this.renderCoursesTable();
        });
    }

    async loadCourses() {
        try {
            const coursesRef = ref(db, 'courses');
            const snapshot = await get(coursesRef);
            
            if (snapshot.exists()) {
                this.courses = snapshot.val();
            } else {
                this.courses = {};
            }
            
            this.renderCoursesTable();
        } catch (error) {
            console.error('Error al cargar cursos:', error);
            if (window.app) {
                window.app.showNotification('Error al cargar cursos', 'error');
            }
        }
    }

    renderCoursesTable() {
        const tbody = document.querySelector('#coursesTable tbody');
        if (!tbody) return;

        if (Object.keys(this.courses).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div style="padding: 40px; color: #6c757d;">
                            <i class="fas fa-book fa-3x mb-3"></i>
                            <h4>No hay cursos veterinarios registrados</h4>
                            <p>Comience agregando un nuevo curso veterinario</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = Object.entries(this.courses)
            .map(([id, course]) => `
                <tr>
                    <td><strong>${course.code}</strong></td>
                    <td>${course.name}</td>
                    <td>${course.description}</td>
                    <td>${this.formatCurrency(course.price)}</td>
                    <td>
                        <span class="status-badge ${course.status}">
                            ${course.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-warning" onclick="window.coursesManager.editCourse('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger" onclick="window.coursesManager.deleteCourse('${id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
    }

    showCourseModal(courseId = null) {
        const course = courseId ? this.courses[courseId] : null;
        const isEdit = course !== null;

        const modalContent = `
            <div class="modal-header">
                                    <h3>
                        <i class="fas fa-book"></i> 
                        ${isEdit ? 'Editar' : 'Nuevo'} Curso Veterinario
                    </h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="courseForm" class="handled">
                <div class="form-group">
                    <label for="courseCode">Código del Curso *</label>
                    <input 
                        type="text" 
                        id="courseCode" 
                        value="${course?.code || ''}" 
                        required
                        placeholder="Ej: WEB001"
                    >
                </div>
                
                <div class="form-group">
                    <label for="courseName">Nombre del Curso Veterinario *</label>
                    <input 
                        type="text" 
                        id="courseName" 
                        value="${course?.name || ''}" 
                        required
                        placeholder="Ej: Medicina Veterinaria Básica"
                    >
                </div>
                
                <div class="form-group">
                    <label for="courseDescription">Descripción</label>
                    <textarea 
                        id="courseDescription" 
                        placeholder="Descripción del curso..."
                    >${course?.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="coursePrice">Precio Mensual *</label>
                    <input 
                        type="number" 
                        id="coursePrice" 
                        value="${course?.price || ''}" 
                        required
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                    >
                </div>
                
                <div class="form-group">
                    <label for="courseDuration">Duración (meses)</label>
                    <input 
                        type="number" 
                        id="courseDuration" 
                        value="${course?.duration || ''}" 
                        min="1"
                        placeholder="6"
                    >
                </div>
                
                <div class="form-group">
                    <label for="courseStatus">Estado</label>
                    <select id="courseStatus" required>
                        <option value="active" ${course?.status === 'active' ? 'selected' : ''}>Activo</option>
                        <option value="inactive" ${course?.status === 'inactive' ? 'selected' : ''}>Congelado</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.app.closeModal()">
                        Cancelar
                    </button>
                                            <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> 
                            ${isEdit ? 'Actualizar' : 'Crear'} Curso Veterinario
                        </button>
                </div>
            </form>
        `;

        if (window.app) {
            window.app.showModal(modalContent);
        }

        // Configurar evento del formulario
        const courseForm = document.getElementById('courseForm');
        if (courseForm) {
            courseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCourse(courseId);
            });
        }
    }

    async saveCourse(courseId = null) {
        const form = document.getElementById('courseForm');
        if (!form) return;

        const formData = new FormData(form);
        const courseData = {
            code: document.getElementById('courseCode').value.trim(),
            name: document.getElementById('courseName').value.trim(),
            description: document.getElementById('courseDescription').value.trim(),
            price: parseFloat(document.getElementById('coursePrice').value) || 0,
            duration: parseInt(document.getElementById('courseDuration').value) || null,
            status: document.getElementById('courseStatus').value,
            updatedAt: new Date().toISOString()
        };

        // Debug: mostrar los datos del curso
        console.log('Datos del curso capturados:', courseData);

        // Validaciones
        if (!courseData.code || !courseData.name || !courseData.status) {
            if (window.app) {
                window.app.showNotification('Complete todos los campos requeridos', 'error');
            }
            return;
        }

        // Verificar que el código no esté duplicado
        const isDuplicate = Object.entries(this.courses).some(([id, course]) => 
            course.code.toLowerCase() === courseData.code.toLowerCase() && id !== courseId
        );

        if (isDuplicate) {
            if (window.app) {
                window.app.showNotification('El código del curso ya existe', 'error');
            }
            return;
        }

        try {
            // Deshabilitar botón de envío
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            if (courseId) {
                // Actualizar curso existente
                const courseRef = ref(db, `courses/${courseId}`);
                await set(courseRef, courseData);
            } else {
                // Crear nuevo curso
                courseData.createdAt = new Date().toISOString();
                const coursesRef = ref(db, 'courses');
                await push(coursesRef, courseData);
            }

            if (window.app) {
                window.app.closeModal();
                window.app.showNotification(
                    `Curso ${courseId ? 'actualizado' : 'creado'} exitosamente`, 
                    'success'
                );
            }

        } catch (error) {
            console.error('Error al guardar curso:', error);
            if (window.app) {
                window.app.showNotification('Error al guardar el curso', 'error');
            }
        } finally {
            // Rehabilitar botón
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${courseId ? 'Actualizar' : 'Crear'} Curso`;
            }
        }
    }

    editCourse(courseId) {
        this.showCourseModal(courseId);
    }

    async deleteCourse(courseId) {
        const course = this.courses[courseId];
        if (!course) return;

        // Confirmar eliminación
        const confirmed = confirm(
            `¿Está seguro de que desea eliminar el curso "${course.name}"?\n\n` +
            'Esta acción no se puede deshacer y afectará a todos los estudiantes matriculados.'
        );

        if (!confirmed) return;

        try {
            // Verificar si hay estudiantes matriculados
            const studentsRef = ref(db, 'students');
            const studentsSnapshot = await get(studentsRef);
            
            if (studentsSnapshot.exists()) {
                const students = studentsSnapshot.val();
                const enrolledStudents = Object.values(students).filter(
                    student => student.course === course.name
                );
                
                if (enrolledStudents.length > 0) {
                    if (window.app) {
                        window.app.showNotification(
                            `No se puede eliminar. Hay ${enrolledStudents.length} estudiante(s) matriculado(s) en este curso.`,
                            'warning'
                        );
                    }
                    return;
                }
            }

            // Eliminar curso
            const courseRef = ref(db, `courses/${courseId}`);
            await remove(courseRef);

            if (window.app) {
                window.app.showNotification('Curso eliminado exitosamente', 'success');
            }

        } catch (error) {
            console.error('Error al eliminar curso:', error);
            if (window.app) {
                window.app.showNotification('Error al eliminar el curso', 'error');
            }
        }
    }

    // Obtener lista de cursos activos para otros módulos
    getActiveCourses() {
        return Object.entries(this.courses)
            .filter(([id, course]) => course.status === 'active')
            .map(([id, course]) => ({
                id,
                name: course.name,
                code: course.code,
                price: course.price
            }));
    }

    // Obtener curso por ID
    getCourse(courseId) {
        return this.courses[courseId] || null;
    }

    // Buscar curso por nombre
    getCourseByName(courseName) {
        return Object.entries(this.courses).find(
            ([id, course]) => course.name === courseName
        );
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CR', {
            style: 'currency',
            currency: 'CRC'
        }).format(amount);
    }

    // Método para exportar cursos
    exportCourses() {
        const coursesData = Object.entries(this.courses).map(([id, course]) => ({
            'Código': course.code,
            'Nombre': course.name,
            'Descripción': course.description,
            'Precio': course.price,
            'Duración (meses)': course.duration || 'N/A',
            'Estado': course.status === 'active' ? 'Activo' : 'Inactivo',
            'Fecha Creación': course.createdAt ? new Date(course.createdAt).toLocaleDateString('es-ES') : 'N/A'
        }));

        // Crear archivo Excel
        const ws = XLSX.utils.json_to_sheet(coursesData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cursos');
        
        // Descargar archivo
        XLSX.writeFile(wb, `cursos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // Limpiar suscripciones al destruir el módulo
    destroy() {
        if (this.unsubscribeCourses) {
            this.unsubscribeCourses();
        }
    }
}

// Crear instancia global
document.addEventListener('DOMContentLoaded', () => {
    // Solo crear si estamos en una página que tiene la tabla de cursos
    if (document.getElementById('coursesTable')) {
        window.coursesManager = new CoursesManager();
    }
});

export default CoursesManager;
