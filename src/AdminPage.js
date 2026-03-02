import React, { useState, useEffect, useRef, useMemo } from 'react';
import './AdminPage.css';
import { getAllAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob } from './apiService';
import FileView from './FileComponents';

const tableColumns = [
    'DATE', 'JOB NO.', 'CUSTOMER', 'SALES', 'SELL', 'COST', 'MARGIN', 'SIGNATURE', 'REMARKS'
];

// =========================================================
// Utility Functions for Date Formatting
// =========================================================
const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
    }
    
    // If it's a Date object or ISO string
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitialValue = (col) => {
    if (col === 'DATE') return getCurrentDate();
    return '';
};

// =========================================================
// SignatureCanvas Component
// =========================================================
const SignatureCanvas = ({ signatureData, onSaveSignature, onClearSignature }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [ctx, setCtx] = useState(null);
    
    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            // Set canvas background to white before drawing
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.lineWidth = 2;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#000000';
            
            setCtx(context);
            
            if (signatureData) {
                const img = new Image();
                img.onload = () => {
                    context.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = signatureData;
            }
        }
    }, [signatureData]);

   const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Calculate scaling factors between bitmap and display size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;

        if (e.touches && e.touches.length === 1) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Convert to canvas bitmap coordinates
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    const startDrawing = (e) => {
        if (!ctx) return;
        const { x, y } = getCoordinates(e);
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    
    const draw = (e) => {
        if (!isDrawing || !ctx) return;
        const { x, y } = getCoordinates(e);
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
    };
    
    const handleSave = () => {
        if (canvasRef.current) {
            // Optimization: Scale down the signature before saving the data URL
            const originalCanvas = canvasRef.current;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = 400; // Match the display width
            tempCanvas.height = 150; // Match the display height
            
            tempCtx.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 
                              0, 0, tempCanvas.width, tempCanvas.height);
            
            // Use image/jpeg for smaller file size, unless transparency is required
            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8); 
            onSaveSignature(dataUrl);
        }
    };
    
    const handleClear = () => {
        if (canvasRef.current && ctx) {
            // Redraw white background to clear
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            onClearSignature();
        }
    };
    
    return (
        <div className="signature-container">
            <div className="signature-header">
                <h4>Draw Signature</h4>
                <div className="signature-instructions">
                    Draw your signature in the box below
                </div>
            </div>
            
            <div className="signature-canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="signature-canvas"
                    // Mouse handlers
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    // Touch handlers
                    onTouchStart={(e) => {
                        e.preventDefault();
                        if (e.touches.length === 1) startDrawing(e);
                    }}
                    onTouchMove={(e) => {
                        e.preventDefault();
                        if (e.touches.length === 1) draw(e);
                    }}
                    onTouchEnd={stopDrawing}
                />
            </div>
            
            <div className="signature-controls">
                <button type="button" onClick={handleClear} className="signature-btn clear-btn">
                    Clear
                </button>
                <button type="button" onClick={handleSave} className="signature-btn save-btn">
                    Save Signature
                </button>
            </div>
            
            {signatureData && (
                <div className="signature-preview">
                    <h5>Current Signature:</h5>
                    <img src={signatureData} alt="Signature Preview" className="signature-image-preview" />
                </div>
            )}
        </div>
    );
};

// =========================================================
// ProjectModal Component
// =========================================================
const ProjectModal = ({ 
    isOpen, 
    onClose, 
    columns, 
    onSave, 
    jobToEdit
}) => {
    
    // Create initial state using useMemo to ensure stability across renders
    const initialFormState = useMemo(() => columns.reduce((acc, col) => ({ 
        ...acc, 
        [col]: col === 'SIGNATURE' ? null : getInitialValue(col)
    }), {}), [columns]);
    
    const [formData, setFormData] = useState(initialFormState);
    const [error, setError] = useState(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [tempSignature, setTempSignature] = useState(null);

    // Extract specific form values for dependency tracking
    const sellValue = formData['SELL'];
    const costValue = formData['COST'];
    const marginValue = formData['MARGIN'];

    // FIX 1: Initialization/Reset useEffect
    useEffect(() => {
        if (jobToEdit) {
            // Map API response to form data structure
            const mappedData = {
                'DATE': formatDateToYYYYMMDD(jobToEdit.dateEntry) || getInitialValue('DATE'),
                'JOB NO.': jobToEdit.jobNo || getInitialValue('JOB NO.'),
                'CUSTOMER': jobToEdit.customerName || getInitialValue('CUSTOMER'),
                'SALES': jobToEdit.salesAmount === null || jobToEdit.salesAmount === 0 ? '' : Number(jobToEdit.salesAmount),
                'SELL': jobToEdit.sellPrice === null || jobToEdit.sellPrice === 0 ? '' : Number(jobToEdit.sellPrice),
                'COST': jobToEdit.cost === null || jobToEdit.cost === 0 ? '' : Number(jobToEdit.cost),
                'MARGIN': jobToEdit.margin === null || jobToEdit.margin === 0 ? '' : Number(jobToEdit.margin),
                'SIGNATURE': jobToEdit.signatureData,
                'REMARKS': jobToEdit.remarks || getInitialValue('REMARKS'),
            };
            setFormData(mappedData);
            setTempSignature(jobToEdit.signatureData);
        } else {
            // Reset to initial state for a new entry
            setFormData(initialFormState);
            setTempSignature(null);
        }
    }, [jobToEdit, isOpen, initialFormState]);

    // FIX 2: Margin Calculation useEffect - Fixed dependency array
    useEffect(() => {
        const sellNum = Number(sellValue);
        const costNum = Number(costValue);
        const currentMargin = marginValue;
        
        if (!isNaN(sellNum) && !isNaN(costNum) && sellValue !== '' && costValue !== '') {
            const marginValueCalc = sellNum - costNum;
            const calculatedMargin = parseFloat(marginValueCalc.toFixed(2));

            if (calculatedMargin !== currentMargin) {
                setFormData(prev => ({ 
                    ...prev, 
                    'MARGIN': calculatedMargin 
                }));
            }
        } else if (currentMargin !== '') {
            setFormData(prev => ({ ...prev, 'MARGIN': '' }));
        }
    }, [sellValue, costValue, marginValue]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setError(null);
        
        let finalValue = value;
        if (type === 'number') {
            finalValue = value === '' ? '' : parseFloat(value);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSignatureSave = (signatureData) => {
        setTempSignature(signatureData);
        setShowSignaturePad(false);
    };

    const handleClearSignature = () => {
        setTempSignature(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate required fields
        if (!formData['JOB NO.'] || String(formData['JOB NO.']).trim() === '') {
            setError('Job No. is required.');
            return;
        }

        if (formData['SELL'] === '' || formData['COST'] === '' || formData['SALES'] === '') {
            setError('Please ensure SELL, COST, and SALES amounts are entered.');
            return;
        }

        const selectedProjectNumber = String(formData['JOB NO.']);
        const customerName = formData['CUSTOMER'] || `Customer for ${selectedProjectNumber}`;

        const payload = {
            Job_No: selectedProjectNumber,
            Date_Entry: formData['DATE'],
            Customer_Name: customerName,
            Sales_Amount: formData['SALES'] === '' ? null : formData['SALES'],
            Sell_Price: formData['SELL'] === '' ? null : formData['SELL'],
            Cost: formData['COST'] === '' ? null : formData['COST'],
            Margin: formData['MARGIN'] === '' ? null : formData['MARGIN'],
            Remarks: formData['REMARKS'] || null,
            Signature_Data: tempSignature,
        };

        console.log('Submitting payload with signature:', {
            ...payload,
            Signature_Data: tempSignature ? `Base64 data URL (${tempSignature.length} chars)` : 'null'
        });

        // FIX: Pass the old job number when editing
        const oldJobNo = jobToEdit ? jobToEdit.jobNo : null;
        onSave(payload, jobToEdit ? 'UPDATE' : 'CREATE', oldJobNo);
    };

    const getInputType = (col) => {
        if (['SELL', 'COST', 'SALES', 'MARGIN'].includes(col)) return 'number';
        if (col === 'DATE') return 'date';
        if (col === 'REMARKS') return 'textarea';
        return 'text';
    };

    const isRequired = (col) => ['DATE', 'JOB NO.', 'SELL', 'COST', 'SALES'].includes(col);

    const renderField = (col) => {
        const type = getInputType(col);
        const isMarginField = col === 'MARGIN';
        const isReadOnly = isMarginField;

        if (col === 'SIGNATURE') {
            return (
                <div className="signature-field">
                    <div className="signature-display">
                        {tempSignature ? (
                            <img src={tempSignature} alt="Signature" className="signature-thumbnail" />
                        ) : (
                            <span className="no-signature">No signature</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="action-btn signature-btn"
                    >
                        {tempSignature ? 'Update Signature' : 'Add Signature'}
                    </button>
                </div>
            );
        }

        const inputProps = {
            id: col,
            name: col,
            value: formData[col] === null || formData[col] === '' ? '' : formData[col], 
            onChange: isReadOnly ? undefined : handleChange,
            required: isRequired(col),
            readOnly: isReadOnly,
            className: isReadOnly ? 'readonly-field' : '',
            placeholder: col === 'JOB NO.' ? 'Enter Job/Project Number' : ''
        };

        // For JOB NO. field - always text input, readOnly only when editing
        if (col === 'JOB NO.') {
            return (
                <input 
                    {...inputProps}
                    type="text"
                />
            );
        }

        if (type === 'textarea') {
            return <textarea {...inputProps} rows="3"></textarea>;
        }

        if (type === 'number') {
            // Add onWheel handler to prevent scrolling from changing values
            return (
                <input 
                    {...inputProps} 
                    type="number" 
                    step="0.01" 
                    onWheel={(e) => e.target.blur()}
                />
            );
        }

        return <input {...inputProps} type={type} />;
    };

    return (
        <>
            <div className="modal-backdrop">
                <div className="modal-content">
                    {error && <div className="error-message">⚠️ {error}</div>}
                    <form onSubmit={handleSubmit}>
                        {columns.map(col => (
                            <div key={col} className="form-group">
                                <label htmlFor={col}>
                                    {col}{isRequired(col) && <span className="required-star">*</span>}
                                </label>
                                {renderField(col)}
                            </div>
                        ))}

                        <div className="modal-actions">
                            <button type="submit" className="action-btn primary">
                                {jobToEdit ? 'Update' : 'Save Entry'}
                            </button>
                            <button type="button" onClick={onClose} className="action-btn secondary">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {showSignaturePad && (
                <div className="modal-backdrop">
                    <div className="modal-content signature-modal">
                        <h3>Draw Signature</h3>
                        <SignatureCanvas
                            signatureData={tempSignature}
                            onSaveSignature={handleSignatureSave}
                            onClearSignature={handleClearSignature}
                        />
                        <div className="modal-actions">
                            <button
                                type="button"
                                onClick={() => setShowSignaturePad(false)}
                                className="action-btn secondary"
                            >
                                Close Without Saving
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// =========================================================
// AdminPage Component
// =========================================================
const AdminPage = ({ navigate }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [jobToEdit, setJobToEdit] = useState(null);
    
    // --- NEW LOGIC: Hash-Based Routing ---
    
    // 1. Utility to extract projectNo from the URL hash
    const getProjectNoFromHash = () => {
        // Expected hash format: #/files/212121
        const hash = window.location.hash;
        const match = hash.match(/^#\/files\/([^/]+)$/);
        return match ? match[1] : null;
    };
    
    // 2. Initialize state from the URL hash
    const [viewingProjectNo, setViewingProjectNo] = useState(getProjectNoFromHash());
    
    // 3. Effect to synchronize state with URL hash changes
    useEffect(() => {
        // Function to listen to browser back/forward buttons
        const handleHashChange = () => {
            const newProjectNo = getProjectNoFromHash();
            if (newProjectNo !== viewingProjectNo) {
                setViewingProjectNo(newProjectNo);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [viewingProjectNo]);
    
    // 4. Effect to update URL hash when state changes
    useEffect(() => {
        if (viewingProjectNo) {
            // Set hash to #/files/jobNo when viewing files
            window.location.hash = `/files/${viewingProjectNo}`;
        } else {
            // Set hash back to base path (assuming #/ is the base)
            // This happens when handleBackFromFiles is called
            if (getProjectNoFromHash()) {
                 window.location.hash = '/'; // Change this if your base route is different (e.g., '/admin')
            }
        }
        // This runs when the state changes via handleViewFiles/handleBackFromFiles
    }, [viewingProjectNo]);
    
    // ------------------------------------


    // Fetch all jobs
    const fetchJobs = async () => {
        setLoading(true);
        try {
            const data = await getAllAdminJobs();
            setJobs(data.sort((a, b) => new Date(b.dateEntry) - new Date(a.dateEntry))); 
            setError(null);
        } catch (err) {
            console.error(err);
            setError(`Failed to load job data from the server: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Only fetch jobs if not already in file view mode
    useEffect(() => {
        if (!viewingProjectNo) {
            fetchJobs();
        }
    }, [viewingProjectNo]); // Depend on viewingProjectNo to prevent fetching when in file view

    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === '') {
            return 'N/A';
        }
        
        const numValue = Number(value);
        if (isNaN(numValue)) {
            return 'N/A';
        }

        return `RM${numValue.toFixed(2)}`;
    };

    // Format date for table display
    const formatDateForDisplay = (dateString) => {
        const formatted = formatDateToYYYYMMDD(dateString);
        return formatted || 'N/A';
    };

    const formatJobData = (job) => ({
        DATE: formatDateForDisplay(job.dateEntry),
        'JOB NO.': job.jobNo || 'N/A',
        CUSTOMER: job.customerName || 'N/A',
        SALES: formatCurrency(job.salesAmount),
        SELL: formatCurrency(job.sellPrice),
        COST: formatCurrency(job.cost),
        MARGIN: formatCurrency(job.margin),
        SIGNATURE: job.signatureData,
        REMARKS: job.remarks || '-',
        signatureData: job.signatureData,
    });

    const handleSaveJob = async (payload, mode, oldJobNo = null) => {
        try {
            const processedPayload = {
                ...payload,
                Date_Entry: formatDateToYYYYMMDD(payload.Date_Entry)
            };

            let responseJob;
            
            if (mode === 'CREATE') {
                const response = await createAdminJob(processedPayload);
                responseJob = response.job || response;
                
                setJobs(prevJobs => {
                    const updatedJobs = [responseJob, ...prevJobs];
                    return updatedJobs.sort((a, b) => new Date(b.dateEntry) - new Date(a.dateEntry));
                });
                
                alert(`✅ Successfully created job ${responseJob.jobNo}`);

            } else if (mode === 'UPDATE') {
                // Always use the OLD job number in the URL for the API call
                const jobNoForUpdate = oldJobNo || processedPayload.Job_No;
                
                try {
                    const response = await updateAdminJob(jobNoForUpdate, processedPayload);
                    responseJob = response.job || response;
                    
                    // Update the jobs list - always handle as if job number might have changed
                    setJobs(prevJobs => {
                        // Remove the old entry if job number changed
                        const filteredJobs = oldJobNo && oldJobNo !== responseJob.jobNo 
                            ? prevJobs.filter(job => job.jobNo !== oldJobNo)
                            : prevJobs;
                        
                        // Add/update with new job
                        const existingIndex = filteredJobs.findIndex(job => job.jobNo === responseJob.jobNo);
                        let updatedJobs;
                        
                        if (existingIndex >= 0) {
                            // Update existing job
                            updatedJobs = filteredJobs.map(job => 
                                job.jobNo === responseJob.jobNo ? responseJob : job
                            );
                        } else {
                            // Add new job entry (job number changed to a new one)
                            updatedJobs = [responseJob, ...filteredJobs];
                        }
                        
                        return updatedJobs.sort((a, b) => new Date(b.dateEntry) - new Date(a.dateEntry));
                    });
                    
                    if (oldJobNo && oldJobNo !== responseJob.jobNo) {
                        alert(`✅ Successfully updated job ${oldJobNo} to ${responseJob.jobNo}`);
                    } else {
                        alert(`✅ Successfully updated job ${responseJob.jobNo}`);
                    }
                    
                } catch (updateErr) {
                    // If update fails with 404 (job not found), treat it as changing to a non-existent job
                    if (updateErr.message.includes('404') || (updateErr.response && updateErr.response.status === 404)) {
                        console.log(`Job ${jobNoForUpdate} not found, treating as job number change to new number ${processedPayload.Job_No}`);
                        
                        // Try to create as new job instead
                        try {
                            const createResponse = await createAdminJob(processedPayload);
                            responseJob = createResponse.job || createResponse;
                            
                            // Remove old job and add new one
                            setJobs(prevJobs => {
                                const filteredJobs = prevJobs.filter(job => job.jobNo !== oldJobNo);
                                const updatedJobs = [responseJob, ...filteredJobs];
                                return updatedJobs.sort((a, b) => new Date(b.dateEntry) - new Date(a.dateEntry));
                            });
                            
                            alert(`✅ Job number changed from ${oldJobNo} to new job ${responseJob.jobNo}`);
                            
                        } catch (createErr) {
                            throw new Error(`Failed to create new job after job number change: ${createErr.message}`);
                        }
                    } else {
                        throw updateErr;
                    }
                }
            }
            
            setError(null);
            closeModal();
            
        } catch (err) {
            console.error('API Error:', err);
            let alertMessage = 'Operation failed due to an unknown error.';
            if (err.message.includes('409') || (err.response && err.response.status === 409)) {
                alertMessage = `❌ Operation failed: Job No. ${payload.Job_No} already exists (Conflict).`;
            } else {
                alertMessage = `❌ ${mode} failed: ${err.message}`;
            }
            alert(alertMessage);
        }
    };

    const handleDeleteJob = async (jobNo) => {
        if (!window.confirm(`Are you sure you want to delete job entry ${jobNo}? This cannot be undone.`)) {
            return;
        }

        try {
            await deleteAdminJob(jobNo);
            setJobs(prevJobs => prevJobs.filter(job => job.jobNo !== jobNo));
            alert(`Job ${jobNo} successfully deleted.`);
            setError(null);
        } catch (err) {
            console.error('Delete Error:', err);
            alert(`Deletion failed: ${err.message}`);
        }
    };

    const openCreateModal = () => {
        setJobToEdit(null);
        setIsModalOpen(true);
    };
    
    const openEditModal = (job) => {
        setJobToEdit(job);
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setJobToEdit(null);
    };

    const handleViewFiles = (jobNo) => {
        setViewingProjectNo(jobNo);
    };

    const handleBackFromFiles = () => {
        setViewingProjectNo(null);
    };

    const renderSignatureCell = (signatureData) => {
        if (!signatureData) {
            return <span className="no-signature-text">No signature</span>;
        }
        
        const imgSrc = signatureData.startsWith('data:image/') 
            ? signatureData 
            : `data:image/png;base64,${signatureData}`;
        
        return (
            <div 
                className="signature-cell-tooltip"
                onClick={() => {
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                        newWindow.document.write(`
                            <html>
                                <head>
                                    <title>Signature - Job Details</title>
                                    <style>
                                        body { 
                                            display: flex; 
                                            justify-content: center; 
                                            align-items: center; 
                                            height: 100vh; 
                                            margin: 0; 
                                            background: #f5f5f5;
                                        }
                                        img { 
                                            max-width: 90vw; 
                                            max-height: 90vh; 
                                            border: 1px solid #ddd;
                                            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                                            background: white;
                                        }
                                    </style>
                                </head>
                                <body>
                                    <img src="${imgSrc}" alt="Full Signature" />
                                </body>
                            </html>
                        `);
                        newWindow.document.close();
                    }
                }}
            >
                <img 
                    src={imgSrc} 
                    alt="Signature" 
                    className="signature-table-image"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<span class="no-signature-text">Error loading</span>';
                    }}
                />
                <span className="tooltip-text">Click to view full size</span>
            </div>
        );
    };

    if (viewingProjectNo) 
    {
        return (
            <FileView 
                projectNo={viewingProjectNo}
                navigateHome={handleBackFromFiles}
            />
        );
    }

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>⚙️ Sales Administration</h1>
                <div className="project-stats">
                    <span className="stat-item">
                        📊 Total Entries: <strong>{jobs.length}</strong>
                    </span>
                </div>
            </header>

            <main className="admin-content">
                <div className="admin-section project-table-section">
                    <div className="table-header-row">
                        <h2>Sales Ledger 📈</h2>
                    </div>
                    
                    <div className="project-table-container">
                        {loading && <div className="loading-message">Loading job data...</div>}
                        {error && <div className="error-message">Error: {error}</div>}

                        {!loading && !error && (
                            <table>
                                <thead>
                                    <tr>
                                        {tableColumns.map(col => (
                                            <th key={col}>{col}</th>
                                        ))}
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.length > 0 ? (
                                        jobs.map((job) => {
                                            const key = job.jobNo; 
                                            const data = formatJobData(job);
                                            return (
                                                <tr key={key}>
                                                    {tableColumns.map(col => {
                                                        if (col === 'SIGNATURE') {
                                                            return (
                                                                <td key={`${key}-${col}`} className="signature-cell">
                                                                    {renderSignatureCell(data.signatureData)}
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td key={`${key}-${col}`}>{data[col]}</td>
                                                        );
                                                    })}
                                                    <td className="action-cell">
                                                        <button 
                                                            onClick={() => handleViewFiles(job.jobNo)}
                                                            className="table-action-btn view-btn"
                                                            title="View project files"
                                                            disabled={!job.jobNo}
                                                        >
                                                            📁 View Files
                                                        </button>
                                                        <button 
                                                            onClick={() => openEditModal(job)}
                                                            className="table-action-btn edit-btn"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteJob(job.jobNo)}
                                                            className="table-action-btn delete-btn"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={tableColumns.length + 1} className="no-data">
                                                No sales found. Use the ➕ button to start tracking!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>

            <ProjectModal 
                isOpen={isModalOpen}
                onClose={closeModal}
                columns={tableColumns}
                onSave={handleSaveJob}
                jobToEdit={jobToEdit}
            />
        </div>
    );
};

export default AdminPage;