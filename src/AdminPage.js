import React, { useState, useEffect, useRef, useMemo } from 'react';
import './AdminPage.css';
import { getAllAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob } from './apiService';
import { projectsAPI } from './apiService'; // Import the projects API

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
    
    const startDrawing = (e) => {
        if (!ctx) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    
    const draw = (e) => {
        if (!isDrawing || !ctx) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
    };
    
    const handleSave = () => {
        if (canvasRef.current) {
            // Optimize image size before saving
            const originalCanvas = canvasRef.current;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = 300;
            tempCanvas.height = 100;
            
            tempCtx.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 
                              0, 0, tempCanvas.width, tempCanvas.height);
            
            const dataUrl = tempCanvas.toDataURL('image/png');
            onSaveSignature(dataUrl);
        }
    };
    
    const handleClear = () => {
        if (canvasRef.current && ctx) {
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
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        if (e.touches.length === 1) startDrawing(e.touches[0]);
                    }}
                    onTouchMove={(e) => {
                        e.preventDefault();
                        if (e.touches.length === 1) draw(e.touches[0]);
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
// ProjectModal Component (Updated - Approval removed)
// =========================================================
const ProjectModal = ({ 
    isOpen, 
    onClose, 
    columns, 
    onSave, 
    jobToEdit,
    projectNumbers
}) => {
    
    const getInitialValue = (col) => {
        if (col === 'DATE') return getCurrentDate();
        if (col === 'JOB NO.' && projectNumbers.length > 0) return projectNumbers[0];
        return '';
    };

    const initialFormState = columns.reduce((acc, col) => ({ 
        ...acc, 
        [col]: col === 'SIGNATURE' ? null : getInitialValue(col)
    }), {});
    
    const [formData, setFormData] = useState(initialFormState);
    const [error, setError] = useState(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [tempSignature, setTempSignature] = useState(null);

    useEffect(() => {
        if (jobToEdit) {
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
            setFormData(initialFormState);
            setTempSignature(null);
        }
    }, [jobToEdit, isOpen, projectNumbers]);

    useEffect(() => {
        const sell = formData['SELL'];
        const cost = formData['COST'];
        
        const sellNum = Number(sell);
        const costNum = Number(cost);

        if (!isNaN(sellNum) && !isNaN(costNum) && sell !== '' && cost !== '') {
            const marginValue = sellNum - costNum;
            if (parseFloat(marginValue.toFixed(2)) !== formData['MARGIN']) {
                setFormData(prev => ({ 
                    ...prev, 
                    'MARGIN': parseFloat(marginValue.toFixed(2)) 
                }));
            }
        } else if (formData['MARGIN'] !== '') {
            setFormData(prev => ({ ...prev, 'MARGIN': '' }));
        }
    }, [formData['SELL'], formData['COST']]);

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

        if (formData['SELL'] === '' || formData['COST'] === '' || formData['SALES'] === '') {
            setError('Please ensure SELL, COST, and SALES amounts are entered.');
            return;
        }

        // Get customer name from selected project if available
        const selectedProjectNumber = formData['JOB NO.'];
        const customerName = formData['CUSTOMER'] || `Customer for ${selectedProjectNumber}`;

        const payload = {
            Job_No: selectedProjectNumber,
            Date_Entry: formData['DATE'],
            Customer_Name: customerName,
            Sales_Amount: formData['SALES'],
            Sell_Price: formData['SELL'],
            Cost: formData['COST'],
            Margin: formData['MARGIN'],
            Remarks: formData['REMARKS'] || null,
            Signature_Data: tempSignature,
        };

        console.log('Submitting payload with signature:', {
            ...payload,
            Signature_Data: tempSignature ? `Base64 data URL (${tempSignature.length} chars)` : 'null'
        });

        onSave(payload, jobToEdit ? 'UPDATE' : 'CREATE');
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
        const isJobNoField = col === 'JOB NO.';
        const isReadOnly = isMarginField || (isJobNoField && jobToEdit);

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
            className: isReadOnly ? 'readonly-field' : ''
        };

        if (col === 'JOB NO.') {
            return (
                <select {...inputProps}>
                    <option value="">Select a project</option>
                    {projectNumbers.map((projectNo) => (
                        <option key={projectNo} value={projectNo}>
                            {projectNo}
                        </option>
                    ))}
                </select>
            );
        }

        if (type === 'textarea') {
            return <textarea {...inputProps} rows="3"></textarea>;
        }

        if (type === 'number') {
            return <input {...inputProps} type="number" step="0.01" />;
        }

        return <input {...inputProps} type={type} />;
    };

    return (
        <>
            <div className="modal-backdrop">
                <div className="modal-content">
                    <h3>{jobToEdit ? `✍️ Edit Job ${formData['JOB NO.']}` : '➕ Create New Job Entry'}</h3>
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
                                {jobToEdit ? 'Update Entry' : 'Save Entry'}
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
// AdminPage Component (Updated - Approval removed)
// =========================================================
const AdminPage = ({ navigate }) => {
    const [jobs, setJobs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [jobToEdit, setJobToEdit] = useState(null);

    // Fetch all jobs
    const fetchJobs = async () => {
        setLoading(true);
        try {
            const data = await getAllAdminJobs();
            setJobs(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(`Failed to load job data from the server: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch all projects to get project numbers
    const fetchProjects = async () => {
        setProjectsLoading(true);
        try {
            const data = await projectsAPI.getAll();
            setProjects(data);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
            console.log('Will use existing job numbers instead');
        } finally {
            setProjectsLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        fetchProjects();
    }, []);

    // Extract unique project numbers from both sources
    const projectNumbers = useMemo(() => {
        const numbersFromProjects = projects
            .map(project => project.projectNo)
            .filter(projectNo => projectNo && projectNo.trim() !== '');
        
        const numbersFromJobs = jobs
            .map(job => job.jobNo)
            .filter(jobNo => jobNo && jobNo.trim() !== '');
        
        // Combine and deduplicate
        const allNumbers = [...numbersFromProjects, ...numbersFromJobs];
        const uniqueNumbers = [...new Set(allNumbers)].sort();
        
        return uniqueNumbers;
    }, [projects, jobs]);

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

    const handleSaveJob = async (payload, mode) => {
        try {
            // Ensure date is in YYYY-MM-DD format before sending
            const processedPayload = {
                ...payload,
                Date_Entry: formatDateToYYYYMMDD(payload.Date_Entry)
            };

            let responseData;
            
            if (mode === 'CREATE') {
                responseData = await createAdminJob(processedPayload);
                setJobs(prevJobs => [responseData, ...prevJobs].sort((a, b) => new Date(b.dateEntry) - new Date(a.dateEntry)));
                alert(`Successfully created job ${responseData.jobNo}.`);
            } else if (mode === 'UPDATE') {
                responseData = await updateAdminJob(processedPayload.Job_No, processedPayload);
                setJobs(prevJobs => prevJobs.map(job => 
                    job.jobNo === processedPayload.Job_No ? { ...job, ...responseData } : job
                ));
                alert(`Successfully updated job ${processedPayload.Job_No}.`);
            }
            
            // Refresh projects list to include any new project numbers
            if (mode === 'CREATE') {
                fetchProjects();
            }
            
            setError(null);
            closeModal();
        } catch (err) {
            console.error('API Error:', err);
            let alertMessage = 'Operation failed due to an unknown error.';
            if (err.message.includes('409')) {
                alertMessage = `Operation failed: Job No. ${payload.Job_No} already exists (Conflict).`;
            } else {
                alertMessage = `${mode} failed: ${err.message}`;
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

    const renderSignatureCell = (signatureData) => {
        if (!signatureData) {
            return <span className="no-signature-text">No signature</span>;
        }
        
        // Ensure it's a data URL
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

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>⚙️ Job/Sales Administration</h1>
                <p>Manage and monitor all sales entries in the system</p>
                <div className="project-stats">
                    <span className="stat-item">
                        📊 Total Jobs: <strong>{jobs.length}</strong>
                    </span>
                    <span className="stat-item">
                        🏗️ Projects in DB: <strong>{projectNumbers.length}</strong>
                    </span>
                </div>
            </header>

            <main className="admin-content">
                <div className="admin-section project-table-section">
                    <div className="table-header-row">
                        <h2>Sales Ledger 📈</h2>
                        <div className="header-actions">
                            {projectsLoading && (
                                <span className="loading-text">Loading projects...</span>
                            )}
                            <button 
                                className="create-icon-btn"
                                onClick={openCreateModal}
                                title="Create New Job"
                                disabled={projectNumbers.length === 0 && projectsLoading}
                            >
                                ➕ Create New Entry
                            </button>
                        </div>
                    </div>
                    
                    {projectNumbers.length === 0 && !projectsLoading && (
                        <div className="warning-banner">
                            ⚠️ No projects found in the database. Please create projects first in the main Projects page.
                        </div>
                    )}
                    
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
                                            const key = job.recordId || job.jobNo;
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
                                                No jobs found. Use the ➕ button to start tracking!
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
                projectNumbers={projectNumbers}
            />
        </div>
    );
};

export default AdminPage;