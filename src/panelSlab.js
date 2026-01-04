import React, { useState, useEffect, useMemo } from 'react';
import { panelTasksAPI, projectsAPI, excelDataAPI } from './apiService'; 
import './PanelSlab.css';
import ViewPanelPage from './ViewPanelPage';

// Excel Data Modal Component
const ExcelDataModal = ({ 
    isOpen, 
    onClose, 
    excelData,
    isLoading,
    error
}) => {
    if (!isOpen) return null;

    // Function to get column headers from the first data row
    const getColumnHeaders = () => {
        if (!excelData || excelData.length === 0) return [];
        return Object.keys(excelData[0]);
    };

    // Function to format cell value for display
    const formatCellValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') {
            // Check if it's a date (Excel serial number)
            if (value > 40000 && value < 50000) {
                try {
                    // Convert Excel serial date to JavaScript date
                    const excelEpoch = new Date(1899, 11, 30);
                    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
                    return date.toLocaleDateString();
                } catch {
                    return value;
                }
            }
            return value.toLocaleString();
        }
        return String(value);
    };

    // Function to download Excel data as CSV
    const downloadCSV = () => {
        if (!excelData || excelData.length === 0) return;
        
        const headers = getColumnHeaders();
        const csvContent = [
            headers.join(','), // Header row
            ...excelData.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape quotes and wrap in quotes if contains comma
                    const strValue = formatCellValue(value);
                    return strValue.includes(',') ? `"${strValue}"` : strValue;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'excel_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content excel-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 Excel Data Viewer</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="alert alert-danger">{error}</div>}
                    
                    {isLoading ? (
                        <div className="loading-state">
                            <p>Loading Excel data... 🔄</p>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : excelData && excelData.length > 0 ? (
                        <>
                            <div className="excel-info-bar">
                                <div className="excel-stats">
                                    <span className="stat-item">
                                        <strong>Rows:</strong> {excelData.length}
                                    </span>
                                    <span className="stat-item">
                                        <strong>Columns:</strong> {getColumnHeaders().length}
                                    </span>
                                    <span className="stat-item">
                                        <strong>Last Updated:</strong> {new Date().toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="excel-table-container">
                                <table className="excel-table">
                                    <thead>
                                        <tr>
                                            {getColumnHeaders().map((header, index) => (
                                                <th key={index} title={header}>
                                                    <div className="header-content">
                                                        <span className="header-text">{header}</span>
                                                        <span className="column-index">#{index + 1}</span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {excelData.slice(0, 100).map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {getColumnHeaders().map((header, colIndex) => (
                                                    <td key={colIndex} className={colIndex === 0 ? 'first-column' : ''}>
                                                        <div className="cell-content">
                                                            {formatCellValue(row[header])}
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                
                                {excelData.length > 100 && (
                                    <div className="excel-footer-note">
                                        Showing 100 of {excelData.length} rows. 
                                        Use download button to get complete data.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <h3>No Excel data available</h3>
                            <p>There's no Excel data to display at the moment.</p>
                        </div>
                    )}
                    
                    <div className="modal-actions">
                        <button type="button" className="secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Edit Task Modal Component
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
                    <h2>✏️ Edit Task: {editingTask.title}</h2>
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

                        <div className="form-group">
                            <label htmlFor="editDescription">Description</label>
                            <textarea 
                                id="editDescription" 
                                name="description" 
                                value={editingTask.description || ''} 
                                onChange={onInputChange} 
                                rows="3" 
                                autoComplete="off" 
                                className="form-textarea" 
                            />
                        </div>

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

// Create Task Modal Component
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

                        <div className="form-group">
                            <label htmlFor="createDescription">Description</label>
                            <textarea 
                                id="createDescription" 
                                name="description" 
                                value={newTask.description || ''} 
                                onChange={onInputChange} 
                                rows="3" 
                                autoComplete="off" 
                                className="form-textarea" 
                                placeholder="Enter task description (optional)"
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

const PanelSlab = ({ onBackToProjects }) => {
    const [showViewPanel, setShowViewPanel] = useState(false); // State to control which component to show
    
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProjectsLoading, setIsProjectsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Excel Modal States
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [excelData, setExcelData] = useState([]);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    const [excelTablesList, setExcelTablesList] = useState([]);
    const [selectedTableName, setSelectedTableName] = useState('');
    
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

    // Fetch tasks and projects on component mount
    useEffect(() => {
        fetchTasks();
        fetchProjects();
    }, []);

    // API Functions
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
            // TIER 1: Completion Status (Always forces completed to bottom)
            const isACompleted = a.status?.toLowerCase() === 'completed';
            const isBCompleted = b.status?.toLowerCase() === 'completed';

            if (isACompleted !== isBCompleted) {
                return isACompleted ? 1 : -1; 
            }

            // TIER 2: User-selected Sort (only if the status tier is the same)
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Special handling for Priority levels if sorting by Priority
                if (sortConfig.key === 'priority') {
                    const priorityWeight = { high: 1, medium: 2, low: 3 };
                    aValue = priorityWeight[a.priority?.toLowerCase()] || 4;
                    bValue = priorityWeight[b.priority?.toLowerCase()] || 4;
                }

                // Special handling for Dates
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
        // Reset new task form
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
        try {
            const response = await excelDataAPI.getExcelTables();
            
            console.log('Frontend received Excel data:', response);
            
            // Handle different response structures
            let excelDataArray = [];
            if (Array.isArray(response)) {
                excelDataArray = response;
            } else if (response && response.data) {
                excelDataArray = response.data;
            } else if (response && Array.isArray(response.rows)) {
                excelDataArray = response.rows;
            }
            
            setExcelData(excelDataArray);
            setExcelTablesList([{ name: 'excel_table' }]);
            setSelectedTableName('excel_table');
            setIsExcelModalOpen(true);
            
        } catch (err) {
            console.error('Failed to fetch Excel tables:', err);
            setError('Failed to load Excel data. Please ensure the Excel file is available.');
        } finally {
            setIsExcelLoading(false);
        }
    };

    const closeExcelModal = () => {
        setIsExcelModalOpen(false);
        setExcelData([]);
        setError(null);
    };

    // Task Management Functions
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

            const updatedTask = await panelTasksAPI.update(editingTask.id, payload);
            
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
            const updatedTask = await panelTasksAPI.update(taskId, { status: newStatus });
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
            await panelTasksAPI.delete(taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete task.');
        }
    };

    // Modal Functions
    const openCreateModal = () => {
        setIsTaskModalOpen(true);
        setError(null);
    };

    const closeCreateModal = () => {
        setIsTaskModalOpen(false);
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: 'pending',
            project_no: '',
            due_date: '',
        });
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

    // Input Handlers
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

    // Utility Functions
    const uniqueProjectNos = useMemo(() => {
        const projectNumbers = projects.map(project => project.projectNo).filter(p => p);
        return [...new Set(projectNumbers)].sort();
    }, [projects]);

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
            // TIER 1: Completion Status (Always forces completed to bottom)
            const isACompleted = a.status?.toLowerCase() === 'completed';
            const isBCompleted = b.status?.toLowerCase() === 'completed';

            if (isACompleted !== isBCompleted) {
                return isACompleted ? 1 : -1; 
            }

            // TIER 2: User-selected Sort (only if the status tier is the same)
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Special handling for Priority levels if sorting by Priority
                if (sortConfig.key === 'priority') {
                    const priorityWeight = { high: 1, medium: 2, low: 3 };
                    aValue = priorityWeight[a.priority?.toLowerCase()] || 4;
                    bValue = priorityWeight[b.priority?.toLowerCase()] || 4;
                }

                // Special handling for Dates
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
            default: return '#6c757d';
        }
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

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '⬆️' : '⬇️';
    };

    // Function to show the ViewPanelPage component
    const goToViewPanelPage = () => {
        setShowViewPanel(true);
    };

    // Function to go back to PanelSlab
    const goBackToPanelSlab = () => {
        setShowViewPanel(false);
    };

    // If showViewPanel is true, render the ViewPanelPage component
    if (showViewPanel) {
        return <ViewPanelPage onBack={goBackToPanelSlab} />;
    }

    // Otherwise, render the normal PanelSlab UI
    return (
        <div className="panel-slab-container">
            {/* Header Section */}
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

            {/* Dashboard Cards */}
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
            </div>

            {/* Filters Section */}
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

            {/* Tasks Table */}
            <div className="tasks-table-container">
                {error && <div className="alert alert-danger">{error}</div>}

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
                        <button className="create-first-task-btn" onClick={goToViewPanelPage}>
                            👁️ Go to View Panel Page to Create Tasks
                        </button>
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
                                            {task.description && (
                                                <div className="task-description">{task.description}</div>
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
                                                    <option value="on-hold">⏸️ On Hold</option>
                                                    <option value="in-progress">🔄 In Progress</option>
                                                    <option value="completed">✅ Completed</option>
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

            {/* Modals */}
            <ExcelDataModal 
                isOpen={isExcelModalOpen}
                onClose={closeExcelModal}
                excelData={excelData}
                isLoading={isExcelLoading}
                error={error}
            />

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
        </div>
    );
};

export default PanelSlab;