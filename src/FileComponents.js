// FileComponents.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import imageCompression from 'browser-image-compression';

const API_BASE = 'http://localhost:5000/api';

// =========================================================
// CONFIGURATION
// =========================================================

const MAX_UPLOAD_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const INDIVIDUAL_FILE_LIMIT = 50 * 1024 * 1024; // 50 MB per file

// =========================================================
// Compression Utility Functions
// =========================================================

/**
 * Enhanced compression function using browser-image-compression
 * @param {File} file - The original File object
 * @param {Object} options - Compression options
 * @returns {Promise<File>} - Compressed file
 */
const compressImageFile = async (file, options = {}) => {
  const {
    maxSizeMB = 5,
    maxWidthOrHeight = 1920,
    quality = 0.8,
    useWebWorker = true
  } = options;

  // Skip compression for non-images and GIFs
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  try {
    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      initialQuality: quality,
      maxIteration: 10,
      exifOrientation: 1,
      fileType: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
    };

    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Convert compressed blob back to File object
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Compression failed, using original file:', error);
    return file; // Return original if compression fails
  }
};

/**
 * Check if file needs aggressive compression
 * @param {File} file - File to check
 * @returns {boolean} - True if needs aggressive compression
 */
const needsAggressiveCompression = (file) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return false;
  }
  
  // If file is larger than 10MB, it needs aggressive compression
  return file.size > 10 * 1024 * 1024;
};

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
// Category Cards Component - UPDATED with Transportation
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
    },
    { 
      key: 'transportation', // NEW CATEGORY ADDED
      label: 'Transportation', 
      icon: '🚚',
      description: 'Transportation logs, bills, and documents'
    }
  ];

  return (
    <div className="category-cards-container">
      <header className="page-header">
        <h1>Files for Job: <strong>{projectNo}</strong></h1>
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
  const [currentView, setCurrentView] = useState('categories');
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
  
  const [compressionReport, setCompressionReport] = useState(null); 
  const [uploadProgress, setUploadProgress] = useState(0);

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
    setCompressionReport(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFilesToUpload([]);
    setCompressionReport(null);
    setIsUploading(false);
    setUploadProgress(0);
  };
  
  const handleFilesChange = (e) => {
    const selected = e.target.files;
    if (selected) {
      const newFiles = Array.from(selected).filter(
        newFile => !filesToUpload.some(existingFile => 
          existingFile.name === newFile.name && 
          existingFile.size === newFile.size &&
          existingFile.lastModified === newFile.lastModified
        )
      );
      
      // Check individual file size limit
      const oversizedFiles = newFiles.filter(file => file.size > INDIVIDUAL_FILE_LIMIT);
      if (oversizedFiles.length > 0) {
        setError(`Some files exceed 50MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      }
      
      const validFiles = newFiles.filter(file => file.size <= INDIVIDUAL_FILE_LIMIT);
      setFilesToUpload(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles = droppedFiles.filter(
      newFile => !filesToUpload.some(existingFile => 
        existingFile.name === newFile.name && 
        existingFile.size === newFile.size
      )
    );
    
    // Check individual file size limit
    const oversizedFiles = newFiles.filter(file => file.size > INDIVIDUAL_FILE_LIMIT);
    if (oversizedFiles.length > 0) {
      setError(`Some files exceed 50MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }
    
    const validFiles = newFiles.filter(file => file.size <= INDIVIDUAL_FILE_LIMIT);
    setFilesToUpload(prev => [...prev, ...validFiles]);
  };

  // Enhanced upload with compression
  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    
    setIsUploading(true);
    setError(null);
    setCompressionReport(null);
    setUploadProgress(0);

    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let compressedCount = 0;
    let skippedCount = 0;
    
    const filesToActuallyUpload = [];
    const compressionResults = [];

    try {
      const formData = new FormData();
      formData.append('projectNo', projectNo);
      formData.append('category', selectedCategory);
      
      const limitMB = (MAX_UPLOAD_SIZE_BYTES / 1024 / 1024).toFixed(0);
      
      // Process files sequentially
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 50));
        
        totalOriginalSize += file.size;
        
        let finalFile = file;
        let compressionApplied = false;
        let compressionDetails = {
          name: file.name,
          originalSize: file.size,
          compressedSize: file.size,
          ratio: 1,
          skipped: false,
          reason: '',
          compressionLevel: 'none'
        };

        // Skip compression for non-images and GIFs
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
          try {
            // Determine compression level based on file size
            let compressionOptions = {
              maxSizeMB: 5,
              maxWidthOrHeight: 1920,
              quality: 0.8,
              useWebWorker: true
            };
            
            if (needsAggressiveCompression(file)) {
              compressionOptions = {
                maxSizeMB: 2,
                maxWidthOrHeight: 1024,
                quality: 0.6,
                useWebWorker: true
              };
              compressionDetails.compressionLevel = 'aggressive';
            } else {
              compressionDetails.compressionLevel = 'standard';
            }
            
            console.log(`Compressing ${file.name} with ${compressionDetails.compressionLevel} settings`);
            finalFile = await compressImageFile(file, compressionOptions);
            
            if (finalFile.size < file.size) {
              compressionApplied = true;
              compressionDetails.compressedSize = finalFile.size;
              compressionDetails.ratio = (finalFile.size / file.size).toFixed(2);
            }
            
          } catch (compressionError) {
            console.warn(`Compression failed for ${file.name}:`, compressionError);
            compressionDetails.reason = 'Compression failed';
            // Use original file
          }
        } else {
          compressionDetails.reason = 'Not an image or GIF file';
        }

        // Check if adding this file would exceed total limit
        if (totalCompressedSize + finalFile.size > MAX_UPLOAD_SIZE_BYTES) {
          const currentTotalMB = (totalCompressedSize / 1024 / 1024).toFixed(2);
          const fileMB = (finalFile.size / 1024 / 1024).toFixed(2);
          
          compressionDetails.skipped = true;
          compressionDetails.reason = `Size limit exceeded (${currentTotalMB}MB + ${fileMB}MB > ${limitMB}MB)`;
          skippedCount++;
          
          compressionResults.push(compressionDetails);
          setError(`Upload limit exceeded! Current total: ${currentTotalMB}MB + ${fileMB}MB = exceeds ${limitMB}MB limit. Skipping remaining files.`);
          break;
        }

        // Add file to upload list
        filesToActuallyUpload.push(finalFile);
        totalCompressedSize += finalFile.size;
        
        if (compressionApplied) {
          compressedCount++;
        }
        
        compressionResults.push(compressionDetails);
        
        // Update progress during compression phase
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      // Check if any files can be uploaded
      if (filesToActuallyUpload.length === 0) {
        setError('No files to upload after processing.');
        setIsUploading(false);
        return;
      }

      // Append files to FormData
      filesToActuallyUpload.forEach(file => {
        formData.append('files', file);
      });

      // Set compression report
      const report = {
        totalFiles: filesToUpload.length,
        uploadedFiles: filesToActuallyUpload.length,
        compressedCount,
        skippedCount,
        originalSize: totalOriginalSize,
        compressedSize: totalCompressedSize,
        results: compressionResults,
        sizeReduction: totalOriginalSize - totalCompressedSize,
        isCompressed: compressedCount > 0,
        uploadStarted: false
      };

      setCompressionReport(report);
      
      // Upload files
      setUploadProgress(100);
      const uploadResult = await real_uploadProjectFiles(formData);
      
      // Update report with success
      setCompressionReport({
        ...report,
        uploadStarted: true,
        uploadSuccessful: true,
        uploadResult
      });

      // Refresh file list
      await fetchFilesByCategory(selectedCategory);
      
      // Close modal after delay
      setTimeout(() => {
        handleCloseModal();
      }, 3000);

    } catch (err) {
      console.error("Upload failed:", err);
      setError(`Upload failed: ${err.message || 'Server error'}`);
      setCompressionReport(prev => prev ? {
        ...prev,
        uploadStarted: true,
        uploadSuccessful: false,
        uploadError: err.message
      } : null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFileFromStaging = (index) => setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = () => { setIsDragActive(false); };

  // Helper functions
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getReductionPercentage = (original, compressed) => {
    if (original === 0) return '0%';
    const reduction = ((original - compressed) / original) * 100;
    return reduction > 0 ? reduction.toFixed(1) + '%' : '0%';
  };

  // Render file preview
  const renderFilePreview = () => {
    if (!selectedFile) return <p>Select a file from the list to preview its content.</p>;
    if (isFetchingBlob) return <p>Loading <strong>{selectedFile.file_name}</strong> content... 🔄</p>;
    
    if (!isPreviewable(selectedFile.mime_type) || !previewUrl) {
      return (
        <div className="preview-placeholder">
          <h4 className="no-preview-title">Cannot Display Preview</h4>
          <p className="no-preview-message">
            The file <strong>{selectedFile.file_name}</strong> is of type <strong>{selectedFile.mime_type}</strong>.
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
            {/* Progress Bar */}
            {isUploading && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {uploadProgress < 100 ? 'Compressing files...' : 'Uploading...'}
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}

            {/* Compression Report */}
            {compressionReport && compressionReport.uploadStarted && (
              <div className={`alert ${compressionReport.uploadSuccessful ? 'alert-success' : 'alert-danger'}`}>
                <h4>{compressionReport.uploadSuccessful ? '✅ Upload Complete!' : '❌ Upload Failed'}</h4>
                <p>
                  Processed <strong>{compressionReport.totalFiles}</strong> file(s).
                  {compressionReport.compressedCount > 0 && (
                    <> <strong>{compressionReport.compressedCount}</strong> image(s) compressed.</>
                  )}
                  {compressionReport.skippedCount > 0 && (
                    <> <strong>{compressionReport.skippedCount}</strong> file(s) skipped.</>
                  )}
                </p>
                
                {compressionReport.sizeReduction > 0 && (
                  <div className="size-reduction-details">
                    <p>
                      <strong>Total size reduction:</strong> {formatSize(compressionReport.originalSize)} →{' '}
                      <strong>{formatSize(compressionReport.compressedSize)}</strong>{' '}
                      ({getReductionPercentage(compressionReport.originalSize, compressionReport.compressedSize)} saved)
                    </p>
                  </div>
                )}
                
                {compressionReport.uploadSuccessful && (
                  <div className="success-message">
                    <p>✅ Files uploaded successfully! Refreshing file list...</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Error Message */}
            {error && !compressionReport?.uploadStarted && (
              <div className="alert alert-danger">
                <h4>🚫 Upload Error</h4>
                <p>{error}</p>
              </div>
            )}
            
            {/* Upload Form (only show if not in success state) */}
            {(!compressionReport || !compressionReport.uploadStarted) && (
              <>
                <div className="upload-info">
                  <p><strong>Uploading to:</strong> {selectedCategoryLabel}</p>
                  <p><strong>Total limit:</strong> 300 MB (images auto-compressed)</p>
                  <p><strong>Individual limit:</strong> 50 MB per file</p>
                  <p className="upload-tip">
                    <em>💡 Images are automatically compressed to save space.</em>
                  </p>
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
                  <div className="drag-drop-icon">📁</div>
                  <p className="drag-drop-text">
                    {isDragActive 
                      ? 'Release files here!' 
                      : 'Click to Select or Drag & Drop Files'}
                  </p>
                  <small className="drag-drop-hint">Supports images, PDFs, documents (max 50MB each)</small>
                </div>

                {filesToUpload.length > 0 && (
                  <div className="file-list-preview">
                    <div className="staged-files-header">
                      <h4>Files to Upload ({filesToUpload.length})</h4>
                      <button 
                        className="clear-all-btn"
                        onClick={() => setFilesToUpload([])}
                        disabled={isUploading}
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="staged-file-list-container">
                      <ul className="staged-file-list">
                        {filesToUpload.map((file, index) => (
                          <li key={file.name + index} className="staged-file-item"> 
                            <div className="file-info">
                              <span className="file-icon">📄</span>
                              <div className="file-details">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{formatSize(file.size)}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFileFromStaging(index); }}
                              className="remove-file-btn"
                              title="Remove file"
                              disabled={isUploading}
                            >
                              &times;
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="upload-actions">
                      <button 
                        className={`upload-btn primary ${isUploading ? 'uploading' : ''}`}
                        onClick={handleUpload}
                        disabled={isUploading || filesToUpload.length === 0}
                      >
                        {isUploading ? (
                          <>
                            <span className="spinner"></span>
                            Compressing & Uploading...
                          </>
                        ) : (
                          `Upload ${filesToUpload.length} File${filesToUpload.length !== 1 ? 's' : ''}`
                        )}
                      </button>
                      <button 
                        className="cancel-btn secondary"
                        onClick={handleCloseModal}
                        disabled={isUploading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Close button when upload is complete */}
            {compressionReport?.uploadSuccessful && (
              <div className="upload-complete-actions">
                <button 
                  className="close-modal-btn primary"
                  onClick={handleCloseModal}
                >
                  Close
                </button>
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
        <div className="loading-container">
          <div className="spinner-large"></div>
          <h2>Loading {selectedCategoryLabel} Files...</h2>
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
            className="primary add-files-btn"
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
                  <a 
                    className="download-btn"
                    href={`${API_BASE}/projects/file/blob/${selectedFile.id}`}
                    download={selectedFile.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </a>
                  <button 
                    onClick={() => handleDeleteFile(selectedFile)}
                    className="danger delete-btn"
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
          <div className="file-list-header">
            <h3>Available Files ({files.length})</h3>
            {files.length > 0 && (
              <button
                className="secondary refresh-btn"
                onClick={() => fetchFilesByCategory(selectedCategory)}
                title="Refresh file list"
              >
                ↻ Refresh
              </button>
            )}
          </div>
          
          {files.length === 0 ? (
            <div className="no-files-message">
              <div className="no-files-icon">📁</div>
              <p>No files uploaded for {selectedCategoryLabel}.</p>
              <button 
                className="primary"
                onClick={handleOpenModal}
              >
                + Upload First File
              </button>
            </div>
          ) : (
            <div className="file-list-container">
              <div className="file-list">
                {files.map(file => (
                  <div 
                    key={file.id} 
                    className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                    onClick={() => handleFileSelectForPreview(file)}
                  >
                    <span className="file-icon">
                      {file.mime_type.startsWith('image/') ? '🖼️' : 
                       file.mime_type.endsWith('/pdf') ? '📕' : '📄'}
                    </span>
                    <div className="file-info">
                      <span className="file-name" title={file.file_name}>{file.file_name}</span>
                      <span className="file-meta">
                        {(file.file_size / 1024 / 1024).toFixed(2)} MB • {file.mime_type.split('/')[1] || file.mime_type}
                      </span>
                    </div>
                    <button 
                      className="delete-file-btn"
                      onClick={(e) => handleDeleteFile(file, e)}
                      title={`Delete ${file.file_name}`}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
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

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
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
          <p><strong>{filesToUpload.length} file(s) selected:</strong></p>
          <ul>
            {filesToUpload.map((file, index) => (
              <li key={index} className="file-preview-item">
                <span className="file-preview-name">{file.name}</span>
                <span className="file-preview-size">{formatSize(file.size)}</span>
                <span 
                  className="remove-file" 
                  onClick={() => handleRemoveFile(file.name)}
                  title="Remove file"
                >
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