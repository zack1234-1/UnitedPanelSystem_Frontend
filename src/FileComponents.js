// FileComponents.js
import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:5000/api';

// =========================================================
// File API Functions
// =========================================================

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

// Get files for a project
export const real_getProjectFiles = async (projectNo) => {
  return await apiCall(`/projects/files/${projectNo}`);
};

// Get files for a specific category
export const real_getProjectFilesByCategory = async (projectNo, category) => {
  return await apiCall(`/projects/files/${projectNo}?category=${category}`);
};

// Download a file
export const real_downloadFile = async (fileId) => {
  const response = await fetch(`${API_BASE}/projects/file/blob/${fileId}`);
  if (!response.ok) {
    throw new Error('Download failed');
  }
  return response.blob();
};

// Delete a project file
export const real_deleteProjectFile = async (fileId) => {
  return await apiCall(`/projects/file/${fileId}`, {
    method: 'DELETE',
  });
};

// Upload project files
export const real_uploadProjectFiles = async (formData) => {
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

// =========================================================
// Category Cards Component
// =========================================================

const CategoryCards = ({ projectNo, onCategorySelect }) => {
  const categories = [
    { 
      key: 'panel', 
      label: 'Panel / Slab', 
      icon: '🖼️',
      description: 'Panel and slab related files'
    },
    { 
      key: 'cutting', 
      label: 'Cutting', 
      icon: '✂️',
      description: 'Cutting plans and documents'
    },
    { 
      key: 'door', 
      label: 'Door', 
      icon: '🚪',
      description: 'Door specifications and drawings'
    },
    { 
      key: 'strip_curtain', 
      label: 'Strip Curtain', 
      icon: '🎪',
      description: 'Strip curtain documentation'
    },
    { 
      key: 'accessories', 
      label: 'Accessories', 
      icon: '🔧',
      description: 'Accessories and fittings'
    },
    { 
      key: 'system', 
      label: 'System', 
      icon: '⚙️',
      description: 'System integration files'
    }
  ];

  return (
    <div className="category-cards-container">
      <header className="page-header">
        <h1>Files for Job: **{projectNo}**</h1>
        <p className="page-subtitle">Select a category to view files</p>
      </header>
      
      <div className="category-cards-grid">
        {categories.map(category => (
          <div 
            key={category.key}
            className="category-card"
            onClick={() => onCategorySelect(category.key, category.label)}
          >
            <div className="category-icon">{category.icon}</div>
            <h3 className="category-title">{category.label}</h3>
            <p className="category-description">{category.description}</p>
            <div className="category-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================
// FileView Component
// =========================================================

export const FileView = ({ projectNo, navigateHome }) => {
    const [currentView, setCurrentView] = useState('categories'); // 'categories' or 'files'
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
    
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

    // Handle category selection
    const handleCategorySelect = async (category, label) => {
        setSelectedCategory(category);
        setSelectedCategoryLabel(label);
        setCurrentView('files');
        await fetchFilesByCategory(category);
    };

    // Go back to category view
    const handleBackToCategories = () => {
        setCurrentView('categories');
        setSelectedCategory('');
        setSelectedCategoryLabel('');
        setFiles([]);
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl('');
        }
    };

    // Fetch files for a specific category
    const fetchFilesByCategory = useCallback(async (category) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await real_getProjectFilesByCategory(projectNo, category);
            setFiles(data);
        } catch (err) {
            console.error("Failed to fetch files for category:", err);
            setError(`Failed to load ${category} files for project ${projectNo}.`);
        } finally {
            setIsLoading(false);
        }
    }, [projectNo]);

    useEffect(() => {
        if (currentView === 'files' && selectedCategory) {
            fetchFilesByCategory(selectedCategory);
        }
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [fetchFilesByCategory, currentView, selectedCategory, previewUrl]);

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
            formData.append('category', selectedCategory);
            
            filesToUpload.forEach(file => {
                formData.append('files', file); 
            });

            await real_uploadProjectFiles(formData);
            
            handleCloseModal();
            // Refresh current view
            await fetchFilesByCategory(selectedCategory);

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
                        <h2>📁 Upload Files to {selectedCategoryLabel}</h2>
                        <button className="close-button" onClick={handleCloseModal}>&times;</button>
                    </div>
    
                    <div className="modal-body">
                        <div className="upload-info">
                            <p><strong>Uploading to:</strong> {selectedCategoryLabel}</p>
                            <p><em>Files will be added to the {selectedCategoryLabel} category</em></p>
                        </div>

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
                                <h4>Files to Upload ({filesToUpload.length})</h4>
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
                                        {isUploading ? 'Uploading... 📤' : `Upload ${filesToUpload.length} File${filesToUpload.length !== 1 ? 's' : ''} to ${selectedCategoryLabel}`}
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

    // Show category cards view
    if (currentView === 'categories') {
        return (
            <div className="file-view-container">
                <CategoryCards 
                    projectNo={projectNo} 
                    onCategorySelect={handleCategorySelect}
                />
            </div>
        );
    }

    // Show files view for selected category
    if (isLoading) {
        return (
            <div className="file-view-container">
                <header className="page-header">
                    <div className="header-controls">
                        <button onClick={handleBackToCategories} className="secondary back-button">
                            ← Back to Categories
                        </button>
                        <h1>{selectedCategoryLabel} Files</h1>
                    </div>
                </header>
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <h2>Loading {selectedCategoryLabel} Files... 🔄</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="file-view-container">
            <header className="page-header">
                <div className="header-controls">
                    <div className="header-left">
                        <button onClick={handleBackToCategories} className="secondary back-button">
                            ← Back to Categories
                        </button>
                        <h1>{selectedCategoryLabel} Files</h1>
                    </div>
                    <button
                        className="primary"
                        onClick={handleOpenModal}
                        title={`Add files to ${selectedCategoryLabel}`}
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
                                        View
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
                        <div className="no-files-message">
                            <p>No files uploaded for {selectedCategoryLabel}.</p>
                            <button 
                                className="primary"
                                onClick={handleOpenModal}
                            >
                                + Upload First File
                            </button>
                        </div>
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
// File Upload Component (for use in App.js)
// =========================================================

export const FileUploadSection = ({ 
    filesToUpload, 
    setFilesToUpload, 
    isDragActive, 
    setIsDragActive, 
    fileInputRef 
}) => {
    
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

    return (
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
    );
};

export default FileView;