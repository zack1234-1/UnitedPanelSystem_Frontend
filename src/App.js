import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelSlab from './panelSlab';
import Cutting from './Cutting';
import Door from './Door';
import Accessories from './Accessories';
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

const real_uploadProjectFiles = async (formData) => {
  try {
    const response = await fetch(`${API_BASE}/projects/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};

// Get files for a project
const real_getProjectFiles = async (projectNo) => {
  return await apiCall(`/projects/files/${projectNo}`);
};

// Download a file
const real_downloadFile = async (fileId) => {
  const response = await fetch(`${API_BASE}/projects/file/blob/${fileId}`);
  if (!response.ok) {
    throw new Error('Download failed');
  }
  return response.blob();
};

// Delete a project file
const real_deleteProjectFile = async (fileId) => {
  return await apiCall(`/projects/file/${fileId}`, {
    method: 'DELETE',
  });
};

// NEW: Get completion counts for a project
const real_getProjectCompletion = async (projectNo) => {
  return await apiCall(`/projects/completion/${projectNo}`);
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
// 3. Enhanced FileView Component with Preview and Upload
// =========================================================

const FileView = ({ projectNo, navigateHome }) => {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedFile, setSelectedFile] = useState(null); 
    const [previewUrl, setPreviewUrl] = useState('');
    const [isFetchingBlob, setIsFetchingBlob] = useState(false);
    
    const [filesToUpload, setFilesToUpload] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch files for the project
    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await real_getProjectFiles(projectNo);
            setFiles(data);
        } catch (err) {
            console.error("Failed to fetch files:", err);
            setError(`Failed to load files for project ${projectNo}.`);
        } finally {
            setIsLoading(false);
        }
    }, [projectNo]);

    useEffect(() => {
        fetchFiles();
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [fetchFiles, previewUrl]);

    const isPreviewable = (mimeType) => mimeType && (mimeType.startsWith('image/') || mimeType.endsWith('/pdf'));

    const handleFileSelectForPreview = async (file) => {
        if (selectedFile?.id === file.id && previewUrl) return;

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        
        setSelectedFile(file);
        setPreviewUrl('');
        setError(null);

        if (!isPreviewable(file.mime_type)) return;
        
        setIsFetchingBlob(true);
        
        try {
            const blob = await real_downloadFile(file.id);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (err) {
            console.error("Failed to fetch file BLOB:", err);
            setError(`Failed to open ${file.file_name}: ${err.message}`);
            setSelectedFile(null);
        } finally {
            setIsFetchingBlob(false);
        }
    };

    // File deletion
    const handleDeleteFile = async (file, e) => {
        if (e) e.stopPropagation(); 
        if (!window.confirm(`Are you sure you want to permanently delete: ${file.file_name}?`)) return;

        try {
            await real_deleteProjectFile(file.id);
            setFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));
            if (selectedFile?.id === file.id) {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setSelectedFile(null);
                setPreviewUrl('');
            }
        } catch (err) {
            console.error("Failed to delete file:", err);
            setError(`Failed to delete ${file.file_name}.`);
        }
    };

    // File upload functionality
    const handleOpenModal = () => {
        setIsModalOpen(true);
        setFilesToUpload([]);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFilesToUpload([]);
    };
    
    const handleFilesChange = (e) => {
        const selected = e.target.files;
        if (selected) {
            const newFiles = Array.from(selected).filter(
                newFile => !filesToUpload.some(existingFile => existingFile.name === newFile.name)
            );
            setFilesToUpload(prev => [...prev, ...newFiles]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragActive(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        const newFiles = droppedFiles.filter(
            newFile => !filesToUpload.some(existingFile => existingFile.name === newFile.name)
        );
        setFilesToUpload(prev => [...prev, ...newFiles]);
    };

    const handleUpload = async () => {
        if (filesToUpload.length === 0) return;
        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('projectNo', projectNo); 
            
            filesToUpload.forEach(file => {
                formData.append('files', file); 
            });

            await real_uploadProjectFiles(formData);
            
            handleCloseModal();
            await fetchFiles();

        } catch (err) {
            console.error("Upload failed:", err);
            setError(`File upload failed: ${err.message || 'Server error'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const removeFileFromStaging = (index) => setFilesToUpload(prev => prev.filter((_, i) => i !== index));
    const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
    const handleDragLeave = () => { setIsDragActive(false); };

    // Render file preview
    const renderFilePreview = () => {
        if (!selectedFile) return <p>Select a file from the list to preview its content.</p>;
        if (isFetchingBlob) return <p>Loading **{selectedFile.file_name}** content... 🔄</p>;
        
        if (!isPreviewable(selectedFile.mime_type) || !previewUrl) {
            return (
                <div className="preview-placeholder">
                    <h4 className="no-preview-title">Cannot Display Preview</h4>
                    <p className="no-preview-message">
                        The file **{selectedFile.file_name}** is of type **{selectedFile.mime_type}**.
                        <br/>
                        Use the download button to view it locally.
                    </p>
                </div>
            );
        }
        
        if (selectedFile.mime_type.startsWith('image/')) {
            return <img src={previewUrl} alt={`Preview of ${selectedFile.file_name}`} className="preview-content preview-image" />;
        } 
        
        if (selectedFile.mime_type.endsWith('/pdf')) {
            return <iframe src={previewUrl} title={`Preview of ${selectedFile.file_name}`} className="preview-content preview-iframe" />;
        }
    };

    // Upload Modal Component
    const UploadModal = () => {
        if (!isModalOpen) return null;
        return (
            <div className="modal-overlay" onClick={handleCloseModal}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>📁 Upload Files for Job #{projectNo}</h2>
                        <button className="close-button" onClick={handleCloseModal}>&times;</button>
                    </div>
    
                    <div className="modal-body">
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            onChange={handleFilesChange}
                            style={{ display: 'none' }}
                        />
                        
                        <div
                            className={`drag-drop-area ${isDragActive ? 'drag-active' : ''}`}
                            onClick={() => fileInputRef.current.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <p>
                                {isDragActive 
                                    ? 'Release files here to upload!' 
                                    : 'Click to Select or Drag & Drop Multiple Files'}
                            </p>
                            <small>Max file size: 50MB</small>
                        </div>
    
                        {filesToUpload.length > 0 && (
                            <div className="file-list-preview">
                                <h4>Staged Files ({filesToUpload.length})</h4>
                                <ul className="staged-file-list">
                                    {filesToUpload.map((file, index) => (
                                        <li key={file.name + index}> 
                                            <span className="file-name">{file.name}</span>
                                            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFileFromStaging(index); }}
                                                className="remove-file"
                                                title="Remove from staging"
                                            >
                                                &times;
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="upload-actions">
                                    <button 
                                        className="primary" 
                                        onClick={handleUpload}
                                        disabled={isUploading || filesToUpload.length === 0}
                                    >
                                        {isUploading ? 'Uploading... 📤' : `Upload ${filesToUpload.length} File(S)`}
                                    </button>
                                    <button 
                                        className="secondary" 
                                        onClick={handleCloseModal}
                                        disabled={isUploading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="file-view-container">
                <header className="page-header">
                    <button onClick={navigateHome} className="back-btn">
                        &larr; Back to Job List
                    </button>
                    <h1>Files for Job: **{projectNo}**</h1>
                </header>
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <h2>Loading Files... 🔄</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="file-view-container">
            <header className="page-header">
                <button onClick={navigateHome} className="back-btn">
                    &larr; Back to Job List
                </button>
                <div className="header-controls">
                    <h1>Files for Job: **{projectNo}**</h1>
                    <button
                        className="primary"
                        onClick={handleOpenModal}
                        title="Add/Upload Multiple Files"
                    >
                        + Add Files
                    </button>
                </div>
            </header>
            
            {error && <div className="alert alert-danger">{error}</div>}
            
            <div className="file-view-layout">
                {/* PREVIEW PANEL */}
                <div className="preview-panel">
                    <div className="preview-header">
                        <div className="preview-header-content">
                            <h4>{selectedFile ? `Previewing: ${selectedFile.file_name}` : 'Select a File to View'}</h4>
                            {selectedFile && (
                                <div className="file-actions">
                                    <button 
                                        className="download-btn"
                                        onClick={() => {
                                            const a = document.createElement('a');
                                            a.href = `${API_BASE}/projects/file/blob/${selectedFile.id}`;
                                            a.download = selectedFile.file_name;
                                            a.click();
                                        }}
                                    >
                                        Download
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteFile(selectedFile)}
                                        className="danger"
                                        title={`Delete ${selectedFile.file_name}`}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="preview-area">
                        {renderFilePreview()}
                    </div>
                </div>
                
                {/* FILE LIST PANEL */}
                <div className="file-list-panel">
                    <h3>Available Files ({files.length})</h3>
                    
                    {files.length === 0 ? (
                        <p className="no-files-message">No files uploaded for this project.</p>
                    ) : (
                        <div className="file-list">
                            {files.map(file => (
                                <div 
                                    key={file.id} 
                                    className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                                    onClick={() => handleFileSelectForPreview(file)}
                                >
                                    <span className="file-icon">📄</span>
                                    <div className="file-info">
                                        <span className="file-name">{file.file_name}</span>
                                        <span className="file-meta">
                                            {(file.file_size / 1024 / 1024).toFixed(2)} MB &middot; {file.mime_type}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteFile(file, e)}
                                        className="danger"
                                        title={`Delete ${file.file_name}`}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            <UploadModal />
        </div>
    );
};

// =========================================================
// 4. Custom Router Logic
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

    // Route parsing
    const matchFiles = path.match(/^\/files\/(.+)$/);
    const matchPanels = path === '/panels';
    const matchCutting = path === '/cutting';
    const matchDoors = path === '/doors';
    const matchAccessories = path === '/accessories';

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
    }

    return { navigate, currentRoute, params };
};

// =========================================================
// 5. Progress Component for Task Count Display
// =========================================================

const TaskCountDisplay = ({ completed, total }) => {
    const getProgressClass = () => {
        if (total === 0) return 'progress-not-started';
        if (completed < total) return 'progress-in-progress';
        return 'progress-completed';
    };

    const getDisplayText = () => {
        if (total === 0) return 'No Tasks';
        return `${completed}/${total}`;
    };

    return (
        <div className={`task-count-display ${getProgressClass()}`}>
            <span className="task-count-text">{getDisplayText()}</span>
        </div>
    );
};

// =========================================================
// 6. Main App Component
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
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false); 
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // --- API State Variables ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null); 

    // =========================================================
    // API Data Fetching Logic (Initial Load) - FIXED VERSION
    // =========================================================
    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await real_getAllProjects(); 
            
            // Fetch completion counts for all projects at once to avoid infinite loop
            const projectsWithCompletion = await Promise.all(
                data.map(async (project) => {
                    try {
                        const completion = await real_getProjectCompletion(project.projectNo);
                        return {
                            ...project,
                            completion: completion || {
                                panelSlab: { completed: 0, total: 0 },
                                cutting: { completed: 0, total: 0 },
                                door: { completed: 0, total: 0 },
                                stripCurtain: { completed: 0, total: 0 },
                                accessories: { completed: 0, total: 0 },
                                system: { completed: 0, total: 0 }
                            }
                        };
                    } catch (err) {
                        console.error(`Failed to fetch completion for project ${project.projectNo}:`, err);
                        return {
                            ...project,
                            completion: {
                                panelSlab: { completed: 0, total: 0 },
                                cutting: { completed: 0, total: 0 },
                                door: { completed: 0, total: 0 },
                                stripCurtain: { completed: 0, total: 0 },
                                accessories: { completed: 0, total: 0 },
                                system: { completed: 0, total: 0 }
                            }
                        };
                    }
                })
            );
            
            setProjects(projectsWithCompletion);
        } catch (err) {
            console.error("Failed to fetch projects:", err);
            setError(`Failed to load projects: ${err.message}. Check your backend server.`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentRoute === 'JobList') {
            fetchProjects();
        }
    }, [fetchProjects, currentRoute]);

    // =========================================================
    // Drag and Drop & File Handlers
    // =========================================================

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragActive(true);
        } else if (e.type === "dragleave" || e.type === "drop") {
            setIsDragActive(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFilesToUpload(prevFiles => [
                ...prevFiles, 
                ...Array.from(e.dataTransfer.files)
            ]);
            e.dataTransfer.clearData();
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
             setFilesToUpload(prevFiles => [
                ...prevFiles, 
                ...Array.from(e.target.files)
            ]);
        }
    };

    const handleRemoveFile = (fileName) => {
        setFilesToUpload(prevFiles => prevFiles.filter(file => file.name !== fileName));
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

    const togglePanel = () => {
        setIsPanelOpen(!isPanelOpen);
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
    if (isLoading && currentRoute === 'JobList') {
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
                        href="#/accessories" 
                        className={`nav-item ${currentRoute === 'Accessories' ? 'active' : ''}`}
                        onClick={() => navigate('/accessories')}
                    > 
                        <span role="img" aria-label="accessories">🔧</span>
                        {isSidebarOpen && <span>Accessories</span>}
                    </a>
                </nav>

                <div className="sidebar-footer">
                    <div className="notification-area">
                        <div className="nav-item notification-icon" onClick={togglePanel}>
                            <span role="img" aria-label="bell">🔔</span>
                            {isSidebarOpen && <span>Notifications</span>}
                            {notifications.length > 0 && (
                                <span className="notification-badge">{notifications.length}</span>
                            )}
                        </div>
                        {isPanelOpen && (
                            <div className="notification-panel">
                                {notifications.length > 0 ? (
                                    <>
                                        <div className="panel-header">
                                            <h4>Notifications</h4>
                                            <button onClick={clearAllNotifications} className="clear-all-btn link-btn">Clear All</button>
                                        </div>
                                        <div className="notification-list">
                                            {notifications.map(n => (
                                                <Notification key={n.id} message={n.message} onClose={() => removeNotification(n.id)} />
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="no-notifications">You're all caught up! 🎉</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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
                                        <input name="drawingDate" value={newProject.drawingDate} onChange={handleInputChange} placeholder="Drawing Date (e.g., 1 Jan)" required/>
                                        <input name="projectNo" value={newProject.projectNo} onChange={handleInputChange} placeholder="Job No." required/> 
                                        <input name="customer" value={newProject.customer} onChange={handleInputChange} placeholder="Customer Name" required/>
                                        <input name="poPayment" value={newProject.poPayment} onChange={handleInputChange} placeholder="PO/Payment Status (e.g., OK)" />
                                        <input name="requestedDelivery" value={newProject.requestedDelivery} onChange={handleInputChange} placeholder="Requested Delivery" />
                                        <input name="remarks" value={newProject.remarks} onChange={handleInputChange} placeholder="Remarks" />
                                        
                                        <div 
                                            className={`drag-drop-area ${isDragActive ? 'drag-active' : ''}`}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current.click()} 
                                        >
                                            <input 
                                                type="file" 
                                                name="files" 
                                                multiple 
                                                onChange={handleFileChange} 
                                                ref={fileInputRef} 
                                                style={{ display: 'none' }} 
                                            />
                                            {isDragActive ? (
                                                <p className="drag-text">Release to drop files here!</p>
                                            ) : (
                                                <p className="drag-text">Drag & drop files here, or click to browse</p>
                                            )}
                                            
                                            {filesToUpload.length > 0 && (
                                                <div className="file-list-preview" onClick={e => e.stopPropagation()}>
                                                    <p>✅ <strong>{filesToUpload.length} file(s) selected:</strong></p>
                                                    <ul>
                                                        {filesToUpload.map((file, index) => (
                                                            <li key={index}>
                                                                {file.name} 
                                                                <span className="remove-file" onClick={() => handleRemoveFile(file.name)}>
                                                                    &times;
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

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
                {currentRoute === 'Accessories' && <Accessories navigate={navigate} />}
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