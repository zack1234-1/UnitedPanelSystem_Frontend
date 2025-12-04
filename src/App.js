import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelSlab from './panelSlab';
import Cutting from './Cutting';
import Door from './Door';
import Accessories from './Accessories';
import StripCurtain from './StripCurtain';
import System from './System';
import { FileView, FileUploadSection, real_uploadProjectFiles } from './FileComponents';
import AdminPage from './AdminPage';
import './App.css';

// =========================================================
// 1. REAL API Service Implementation
// =========================================================

const API_BASE = 'http://localhost:5000/api';

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Real API functions
const real_getAllProjects = async () => {
  return await apiCall('/projects');
};

const real_createProject = async (newProject) => {
  return await apiCall('/projects', {
    method: 'POST',
    body: JSON.stringify(newProject),
  });
};

const real_deleteProject = async (id) => {
  return await apiCall(`/projects/${id}`, {
    method: 'DELETE',
  });
};

const real_updateProject = async (id, updatedData) => {
  return await apiCall(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updatedData),
  });
};

// New function to create initial tasks for categories
const createCategoryTasks = async (projectNo, selectedCategories) => {
  try {
    const tasks = [];
    
    // For each selected category, create initial task entry
    for (const category of selectedCategories) {
      let taskData = {
        projectNo: projectNo,
        status: 'Pending'
      };
      
      // Add category-specific default fields
      switch(category) {
        case 'panelSlab':
          taskData = {
            ...taskData,
            panelName: '',
            panelWidth: 0,
            panelHeight: 0,
            panelQty: 0,
            remarks: ''
          };
          await apiCall('/panel-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
          
        case 'cutting':
          taskData = {
            ...taskData,
            cuttingName: '',
            cuttingWidth: 0,
            cuttingHeight: 0,
            cuttingQty: 0,
            remarks: ''
          };
          await apiCall('/cutting-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
          
        case 'door':
          taskData = {
            ...taskData,
            doorName: '',
            doorWidth: 0,
            doorHeight: 0,
            doorQty: 0,
            remarks: ''
          };
          await apiCall('/door-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
          
        case 'stripCurtain':
          taskData = {
            ...taskData,
            stripCurtainName: '',
            stripCurtainWidth: 0,
            stripCurtainHeight: 0,
            stripCurtainQty: 0,
            remarks: ''
          };
          await apiCall('/strip-curtain-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
          
        case 'accessories':
          taskData = {
            ...taskData,
            accessoryName: '',
            accessoryQty: 0,
            remarks: ''
          };
          await apiCall('/accessories-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
          
        case 'system':
          taskData = {
            ...taskData,
            systemName: '',
            systemQty: 0,
            remarks: ''
          };
          await apiCall('/system-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
          });
          break;
      }
      
      tasks.push({ category, taskData });
    }
    
    return tasks;
  } catch (error) {
    console.error('Error creating category tasks:', error);
    throw error;
  }
};

// =========================================================
// 2. Notification Component
// =========================================================

const Notification = React.memo(({ message, onClose }) => {
    return (
        <div className="notification-item">
            <div className="message" dangerouslySetInnerHTML={{ __html: message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
    );
});

// =========================================================
// 3. Notification Page Component
// =========================================================

const NotificationPage = ({ notifications, removeNotification, clearAllNotifications }) => {
    return (
        <div className="notification-page">
            <header className="page-header">
                <h1>📋 Notifications</h1>
                {notifications.length > 0 && (
                    <button 
                        onClick={clearAllNotifications} 
                        className="secondary clear-all-btn"
                    >
                        Clear All Notifications
                    </button>
                )}
            </header>

            <main className="notification-page-content">
                {notifications.length === 0 ? (
                    <div className="no-notifications-page">
                        <div className="empty-state">
                            <span className="empty-icon">🎉</span>
                            <h2>You're all caught up!</h2>
                            <p>No notifications at the moment.</p>
                        </div>
                    </div>
                ) : (
                    <div className="notification-list-page">
                        <div className="notification-stats">
                            <p>You have <strong>{notifications.length}</strong> notification{notifications.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="notifications-grid">
                            {notifications.map(notification => (
                                <div key={notification.id} className="notification-card">
                                    <div 
                                        className="notification-message" 
                                        dangerouslySetInnerHTML={{ 
                                            __html: notification.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                                        }} 
                                    />
                                    <div className="notification-actions">
                                        <button 
                                            onClick={() => removeNotification(notification.id)}
                                            className="close-btn"
                                            title="Dismiss notification"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

// =========================================================
// 4. Enhanced Category Selection Component with Optional File Upload
// =========================================================

const EnhancedCategorySelection = ({ 
    selectedCategories, 
    onCategoryChange, 
    categoryFiles, 
    onCategoryFileUpload, 
    onRemoveCategoryFile, 
    onClearCategoryFiles 
}) => {
    const categories = [
        { id: 'panel', label: 'Panel / Slab', icon: '🖼️' },
        { id: 'cutting', label: 'Cutting', icon: '✂️' },
        { id: 'door', label: 'Door', icon: '🚪' },
        { id: 'stripCurtain', label: 'Strip Curtain', icon: '🎪' },
        { id: 'accessories', label: 'Accessories', icon: '🔧' },
        { id: 'system', label: 'System', icon: '⚙️' }
    ];

    const [dragActiveCategory, setDragActiveCategory] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});
    const [isUploading, setIsUploading] = useState(false);

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get file icon based on type
    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('dwg') || fileType.includes('dxf')) return '📐';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
        if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
        return '📎';
    };

    const handleCategoryToggle = (categoryId) => {
        const newCategories = selectedCategories.includes(categoryId)
            ? selectedCategories.filter(id => id !== categoryId)
            : [...selectedCategories, categoryId];
        onCategoryChange(newCategories);
    };

    const handleFileUpload = async (categoryId, event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setIsUploading(true);
            
            // Simulate upload progress for each file
            const progressUpdates = {};
            files.forEach((file, index) => {
                progressUpdates[`${categoryId}-${file.name}`] = 0;
                
                // Simulate progress updates
                const interval = setInterval(() => {
                    setUploadProgress(prev => {
                        const newProgress = { ...prev };
                        const current = newProgress[`${categoryId}-${file.name}`] || 0;
                        if (current < 90) {
                            newProgress[`${categoryId}-${file.name}`] = current + 10;
                        } else {
                            clearInterval(interval);
                        }
                        return newProgress;
                    });
                }, 200);
                
                // Complete progress after 2 seconds
                setTimeout(() => {
                    setUploadProgress(prev => ({
                        ...prev,
                        [`${categoryId}-${file.name}`]: 100
                    }));
                }, 2000);
            });

            // Add files to state
            onCategoryFileUpload(categoryId, files);
            
            // Reset uploading state
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress({});
            }, 2500);
        }
    };

    const handleDragOver = (categoryId, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveCategory(categoryId);
    };

    const handleDragLeave = (categoryId) => {
        setDragActiveCategory(null);
    };

    const handleDrop = (categoryId, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveCategory(null);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // Create a synthetic event to reuse the handleFileUpload function
            const syntheticEvent = {
                target: { files }
            };
            handleFileUpload(categoryId, syntheticEvent);
        }
    };

    const triggerFileInput = (categoryId) => {
        const fileInput = document.getElementById(`file-input-${categoryId}`);
        if (fileInput) {
            fileInput.click();
        }
    };

    return (
        <div className="category-selection">
            <h3>Select Job Categories</h3>
            <p className="category-instructions">
                Tick the categories that apply to this job. You can upload files for each category (optional):
            </p>

            <div className="category-grid">
                {categories.map((category) => {
                    const isSelected = selectedCategories.includes(category.id);
                    const files = categoryFiles[category.id] || [];
                    const isDraggingOver = dragActiveCategory === category.id;
                    
                    return (
                        <div 
                            key={category.id}
                            className={`category-item ${isSelected ? 'selected' : ''}`}
                        >
                            <div className="category-header">
                                <div 
                                    className="category-main" 
                                    onClick={() => handleCategoryToggle(category.id)}
                                >
                                    <div className="category-icon">{category.icon}</div>
                                    <div className="category-label">{category.label}</div>
                                    <div className="category-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="category-checkbox-input"
                                        />
                                        <span className="checkmark"></span>
                                    </div>
                                </div>
                                
                                {isSelected && (
                                    <div className="category-file-upload">
                                        <div 
                                            className={`category-file-dropzone ${isDraggingOver ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
                                            onDragOver={(e) => handleDragOver(category.id, e)}
                                            onDragLeave={() => handleDragLeave(category.id)}
                                            onDrop={(e) => handleDrop(category.id, e)}
                                            onClick={() => !isUploading && triggerFileInput(category.id)}
                                        >
                                            <input
                                                type="file"
                                                multiple
                                                onChange={(e) => handleFileUpload(category.id, e)}
                                                style={{ display: 'none' }}
                                                id={`file-input-${category.id}`}
                                                accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                                            />
                                            <div className="upload-area-content">
                                                <div className="upload-icon">
                                                    {isUploading ? '⏳' : isDraggingOver ? '⬇️' : '📁'}
                                                </div>
                                                <div className="upload-text">
                                                    <div className="upload-label">
                                                        {isUploading ? 'Uploading...' : 'Click or drop files here (optional)'}
                                                    </div>
                                                    <div className="upload-subtext">
                                                        {isUploading ? 'Please wait while files upload' : 'Drag & drop or click to browse'}
                                                    </div>
                                                    <div className="upload-hint">
                                                        Supports images, PDFs, CAD files, documents
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {files.length > 0 && (
                                            <div className="category-files-list">
                                                <div className="files-header">
                                                    <div className="files-stats">
                                                        <span className="files-count">
                                                            {files.length} file{files.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="files-size">
                                                            • {formatFileSize(files.reduce((acc, file) => acc + file.size, 0))}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        className="clear-files-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onClearCategoryFiles(category.id);
                                                        }}
                                                        disabled={isUploading}
                                                    >
                                                        Clear All
                                                    </button>
                                                </div>
                                                
                                                <div className="files-grid">
                                                    {files.map((file, index) => {
                                                        const progressKey = `${category.id}-${file.name}`;
                                                        const progress = uploadProgress[progressKey] || 0;
                                                        const isUploadingFile = progress > 0 && progress < 100;
                                                        
                                                        return (
                                                            <div 
                                                                key={index} 
                                                                className={`file-item ${isUploadingFile ? 'uploading' : ''}`}
                                                            >
                                                                <div className="file-info">
                                                                    <div className="file-icon">
                                                                        {getFileIcon(file.type)}
                                                                    </div>
                                                                    <div className="file-details">
                                                                        <div className="file-name" title={file.name}>
                                                                            {file.name}
                                                                        </div>
                                                                        <div className="file-meta">
                                                                            <span className="file-type">
                                                                                {file.type || 'Unknown type'}
                                                                            </span>
                                                                            <span className="file-size">
                                                                                • {formatFileSize(file.size)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="file-actions">
                                                                    {isUploadingFile ? (
                                                                        <div className="upload-progress">
                                                                            <div 
                                                                                className="progress-bar"
                                                                                style={{ width: `${progress}%` }}
                                                                            ></div>
                                                                            <span className="progress-text">
                                                                                {progress}%
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <button 
                                                                            type="button"
                                                                            className="remove-file-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onRemoveCategoryFile(category.id, index);
                                                                            }}
                                                                            title="Remove file"
                                                                            disabled={isUploading}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// =========================================================
// 5. Custom Router Logic
// =========================================================

const useSimpleRouter = () => {
    const [path, setPath] = useState(window.location.hash.slice(1) || '/');

    const handleHashChange = useCallback(() => {
        setPath(window.location.hash.slice(1) || '/');
    }, []);

    useEffect(() => {
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [handleHashChange]);

    const navigate = useCallback((newPath) => {
        window.location.hash = newPath;
    }, []);

    const matchFiles = path.match(/^\/files\/(.+)$/);
    const matchPanels = path === '/panels';
    const matchCutting = path === '/cutting';
    const matchDoors = path === '/doors';
    const matchAccessories = path === '/accessories';
    const matchStripCurtain = path === '/strip-curtain';
    const matchSystem = path === '/system';
    const matchNotifications = path === '/notifications';
    const matchAdmin = path === '/admin';

    let currentRoute = 'JobList';
    let params = {};

    if (matchFiles) {
        currentRoute = 'FileView';
        params = { projectNo: matchFiles[1] };
    } else if (matchPanels) {
        currentRoute = 'PanelSlab';
    } else if (matchCutting) {
        currentRoute = 'Cutting';
    } else if (matchDoors) {
        currentRoute = 'Door';
    } else if (matchAccessories) {
        currentRoute = 'Accessories';
    } else if (matchStripCurtain) {
        currentRoute = 'StripCurtain';
    } else if (matchSystem) {
        currentRoute = 'System';
    } else if (matchNotifications) {
        currentRoute = 'NotificationPage';
    } else if (matchAdmin) {
        currentRoute = 'AdminPage';
    }

    return { navigate, currentRoute, params };
};

// =========================================================
// 6. Progress Component for Task Count Display
// =========================================================

const TaskCountDisplay = ({ completed, total }) => {
    const getProgressClass = () => {
        if (total === 0) return 'progress-not-started';
        if (completed < total) return 'progress-in-progress';
        return 'progress-completed';
    };

    const getDisplayText = () => {
        return `${completed}/${total}`;
    };

    return (
        <div className={`task-count-display ${getProgressClass()}`}>
            <span className="task-count-text">{getDisplayText()}</span>
        </div>
    );
};

// =========================================================
// 7. Payment Status Dropdown Component
// =========================================================

const PaymentStatusDropdown = ({ value, onChange, name, required = false, disabled = false }) => {
    const paymentOptions = [
        { value: '', label: 'Select Payment Status', disabled: true },
        { value: 'Deposit', label: '💰 Deposit' },
        { value: 'Full Payment', label: '💳 Full Payment' },
        { value: 'Progress Claim', label: '📋 Progress Claim' },
        { value: 'Retention', label: '📊 Retention' },
        { value: 'Done', label: '✅ Done' }
    ];

    const getStatusColor = (status) => {
        switch(status) {
            case 'Done': return '#10B981';
            case 'Full Payment': return '#3B82F6';
            case 'Deposit': return '#F59E0B';
            case 'Progress Claim': return '#8B5CF6';
            case 'Retention': return '#EF4444';
            default: return '#6B7280';
        }
    };

    return (
        <div className="form-group payment-status-group">
            <label htmlFor={name}>PO/Payment Status</label>
            <div className="select-wrapper">
                <select
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    disabled={disabled}
                    className="payment-status-select"
                    style={{
                        borderLeft: `4px solid ${getStatusColor(value)}`
                    }}
                >
                    {paymentOptions.map((option, index) => (
                        <option 
                            key={index} 
                            value={option.value} 
                            disabled={option.disabled}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

// =========================================================
// 8. Date Picker Component (Updated for both dates)
// =========================================================

const DatePicker = ({ 
    value, 
    onChange, 
    name, 
    label, 
    required = false, 
    disabled = false,
    minDate = null,
    maxDate = null
}) => {
    return (
        <div className="form-group date-picker-group">
            <label htmlFor={name}>{label}</label>
            <div className="date-input-wrapper">
                <input
                    type="date"
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    disabled={disabled}
                    min={minDate}
                    max={maxDate}
                    className="date-input"
                />
            </div>
        </div>
    );
};

// =========================================================
// 9. Main App Component
// =========================================================

function App() {
    // --- Routing ---
    const { navigate, currentRoute, params } = useSimpleRouter();

    // Get today's date in YYYY-MM-DD format for date inputs
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // --- State Initialization ---
    const [projects, setProjects] = useState([]);
    const [newProject, setNewProject] = useState({
        drawingDate: '', 
        projectNo: '', 
        customer: '', 
        poPayment: '', 
        requestedDelivery: '', 
        remarks: ''
    });
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [categoryFiles, setCategoryFiles] = useState({});
    const [isDragActive, setIsDragActive] = useState(false);
    
    const [editingProject, setEditingProject] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false); 
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // --- API State Variables ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null); 

    // =========================================================
    // Category Files Management
    // =========================================================

    // Initialize files for a category
    const initializeCategoryFiles = useCallback((categoryId) => {
        if (!categoryFiles[categoryId]) {
            setCategoryFiles(prev => ({
                ...prev,
                [categoryId]: []
            }));
        }
    }, [categoryFiles]);

    // Handle file upload for a specific category
    const handleCategoryFileUpload = useCallback((categoryId, files) => {
        setCategoryFiles(prev => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), ...files]
        }));
    }, []);

    // Remove file from a specific category
    const removeCategoryFile = useCallback((categoryId, fileIndex) => {
        setCategoryFiles(prev => {
            const updatedFiles = [...(prev[categoryId] || [])];
            updatedFiles.splice(fileIndex, 1);
            return {
                ...prev,
                [categoryId]: updatedFiles
            };
        });
    }, []);

    // Clear all files for a category
    const clearCategoryFiles = useCallback((categoryId) => {
        setCategoryFiles(prev => ({
            ...prev,
            [categoryId]: []
        }));
    }, []);

    // Handle category selection change
    const handleCategoryChange = useCallback((categories) => {
        // Initialize files for newly selected categories
        categories.forEach(categoryId => {
            if (!selectedCategories.includes(categoryId)) {
                initializeCategoryFiles(categoryId);
            }
        });
        
        // Remove files from deselected categories
        const deselectedCategories = selectedCategories.filter(
            cat => !categories.includes(cat)
        );
        
        deselectedCategories.forEach(categoryId => {
            setCategoryFiles(prev => {
                const newFiles = { ...prev };
                delete newFiles[categoryId];
                return newFiles;
            });
        });
        
        setSelectedCategories(categories);
    }, [selectedCategories, initializeCategoryFiles]);

    // =========================================================
    // API Data Fetching Logic
    // =========================================================
    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await real_getAllProjects(); 
            
            const projectsWithCompletion = data.map((project) => {
                const completion = {
                    panelSlab: { 
                        completed: project.completed_panel || 0, 
                        total: project.total_panel || 0 
                    },
                    cutting: { 
                        completed: project.completed_cutting || 0, 
                        total: project.total_cutting || 0 
                    },
                    door: { 
                        completed: project.completed_door || 0, 
                        total: project.total_door || 0 
                    },
                    stripCurtain: { 
                        completed: project.completed_strip_cuttain || 0, 
                        total: project.total_strip_cuttain || 0 
                    },
                    accessories: { 
                        completed: project.completed_accessories || 0, 
                        total: project.total_accessories || 0 
                    },
                    system: { 
                        completed: project.completed_system || 0, 
                        total: project.total_system || 0 
                    }
                };

                return {
                    ...project,
                    completion: completion
                };
            });
            
            setProjects(projectsWithCompletion);
        } catch (err) {
            console.error("Failed to fetch projects:", err);
            setError(`Failed to load projects: ${err.message}. Check your backend server.`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentRoute === 'JobList' || currentRoute === 'AdminPage') {
            fetchProjects();
        }
    }, [fetchProjects, currentRoute]);

    // =========================================================
    // Core App Handlers
    // =========================================================

    const handleViewFiles = (projectNo) => {
        navigate(`/files/${projectNo}`); 
    };

    const toggleForm = () => {
        setIsFormOpen(!isFormOpen);
        if (isFormOpen) { 
            setNewProject({ 
                drawingDate: '', 
                projectNo: '', 
                customer: '', 
                poPayment: '', 
                requestedDelivery: '', 
                remarks: ''
            }); 
            setSelectedCategories([]);
            setCategoryFiles({});
            if (fileInputRef.current) { fileInputRef.current.value = ''; }
        }
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const addNotification = (message) => {
        const newNotification = { id: Date.now(), message };
        setNotifications(prev => [newNotification, ...prev]);

        setTimeout(() => {
            removeNotification(newNotification.id);
        }, 5000);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAllNotifications = () => {
        setNotifications([]);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewProject({ ...newProject, [name]: value });
    };

    const handleAddProject = async (e) => {
        e.preventDefault();
        
        if (!newProject.projectNo || !newProject.customer) {
            addNotification("🚨 **Error:** Project No. and Customer Name are required."); 
            return;
        }

        try {
            // Add selected categories to project data
            const projectWithCategories = {
                ...newProject,
                selectedCategories: selectedCategories
            };

            // Create the project
            const addedProject = await real_createProject(projectWithCategories); 
            
            // Create initial tasks for each selected category
            let createdTasksCount = 0;
            try {
                await createCategoryTasks(addedProject.projectNo, selectedCategories);
                createdTasksCount = selectedCategories.length;
            } catch (taskError) {
                console.error("Error creating category tasks:", taskError);
                addNotification("⚠️ Project created but could not create category tasks. You can add them manually later.");
            }

            // Handle file uploads for EACH selected category (OPTIONAL)
            let totalFilesUploaded = 0;
            let uploadResults = [];
            
            // Only attempt to upload files if there are any files for any category
            const hasFiles = Object.values(categoryFiles).some(files => files && files.length > 0);
            
            if (hasFiles) {
                for (const categoryId of selectedCategories) {
                    const files = categoryFiles[categoryId] || [];
                    
                    if (files.length > 0) {
                        const formData = new FormData();
                        formData.append('projectNo', addedProject.projectNo);
                        formData.append('category', categoryId);
                        
                        files.forEach(file => {
                            formData.append('files', file);
                        });

                        try {
                            await real_uploadProjectFiles(formData);
                            totalFilesUploaded += files.length;
                            uploadResults.push(`${files.length} to ${categoryId}`);
                        } catch (uploadError) {
                            console.error(`Error uploading files for ${categoryId}:`, uploadError);
                            addNotification(`⚠️ Error uploading files for ${categoryId}. Please try again later.`);
                        }
                    }
                }
            }

            // Refresh projects list
            await fetchProjects();
            
            // Reset form
            setNewProject({ 
                drawingDate: '', 
                projectNo: '', 
                customer: '', 
                poPayment: '', 
                requestedDelivery: '', 
                remarks: '' 
            }); 
            setSelectedCategories([]);
            setCategoryFiles({});
            
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            
            setIsFormOpen(false); 
            
            // Success notification
            const categoryNames = {
                panelSlab: 'Panel/Slab',
                cutting: 'Cutting',
                door: 'Door',
                stripCurtain: 'Strip Curtain',
                accessories: 'Accessories',
                system: 'System'
            };
            
            const categoryList = selectedCategories.map(cat => categoryNames[cat]).join(', ');
            
            let notificationMessage = `✅ Job for ${addedProject.customer} (**${addedProject.projectNo}**) created successfully. `;
            notificationMessage += `Categories: ${categoryList}. `;
            notificationMessage += `${createdTasksCount} initial task(s) created.`;
            
            if (totalFilesUploaded > 0) {
                notificationMessage += ` ${totalFilesUploaded} file(s) uploaded: ${uploadResults.join(', ')}.`;
            } else {
                notificationMessage += ` No files uploaded (optional).`;
            }
            
            addNotification(notificationMessage);

        } catch (err) {
            console.error("Error creating project:", err);
            setError(`Error creating project: ${err.message}`);
            addNotification(`❌ **Error:** Could not create job. ${err.message}`);
        }
    };
    
    // Deletion Handler
    const startDeleteConfirmation = (id, projectNo) => {
        setConfirmDeleteId({ id, projectNo });
    };

    const confirmDeleteProject = async () => {
        if (!confirmDeleteId) return;

        const { id, projectNo } = confirmDeleteId;
        setConfirmDeleteId(null);

        try {
            await real_deleteProject(id); 
            setProjects(projects.filter(p => p.id !== id));
            addNotification(`🗑️ Job **${projectNo}** has been deleted from DB.`);
        } catch (err) {
            setError(`Error deleting project: ${err.message}`);
            addNotification(`❌ **Error:** Could not delete job.`);
        }
    };

    const handleEdit = (project) => {
        setEditingProject({ ...project });
    };

    const handleCancelEdit = () => {
        setEditingProject(null);
    };

    const handleUpdateProject = async (e) => {
        e.preventDefault();
        const originalProjects = projects; 
        
        try {
            const updatedProject = await real_updateProject(editingProject.id, editingProject); 
            setProjects(projects.map(p => (p.id === updatedProject.id ? updatedProject : p)));
            setEditingProject(null);
            addNotification(`✏️ Job **${updatedProject.projectNo}** has been fully updated.`); 
        } catch (err) {
            setError(`Error updating project: ${err.message}`);
            addNotification(`❌ **Error:** Could not update job. Reverting changes.`);
            setProjects(originalProjects);
        }
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingProject({ ...editingProject, [name]: value });
    };

    const progressColumns = [
        { key: 'panelSlab', label: 'Panel / Slab' },
        { key: 'cutting', label: 'Cutting' },
        { key: 'door', label: 'Door' },
        { key: 'stripCurtain', label: 'Strip Curtain' },
        { key: 'accessories', label: 'Accessories' },
        { key: 'system', label: 'System' }
    ];

    // Function to format date for display
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return 'Not set';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString; // Return original string if parsing fails
        }
    };

    // Function to get payment status color
    const getPaymentStatusColor = (status) => {
        switch(status) {
            case 'Done': return '#10B981';
            case 'Full Payment': return '#3B82F6';
            case 'Deposit': return '#F59E0B';
            case 'Progress Claim': return '#8B5CF6';
            case 'Retention': return '#EF4444';
            default: return '#6B7280';
        }
    };

    // Function to get payment status icon
    const getPaymentStatusIcon = (status) => {
        switch(status) {
            case 'Done': return '✅';
            case 'Full Payment': return '💳';
            case 'Deposit': return '💰';
            case 'Progress Claim': return '📋';
            case 'Retention': return '📊';
            default: return '📝';
        }
    };

    const renderProjectCard = (project) => {
        const isEditing = editingProject && editingProject.id === project.id;
        const completion = project.completion || {
            panelSlab: { completed: 0, total: 0 },
            cutting: { completed: 0, total: 0 },
            door: { completed: 0, total: 0 },
            stripCurtain: { completed: 0, total: 0 },
            accessories: { completed: 0, total: 0 },
            system: { completed: 0, total: 0 }
        };

        if (isEditing) {
            return (
                <form onSubmit={handleUpdateProject} className="job-card edit-card">
                    <h3 className="card-title">Edit Job: {project.projectNo}</h3>
                    
                    <div className="form-row">
                        <DatePicker 
                            value={editingProject.drawingDate}
                            onChange={handleEditInputChange}
                            name="drawingDate"
                            label="Drawing Date*"
                        />
                        
                        <div className="form-group">
                            <label htmlFor="edit-projectNo">Job No.*</label>
                            <input 
                                id="edit-projectNo"
                                name="projectNo" 
                                value={editingProject.projectNo} 
                                onChange={handleEditInputChange} 
                                placeholder="Job No." 
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="edit-customer">Customer Name*</label>
                        <input 
                            id="edit-customer"
                            name="customer" 
                            value={editingProject.customer} 
                            onChange={handleEditInputChange} 
                            placeholder="Customer Name" 
                            required
                        />
                    </div>
                    
                    <div className="form-row">
                        <PaymentStatusDropdown 
                            value={editingProject.poPayment}
                            onChange={handleEditInputChange}
                            name="poPayment"
                        />
                        
                        <DatePicker 
                            value={editingProject.requestedDelivery}
                            onChange={handleEditInputChange}
                            name="requestedDelivery"
                            label="Requested Delivery"
                            minDate={getTodayDate()}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="edit-remarks">Remarks</label>
                        <textarea 
                            id="edit-remarks"
                            name="remarks" 
                            value={editingProject.remarks} 
                            onChange={handleEditInputChange} 
                            placeholder="Additional notes or remarks"
                            rows="3"
                        />
                    </div>
                    
                    <div className="card-actions">
                        <button type="button" onClick={handleCancelEdit} className="secondary">Cancel</button>
                        <button type="submit" className="primary">Save Changes</button>
                    </div>
                </form>
            );
        }

        return (
            <div 
                className="job-card clickable"
                onClick={() => handleViewFiles(project.projectNo)} 
            >
                <div className="job-header">
                    <h3 className="card-title">{project.customer}</h3>
                    <span className="job-no-tag">Job #{project.projectNo}</span> 
                </div>
                
                <div className="job-details-group">
                    <p>
                        <strong>Drawing Date:</strong> 
                        <span className="date-value">{formatDateForDisplay(project.drawingDate)}</span>
                    </p>
                    <p>
                        <strong>Payment Status:</strong> 
                        <span 
                            className="payment-status-tag"
                            style={{
                                backgroundColor: `${getPaymentStatusColor(project.poPayment)}20`,
                                borderColor: getPaymentStatusColor(project.poPayment),
                                color: getPaymentStatusColor(project.poPayment)
                            }}
                        >
                            {getPaymentStatusIcon(project.poPayment)} {project.poPayment || 'Not set'}
                        </span>
                    </p>
                    <p>
                        <strong>Requested Delivery:</strong> 
                        <span className="date-value">{formatDateForDisplay(project.requestedDelivery)}</span>
                    </p>
                </div>

                <div className="status-grid" onClick={e => e.stopPropagation()}> 
                    {progressColumns.map(({ key, label }) => (
                        <div key={key} className="status-field">
                            <label>{label}</label>
                            <TaskCountDisplay 
                                completed={completion[key]?.completed || 0} 
                                total={completion[key]?.total || 0} 
                            />
                        </div>
                    ))}
                </div>
                
                <div className="job-remarks">
                    <strong>Remarks:</strong> 
                    <span className="remarks-text">
                        {project.remarks || 'No remarks provided.'}
                    </span>
                </div>
                
                <div className="card-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(project); }} className="secondary">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); startDeleteConfirmation(project.id, project.projectNo); }} className="danger">Delete</button> 
                </div>
            </div>
        );
    };

    // --- Loading and Error View ---
    if (isLoading && (currentRoute === 'JobList' || currentRoute === 'AdminPage')) {
        return <div className="App" style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Loading Projects... 🔄</h2>
        </div>;
    }

    if (error) {
        return <div className="App" style={{ textAlign: 'center', padding: '50px', color: '#B91C1C' }}>
            <h2>Error Connecting to API</h2>
            <p className="error-detail">Details: {error}</p>
            <button onClick={fetchProjects} className="primary" style={{ marginTop: '20px' }}>Try Reloading Data</button>
        </div>;
    }

    // --- Main Renderer ---
    return (
        <div className="App sidebar-layout">
            {/* Sidebar Component */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className={`app-logo ${isSidebarOpen ? 'full' : 'collapsed-text'}`}>
                        **Project Tracker**
                    </div>
                    
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                        {isSidebarOpen ? '◀' : '▶'}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <a 
                        href="#/" 
                        className={`nav-item primary-nav ${currentRoute === 'JobList' ? 'active' : ''}`}
                        onClick={() => navigate('/')}
                    > 
                        <span role="img" aria-label="home">🏠</span>
                        {isSidebarOpen && <span>Job List</span>}
                    </a>
                    
                    <a 
                        href="#/panels" 
                        className={`nav-item ${currentRoute === 'PanelSlab' ? 'active' : ''}`}
                        onClick={() => navigate('/panels')}
                    > 
                        <span role="img" aria-label="panel">🖼️</span>
                        {isSidebarOpen && <span>Panel / Slab</span>}
                    </a>

                    <a 
                        href="#/cutting" 
                        className={`nav-item ${currentRoute === 'Cutting' ? 'active' : ''}`}
                        onClick={() => navigate('/cutting')}
                    > 
                        <span role="img" aria-label="cutting">✂️</span>
                        {isSidebarOpen && <span>Cutting</span>}
                    </a>
                    
                    <a 
                        href="#/doors" 
                        className={`nav-item ${currentRoute === 'Door' ? 'active' : ''}`}
                        onClick={() => navigate('/doors')}
                    > 
                        <span role="img" aria-label="door">🚪</span>
                        {isSidebarOpen && <span>Door</span>}
                    </a>

                    <a 
                        href="#/strip-curtain" 
                        className={`nav-item ${currentRoute === 'StripCurtain' ? 'active' : ''}`}
                        onClick={() => navigate('/strip-curtain')}
                    > 
                        <span role="img" aria-label="strip curtain">🎪</span>
                        {isSidebarOpen && <span>Strip Curtain</span>}
                    </a>

                    <a 
                        href="#/accessories" 
                        className={`nav-item ${currentRoute === 'Accessories' ? 'active' : ''}`}
                        onClick={() => navigate('/accessories')}
                    > 
                        <span role="img" aria-label="accessories">🔧</span>
                        {isSidebarOpen && <span>Accessories</span>}
                    </a>

                    <a 
                        href="#/system" 
                        className={`nav-item ${currentRoute === 'System' ? 'active' : ''}`}
                        onClick={() => navigate('/system')}
                    > 
                        <span role="img" aria-label="system">⚙️</span>
                        {isSidebarOpen && <span>System</span>}
                    </a>

                    {/* Admin Page Navigation */}
                    <a 
                        href="#/admin" 
                        className={`nav-item ${currentRoute === 'AdminPage' ? 'active' : ''}`}
                        onClick={() => navigate('/admin')}
                    > 
                        <span role="img" aria-label="admin">👨‍💼</span>
                        {isSidebarOpen && <span>Project Admin</span>}
                    </a>

                    {/* Notification Page Navigation */}
                    <a 
                        href="#/notifications" 
                        className={`nav-item ${currentRoute === 'NotificationPage' ? 'active' : ''}`}
                        onClick={() => navigate('/notifications')}
                    > 
                        <span role="img" aria-label="notifications">🔔</span>
                        {isSidebarOpen && <span>Notifications</span>}
                        {notifications.length > 0 && (
                            <span className="notification-badge">{notifications.length}</span>
                        )}
                    </a>
                </nav>
            </div>
            
            {/* Main Content Area */}
            <div className={`content-area ${isSidebarOpen ? 'shrunk' : 'expanded'}`}>
                {currentRoute === 'JobList' && (
                    <>
                        <header className="page-header">
                            <h1>Active Project Tracker</h1>
                            <button onClick={toggleForm} className="primary toggle-form-button">
                                {isFormOpen ? '✖️ Close Form' : '➕ Add New Project'}
                            </button>
                        </header>
                        <main>
                            {isFormOpen && (
                                <div className="job-form-container">
                                    <h2>➕ Add New Job</h2>
                                    <form onSubmit={handleAddProject} className="job-form">
                                        <div className="form-row">
                                            <DatePicker 
                                                value={newProject.drawingDate}
                                                onChange={handleInputChange}
                                                name="drawingDate"
                                                label="Drawing Date*"
                                                required
                                            />
                                            
                                            <div className="form-group">
                                                <label htmlFor="projectNo">Job No.*</label>
                                                <input 
                                                    id="projectNo"
                                                    name="projectNo" 
                                                    value={newProject.projectNo} 
                                                    onChange={handleInputChange} 
                                                    placeholder="Job No." 
                                                    required
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="form-group">
                                            <label htmlFor="customer">Customer Name*</label>
                                            <input 
                                                id="customer"
                                                name="customer" 
                                                value={newProject.customer} 
                                                onChange={handleInputChange} 
                                                placeholder="Customer Name" 
                                                required
                                            />
                                        </div>
                                        
                                        <div className="form-row">
                                            <PaymentStatusDropdown 
                                                value={newProject.poPayment}
                                                onChange={handleInputChange}
                                                name="poPayment"
                                            />
                                            
                                            <DatePicker 
                                                value={newProject.requestedDelivery}
                                                onChange={handleInputChange}
                                                name="requestedDelivery"
                                                label="Requested Delivery"
                                                minDate={getTodayDate()}
                                            />
                                        </div>
                                        
                                        <div className="form-group">
                                            <label htmlFor="remarks">Remarks</label>
                                            <textarea 
                                                id="remarks"
                                                name="remarks" 
                                                value={newProject.remarks} 
                                                onChange={handleInputChange} 
                                                placeholder="Additional notes or remarks"
                                                rows="3"
                                            />
                                        </div>
                                        
                                        {/* Enhanced Category Selection with Optional File Upload */}
                                        <EnhancedCategorySelection 
                                            selectedCategories={selectedCategories}
                                            onCategoryChange={handleCategoryChange}
                                            categoryFiles={categoryFiles}
                                            onCategoryFileUpload={handleCategoryFileUpload}
                                            onRemoveCategoryFile={removeCategoryFile}
                                            onClearCategoryFiles={clearCategoryFiles}
                                        />

                                        <div className="form-actions">
                                            <button type="submit" className="primary">Create Project</button>
                                            <button type="button" onClick={toggleForm} className="secondary">Cancel</button>
                                        </div>
                                    </form>
                                </div>
                            )}
                            
                            <div className="job-list-header">
                                <h3>Active Projects ({projects.length})</h3>
                            </div>
                            
                            <div className="job-list">
                                {projects.length === 0 ? (
                                    <p className="no-jobs-message">No projects found. Create your first project to get started!</p>
                                ) : (
                                    projects.map(project => (
                                        <div key={project.id}>{renderProjectCard(project)}</div>
                                    ))
                                )}
                            </div>
                        </main>
                    </>
                )}
                
                {currentRoute === 'FileView' && params.projectNo && (
                    <FileView 
                        projectNo={params.projectNo} 
                        navigateHome={() => navigate('/')}
                    />
                )}

                {currentRoute === 'PanelSlab' && <PanelSlab navigate={navigate} />}
                {currentRoute === 'Cutting' && <Cutting navigate={navigate} />}
                {currentRoute === 'Door' && <Door navigate={navigate} />}
                {currentRoute === 'StripCurtain' && <StripCurtain navigate={navigate} />}
                {currentRoute === 'Accessories' && <Accessories navigate={navigate} />}
                {currentRoute === 'System' && <System navigate={navigate} />}
                
                {/* Notification Page */}
                {currentRoute === 'NotificationPage' && (
                    <NotificationPage 
                        notifications={notifications}
                        removeNotification={removeNotification}
                        clearAllNotifications={clearAllNotifications}
                    />
                )}

                {/* Admin Page */}
                {currentRoute === 'AdminPage' && (
                    <AdminPage 
                        projects={projects}
                        navigate={navigate}
                    />
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmDeleteId && (
                <div className="confirm-modal-overlay">
                    <div className="confirm-modal">
                        <h4>Confirm Deletion</h4>
                        <p>Are you sure you want to delete job **{confirmDeleteId.projectNo}**? This action cannot be undone.</p>
                        <div className="confirm-modal-actions">
                            <button onClick={() => setConfirmDeleteId(null)} className="secondary">Cancel</button>
                            <button onClick={confirmDeleteProject} className="danger">Yes, Delete Job</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;