import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelSlab from './panelSlab';
import Cutting from './Cutting';
import Door from './Door';
import Accessories from './Accessories';
import StripCurtain from './StripCurtain';
import System from './System';
import { FileView, FileUploadSection, real_uploadProjectFiles } from './FileComponents';
import AdminPage from './AdminPage'; // Import the AdminPage component
import './App.css';

// =========================================================
// 1. REAL API Service Implementation (connecting to Express backend)
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
// 4. Custom Router Logic - UPDATED with Notification and Admin Routes
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

    // Route parsing - UPDATED with new routes including notifications and admin
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
// 5. Progress Component for Task Count Display - UPDATED
// =========================================================

const TaskCountDisplay = ({ completed, total }) => {
    const getProgressClass = () => {
        if (total === 0) return 'progress-not-started';
        if (completed < total) return 'progress-in-progress';
        return 'progress-completed';
    };

    const getDisplayText = () => {
        // Always show the actual numbers
        return `${completed}/${total}`;
    };

    return (
        <div className={`task-count-display ${getProgressClass()}`}>
            <span className="task-count-text">{getDisplayText()}</span>
        </div>
    );
};

// =========================================================
// 6. Main App Component - UPDATED
// =========================================================

function App() {
    // --- Routing ---
    const { navigate, currentRoute, params } = useSimpleRouter();

    // --- State Initialization ---
    const [projects, setProjects] = useState([]);
    const [newProject, setNewProject] = useState({
        drawingDate: '', projectNo: '', customer: '', poPayment: '', requestedDelivery: '', remarks: '' 
    });
    const [filesToUpload, setFilesToUpload] = useState([]); 
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
    // API Data Fetching Logic - UPDATED to use direct database fields
    // =========================================================
    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await real_getAllProjects(); 
            
            // Map database fields to frontend completion structure
            const projectsWithCompletion = data.map((project) => {
                // Map the database fields to our frontend structure
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
            setNewProject({ drawingDate: '', projectNo: '', customer: '', poPayment: '', requestedDelivery: '', remarks: '' }); 
            setFilesToUpload([]);
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
            const addedProject = await real_createProject(newProject); 
            
            let fileUploadMessage = '';
            if (filesToUpload.length > 0) {
                const formData = new FormData();
                formData.append('projectNo', addedProject.projectNo); 
                
                filesToUpload.forEach(file => {
                    formData.append('files', file); 
                });

                await real_uploadProjectFiles(formData); 
                fileUploadMessage = ` (${filesToUpload.length} file(s) attached)`;
            }

            await fetchProjects();
            setNewProject({ drawingDate: '', projectNo: '', customer: '', poPayment: '', requestedDelivery: '', remarks: '' }); 
            setFilesToUpload([]); 
            
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            
            setIsFormOpen(false); 
            
            addNotification(`✅ Job for ${addedProject.customer} (**${addedProject.projectNo}**) has been added to DB${fileUploadMessage}.`);

        } catch (err) {
            setError(`Error creating project or uploading files: ${err.message}`);
            addNotification(`❌ **Error:** Could not create job. Check console for details.`);
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
                    <input name="drawingDate" value={editingProject.drawingDate} onChange={handleEditInputChange} placeholder="Drawing Date" />
                    <input name="projectNo" value={editingProject.projectNo} onChange={handleEditInputChange} placeholder="Job No." /> 
                    <input name="customer" value={editingProject.customer} onChange={handleEditInputChange} placeholder="Customer" />
                    <input name="poPayment" value={editingProject.poPayment} onChange={handleEditInputChange} placeholder="PO/Payment" />
                    <input name="requestedDelivery" value={editingProject.requestedDelivery} onChange={handleEditInputChange} placeholder="Requested Delivery" />
                    <input name="remarks" value={editingProject.remarks} onChange={handleEditInputChange} placeholder="Remarks" />
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
                    <p><strong>Drawing Date:</strong> <span>{project.drawingDate}</span></p>
                    <p><strong>PO/Payment:</strong> <span className={project.poPayment && project.poPayment.toUpperCase() === 'OK' ? 'status-ok' : 'status-pending'}>{project.poPayment || 'Pending'}</span></p>
                    <p><strong>Req. Delivery:</strong> <span>{project.requestedDelivery}</span></p>
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
                    <strong>Remarks:</strong> {project.remarks || 'No remarks provided.'}
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
            {/* Sidebar Component - UPDATED with admin navigation */}
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

                    {/* NEW: Admin Page Navigation */}
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
            
            {/* Main Content Area - UPDATED with admin page */}
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
                                        <input name="drawingDate" value={newProject.drawingDate} onChange={handleInputChange} placeholder="Drawing Date (e.g., 1 Jan)" required/>
                                        <input name="projectNo" value={newProject.projectNo} onChange={handleInputChange} placeholder="Job No." required/> 
                                        <input name="customer" value={newProject.customer} onChange={handleInputChange} placeholder="Customer Name" required/>
                                        <input name="poPayment" value={newProject.poPayment} onChange={handleInputChange} placeholder="PO/Payment Status (e.g., OK)" />
                                        <input name="requestedDelivery" value={newProject.requestedDelivery} onChange={handleInputChange} placeholder="Requested Delivery" />
                                        <input name="remarks" value={newProject.remarks} onChange={handleInputChange} placeholder="Remarks" />
                                        
                                        {/* File Upload Section */}
                                        <FileUploadSection 
                                            filesToUpload={filesToUpload}
                                            setFilesToUpload={setFilesToUpload}
                                            isDragActive={isDragActive}
                                            setIsDragActive={setIsDragActive}
                                            fileInputRef={fileInputRef}
                                        />

                                        <button type="submit" className="primary">Create Project and Upload</button>
                                        <button type="button" onClick={toggleForm} className="secondary">Cancel</button>
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

                {/* NEW: Admin Page */}
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