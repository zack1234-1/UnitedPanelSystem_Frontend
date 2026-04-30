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
import Transportation from './Transportation';
import NotificationPage from './Notification';
import ExcelExtractor from './ExcelExtractor';
import ReportGenerator from './ReportGenerator';

// =========================================================
// 1. REAL API Service Implementatione
// =========================================================

const API_BASE = '/api';

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

const real_getProjectsByStatus = async (status) => {
  return await apiCall(`/projects/status/${status}`);
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

const real_updateProjectStatus = async (id, status) => {
  return await apiCall(`/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

const createCategoryTasks = async (projectNo, selectedCategories) => {
  const results = [];
  
  for (const category of selectedCategories) {
    try {
      let endpoint = '';
      
      const taskData = {
        project_no: projectNo,
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} Task`,
        description: `Initial task for ${category} category`,
        priority: 'empty',
        status: 'pending',
        approve_status: 'Pending',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      switch(category) {
        case 'panel':
          endpoint = '/panel-tasks';
          break;
        case 'cutting':
          endpoint = '/cutting-tasks';
          break;
        case 'door':
          endpoint = '/door-tasks';
          break;
        case 'accessories':
          endpoint = '/accessories-tasks';
          break;
        case 'system':
          endpoint = '/system-tasks';
          break;
        default:
          continue;
      }

      const result = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(taskData),
      });

      console.log(`✅ Created task for category: ${category}`);

    } catch (error) {
      console.error(`❌ Failed to create task for category: ${category}`, error.message);
      results.push({ category, success: false, error: error.message });
    }
  }

  return results;
};

// =========================================================
// Status Tabs Component
// =========================================================

const StatusTabs = ({ activeTab, onTabChange}) => {
  const tabs = [
    { id: 'approved', label: 'Approved' },
    { id: 'done', label: 'Done'},
  ];

  return (
    <div className="status-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`status-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

// =========================================================
// Status Update Modal Component
// =========================================================

const StatusUpdateModal = ({ isOpen, onClose, project, onUpdateStatus }) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusOptions = [
    { value: 'done', label: 'Done', icon: '✅' },
    { value: 'approved', label: 'Approved', icon: '🎯' }
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) return;

    setIsSubmitting(true);
    try {
      await onUpdateStatus(project.id, selectedStatus, notes);
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Update Project Status</h3>
          <button className="close-modal" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="project-info">
            <h4>{project.customer}</h4>
            <p className="project-no">Project #{project.projectNo}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select New Status</label>
              <div className="status-options">
                {statusOptions.map(option => (
                  <div 
                    key={option.value}
                    className={`status-option ${selectedStatus === option.value ? 'selected' : ''}`}
                    onClick={() => setSelectedStatus(option.value)}
                  >
                    <span className="status-icon">{option.icon}</span>
                    <span className="status-label">{option.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="secondary-btn">
                Cancel
              </button>
              <button 
                type="submit" 
                className="primary-btn"
                disabled={!selectedStatus || isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// =========================================================
// 4. Enhanced Category Selection Component (Updated with Quotation)
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
        //{ id: 'strip_curtain', label: 'Strip Curtain', icon: '🎪' },
        { id: 'accessories', label: 'Accessories', icon: '🔧' },
        { id: 'system', label: 'Refrigeration System', icon: '⚙️' },
        { id: 'quotation', label: 'Quotation', icon: '📋' }
    ];

    const [dragActiveCategory, setDragActiveCategory] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});
    // Changed from single boolean to object tracking upload state per category
    const [isUploadingPerCategory, setIsUploadingPerCategory] = useState({});

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('dwg') || fileType.includes('dxf')) return '📐';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
        if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
        if (fileType.includes('quotation') || fileType.includes('quote')) return '📋';
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
            // Set uploading state only for this specific category
            setIsUploadingPerCategory(prev => ({
                ...prev,
                [categoryId]: true
            }));
            
            const progressUpdates = {};
            files.forEach((file, index) => {
                progressUpdates[`${categoryId}-${file.name}`] = 0;
                
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
                
                setTimeout(() => {
                    setUploadProgress(prev => ({
                        ...prev,
                        [`${categoryId}-${file.name}`]: 100
                    }));
                }, 2000);
            });

            // Call the parent upload handler
            onCategoryFileUpload(categoryId, files);
            
            // Reset upload state for this category after upload completes
            setTimeout(() => {
                setIsUploadingPerCategory(prev => ({
                    ...prev,
                    [categoryId]: false
                }));
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    // Remove progress indicators for this category's files
                    Object.keys(newProgress).forEach(key => {
                        if (key.startsWith(`${categoryId}-`)) {
                            delete newProgress[key];
                        }
                    });
                    return newProgress;
                });
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
                    const isUploadingThisCategory = isUploadingPerCategory[category.id] || false;
                    
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
                                    <div className="category-container">
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
                                </div>
                                
                                {isSelected && (
                                    <div className="category-file-upload">
                                        <div 
                                            className={`category-file-dropzone ${isDraggingOver ? 'drag-active' : ''} ${isUploadingThisCategory ? 'uploading' : ''}`}
                                            onDragOver={(e) => handleDragOver(category.id, e)}
                                            onDragLeave={() => handleDragLeave(category.id)}
                                            onDrop={(e) => handleDrop(category.id, e)}
                                            onClick={() => !isUploadingThisCategory && triggerFileInput(category.id)}
                                        >
                                            <input
                                                type="file"
                                                multiple
                                                onChange={(e) => handleFileUpload(category.id, e)}
                                                style={{ display: 'none' }}
                                                id={`file-input-${category.id}`}
                                                accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                                                disabled={isUploadingThisCategory}
                                            />
                                            <div className="upload-area-content">
                                                <div className="upload-icon">
                                                    {isUploadingThisCategory ? '⏳' : isDraggingOver ? '⬇️' : '📁'}
                                                </div>
                                                <div className="upload-text">
                                                    <div className="upload-label">
                                                        {isUploadingThisCategory ? 'Uploading...' : 'Click or drop files here (optional)'}
                                                    </div>
                                                    <div className="upload-subtext">
                                                        {isUploadingThisCategory ? 'Please wait while files upload' : 'Drag & drop or click to browse'}
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
                                                        disabled={isUploadingThisCategory}
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
                                                                            disabled={isUploadingThisCategory}
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
    const matchExcelExtractor = path === '/excel-extractor';
    const matchReportGenerator = path === '/report-generator';
    const matchTransportation = path === '/transportation';

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
    } else if (matchTransportation) { 
        currentRoute = 'Transportation';
    } else if (matchSystem) {
        currentRoute = 'System';
    } else if (matchNotifications) {
        currentRoute = 'NotificationPage';
    } else if (matchAdmin) {
        currentRoute = 'AdminPage';
    } else if (matchExcelExtractor) {
        currentRoute = 'ExcelExtractor';
    } else if (matchReportGenerator) {
        currentRoute = 'ReportGenerator';
    }

    return { navigate, currentRoute, params };
};

// =========================================================
// Search Component
// =========================================================

const SearchBar = ({ 
    searchTerm, 
    onSearchChange, 
    searchType, 
    onSearchTypeChange, 
    onClearSearch,
    totalProjects,
    filteredCount 
}) => {
    return (
        <div className="search-container">
            <div className="search-header">
                <div className="search-title">
                    <h3>Search Projects</h3>
                    <div className="search-stats">
                        Showing {filteredCount} of {totalProjects} projects
                    </div>
                </div>
            </div>
            
            <div className="search-controls">
                <div className="search-input-group">
                    <div className="search-icon">
                        🔍
                    </div>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={onSearchChange}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button 
                            onClick={onClearSearch}
                            className="clear-search-btn"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
                
                <div className="search-filters">
                    <div className="filter-group">
                        <label htmlFor="searchType" className="filter-label">Search by:</label>
                        <select
                            id="searchType"
                            value={searchType}
                            onChange={onSearchTypeChange}
                            className="search-type-select"
                        >
                            <option value="all">All Fields</option>
                            <option value="projectNo">Project No</option>
                            <option value="customer">Customer Name</option>
                            <option value="projectName">Project Name</option>
                        </select>
                    </div>
                </div>
            </div>
            
            {searchTerm && (
                <div className="search-results-info">
                    <span className="search-term">
                        Searching for: "<strong>{searchTerm}</strong>"
                    </span>
                    <span className="search-filter">
                        in <strong>{searchType === 'all' ? 'all fields' : searchType}</strong>
                    </span>
                </div>
            )}
        </div>
    );
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
// 8. Date Picker Component
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

    // Get today's date in YYYY-MM-DD format
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
        remarks: '',
        sales: '',
        sell: '',
        cost: '',
        margin: ''
    });
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [categoryFiles, setCategoryFiles] = useState({});
    const [isDragActive, setIsDragActive] = useState(false);
    
    const [editingProject, setEditingProject] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false); 
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // --- Status Filtering ---
    const [activeTab, setActiveTab] = useState('approved');
    const [statusUpdateModal, setStatusUpdateModal] = useState({
        isOpen: false,
        project: null
    });

    // --- Search State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('all'); // 'all', 'projectNo', 'customer', 'projectName'
    const [filteredProjects, setFilteredProjects] = useState([]);

    // --- API State Variables ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null); 

    // Calculate margin when sell or cost changes
    useEffect(() => {
        const sell = parseFloat(newProject.sell) || 0;
        const cost = parseFloat(newProject.cost) || 0;
        const margin = sell - cost;
        
        if (!isNaN(margin) && newProject.margin !== margin.toFixed(2)) {
            setNewProject(prev => ({
                ...prev,
                margin: margin.toFixed(2)
            }));
        }
    }, [newProject.sell, newProject.cost]);

    // Calculate margin when editing
    useEffect(() => {
        if (editingProject) {
            const sell = parseFloat(editingProject.sell) || 0;
            const cost = parseFloat(editingProject.cost) || 0;
            const margin = sell - cost;
            
            if (!isNaN(margin) && editingProject.margin !== margin.toFixed(2)) {
                setEditingProject(prev => ({
                    ...prev,
                    margin: margin.toFixed(2)
                }));
            }
        }
    }, [editingProject?.sell, editingProject?.cost]);

    // =========================================================
    // Category Files Management
    // =========================================================

    const initializeCategoryFiles = useCallback((categoryId) => {
        if (!categoryFiles[categoryId]) {
            setCategoryFiles(prev => ({
                ...prev,
                [categoryId]: []
            }));
        }
    }, [categoryFiles]);

    const handleCategoryFileUpload = useCallback((categoryId, files) => {
        setCategoryFiles(prev => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), ...files]
        }));
    }, []);

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

    const clearCategoryFiles = useCallback((categoryId) => {
        setCategoryFiles(prev => ({
            ...prev,
            [categoryId]: []
        }));
    }, []);

    const handleCategoryChange = useCallback((categories) => {
        categories.forEach(categoryId => {
            if (!selectedCategories.includes(categoryId)) {
                initializeCategoryFiles(categoryId);
            }
        });
        
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
    // Search Handlers
    // =========================================================

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleSearchTypeChange = (e) => {
        setSearchType(e.target.value);
    };

    const clearSearch = () => {
        setSearchTerm('');
        setSearchType('all');
    };

    // =========================================================
    // API Data Fetching Logic
    // =========================================================
    const fetchProjects = useCallback(async (status = 'active') => {
        setIsLoading(true);
        setError(null);
        try {
            let data;

            data = await real_getProjectsByStatus(status);

            
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
                        completed: project.completed_strip_curtain || 0, 
                        total: project.total_strip_curtain || 0 
                    },
                    accessories: { 
                        completed: project.completed_accessories || 0, 
                        total: project.total_accessories || 0 
                    },
                    system: { 
                        completed: project.completed_system || 0, 
                        total: project.total_system || 0 
                    },
                    quotation: { 
                        completed: project.completed_quotation || 0, 
                        total: project.total_quotation || 0 
                    }
                };

                return {
                    ...project,
                    completion: completion
                };
            });
            
            setProjects(projectsWithCompletion);
            setFilteredProjects(projectsWithCompletion);
        } catch (err) {
            console.error("Failed to fetch projects:", err);
            setError(`Failed to load projects: ${err.message}. Check your backend server.`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentRoute === 'JobList' || currentRoute === 'AdminPage') {
            fetchProjects(activeTab === 'active' ? 'active' : activeTab);
        }
    }, [fetchProjects, currentRoute, activeTab]);

    // Filter projects based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProjects(projects);
            return;
        }

        const term = searchTerm.toLowerCase().trim();
        let filtered = projects.filter(project => {
            // Always search all fields regardless of searchType
            if (searchType === 'all') {
                return (
                    (project.projectNo && project.projectNo.toLowerCase().includes(term)) ||
                    (project.customer && project.customer.toLowerCase().includes(term)) ||
                    (project.projectName && project.projectName.toLowerCase().includes(term)) ||
                    (project.salesman && project.salesman.toLowerCase().includes(term)) ||
                    (project.remarks && project.remarks.toLowerCase().includes(term))
                );
            } else if (searchType === 'projectNo') {
                return project.projectNo && project.projectNo.toLowerCase().includes(term);
            } else if (searchType === 'customer') {
                return project.customer && project.customer.toLowerCase().includes(term);
            } else if (searchType === 'projectName') {
                return project.projectName && project.projectName.toLowerCase().includes(term);
            }
            return true;
        });

        setFilteredProjects(filtered);
    }, [projects, searchTerm, searchType]);

    // =========================================================
    // Status Management Functions
    // =========================================================

    const handleStatusTabChange = (tab) => {
        setActiveTab(tab);
        fetchProjects(tab === 'active' ? 'active' : tab);
    };

    const openStatusUpdateModal = (project) => {
        setStatusUpdateModal({
            isOpen: true,
            project: project
        });
    };

    const closeStatusUpdateModal = () => {
        setStatusUpdateModal({
            isOpen: false,
            project: null
        });
    };

    const handleUpdateProjectStatus = async (projectId, status, notes) => {
        try {
            await real_updateProjectStatus(projectId, status);
            
            // Update local state
            setProjects(prev => prev.map(project => 
                project.id === projectId 
                    ? { ...project, status: status, statusNotes: notes } 
                    : project
            ));
            
            addNotification(`✅ Project status updated to ${status}`);
            fetchProjects(activeTab === 'active' ? 'active' : activeTab);
        } catch (error) {
            console.error('Error updating project status:', error);
            addNotification(`❌ Failed to update project status: ${error.message}`);
            throw error;
        }
    };

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
                remarks: '',
                sales: '',
                sell: '',
                cost: '',
                margin: ''
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
            addNotification("🚨 Error: Project No. and Customer Name are required."); 
            return;
        }

        try {
            const projectWithCategories = {
                ...newProject,
                selectedCategories: selectedCategories,
                status: 'active'
            };

            // 1. Create the project (essential – must complete before anything else)
            const addedProject = await real_createProject(projectWithCategories); 

            // 2. Reset form and close it immediately
            setNewProject({ 
                drawingDate: '', projectNo: '', customer: '', poPayment: '', 
                requestedDelivery: '', remarks: '', sales: '', sell: '', cost: '', margin: ''
            }); 
            setSelectedCategories([]);
            setCategoryFiles({});
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsFormOpen(false);

            // 4. Perform background tasks (do NOT await them)
            const categoriesForTasks = selectedCategories;

            // Fire-and-forget file uploads
            const hasFiles = Object.values(categoryFiles).some(files => files?.length > 0);
            if (hasFiles) {
                // Upload all files in parallel, but don't block
                Promise.all(selectedCategories.map(async (categoryId) => {
                    const files = categoryFiles[categoryId] || [];
                    if (files.length === 0) return;

                    const formData = new FormData();
                    formData.append('projectNo', addedProject.projectNo);
                    formData.append('category', categoryId);
                    files.forEach(file => formData.append('files', file));

                    try {
                        await real_uploadProjectFiles(formData);
                    } catch (uploadError) {
                        console.error(`Error uploading files for ${categoryId}:`, uploadError);
                        // Optionally show a notification to the user
                        addNotification(`⚠️ Some files for ${categoryId} failed to upload.`);
                    }
                })).catch(err => console.error('Background file uploads failed:', err));
            }

            navigate('/admin');
            fetchProjects('approved');

        } catch (err) {
            console.error("Error creating project:", err);
            setError(`Error creating project: ${err.message}`);
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
            setProjects(prev =>
            prev.map(p => {
                if (p.id === updatedProject.id) {
                // Keep the old completion object (if it exists) and override only the changed project fields
                return { ...updatedProject, completion: p.completion };
                }
                return p;
            })
            );
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
        //{ key: 'stripCurtain', label: 'Strip Curtain' },
        { key: 'accessories', label: 'Accessories' },
        { key: 'system', label: 'Refrigeration System' },
    ];

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
            return dateString;
        }
    };

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

    const getProjectStatusBadge = (status) => {
        const statusConfig = {
            active: { color: '#3B82F6', icon: '🔄', label: 'Production' },
            done: { color: '#10B981', icon: '✅', label: 'Done' },
            completed: { color: '#8B5CF6', icon: '🎯', label: 'Approved' }
        };
        
        const config = statusConfig[status] || statusConfig.active;
        
        return (
            <span 
                className="project-status-badge"
                style={{
                    backgroundColor: `${config.color}20`,
                    borderColor: config.color,
                    color: config.color
                }}
            >
                {config.icon} {config.label}
            </span>
        );
    };

    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === '') {
            return 'RM 0.00';
        }
        
        const numValue = Number(value);
        if (isNaN(numValue)) {
            return 'RM 0.00';
        }

        return `RM ${numValue.toFixed(2)}`;
    };

    const renderProjectCard = (project) => {
        const isEditing = editingProject && editingProject.id === project.id;
        const completion = project.completion || {
            panelSlab: { completed: 0, total: 0 },
            cutting: { completed: 0, total: 0 },
            door: { completed: 0, total: 0 },
            stripCurtain: { completed: 0, total: 0 },
            accessories: { completed: 0, total: 0 },
            system: { completed: 0, total: 0 },
            quotation: { completed: 0, total: 0 }
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
                        <label htmlFor="edit-projectName">Project Name</label>
                        <input 
                            id="edit-projectName"
                            name="projectName" 
                            value={editingProject.projectName} 
                            onChange={handleEditInputChange} 
                            placeholder="Project Name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-salesman">Salesman Name</label>
                        <input 
                            id="edit-salesman"
                            name="salesman" 
                            value={editingProject.salesman} 
                            onChange={handleEditInputChange} 
                            placeholder="Salesman Name"
                        />
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

                    {/* Financial Details Section */}
                    <div className="financial-section">
                        <h4>Financial Details (Optional)</h4>
                        <div className="financial-grid">
                            <div className="form-group">
                                <label htmlFor="edit-sales">Sales (RM)</label>
                                <input 
                                    id="edit-sales"
                                    name="sales" 
                                    type="number"
                                    step="0.01"
                                    value={editingProject.sales} 
                                    onChange={handleEditInputChange} 
                                    placeholder="Sales Amount"
                                    onWheel={(e) => e.target.blur()}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="edit-sell">Sell (RM)</label>
                                <input 
                                    id="edit-sell"
                                    name="sell" 
                                    type="number"
                                    step="0.01"
                                    value={editingProject.sell} 
                                    onChange={handleEditInputChange} 
                                    placeholder="Sell Price"
                                    onWheel={(e) => e.target.blur()}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="edit-cost">Cost (RM)</label>
                                <input 
                                    id="edit-cost"
                                    name="cost" 
                                    type="number"
                                    step="0.01"
                                    value={editingProject.cost} 
                                    onChange={handleEditInputChange} 
                                    placeholder="Cost"
                                    onWheel={(e) => e.target.blur()}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="edit-margin">Margin (RM)</label>
                                <input 
                                    id="edit-margin"
                                    name="margin" 
                                    type="number"
                                    step="0.01"
                                    value={editingProject.margin} 
                                    onChange={handleEditInputChange} 
                                    placeholder="Margin"
                                    readOnly
                                    className="readonly-field"
                                    onWheel={(e) => e.target.blur()}
                                />
                            </div>
                        </div>
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
                    <div className="job-title-section">
                        <h3 className="card-title">{project.customer}</h3>
                    </div>
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
                        <strong>Project Name:</strong> 
                        <span className="date-value">{project.projectName}</span>
                    </p>
                    <p>
                        <strong>Salesman:</strong> 
                        <span className="date-value">{project.salesman}</span>
                    </p>
                    <p>
                        <strong>Requested Delivery:</strong> 
                        <span className="date-value">{formatDateForDisplay(project.requestedDelivery)}</span>
                    </p>
                </div>

                {/* Financial Summary */}
                {(project.sales || project.sell || project.cost || project.margin) && (
                    <div className="financial-summary">
                        <h4>Financial Summary</h4>
                        <div className="financial-items">
                            <div className="financial-item">
                                <span className="financial-label">Sales:</span>
                                <span className="financial-value">{formatCurrency(project.sales)}</span>
                            </div>
                            <div className="financial-item">
                                <span className="financial-label">Sell:</span>
                                <span className="financial-value">{formatCurrency(project.sell)}</span>
                            </div>
                            <div className="financial-item">
                                <span className="financial-label">Cost:</span>
                                <span className="financial-value">{formatCurrency(project.cost)}</span>
                            </div>
                            <div className="financial-item">
                                <span className="financial-label">Margin:</span>
                                <span className={`financial-value ${(parseFloat(project.margin) || 0) >= 0 ? 'positive' : 'negative'}`}>
                                    {formatCurrency(project.margin)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

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
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                openStatusUpdateModal(project); 
                            }} 
                            className="status-btn"
                        >
                            Update Status
                        </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(project); }} className="secondary">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); startDeleteConfirmation(project.id, project.projectNo); }} className="danger">Delete</button> 
                </div>
            </div>
        );
    };

    // --- Loading and Error View ---
    if (isLoading && (currentRoute === 'JobList' || currentRoute === 'AdminPage')) {
        return <div className="App" style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Loading... 🔄</h2>
        </div>;
    }

    // --- Main Renderer ---
    return (
        <div className="App sidebar-layout">
            {/* Sidebar Component */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className={`app-logo ${isSidebarOpen ? 'full' : 'collapsed-text'}`}>
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
                        {isSidebarOpen && <span>Project List</span>}
                    </a>

                    {/* Admin Page Navigation */}
                    <a 
                        href="#/admin" 
                        className={`nav-item ${currentRoute === 'AdminPage' ? 'active' : ''}`}
                        onClick={() => navigate('/admin')}
                    > 
                        <span role="img" aria-label="admin">👨‍💼</span>
                        {isSidebarOpen && <span>Sales</span>}
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

                    {/* <a 
                        href="#/strip-curtain" 
                        className={`nav-item ${currentRoute === 'StripCurtain' ? 'active' : ''}`}
                        onClick={() => navigate('/strip-curtain')}
                    > 
                        <span role="img" aria-label="strip curtain">🎪</span>
                        {isSidebarOpen && <span>Strip Curtain</span>}
                    </a> */}

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
                        {isSidebarOpen && <span>Refrigeration System</span>}
                    </a>

                    <a 
                        href="#/transportation" 
                        className={`nav-item ${currentRoute === 'Transportation' ? 'active' : ''}`}
                        onClick={() => navigate('/transportation')}
                    > 
                        <span role="img" aria-label="transportation">🚚</span>
                        {isSidebarOpen && <span>Transportation/QC</span>}
                    </a>    

                    {/* Excel Extractor Navigation */}
                    {/* <a 
                        href="#/excel-extractor" 
                        className={`nav-item ${currentRoute === 'ExcelExtractor' ? 'active' : ''}`}
                        onClick={() => navigate('/excel-extractor')}
                    > 
                        <span role="img" aria-label="excel">📊</span>
                        {isSidebarOpen && <span>Excel Extractor</span>}
                    </a> */}
                    {/* Report Generator Navigation */}
                    {/* <a 
                        href="#/report-generator" 
                        className={`nav-item ${currentRoute === 'ReportGenerator' ? 'active' : ''}`}
                        onClick={() => navigate('/report-generator')}
                    > 
                        <span role="img" aria-label="generator">📑</span>
                        {isSidebarOpen && <span>Report Generator</span>}
                    </a> */}

                    {/* Notification Page Navigation */}
                    {/* <a 
                        href="#/notifications" 
                        className={`nav-item ${currentRoute === 'NotificationPage' ? 'active' : ''}`}
                        onClick={() => navigate('/notifications')}
                    > 
                        <span role="img" aria-label="notifications">🔔</span>
                        {isSidebarOpen && <span>Notifications</span>}
                        {notifications.length > 0 && (
                            <span className="notification-badge">{notifications.length}</span>
                        )}
                    </a> */}
                </nav>
            </div>
            
            {/* Main Content Area */}
            <div className={`content-area ${isSidebarOpen ? 'shrunk' : 'expanded'}`}>
                {currentRoute === 'JobList' && (
                    <>
                        <header className="page-header">
                            <h1>Project Tracker</h1>
                            <button onClick={toggleForm} className="primary toggle-form-button">
                                {isFormOpen ? '✖️ Close Form' : '➕ First Start With Add New Project'}
                            </button>
                        </header>
                        <main>
                            {/* Status Tabs */}
                            <StatusTabs 
                                activeTab={activeTab}
                                onTabChange={handleStatusTabChange}
                            />
                            
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

                                        <div className="form-group">
                                            <label htmlFor="salesman">Salesman Name</label>
                                            <input 
                                                id="salesman"
                                                name="salesman" 
                                                value={newProject.salesman} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="projectName">Project Name</label>
                                            <input 
                                                id="projectName"
                                                name="projectName" 
                                                value={newProject.projectName} 
                                                onChange={handleInputChange} 
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

                                        {/* Financial Details Section */}
                                        <div className="financial-section">
                                            <h4>Financial Details (Optional)</h4>
                                            <div className="financial-grid">
                                                <div className="form-group">
                                                    <label htmlFor="sales">Sales (RM)</label>
                                                    <input 
                                                        id="sales"
                                                        name="sales" 
                                                        type="number"
                                                        step="0.01"
                                                        value={newProject.sales} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Sales Amount"
                                                        onWheel={(e) => e.target.blur()}
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label htmlFor="sell">Sell (RM)</label>
                                                    <input 
                                                        id="sell"
                                                        name="sell" 
                                                        type="number"
                                                        step="0.01"
                                                        value={newProject.sell} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Sell Price"
                                                        onWheel={(e) => e.target.blur()}
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label htmlFor="cost">Cost (RM)</label>
                                                    <input 
                                                        id="cost"
                                                        name="cost" 
                                                        type="number"
                                                        step="0.01"
                                                        value={newProject.cost} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Cost"
                                                        onWheel={(e) => e.target.blur()}
                                                    />
                                                </div>
                                                
                                                <div className="form-group">
                                                    <label htmlFor="margin">Margin (RM)</label>
                                                    <input 
                                                        id="margin"
                                                        name="margin" 
                                                        type="number"
                                                        step="0.01"
                                                        value={newProject.margin} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Margin"
                                                        readOnly
                                                        className="readonly-field"
                                                        onWheel={(e) => e.target.blur()}
                                                    />
                                                </div>
                                            </div>
                                            <small className="field-hint">Margin is automatically calculated as Sell - Cost</small>
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
                                        
                                        {/* Enhanced Category Selection with Optional File Upload (now includes Quotation) */}
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
                            
                            {/* Search Bar */}
                            <SearchBar
                                searchTerm={searchTerm}
                                onSearchChange={handleSearch}
                                searchType={searchType}
                                onSearchTypeChange={handleSearchTypeChange}
                                onClearSearch={clearSearch}
                                totalProjects={projects.length}
                                filteredCount={filteredProjects.length}
                            />
                            
                            <div className="job-list-header">
                                <h3>
                                    {activeTab === 'Production' ? 'Active Projects' : 
                                     activeTab === 'done' ? 'Done Projects' : 
                                     'Approved Projects'} 
                                    ({filteredProjects.length})
                                </h3>
                            </div>
                            
                            <div className="job-list">
                                {filteredProjects.length === 0 ? (
                                    <div className="no-jobs-message">
                                        {searchTerm ? (
                                            <div className="search-no-results">
                                                <div className="no-results-icon">🔍</div>
                                                <h4>No projects found</h4>
                                                <p>No projects match your search for "<strong>{searchTerm}</strong>" in {searchType === 'all' ? 'all fields' : searchType}.</p>
                                                <button 
                                                    onClick={clearSearch}
                                                    className="secondary"
                                                    style={{ marginTop: '1rem' }}
                                                >
                                                    Clear Search
                                                </button>
                                            </div>
                                        ) : (
                                            <p>
                                                {activeTab === 'active' ? 'No active projects found. Create your first project to get started!' :
                                                 activeTab === 'done' ? 'No done projects found.' :
                                                 'No approved projects found.'}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    filteredProjects.map(project => (
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
                {currentRoute === 'Accessories' && <Accessories navigate={navigate} />}
                {currentRoute === 'System' && <System navigate={navigate} />}
                {currentRoute === 'Transportation' && <Transportation navigate={navigate} />}
                {currentRoute === 'ReportGenerator' && <ReportGenerator />}
                
                {/* Excel Extractor Page */}
                {currentRoute === 'ExcelExtractor' && <ExcelExtractor />}
                
                {/* Notification Page */}
                {currentRoute === 'NotificationPage' && (
                    <NotificationPage 
                        notifications={notifications}
                        removeNotification={removeNotification}
                        clearAllNotifications={clearAllNotifications}
                        showActivityLogs={false} 
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

            {/* Status Update Modal */}
            <StatusUpdateModal
                isOpen={statusUpdateModal.isOpen}
                onClose={closeStatusUpdateModal}
                project={statusUpdateModal.project}
                onUpdateStatus={handleUpdateProjectStatus}
            />

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