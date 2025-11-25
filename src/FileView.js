import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
// Ensure these functions exist and are exported from apiService.js
import { getProjectFilesMetadata, downloadFileBlob, deleteProjectFile, uploadProjectFiles } from './apiService'; 
import './FileView.css'; 

function FileView() {
    const { projectNo } = useParams(); 
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

    // =========================================================
    // Core Logic: Fetch, Preview, Delete
    // =========================================================
    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getProjectFilesMetadata(projectNo);
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
            const response = await downloadFileBlob(file.id);
            const blob = await response.blob();
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
    
    const handleDeleteFile = async (file, e) => {
        if (e) e.stopPropagation(); 
        if (!window.confirm(`Are you sure you want to permanently delete the file: ${file.file_name}?`)) return;

        try {
            await deleteProjectFile(file.id);
            setFiles(prevFiles => prevFiles.filter(f => f.id !== file.id));
            if (selectedFile?.id === file.id) {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setSelectedFile(null);
                setPreviewUrl('');
            }
            alert(`${file.file_name} successfully deleted.`);
        } catch (err) {
            console.error("Failed to delete file:", err);
            alert(`Failed to delete ${file.file_name}. Check server logs.`);
            setError(`Deletion failed for ${file.file_name}.`);
        }
    };

    // =========================================================
    // File Upload Handlers (Uses projectNo)
    // =========================================================
    
    const handleOpenModal = () => {
        setIsModalOpen(true);
        setFilesToUpload([]);
    }

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFilesToUpload([]);
    }
    
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
            // FIX: Pass projectNo and filesToUpload to the API function
            await uploadProjectFiles(projectNo, filesToUpload);
            
            handleCloseModal(); 
            await fetchFiles(); 
            alert(`${filesToUpload.length} file(s) uploaded successfully!`);

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

    // =========================================================
    // Render Functions
    // =========================================================
    
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
                        Use the **⬇️** icon to download and view it locally.
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
                            className={`drag-drop-area-project ${isDragActive ? 'drag-active' : ''}`}
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
                            <small>Max file size: 10MB</small>
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
                                                className="remove-file icon-btn"
                                                title="Remove from staging"
                                            >
                                                &times;
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="upload-actions">
                                    <button 
                                        className="primary upload-btn" 
                                        onClick={handleUpload}
                                        disabled={isUploading || filesToUpload.length === 0}
                                    >
                                        {isUploading ? 'Uploading... 📤' : `Upload ${filesToUpload.length} File(s)`}
                                    </button>
                                    <button 
                                        className="secondary upload-btn" 
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

    if (isLoading) return <h2>Loading Files... 🔄</h2>;

    return (
        <div className="file-view-container">
            <Link to="/" className="back-link">
                &larr; Back to Job List
            </Link>
            
            <div className="main-header-controls">
                <h1>📁 Files for Job #{projectNo}</h1>
                <button
                    className="primary add-files-btn" // Removed 'icon-btn' just in case of conflicting styles
                    onClick={handleOpenModal}
                    title="Add/Upload Multiple Files"
                >
                    + Add Files
                </button>
            </div>
            
            {error && <div className="alert-danger">{error}</div>}
            
            <div className="file-view-layout">
                {/* PREVIEW PANEL */}

                <div className="preview-panel">
                    <div className="preview-header">
                        {/* Container to hold the title and the download icon side-by-side */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <h4>{selectedFile ? `Previewing: ${selectedFile.file_name}` : 'Select a File to View'}</h4>
                            
                            {/* FIX: Use selectedFile and conditionally render the link */}
                            {/* The icon will automatically be pushed to the right edge by the CSS below */}
                            {selectedFile && (
                                <a 
                                    href={`/api/projects/file/blob/${selectedFile.id}`} // FIX: Use selectedFile.id
                                    download={selectedFile.file_name}                 // FIX: Use selectedFile.file_name
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="download-link-btn"
                                    title={`Download ${selectedFile.file_name}`}      
                                    onClick={e => e.stopPropagation()} 
                                >
                                    ⬇️
                                </a> 
                            )}
                        </div>
                    </div>
                    <div className="preview-area">{renderFilePreview()}</div>
                </div>
                
                {/* FILE LIST PANEL */}
                <div className="file-list-panel">
                    <h3 style={{ marginTop: '0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        Available Files ({files.length})
                    </h3>
                    
                    {files.length === 0 ? (
                        <p className="text-center">No files uploaded for this project.</p>
                    ) : (
                        <ul className="file-list">
                            {files.map(file => (
                                <li 
                                    key={file.id} 
                                    className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                                    onClick={() => handleFileSelectForPreview(file)}
                                >
                                    {/* FIX: File name and icon displayed together, allowing wrapping */}
                                    <span 
                                        className="file-name"
                                        title={`Type: ${file.mime_type} | Size: ${(file.file_size / 1024).toFixed(2)} KB`}
                                    >
                                        {file.file_name}
                                    </span>
                                    
                                    {/* Actions */}
                                    <button 
                                        onClick={(e) => handleDeleteFile(file, e)}
                                        className="icon-btn delete-file-list-btn"
                                        title={`Delete ${file.file_name}`}
                                    >
                                        🗑️
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Upload Modal is rendered here */}
            {UploadModal()}
        </div>
    );
}

export default FileView;