// FileComponents.js - Fixed with No Recursive Call
import React, { useState, useEffect, useCallback, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import './FileView.css';

const API_BASE = 'https://unitedpanelsystem-backend-1.onrender.com/api';

// =========================================================
// CONFIGURATION
// =========================================================

const MAX_UPLOAD_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const INDIVIDUAL_FILE_LIMIT = 50 * 1024 * 1024; // 50 MB per file

// =========================================================
// Thumbnail Generator Functions - FIXED VERSION
// =========================================================

/**
 * Create thumbnail from file blob - FIXED: No recursive call
 */
const createThumbnail = async (blob, mimeType, fileName) => {
  try {
    if (mimeType && mimeType.startsWith('image/')) {
      return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
          try {
            // Set canvas dimensions (thumbnail size)
            const maxWidth = 200;
            const maxHeight = 120;
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw image with white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(dataUrl);
          } catch (error) {
            console.warn('Canvas error for image:', fileName, error);
            resolve(createFallbackThumbnail(mimeType, fileName));
          }
        };
        
        img.onerror = () => {
          console.warn('Failed to load image for thumbnail:', fileName);
          resolve(createFallbackThumbnail(mimeType, fileName));
        };
        
        // Create object URL and clean up after loading
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        
        // Clean up object URL after image loads
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          // Call the original onload logic
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set canvas dimensions (thumbnail size)
          const maxWidth = 200;
          const maxHeight = 120;
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image with white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
      });
    } else {
      // For non-image files, create a styled thumbnail
      return createFallbackThumbnail(mimeType, fileName);
    }
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    return createFallbackThumbnail(mimeType, fileName);
  }
};

/**
 * Create fallback thumbnail for non-image files - SIMPLIFIED VERSION
 */
const createFallbackThumbnail = (mimeType, fileName) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 120;
  
  // Determine background color and icon based on file type
  let bgColor, icon, typeLabel;
  
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    bgColor = '#e74c3c';
    icon = '📕';
    typeLabel = 'PDF';
  } else if (['doc', 'docx'].includes(ext)) {
    bgColor = '#2c3e50';
    icon = '📝';
    typeLabel = 'DOC';
  } else if (['xls', 'xlsx'].includes(ext)) {
    bgColor = '#27ae60';
    icon = '📊';
    typeLabel = 'XLS';
  } else if (['zip', 'rar', '7z'].includes(ext)) {
    bgColor = '#f39c12';
    icon = '🗜️';
    typeLabel = 'ZIP';
  } else if (ext === 'txt' || mimeType?.includes('text')) {
    bgColor = '#3498db';
    icon = '📄';
    typeLabel = 'TXT';
  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
    bgColor = '#9b59b6';
    icon = '🖼️';
    typeLabel = 'IMG';
  } else {
    bgColor = '#95a5a6';
    icon = '📁';
    typeLabel = 'FILE';
  }
  
  // Draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw icon
  ctx.fillStyle = 'white';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(icon, canvas.width / 2, 50);
  
  // Draw file type label
  ctx.font = 'bold 12px Arial';
  ctx.fillText(typeLabel, canvas.width / 2, 80);
  
  // Draw file name (truncated)
  const shortName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(shortName, canvas.width / 2, 100);
  
  return canvas.toDataURL();
};

// =========================================================
// Simplified Thumbnail Loader (Alternative Approach)
// =========================================================

/**
 * Alternative: Use blob URL directly for images, create canvas for others
 */
const createThumbnailSimple = async (blob, mimeType, fileName) => {
  if (mimeType && mimeType.startsWith('image/')) {
    // For images, create a blob URL directly (no canvas processing)
    return URL.createObjectURL(blob);
  } else {
    // For non-images, create fallback thumbnail
    return createFallbackThumbnail(mimeType, fileName);
  }
};

// =========================================================
// Compression Utility Functions
// =========================================================

const compressImageFile = async (file, options = {}) => {
  const {
    maxSizeMB = 5,
    maxWidthOrHeight = 1920,
    quality = 0.8,
    useWebWorker = true
  } = options;

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
    
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Compression failed, using original file:', error);
    return file;
  }
};

const needsAggressiveCompression = (file) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return false;
  }
  
  return file.size > 10 * 1024 * 1024;
};

// =========================================================
// File API Functions
// =========================================================

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

export const real_getProjectFilesByCategory = async (projectNo, category) => {
  return await apiCall(`/projects/files/${projectNo}?category=${category}`);
};

export const real_downloadFile = async (fileId) => {
  const response = await fetch(`${API_BASE}/projects/file/blob/${fileId}`);
  if (!response.ok) {
    throw new Error('Download failed');
  }
  return response.blob();
};

export const real_deleteProjectFile = async (fileId) => {
  return await apiCall(`/projects/file/${fileId}`, {
    method: 'DELETE',
  });
};

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
    { key: 'panel', label: 'Panel / Slab', icon: '🖼️', description: 'Panel and slab related files' },
    { key: 'cutting', label: 'Cutting', icon: '✂️', description: 'Cutting plans and documents' },
    { key: 'door', label: 'Door', icon: '🚪', description: 'Door specifications and drawings' },
    { key: 'strip_curtain', label: 'Strip Curtain', icon: '🎪', description: 'Strip curtain documentation' },
    { key: 'accessories', label: 'Accessories', icon: '🔧', description: 'Accessories and fittings' },
    { key: 'system', label: 'System', icon: '⚙️', description: 'System integration files' },
    { key: 'transportation', label: 'Transportation', icon: '🚚', description: 'Transportation logs and documents' },
    { key: 'quotation', label: 'Quotation', icon: '📄', description: 'Quotation documents and pricing details' },
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
// FileView Component - OPTIMIZED VERSION
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
  
  // Thumbnail states
  const [thumbnails, setThumbnails] = useState({});
  const [loadingThumbnails, setLoadingThumbnails] = useState({});
  
  // Upload states
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
    setThumbnails({});
    setLoadingThumbnails({});
    await fetchFilesByCategory(category);
  };

  // Go back to category view
  const handleBackToCategories = () => {
    setCurrentView('categories');
    setSelectedCategory('');
    setSelectedCategoryLabel('');
    setFiles([]);
    setSelectedFile(null);
    setThumbnails({});
    setLoadingThumbnails({});
    
    // Clean up all blob URLs
    Object.values(thumbnails).forEach(url => {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    
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
      const filesArray = Array.isArray(data) ? data : [];
      setFiles(filesArray);
      
      // Load thumbnails for files
      await loadThumbnails(filesArray);
    } catch (err) {
      console.error("Failed to fetch files for category:", err);
      setError(`Failed to load ${category} files for project ${projectNo}.`);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectNo]);

  // Load thumbnails for files - OPTIMIZED
  const loadThumbnails = async (filesArray) => {
    const thumbnailPromises = filesArray.map(async (file) => {
      try {
        setLoadingThumbnails(prev => ({ ...prev, [file.id]: true }));
        
        // Fetch file data
        const blob = await real_downloadFile(file.id);
        
        // For images, create blob URL (no canvas processing to avoid stack overflow)
        if (file.mime_type && file.mime_type.startsWith('image/')) {
          const blobUrl = URL.createObjectURL(blob);
          setThumbnails(prev => ({ ...prev, [file.id]: blobUrl }));
        } else {
          // For non-images, create fallback thumbnail
          const thumbnail = createFallbackThumbnail(file.mime_type, file.file_name);
          setThumbnails(prev => ({ ...prev, [file.id]: thumbnail }));
        }
        
        // Don't need to keep the blob since we have URL or thumbnail
        URL.revokeObjectURL(blob);
        
      } catch (err) {
        console.warn(`Failed to load thumbnail for ${file.file_name}:`, err);
        // Create fallback thumbnail
        const fallbackThumbnail = createFallbackThumbnail(file.mime_type, file.file_name);
        setThumbnails(prev => ({ ...prev, [file.id]: fallbackThumbnail }));
      } finally {
        setLoadingThumbnails(prev => ({ ...prev, [file.id]: false }));
      }
    });
    
    // Load thumbnails in smaller batches to avoid overwhelming
    const batchSize = 2;
    for (let i = 0; i < thumbnailPromises.length; i += batchSize) {
      const batch = thumbnailPromises.slice(i, i + batchSize);
      await Promise.all(batch);
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  // Check if file is previewable
  const isPreviewable = (mimeType) => {
    return mimeType && (
      mimeType.startsWith('image/') || 
      mimeType === 'application/pdf' ||
      mimeType.endsWith('/pdf')
    );
  };

  // Handle file selection for preview
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
      
      // Remove thumbnail and clean up blob URL
      if (thumbnails[file.id] && typeof thumbnails[file.id] === 'string' && thumbnails[file.id].startsWith('blob:')) {
        URL.revokeObjectURL(thumbnails[file.id]);
      }
      
      setFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));
      setThumbnails(prev => {
        const newThumbnails = { ...prev };
        delete newThumbnails[file.id];
        return newThumbnails;
      });
      
      setLoadingThumbnails(prev => {
        const newLoading = { ...prev };
        delete newLoading[file.id];
        return newLoading;
      });
      
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
      const newFiles = Array.from(selected);
      
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
    
    // Check individual file size limit
    const oversizedFiles = droppedFiles.filter(file => file.size > INDIVIDUAL_FILE_LIMIT);
    if (oversizedFiles.length > 0) {
      setError(`Some files exceed 50MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }
    
    const validFiles = droppedFiles.filter(file => file.size <= INDIVIDUAL_FILE_LIMIT);
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
            
            finalFile = await compressImageFile(file, compressionOptions);
            
            if (finalFile.size < file.size) {
              compressionApplied = true;
              compressionDetails.compressedSize = finalFile.size;
              compressionDetails.ratio = (finalFile.size / file.size).toFixed(2);
            }
            
          } catch (compressionError) {
            console.warn(`Compression failed for ${file.name}:`, compressionError);
            compressionDetails.reason = 'Compression failed';
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
          setError(`Upload limit exceeded! Skipping remaining files.`);
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
      await real_uploadProjectFiles(formData);
      
      // Update report with success
      setCompressionReport({
        ...report,
        uploadStarted: true,
        uploadSuccessful: true
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

  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';
    
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf' || mimeType.endsWith('/pdf')) return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
    if (mimeType.includes('text')) return '📄';
    
    return '📄';
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
                  {uploadProgress < 100 ? 'Processing files...' : 'Uploading...'}
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
            
            {/* Upload Form */}
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
                          <li key={index} className="staged-file-item"> 
                            <div className="file-info">
                              <span className="file-icon">{getFileIcon(file.type)}</span>
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
                            Processing & Uploading...
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

  // Show loading state
  if (isLoading) {
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
          </div>
        </header>
        <div className="loading-container">
          <div className="spinner-large"></div>
          <h2>Loading {selectedCategoryLabel} Files...</h2>
        </div>
      </div>
    );
  }

  // Main file view
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
      
      {error && !selectedFile && <div className="alert alert-danger">{error}</div>}
      
      <div className="files-grid-container">
        <div className="files-grid-header">
          <h2>All Files in {selectedCategoryLabel}</h2>
          <div className="files-count">{files.length} files</div>
        </div>
        
        {!Array.isArray(files) ? (
          <div className="no-files-message">
            <div className="no-files-icon">❌</div>
            <h3>Failed to load files</h3>
            <p>There was an error loading the files. Please try again.</p>
            <button 
              className="secondary"
              onClick={() => fetchFilesByCategory(selectedCategory)}
            >
              ↻ Retry
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="no-files-message">
            <div className="no-files-icon">📁</div>
            <h3>No files yet</h3>
            <p>Upload your first file to get started with {selectedCategoryLabel}.</p>
            <button 
              className="primary"
              onClick={handleOpenModal}
            >
              + Upload First File
            </button>
          </div>
        ) : (
          <div className="files-grid">
            {files.map(file => (
              <div 
                key={file.id} 
                className={`file-grid-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                onClick={() => handleFileSelectForPreview(file)}
              >
            <div className="file-grid-thumbnail">
            {loadingThumbnails[file.id] ? (
              <div className="thumbnail-loading">
                <div className="thumbnail-spinner"></div>
              </div>
            ) : (thumbnails[file.id] || file.file_data) && file.mime_type?.startsWith('image/') ? (
              /* ✅ ONLY try to render <img> if the file is actually an image */
              <img 
                src={
                  thumbnails[file.id] || 
                  (file.file_data?.type === 'Buffer' 
                    ? `data:${file.mime_type};base64,${btoa(String.fromCharCode(...new Uint8Array(file.file_data.data)))}`
                    : `data:${file.mime_type};base64,${file.file_data}`) 
                } 
                alt={`Thumbnail of ${file.file_name}`}
                className="thumbnail-image"
                onError={(e) => {
                  // Emergency fallback if the image data itself is corrupted
                  const container = e.target.parentNode;
                  if (!container.querySelector('.thumbnail-fallback')) {
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'thumbnail-fallback';
                    fallbackDiv.innerHTML = `<span class="file-type-icon">${getFileIcon(file.mime_type)}</span>`;
                    container.appendChild(fallbackDiv);
                  }
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              /* ✅ Immediate fallback for PDF, CAD, ZIP, etc. */
              <div className="thumbnail-fallback">
                <span className="file-type-icon">{getFileIcon(file.mime_type)}</span>
              </div>
            )}
          </div>
                <div className="file-grid-info">
                  <h4 className="file-grid-name" title={file.file_name}>
                    {file.file_name}
                  </h4>
                  <div className="file-grid-actions">
                    <span className="file-grid-size">
                      {formatSize(file.file_size || 0)}
                    </span>
                    <button 
                      className="file-grid-delete-btn"
                      onClick={(e) => handleDeleteFile(file, e)}
                      title={`Delete ${file.file_name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Screen Preview Modal */}
      {selectedFile && (
        <div className="preview-modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3>
                <span className="file-type-icon">{getFileIcon(selectedFile.mime_type)}</span>
                {selectedFile.file_name}
              </h3>
              <div className="preview-modal-actions">
                <a 
                  className="modal-download-btn"
                  href={`${API_BASE}/projects/file/blob/${selectedFile.id}`}
                  download={selectedFile.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📥 View
                </a>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteFile(selectedFile); }}
                  className="modal-delete-btn"
                  title={`Delete ${selectedFile.file_name}`}
                >
                  🗑️ Delete
                </button>
                <button 
                  className="modal-close-btn"
                  onClick={() => setSelectedFile(null)}
                  title="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="preview-modal-body">
              {isFetchingBlob ? (
                <div className="preview-loading">
                  <div className="spinner-large"></div>
                  <h3>Loading {selectedFile.file_name}...</h3>
                </div>
              ) : previewUrl ? (
                selectedFile.mime_type && selectedFile.mime_type.startsWith('image/') ? (
                  <img 
                    src={previewUrl} 
                    alt={`Preview of ${selectedFile.file_name}`} 
                    className="preview-full-content preview-full-image" 
                  />
                ) : (selectedFile.mime_type && (selectedFile.mime_type === 'application/pdf' || selectedFile.mime_type.endsWith('/pdf'))) ? (
                  <iframe 
                    src={previewUrl} 
                    title={`Preview of ${selectedFile.file_name}`} 
                    className="preview-full-content preview-full-iframe" 
                  />
                ) : (
                  <div className="preview-full-placeholder">
                    <h4>Cannot Display Preview</h4>
                    <p>
                      The file <strong>{selectedFile.file_name}</strong> cannot be previewed directly.
                    </p>
                    <a 
                      className="modal-download-btn"
                      href={`${API_BASE}/projects/file/blob/${selectedFile.id}`}
                      download={selectedFile.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📥 Download File
                    </a>
                  </div>
                )
              ) : (
                <div className="preview-full-placeholder">
                  <h4>Preview Unavailable</h4>
                  <p>
                    Unable to load preview for <strong>{selectedFile.file_name}</strong>.
                  </p>
                  <a 
                    className="modal-download-btn"
                    href={`${API_BASE}/projects/file/blob/${selectedFile.id}`}
                    download={selectedFile.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📥 Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal />
    </div>
  );
};

export default FileView;