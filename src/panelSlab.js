import React, { useState, useEffect, useMemo, useRef } from 'react';
import { panelTasksAPI, projectsAPI, cuttingTasksAPI } from './apiService';
import './PanelSlab.css';
import ViewPanelPage from './ViewPanelPage';

// =========================================================
// Edit Task Modal (updated with "cutting" status)
// =========================================================
const EditTaskModal = ({ 
    isOpen, 
    onClose, 
    editingTask, 
    onInputChange, 
    onSubmit, 
    error,
    uniqueProjectNos 
}) => {
    if (!isOpen || !editingTask) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ color: 'white' }}>✏️ Edit Task: {editingTask.title}</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div className="modal-body">
                    <form onSubmit={onSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="editProjectNo">Project No *</label>
                            <select 
                                id="editProjectNo" 
                                name="project_no" 
                                value={editingTask.project_no || ''} 
                                onChange={onInputChange} 
                                required 
                                className="form-select"
                            >
                                <option value="">Select a project</option>
                                {uniqueProjectNos.map(projectNo => (
                                    <option key={projectNo} value={projectNo}>
                                        {projectNo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="editTitle">Task Title *</label>
                            <input 
                                type="text" 
                                id="editTitle" 
                                name="title" 
                                value={editingTask.title} 
                                onChange={onInputChange} 
                                required 
                                autoComplete="off" 
                                className="form-input" 
                            />
                        </div>

                        {/* Description field removed as requested */}

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="editPriority">Priority</label>
                                <select 
                                    id="editPriority" 
                                    name="priority" 
                                    value={editingTask.priority} 
                                    onChange={onInputChange} 
                                    className="form-select"
                                >
                                    <option value="empty">Empty</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="editStatus">Status</label>
                                <select 
                                    id="editStatus" 
                                    name="status" 
                                    value={editingTask.status} 
                                    onChange={onInputChange} 
                                    className="form-select"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cutting">Cutting</option>
                                </select>
                            </div>
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="primary">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Create Task Modal (updated with "cutting" status)
// =========================================================
const CreateTaskModal = ({ 
    isOpen, 
    onClose, 
    newTask, 
    onInputChange, 
    onSubmit, 
    error,
    uniqueProjectNos 
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>➕ Create New Task</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div className="modal-body">
                    <form onSubmit={onSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="createProjectNo">Project No *</label>
                            <select 
                                id="createProjectNo" 
                                name="project_no" 
                                value={newTask.project_no || ''} 
                                onChange={onInputChange} 
                                required 
                                className="form-select"
                            >
                                <option value="">Select a project</option>
                                {uniqueProjectNos.map(projectNo => (
                                    <option key={projectNo} value={projectNo}>
                                        {projectNo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="createTitle">Task Title *</label>
                            <input 
                                type="text" 
                                id="createTitle" 
                                name="title" 
                                value={newTask.title} 
                                onChange={onInputChange} 
                                required 
                                autoComplete="off" 
                                className="form-input" 
                                placeholder="Enter task title"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="createPriority">Priority</label>
                                <select 
                                    id="createPriority" 
                                    name="priority" 
                                    value={newTask.priority} 
                                    onChange={onInputChange} 
                                    className="form-select"
                                >
                                    <option value="empty">Empty</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="createStatus">Status</label>
                                <select 
                                    id="createStatus" 
                                    name="status" 
                                    value={newTask.status} 
                                    onChange={onInputChange} 
                                    className="form-select"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cutting">Cutting</option>   {/* NEW */}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="createDueDate">Due Date</label>
                            <input 
                                type="date" 
                                id="createDueDate" 
                                name="due_date" 
                                value={newTask.due_date || ''} 
                                onChange={onInputChange} 
                                className="form-input" 
                            />
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="primary">
                                Create Task
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UploadMediaModal = ({ 
    isOpen, 
    onClose, 
    task, 
    onUpload, 
    isUploading, 
    error 
}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    // Helper to get scaled canvas coordinates
    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;

        if (e.touches && e.touches.length === 1) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    useEffect(() => {
        if (isOpen && task) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (task.signatureUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                    const x = (canvas.width - img.width * scale) / 2;
                    const y = (canvas.height - img.height * scale) / 2;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                };
                img.onerror = () => {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                };
                img.src = task.signatureUrl;
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (task.imageUrl) {
                setImagePreview(task.imageUrl);
            } else {
                setImagePreview(null);
            }

            setImageFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [isOpen, task]);

    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (e) => {
        e.preventDefault();
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setImageFile(null);
            setImagePreview(task?.imageUrl || null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        let signatureBlob = null;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let hasDrawing = false;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
                hasDrawing = true;
                break;
            }
        }

        if (hasDrawing) {
            signatureBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
        }

        if (!hasDrawing || !imageFile) {
            alert('Please draw a signature AND select an image.');
            return;
        }

        if (!signatureBlob && !imageFile) {
            alert('Please draw a signature or select an image.');
            return;
        }

        const formData = new FormData();
        if (signatureBlob) {
            formData.append('signature', signatureBlob, 'signature.png');
        }
        if (imageFile) {
            formData.append('image', imageFile);
        }

        onUpload(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📎 Upload Media for Task: {task?.title}</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div className="modal-body">
                    <form onSubmit={handleSubmit} className="upload-media-form">
                        <div className="form-group">
                            <label>Draw Signature</label>
                            <div className="signature-canvas-container">
                                <canvas
                                    ref={canvasRef}
                                    width={500}
                                    height={200}
                                    style={{
                                        border: '1px solid #ccc',
                                        background: '#fff',
                                        cursor: 'crosshair',
                                        width: '100%',
                                        height: 'auto',
                                        touchAction: 'none'
                                    }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    onTouchCancel={stopDrawing}
                                />
                            </div>
                            <button type="button" className="secondary small" onClick={clearSignature}>
                                🧹 Clear Signature
                            </button>
                        </div>

                        <div className="form-group">
                            <label>Upload Image (Photo)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                ref={fileInputRef}
                                className="file-input"
                            />
                            {imagePreview && (
                                <div className="image-preview-container">
                                    <img src={imagePreview} alt="Preview" className="image-preview" />
                                    {/* Removed the remove button as requested */}
                                </div>
                            )}
                            <p className="form-hint">
                                {task?.imageUrl ? "Uploading a new image will replace the existing one." : ""}
                            </p>
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose} disabled={isUploading}>
                                Cancel
                            </button>
                            <button type="submit" className="primary" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload Media'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Main PanelSlab Component
// =========================================================
const PanelSlab = ({ onBackToProjects }) => {
    const [showViewPanel, setShowViewPanel] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMediaUploadModalOpen, setIsMediaUploadModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [uploadingTask, setUploadingTask] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProjectsLoading, setIsProjectsLoading] = useState(true);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [error, setError] = useState(null);
    const [uploadMediaError, setUploadMediaError] = useState(null);
    const [cuttingError, setCuttingError] = useState(null);   // NEW: error for cutting task creation

    const [filters, setFilters] = useState({
        priority: 'all',
        status: 'all',
        projectNo: 'all',
        search: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'createdAt',
        direction: 'desc'
    });

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        project_no: '',
        due_date: '',
    });

    useEffect(() => {
        fetchTasks();
        fetchProjects();
    }, []);

    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await panelTasksAPI.getAll();
            setTasks(data);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            setError('Failed to load tasks. Please ensure the backend is running.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProjects = async () => {
        setIsProjectsLoading(true);
        try {
            const data = await projectsAPI.getAll();
            setProjects(data);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
            setError('Failed to load projects list.');
        } finally {
            setIsProjectsLoading(false);
        }
    };

    const uniqueProjectNos = useMemo(() => {
        const projectNumbers = projects.map(project => project.projectNo).filter(p => p);
        return [...new Set(projectNumbers)].sort();
    }, [projects]);

    // NEW: Helper to create a cutting task from a panel task
    const createCuttingTaskFromPanelTask = async (panelTask) => {
        try {
            const cuttingTaskData = {
                title: panelTask.title,
                description: panelTask.description,
                priority: 'empty',
                status: 'pending',  // or you might want to set it to 'cutting' – adjust as needed
                project_no: panelTask.projectNo,
                approve_status: 'Approved',
                due_date: panelTask.dueDate ? panelTask.dueDate.substring(0, 10) : null,
            };
            await cuttingTasksAPI.create(cuttingTaskData);
            console.log('Cutting task created for panel task:', panelTask.id);
        } catch (err) {
            console.error('Failed to create cutting task:', err);
            setCuttingError('Failed to create cutting task. Please check the console.');
        }
    };

    // Handle combined media upload
    const handleUploadMedia = async (formData) => {
        if (!uploadingTask) return;

        setIsUploadingMedia(true);
        setUploadMediaError(null);

        try {
            console.log('FormData contents:', Array.from(formData.entries()));
            await panelTasksAPI.uploadMedia(uploadingTask.id, formData);
            await fetchTasks(); // Refresh tasks to get updated media URLs
            closeUploadModal();
        } catch (err) {
            console.error('Failed to upload media:', err);
            setUploadMediaError('Failed to upload: ' + (err.message || 'Please try again.'));
        } finally {
            setIsUploadingMedia(false);
        }
    };

    // Handle image deletion (separate endpoint)
    const handleDeleteImage = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete the image?')) return;

        try {
            await panelTasksAPI.deleteImage(taskId);
            setTasks(prev => prev.map(task => 
                task.id === taskId ? { ...task, imageUrl: null, imageDate: null } : task
            ));
        } catch (err) {
            console.error('Failed to delete image:', err);
            setError('Failed to delete image. Please try again.');
        }
    };

    // Filtering and sorting
    const filteredTasks = useMemo(() => {
        let filtered = tasks.filter(task => {
            if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
            if (filters.status !== 'all' && task.status !== filters.status) return false;
            if (filters.projectNo !== 'all' && task.projectNo !== filters.projectNo) return false;
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    (task.title?.toLowerCase().includes(searchLower)) ||
                    (task.description?.toLowerCase().includes(searchLower)) ||
                    (task.projectNo?.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });

        // Tiered Sorting
        filtered.sort((a, b) => {
            const isACompleted = a.status?.toLowerCase() === 'completed';
            const isBCompleted = b.status?.toLowerCase() === 'completed';

            if (isACompleted !== isBCompleted) {
                return isACompleted ? 1 : -1;
            }

            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'priority') {
                    const priorityWeight = { high: 1, medium: 2, low: 3, empty: 4 };
                    aValue = priorityWeight[a.priority?.toLowerCase()] || 4;
                    bValue = priorityWeight[b.priority?.toLowerCase()] || 4;
                }

                if (sortConfig.key.includes('Date') || sortConfig.key === 'createdAt') {
                    aValue = new Date(aValue || 0).getTime();
                    bValue = new Date(bValue || 0).getTime();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            }

            return 0;
        });

        return filtered;
    }, [tasks, filters, sortConfig]);

    const closeCreateModal = () => {
        setIsTaskModalOpen(false);
        setError(null);
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: 'pending',
            project_no: '',
            due_date: '',
        });
    };

    const openCreateModal = () => {
        setIsTaskModalOpen(true);
        setError(null);
    };

    const openEditModal = (task) => {
        const { id, title, description, priority, status, projectNo } = task;

        setEditingTask({
            id,
            title,
            description,
            priority,
            status,
            project_no: projectNo || (uniqueProjectNos.length > 0 ? uniqueProjectNos[0] : ''),
            due_date: task.dueDate ? task.dueDate.substring(0, 10) : ''
        });
        setError(null);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingTask(null);
        setError(null);
    };

    const openUploadModal = (task) => {
        setUploadingTask(task);
        setUploadMediaError(null);
        setIsMediaUploadModalOpen(true);
    };

    const closeUploadModal = () => {
        setIsMediaUploadModalOpen(false);
        setUploadingTask(null);
        setUploadMediaError(null);
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTask.title.trim()) {
            setError('Task title is required');
            return;
        }
        if (!newTask.project_no.trim()) {
            setError('Project No is required');
            return;
        }

        try {
            const createdTask = await panelTasksAPI.create(newTask);
            setTasks(prev => [createdTask, ...prev]);
            closeCreateModal();

            // NEW: If the new task status is 'cutting', create a cutting task
            if (createdTask.status === 'cutting') {
                await createCuttingTaskFromPanelTask(createdTask);
            }
        } catch (err) {
            console.error('Failed to create task:', err);
            setError('Failed to create task. Check console for details.');
        }
    };

    const handleUpdateTask = async (e) => {
        e.preventDefault();
        if (!editingTask.title.trim()) {
            setError('Task title is required');
            return;
        }
        if (!editingTask.project_no.trim()) {
            setError('Project No is required');
            return;
        }

        // Get current task before update
        const currentTask = tasks.find(t => t.id === editingTask.id);
        if (!currentTask) return;

        try {
            const payload = {
                title: editingTask.title,
                description: editingTask.description,
                priority: editingTask.priority,
                status: editingTask.status,
                project_no: editingTask.project_no,
                due_date: editingTask.due_date,
            };

            const updatedTask = await panelTasksAPI.update(editingTask.id, payload);
            setTasks(prev => prev.map(task =>
                task.id === updatedTask.id ? updatedTask : task
            ));
            closeEditModal();

            // NEW: If status changed to 'cutting' and wasn't before, create cutting task
            if (editingTask.status === 'cutting' && currentTask.status !== 'cutting') {
                await createCuttingTaskFromPanelTask(updatedTask);
            }
        } catch (err) {
            console.error('Failed to update task:', err);
            setError('Failed to save changes to the task.');
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        // Get current task before update
        const currentTask = tasks.find(t => t.id === taskId);
        if (!currentTask) return;

        try {
            const updatedTask = await panelTasksAPI.update(taskId, { status: newStatus });
            setTasks(prev => prev.map(task =>
                task.id === taskId ? updatedTask : task
            ));

            // NEW: If status changed to 'cutting' and wasn't before, create cutting task
            if (newStatus === 'cutting' && currentTask.status !== 'cutting') {
                await createCuttingTaskFromPanelTask(updatedTask);
            }
        } catch (err) {
            console.error('Failed to update task status:', err);
            setError('Failed to update task status.');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;

        try {
            await panelTasksAPI.delete(taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete task.');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTask(prev => ({ ...prev, [name]: value }));
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingTask(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSearchChange = (e) => {
        setFilters(prev => ({
            ...prev,
            search: e.target.value
        }));
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#dc3545';
            case 'medium': return '#ffc107';
            case 'low': return '#28a745';
            default: return '#6c757d';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#28a745';
            case 'in-progress': return '#17a2b8';
            case 'pending': return '#ffc107';
            case 'on-hold': return '#6c757d';
            case 'cutting': return '#fd7e14';   // NEW: orange for cutting
            default: return '#6c757d';
        }
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '⬆️' : '⬇️';
    };

    const goToViewPanelPage = () => {
        setShowViewPanel(true);
    };

    const goBackToPanelSlab = () => {
        setShowViewPanel(false);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (showViewPanel) {
        return <ViewPanelPage onBack={goBackToPanelSlab} />;
    }

    return (
        <div className="panel-slab-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={onBackToProjects}>
                        ← Back to Projects
                    </button>
                    <h1>Panel / Slab Tasks Management</h1>
                </div>
                <div className="header-right">
                    <button
                        className="header-btn create-btn"
                        onClick={goToViewPanelPage}
                        title="Go to View/Create Panel page"
                    >
                        👁️ View Panel Page
                    </button>
                </div>
            </header>

            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <div className="card-icon">📋</div>
                    <div className="card-content">
                        <h3>Total Tasks</h3>
                        <p className="card-value">{tasks.length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">⏳</div>
                    <div className="card-content">
                        <h3>Pending</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'pending').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">🔄</div>
                    <div className="card-content">
                        <h3>In Progress</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'in-progress').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                        <h3>Completed</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'completed').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">⏸️</div>
                    <div className="card-content">
                        <h3>On Hold</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'on-hold').length}</p>
                    </div>
                </div>
                {/* NEW: Cutting card */}
                <div className="dashboard-card">
                    <div className="card-icon">✂️</div>
                    <div className="card-content">
                        <h3>Cutting</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'cutting').length}</p>
                    </div>
                </div>
            </div>

            <div className="filters-section">
                <div className="filter-row">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Search tasks..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>
                    <div className="filter-group">
                        <select
                            name="priority"
                            value={filters.priority}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Priorities</option>
                            <option value="empty">Empty</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>

                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="on-hold">On Hold</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cutting">Cutting</option>   {/* NEW */}
                        </select>

                        <select
                            name="projectNo"
                            value={filters.projectNo}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Projects</option>
                            {uniqueProjectNos.map(pNo => (
                                <option key={pNo} value={pNo}>{pNo}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="tasks-table-container">
                {error && <div className="alert alert-danger">{error}</div>}
                {cuttingError && <div className="alert alert-warning">{cuttingError}</div>}   {/* NEW */}

                {isLoading ? (
                    <div className="loading-state">
                        <p>Loading tasks... 🔄</p>
                    </div>
                ) : filteredTasks.length === 0 && tasks.length > 0 ? (
                    <div className="empty-state">
                        <h3>No tasks match your current filters.</h3>
                        <p>Try clearing or adjusting your search/filters.</p>
                        <button className="create-first-task-btn" onClick={goToViewPanelPage}>
                            👁️ Go to View Panel Page
                        </button>
                    </div>
                ) : filteredTasks.length === 0 && tasks.length === 0 ? (
                    <div className="empty-state">
                        <h3>No tasks yet</h3>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="tasks-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('title')}>
                                        Task Title {getSortIcon('title')}
                                    </th>
                                    <th onClick={() => handleSort('projectNo')}>
                                        Project No {getSortIcon('projectNo')}
                                    </th>
                                    <th onClick={() => handleSort('priority')}>
                                        Priority {getSortIcon('priority')}
                                    </th>
                                    <th onClick={() => handleSort('status')}>
                                        Status {getSortIcon('status')}
                                    </th>
                                    <th onClick={() => handleSort('createdAt')}>
                                        Created {getSortIcon('createdAt')}
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map(task => (
                                    <tr key={task.id} className="task-row">
                                        <td className="task-title-cell">
                                            <div className="task-title-main">{task.title}</div>
                                            {task.imageUrl && (
                                                <div className="image-indicator">
                                                    <span className="image-badge">🖼️</span>
                                                    <span className="uploaded-text">Signature And Image uploaded</span>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="project-no-badge">
                                                {task.projectNo || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className="priority-badge"
                                                style={{ backgroundColor: getPriorityColor(task.priority) }}
                                            >
                                                {task.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="status-cell">
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                                    className="status-select"
                                                    style={{
                                                        borderColor: getStatusColor(task.status),
                                                        backgroundColor: getStatusColor(task.status) + '20'
                                                    }}
                                                >
                                                    <option value="pending">⏳ Pending</option>
                                                    <option value="on-hold">⏳ On Hold</option>
                                                    <option value="in-progress">🔄 In Progress</option>
                                                    <option value="completed">✅ Completed</option>
                                                    <option value="cutting">✂️ Cutting</option>   {/* NEW */}
                                                </select>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="created-date">
                                                {formatDate(task.createdAt)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => openEditModal(task)}
                                                    className="edit-btn"
                                                    title="Edit task"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => openUploadModal(task)}
                                                    className="upload-btn"
                                                    title={task.imageUrl ?
                                                        "View/Change media" :
                                                        "Upload media (Signature/Image)"}
                                                >
                                                    {task.imageUrl ? '✅' : '📤'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="delete-btn"
                                                    title="Delete task"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredTasks.length > 0 && (
                    <div className="table-footer">
                        <div className="table-summary">
                            Showing {filteredTasks.length} of {tasks.length} tasks
                        </div>
                    </div>
                )}
            </div>

            <EditTaskModal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                editingTask={editingTask}
                onInputChange={handleEditInputChange}
                onSubmit={handleUpdateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
            />

            <CreateTaskModal
                isOpen={isTaskModalOpen}
                onClose={closeCreateModal}
                newTask={newTask}
                onInputChange={handleInputChange}
                onSubmit={handleCreateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
            />

            <UploadMediaModal
                isOpen={isMediaUploadModalOpen}
                onClose={closeUploadModal}
                task={uploadingTask}
                onUpload={handleUploadMedia}
                isUploading={isUploadingMedia}
                error={uploadMediaError}
            />
        </div>
    );
};

export default PanelSlab;