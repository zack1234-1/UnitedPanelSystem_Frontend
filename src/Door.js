import React, { useState, useEffect, useMemo } from 'react';
import { doorTasksAPI } from './apiService'; 
import './Door.css';

const Door = ({ navigate }) => {
    const [tasks, setTasks] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // --- 1. State for Filters ---
    const [filters, setFilters] = useState({
        priority: 'all',
        status: 'all',
        projectNo: 'all', // New filter state
    });
    // ----------------------------
    
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
    }, []);

    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await doorTasksAPI.getAll();
            setTasks(data);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            setError('Failed to load tasks. Please ensure the backend is running.');
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- 2. Logic to extract Unique Project Numbers (for the dropdown) ---
    const uniqueProjectNos = useMemo(() => {
        // Get unique, non-empty project numbers, sort them, and return.
        const projects = [...new Set(tasks.map(t => t.projectNo).filter(p => p))];
        return projects.sort();
    }, [tasks]);
    // ----------------------------------------------------------------------

    // --- 3. Filtering Logic ---
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // 1. Priority Filter
            if (filters.priority !== 'all' && task.priority !== filters.priority) {
                return false;
            }

            // 2. Status Filter
            if (filters.status !== 'all' && task.status !== filters.status) {
                return false;
            }

            // 3. Project No Filter (Dropdown selection)
            if (filters.projectNo !== 'all' && task.projectNo !== filters.projectNo) {
                return false;
            }
            
            return true;
        });
    }, [tasks, filters]); 
    // ----------------------------

    const openCreateModal = () => {
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: 'pending',
            project_no: '',
            due_date: '',
        });
        setError(null);
        setIsTaskModalOpen(true);
    };

    const closeCreateModal = () => {
        setIsTaskModalOpen(false);
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
            project_no: projectNo || '',
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
            const createdTask = await doorTasksAPI.create(newTask);
            setTasks(prev => [createdTask, ...prev]);
            closeCreateModal();
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

        try {
            const payload = {
                title: editingTask.title,
                description: editingTask.description,
                priority: editingTask.priority,
                status: editingTask.status,
                project_no: editingTask.project_no,
                due_date: editingTask.due_date,
            };

            const updatedTask = await doorTasksAPI.update(editingTask.id, payload);
            
            setTasks(prev => prev.map(task => 
                task.id === updatedTask.id ? updatedTask : task
            ));
            closeEditModal();
        } catch (err) {
            console.error('Failed to update task:', err);
            setError('Failed to save changes to the task.');
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        try {
            const updatedTask = await doorTasksAPI.update(taskId, { status: newStatus });
            setTasks(prev => prev.map(task => 
                task.id === taskId ? updatedTask : task
            ));
        } catch (err) {
            console.error('Failed to update task status:', err);
            setError('Failed to update task status.');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;

        try {
            await doorTasksAPI.delete(taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete task.');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTask(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingTask(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };
    
    // --- Filter Handler (Handles all filters) ---
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };
    // -------------------------------------------

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
            case 'pending': return '#6c757d';
            default: return '#6c757d';
        }
    };

    // TaskModal and EditTaskModal components remain unchanged...
    const TaskModal = () => {
        if (!isTaskModalOpen) return null;

        return (
            <div className="modal-overlay" onClick={closeCreateModal}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>➕ Create New Door Task</h2>
                        <button type="button" className="close-button" onClick={closeCreateModal}>
                            &times;
                        </button>
                    </div>

                    <div className="modal-body">
                        <form onSubmit={handleCreateTask} className="task-form">
                            <div className="form-group">
                                <label htmlFor="project_no">Project No *</label>
                                <input 
                                    type="text" 
                                    id="project_no" 
                                    name="project_no" 
                                    value={newTask.project_no} 
                                    onChange={handleInputChange} 
                                    placeholder="Enter project number" 
                                    required 
                                    autoComplete="off" 
                                    className="form-input" 
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="title">Task Title *</label>
                                <input type="text" id="title" name="title" value={newTask.title} onChange={handleInputChange} placeholder="Enter door task title" required autoComplete="off" className="form-input" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" value={newTask.description} onChange={handleInputChange} placeholder="Enter door task description" rows="3" autoComplete="off" className="form-textarea" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="priority">Priority</label>
                                    <select id="priority" name="priority" value={newTask.priority} onChange={handleInputChange} className="form-select">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="due_date">Due Date</label>
                                    <input
                                        type="date"
                                        id="due_date"
                                        name="due_date"
                                        value={newTask.due_date} 
                                        onChange={handleInputChange}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            {error && <div className="alert alert-danger">{error}</div>}

                            <div className="modal-actions">
                                <button type="button" className="secondary" onClick={closeCreateModal}>
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
    
    const EditTaskModal = () => {
        if (!isEditModalOpen || !editingTask) return null;

        return (
            <div className="modal-overlay" onClick={closeEditModal}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>✏️ Edit Task: {editingTask.title}</h2>
                        <button type="button" className="close-button" onClick={closeEditModal}>
                            &times;
                        </button>
                    </div>

                    <div className="modal-body">
                        <form onSubmit={handleUpdateTask} className="task-form">
                            <div className="form-group">
                                <label htmlFor="editProjectNo">Project No *</label>
                                <input 
                                    type="text" 
                                    id="editProjectNo" 
                                    name="project_no" 
                                    value={editingTask.project_no || ''} 
                                    onChange={handleEditInputChange} 
                                    required 
                                    autoComplete="off" 
                                    className="form-input" 
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="editTitle">Task Title *</label>
                                <input type="text" id="editTitle" name="title" value={editingTask.title} onChange={handleEditInputChange} required autoComplete="off" className="form-input" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="editDescription">Description</label>
                                <textarea id="editDescription" name="description" value={editingTask.description || ''} onChange={handleEditInputChange} rows="3" autoComplete="off" className="form-textarea" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="editPriority">Priority</label>
                                    <select id="editPriority" name="priority" value={editingTask.priority} onChange={handleEditInputChange} className="form-select">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="editStatus">Status</label>
                                    <select id="editStatus" name="status" value={editingTask.status} onChange={handleEditInputChange} className="form-select">
                                        <option value="pending">Pending</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="editDueDate">Due Date</label>
                                <input
                                    type="date"
                                    id="editDueDate"
                                    name="due_date"
                                    value={editingTask.due_date || ''}
                                    onChange={handleEditInputChange}
                                    className="form-input"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="secondary" onClick={closeEditModal}>
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

    const TaskCard = ({ task }) => {
        const formatDate = (dateString) => {
            if (!dateString) return 'No due date';
            const date = new Date(dateString);
            return date.toLocaleDateString();
        };

        return (
            <div className="task-card">
                <div className="task-header">
                    <div>
                        <h4 className="task-title">{task.title}</h4>
                        {task.projectNo && (
                            <p className="task-project-no">
                                <strong>Project:</strong> {task.projectNo}
                            </p>
                        )}
                    </div>
                    <div className="task-priority" style={{ backgroundColor: getPriorityColor(task.priority) }}>
                        {task.priority}
                    </div>
                </div>

                {task.description && (
                    <p className="task-description">{task.description}</p>
                )}

                <div className="task-meta">
                    <div className="task-due-date">
                        <strong>Due:</strong> {formatDate(task.dueDate)} 
                    </div>
                    <div className="task-created">
                        Created: {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                </div>

                <div className="task-actions">
                    <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                        className="status-select"
                        style={{ borderColor: getStatusColor(task.status) }}
                    >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>

                    <button
                        onClick={() => openEditModal(task)}
                        className="secondary task-edit-btn"
                        title="Edit task details"
                    >
                        Edit
                    </button>
                    
                    <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="danger task-delete-btn"
                        title="Delete task"
                    >
                        Delete
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="door-container">
            <header className="page-header">
                <div className="header-controls">
                    <h1>🚪 Door Management</h1>
                    <button
                        className="primary"
                        onClick={openCreateModal}
                    >
                        + Create Task
                    </button>
                </div>
            </header>
            
            <hr/>
            
            {/* Filter Section */}
            <div className="filter-controls">
                <h3 style={{ marginBottom: '10px' }}>🔍 Filter Tasks</h3>
                {/* 4. Filter Controls UI - Requires CSS updates for horizontal display */}
                <div className="filter-group">
                    {/* Priority Filter */}
                    <div className="form-group">
                        <label htmlFor="filter-priority">Priority</label>
                        <select 
                            id="filter-priority" 
                            name="priority" 
                            value={filters.priority} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="all">All Priorities</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="form-group">
                        <label htmlFor="filter-status">Status</label>
                        <select 
                            id="filter-status" 
                            name="status" 
                            value={filters.status} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    {/* Project No Filter (Dropdown using uniqueProjectNos) */}
                    <div className="form-group">
                        <label htmlFor="filter-projectNo">Project No</label>
                        <select
                            id="filter-projectNo" 
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
            {/* End Filter Section */}

            <hr/>
            
            <div className="door-content">
                <div className="tasks-section">
                    <div className="tasks-header">
                        {/* Use filteredTasks length here */}
                        <h2>📋 Door Tasks ({filteredTasks.length} / {tasks.length})</h2> 
                        <div className="tasks-stats">
                            <span className="stat pending">Pending: {filteredTasks.filter(t => t.status === 'pending').length}</span>
                            <span className="stat in-progress">In Progress: {filteredTasks.filter(t => t.status === 'in-progress').length}</span>
                            <span className="stat completed">Completed: {filteredTasks.filter(t => t.status === 'completed').length}</span>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {isLoading ? (
                        <div className="loading-state">
                            <p>Loading tasks... 🔄</p>
                        </div>
                    ) : filteredTasks.length === 0 && tasks.length > 0 ? (
                        <div className="empty-state">
                            <h3>No tasks match your current filters.</h3>
                            <p>Try clearing or adjusting your selections.</p>
                        </div>
                    ) : filteredTasks.length === 0 && tasks.length === 0 ? (
                        <div className="empty-state">
                            <h3>No door tasks yet</h3>
                            <p>Create your first door task to get started!</p>
                            <button 
                                className="primary" 
                                onClick={openCreateModal}
                            >
                                Create Your First Task
                            </button>
                        </div>
                    ) : (
                        <div className="tasks-grid">
                            {filteredTasks.map(task => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TaskModal />
            <EditTaskModal />
        </div>
    );
};

export default Door;