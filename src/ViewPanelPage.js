import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { viewPanelAPI, productionAPI } from '../src/apiService';
import './ViewPanelPage.css';

const generateReferenceNumber = (existingReferences = []) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const todayPrefix = `REF-${year}${month}${day}`;
    const todayRefs = existingReferences.filter(ref => ref && ref.startsWith(todayPrefix));
    
    let sequence = 1;
    if (todayRefs.length > 0) {
        const sequences = todayRefs.map(ref => {
            const match = ref.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
        });
        sequence = Math.max(...sequences) + 1;
    }
    
    return `${todayPrefix}-${String(sequence).padStart(3, '0')}`;
};

const PanelCard = ({ panel, onEdit, onDuplicate, onDelete, onToggleProduction, formatNumber, formatDecimal, formatDate, refreshPanels }) => {
    const [showProductionDetails, setShowProductionDetails] = useState(false);
    const [productionDate, setProductionDate] = useState('');
    const [numberOfPanels, setNumberOfPanels] = useState(1);
    const [productionStatus, setProductionStatus] = useState('pending');
    const [isSaving, setIsSaving] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [localSuccess, setLocalSuccess] = useState(null);
    const [productionRecords, setProductionRecords] = useState([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [editingProductionRecord, setEditingProductionRecord] = useState(null);
    const [isEditingProduction, setIsEditingProduction] = useState(false);

    const totalProducedPanels = useMemo(() => {
        return productionRecords.reduce((sum, record) => 
            sum + (parseInt(record.number_of_panels) || 0), 0
        );
    }, [productionRecords]);

    useEffect(() => {
        if (panel && panel.id) {
            setCurrentBalance(panel.balance !== undefined ? panel.balance : panel.qty || 0);
        }
    }, [panel]);

    useEffect(() => {
        if (showProductionDetails && panel && panel.id) {
            fetchProductionRecords();
        }
    }, [showProductionDetails, panel]);

    // Handle wheel event to prevent number input scrolling
    const handleWheel = (e) => {
        e.target.blur();
    };

    if (!panel || !panel.id) {
        console.error('PanelCard received invalid panel data:', panel);
        return null;
    }

    const toggleProductionView = () => {
        setShowProductionDetails(!showProductionDetails);
        setLocalError(null);
        setLocalSuccess(null);
        if (onToggleProduction) {
            onToggleProduction(panel.id, !showProductionDetails);
        }
    };

    const fetchProductionRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const data = await productionAPI.getByPanelId(panel.id);
            setProductionRecords(Array.isArray(data) ? data : []);
            
            try {
                const summary = await viewPanelAPI.getProductionSummary(panel.id);
                if (summary && summary.current_balance !== undefined) {
                    setCurrentBalance(summary.current_balance);
                }
            } catch (summaryErr) {
                console.error('Failed to fetch production summary:', summaryErr);
            }
        } catch (err) {
            console.error('Failed to fetch production records:', err);
            setLocalError('Failed to load production records');
            setProductionRecords([]);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    const handleCreateProductionRecord = async () => {
        if (!productionDate) {
            setLocalError('Please select a production date');
            return;
        }

        if (!numberOfPanels || numberOfPanels < 1) {
            setLocalError('Please enter a valid number of panels');
            return;
        }

        if (numberOfPanels > currentBalance) {
            setLocalError(`Cannot produce ${numberOfPanels} panels. Only ${currentBalance} available.`);
            return;
        }

        setIsSaving(true);
        setLocalError(null);
        setLocalSuccess(null);

        try {
            const productionRecordData = {
                date: productionDate,
                number_of_panels: numberOfPanels,
                delivery_date: productionDate,
                reference_number: panel.reference_number,
                status: productionStatus || 'pending',
                notes: `Production for job ${panel.job_no}`
            };

            const result = await viewPanelAPI.createProductionWithBalance(panel.id, productionRecordData);
            
            if (result && result.production_record) {
                setProductionRecords(prev => [result.production_record, ...prev]);
                setCurrentBalance(result.updated_balance);
            }
            
            if (refreshPanels) {
                refreshPanels();
            }
            
            setProductionDate('');
            setNumberOfPanels(1);
            setProductionStatus('pending');
            
            setLocalSuccess('Production record added successfully! Balance updated.');
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);

        } catch (err) {
            console.error('Failed to create production record:', err);
            setLocalError('Failed to add production record: ' + (err.message || 'Unknown error'));
            
            try {
                const summary = await viewPanelAPI.getProductionSummary(panel.id);
                if (summary && summary.current_balance !== undefined) {
                    setCurrentBalance(summary.current_balance);
                }
            } catch (fetchErr) {
                console.error('Failed to refresh balance:', fetchErr);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProductionRecord = async (recordId) => {
        if (!window.confirm('Are you sure you want to delete this production record? This will restore the balance.')) {
            return;
        }

        setIsSaving(true);
        setLocalError(null);

        try {
            const result = await viewPanelAPI.deleteProductionWithBalance(panel.id, recordId);
            
            setProductionRecords(prev => prev.filter(record => record.id !== recordId));
            
            if (result && result.updated_balance !== undefined) {
                setCurrentBalance(result.updated_balance);
            }
            
            if (refreshPanels) {
                refreshPanels();
            }
            
            setLocalSuccess('Production record deleted. Balance restored.');
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);
            
        } catch (err) {
            console.error('Failed to delete production record:', err);
            setLocalError('Failed to delete production record: ' + (err.message || 'Unknown error'));
            
            try {
                const summary = await viewPanelAPI.getProductionSummary(panel.id);
                if (summary && summary.current_balance !== undefined) {
                    setCurrentBalance(summary.current_balance);
                }
            } catch (fetchErr) {
                console.error('Failed to refresh balance:', fetchErr);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateProductionRecord = async (recordId, updatedData) => {
        setIsSaving(true);
        setLocalError(null);

        try {
            const updatedRecord = await productionAPI.update(panel.id, recordId, updatedData);
            
            setProductionRecords(prev => prev.map(record => 
                record.id === recordId ? updatedRecord : record
            ));
            
            setLocalSuccess('Production record updated successfully!');
            setIsEditingProduction(false);
            setEditingProductionRecord(null);
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);
            
        } catch (err) {
            console.error('Failed to update production record:', err);
            setLocalError('Failed to update production record: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateProductionStatus = async (recordId, newStatus) => {
        try {
            const updatedRecord = await productionAPI.updateStatus(recordId, { status: newStatus });
            
            setProductionRecords(prev => prev.map(record => 
                record.id === recordId ? updatedRecord : record
            ));
            
            setLocalSuccess(`Status updated to ${getStatusDisplay(newStatus)}`);
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);
        } catch (err) {
            console.error('Failed to update production status:', err);
            setLocalError('Failed to update status: ' + (err.message || 'Unknown error'));
        }
    };

    const getStatusDisplay = (status) => {
        switch(status) {
            case 'pending': return '⏳ Pending';
            case 'in_progress': return '⚙️ In Progress';
            case 'completed': return '✅ Completed';
            case 'cancelled': return '❌ Cancelled';
            case 'on_hold': return '⏸️ On Hold';
            default: return '⏳ Pending';
        }
    };

    const openEditProductionRecord = (record) => {
        setEditingProductionRecord({
            ...record,
            date: record.date ? record.date.split('T')[0] : '',
            number_of_panels: record.number_of_panels || 1,
            status: record.status || 'pending'
        });
        setIsEditingProduction(true);
        setLocalError(null);
    };

    const closeEditProductionRecord = () => {
        setEditingProductionRecord(null);
        setIsEditingProduction(false);
        setLocalError(null);
    };

    const panelQty = parseInt(panel.qty) || 0;
    const balance = currentBalance;
    const productionProgress = panelQty > 0 ? Math.min(((panelQty - balance) / panelQty) * 100, 100) : 0;
    const productionMeter = panel.production_meter || 0;

    return (
        <div className="panel-card-horizontal">
            <div className="card-header-section">
                <div className="card-title">
                    <h3>{panel.reference_number}</h3>
                    <span className={`panel-status status-${panel.status || 'pending'}`}>
                        {panel.status === 'completed' ? '✓ Completed' : 
                         panel.status === 'in_progress' ? '⟳ In Progress' : 
                         panel.status === 'pending' ? '⏳ Pending' : 'Pending'}
                    </span>
                </div>
                <div className="card-meta">
                    <span className="job-no">Job: {panel.job_no || 'N/A'}</span>
                    <span className="created-date">
                        {formatDate(panel.created_at)}
                    </span>
                </div>
                
                <div className="toggle-switch-container">
                    <button 
                        className={`toggle-view-btn ${showProductionDetails ? 'active' : ''}`}
                        onClick={toggleProductionView}
                    >
                        {showProductionDetails ? '📋 Panel Details' : '🏭 Production'}
                    </button>
                </div>
                
                <div className="card-actions">
                    <button
                        onClick={() => onEdit(panel)}
                        className="card-btn edit-btn"
                        title="Edit panel"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onDuplicate(panel)}
                        className="card-btn duplicate-btn"
                        title="Duplicate panel"
                    >
                        Duplicate
                    </button>
                    <button
                        onClick={() => onDelete(panel.id)}
                        className="card-btn delete-btn"
                        title="Delete panel"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div className="card-content-section">
                {showProductionDetails ? (
                    <div className="production-details-view">
                        {localError && (
                            <div className="alert alert-danger production-alert">
                                {localError}
                            </div>
                        )}
                        
                        {localSuccess && (
                            <div className="alert alert-success production-alert">
                                {localSuccess}
                            </div>
                        )}

                        <div className="production-horizontal-layout">
                            <div className="production-left-column">
                                <div className="card-section compact-section">
                                    <h4 className="card-section-title">Production Status</h4>
                                    <div className="balance-summary-grid compact">
                                        <div className="balance-item">
                                            <span className="balance-label">Total:</span>
                                            <span className="balance-value">{formatNumber(panelQty)}</span>
                                        </div>
                                        <div className="balance-item">
                                            <span className="balance-label">Produced:</span>
                                            <span className="balance-value">{formatNumber(totalProducedPanels)}</span>
                                        </div>
                                        <div className="balance-item highlight">
                                            <span className="balance-label">Balance:</span>
                                            <span className={`balance-value ${balance <= 0 ? 'zero-balance' : balance <= panelQty * 0.1 ? 'low-balance' : ''}`}>
                                                {formatNumber(balance)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-section compact-section">
                                    <h4 className="card-section-title">Production Records ({productionRecords.length})</h4>
                                    
                                    {isLoadingRecords ? (
                                        <div className="loading-records">
                                            <div className="loading-spinner small"></div>
                                            <p>Loading records...</p>
                                        </div>
                                    ) : productionRecords.length === 0 ? (
                                        <div className="empty-production-records">
                                            <div className="empty-icon">📅</div>
                                            <p>No production records yet.</p>
                                        </div>
                                    ) : (
                                        <div className="compact-production-records">
                                            {productionRecords.slice(0, 3).map((record) => {
                                                const recordDate = new Date(record.date);
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const isPastDue = recordDate < today;
                                                
                                                return (
                                                    <div key={record.id} className={`compact-record-item ${isPastDue ? 'past-due' : ''}`}>
                                                        <div className="record-header">
                                                            <div className="record-date">
                                                                {formatDate(record.date)}
                                                                {isPastDue && <span className="past-due-badge">!</span>}
                                                            </div>
                                                            <div className="record-main-info">
                                                                <span className="record-panels">{record.number_of_panels || 1} panels</span>
                                                            </div>
                                                        </div>
                                                        <div className="record-details">
                                                            <div className="record-status-row">
                                                                <div className="status-display-with-controls">
                                                                    <span className="current-status-badge">
                                                                        {getStatusDisplay(record.status)}
                                                                    </span>
                                                                    <select
                                                                        className="status-change-dropdown mini"
                                                                        value={record.status || 'pending'}
                                                                        onChange={(e) => handleUpdateProductionStatus(record.id, e.target.value)}
                                                                        disabled={isSaving}
                                                                        title="Change status"
                                                                    >
                                                                        <option value="pending">⏳ Pending</option>
                                                                        <option value="in_progress">⚙️ In Progress</option>
                                                                        <option value="completed">✅ Completed</option>
                                                                    </select>
                                                                    <button
                                                                        className="delete-record-btn mini"
                                                                        onClick={() => handleDeleteProductionRecord(record.id)}
                                                                        disabled={isSaving}
                                                                        title="Delete"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="production-right-column">
                                <div className="card-section compact-section">
                                    <h4 className="card-section-title">Add Production</h4>
                                    
                                    <div className="compact-form-group">
                                        <label className="compact-label">Available Balance:</label>
                                        <span className={`compact-value ${balance <= 0 ? 'zero-balance' : balance <= panelQty * 0.1 ? 'low-balance' : ''}`}>
                                            {formatNumber(balance)} panels
                                        </span>
                                    </div>
                                    
                                    <div className="compact-form-group">
                                        <label className="compact-label">Date:</label>
                                        <input 
                                            type="date" 
                                            className="compact-input"
                                            value={productionDate}
                                            onChange={(e) => {
                                                setProductionDate(e.target.value);
                                                setLocalError(null);
                                            }}
                                            disabled={isSaving || balance <= 0}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                    
                                    <div className="compact-form-group">
                                        <label className="compact-label">Panels:</label>
                                        <div className="compact-input-with-hint">
                                            <input 
                                                type="number"
                                                min="1"
                                                max={balance}
                                                step="1"
                                                className="compact-input"
                                                value={numberOfPanels}
                                                onChange={(e) => {
                                                    const value = parseInt(e.target.value) || 1;
                                                    setNumberOfPanels(Math.min(value, balance));
                                                    setLocalError(null);
                                                }}
                                                onWheel={handleWheel}
                                                disabled={isSaving || balance <= 0}
                                            />
                                            <div className="input-hint">
                                                Max: {balance}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="compact-form-group">
                                        <label className="compact-label">Status:</label>
                                        <select 
                                            className="compact-select"
                                            value={productionStatus}
                                            onChange={(e) => setProductionStatus(e.target.value)}
                                            disabled={isSaving}
                                        >
                                            <option value="pending">⏳ Pending</option>
                                            <option value="in_progress">⚙️ In Progress</option>
                                            <option value="completed">✅ Completed</option>
                                        </select>
                                    </div>
                                    
                                    <button
                                        className={`compact-button primary ${balance <= 0 ? 'disabled' : ''}`}
                                        onClick={handleCreateProductionRecord}
                                        disabled={isSaving || !productionDate || !numberOfPanels || numberOfPanels < 1 || numberOfPanels > balance || balance <= 0}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="saving-spinner"></span>
                                                Saving...
                                            </>
                                        ) : balance <= 0 ? (
                                            'No Panels Available'
                                        ) : (
                                            'Add Production'
                                        )}
                                    </button>
                                </div>

                                {productionRecords.length > 0 && (
                                    <div className="card-section compact-section">
                                        <h4 className="card-section-title">Summary</h4>
                                        <div className="compact-summary-grid">
                                            <div className="compact-summary-item">
                                                <span className="compact-summary-label">Records</span>
                                                <span className="compact-summary-value">{productionRecords.length}</span>
                                            </div>
                                            <div className="compact-summary-item">
                                                <span className="compact-summary-label">Produced</span>
                                                <span className="compact-summary-value">{formatNumber(totalProducedPanels)}</span>
                                            </div>
                                            <div className="compact-summary-item highlight">
                                                <span className="compact-summary-label">Remaining</span>
                                                <span className={`compact-summary-value ${balance <= 0 ? 'zero-balance' : ''}`}>
                                                    {formatNumber(balance)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="panel-details-horizontal-layout">
                        <div className="panel-details-column">
                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Basic Info</h4>
                                <div className="info-grid compact">
                                    <div className="info-item">
                                        <span className="info-label">Job No:</span>
                                        <span className="info-value">{panel.job_no || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Type:</span>
                                        <span className="info-value">{panel.type || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Brand:</span>
                                        <span className="info-value">{panel.brand || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Panel Thk:</span>
                                        <span className="info-value">{formatNumber(panel.panel_thk)} mm</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Joint:</span>
                                        <span className="info-value">{panel.joint || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Surface Details</h4>
                                <div className="info-grid compact">
                                    <div className="info-item">
                                        <span className="info-label">Surface Front:</span>
                                        <span className="info-value">{panel.surface_front || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Surface Back:</span>
                                        <span className="info-value">{panel.surface_back || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Surface Type:</span>
                                        <span className="info-value">{panel.surface_type || 'N/A'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Front Thk:</span>
                                        <span className="info-value">{panel.surface_front_thk || 'N/A'} mm</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Back Thk:</span>
                                        <span className="info-value">{panel.surface_back_thk || 'N/A'} mm</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="panel-details-column">
                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Production Status</h4>
                                <div className="balance-display compact">
                                    <div className="balance-item">
                                        <span className="balance-label">Total Qty:</span>
                                        <span className="balance-value">{formatNumber(panelQty)}</span>
                                    </div>
                                    <div className="balance-item highlight">
                                        <span className="balance-label">Balance:</span>
                                        <span className={`balance-value ${balance <= 0 ? 'zero-balance' : ''}`}>
                                            {formatNumber(balance)}
                                        </span>
                                    </div>
                                </div>
                                
                                {panelQty > 0 && (
                                    <div className="compact-progress">
                                        <div className="progress-label">
                                            <span>Progress:</span>
                                            <span>{productionProgress.toFixed(1)}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress"
                                                style={{ width: `${productionProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Dimensions</h4>
                                <div className="info-grid compact">
                                    <div className="info-item">
                                        <span className="info-label">Width:</span>
                                        <span className="info-value">{formatNumber(panel.width)} mm</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Length:</span>
                                        <span className="info-value">{formatNumber(panel.length)} mm</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Quantity:</span>
                                        <span className="info-value">{formatNumber(panel.qty)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Cutting:</span>
                                        <span className="info-value">{panel.cutting || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="panel-details-column">
                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Status & Sales</h4>
                                <div className="info-grid compact">
                                    <div className="info-item">
                                        <span className="info-label">Status:</span>
                                        <span className={`info-value status-badge status-${panel.status || 'pending'}`}>
                                            {panel.status === 'completed' ? 'Completed' : 
                                             panel.status === 'in_progress' ? 'In Progress' : 
                                             panel.status === 'pending' ? 'Pending' : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Salesman:</span>
                                        <span className="info-value">{panel.salesman || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-section compact-section">
                                <h4 className="card-section-title">Additional Info</h4>
                                {panel.estimated_delivery && (
                                    <div className="info-item">
                                        <span className="info-label">Est. Delivery:</span>
                                        <span className="info-value">{formatDate(panel.estimated_delivery)}</span>
                                    </div>
                                )}
                                {panel.notes && (
                                    <div className="notes-preview">
                                        <span className="info-label">Notes:</span>
                                        <span className="notes-content" title={panel.notes}>
                                            {panel.notes.length > 50 ? panel.notes.substring(0, 50) + '...' : panel.notes}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isEditingProduction && editingProductionRecord && (
                <div className="modal-overlay production-edit-modal">
                    <div className="modal-content small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Production Record</h2>
                            <button type="button" className="close-button" onClick={closeEditProductionRecord}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleUpdateProductionRecord(editingProductionRecord.id, {
                                    ...editingProductionRecord,
                                    date: editingProductionRecord.date,
                                    number_of_panels: parseInt(editingProductionRecord.number_of_panels) || 1,
                                    status: editingProductionRecord.status || 'pending'
                                });
                            }} className="production-edit-form">
                                <div className="form-group">
                                    <label htmlFor="edit_date">Date</label>
                                    <input
                                        type="date"
                                        id="edit_date"
                                        name="date"
                                        value={editingProductionRecord.date}
                                        onChange={(e) => setEditingProductionRecord(prev => ({ ...prev, date: e.target.value }))}
                                        className="form-input"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="edit_number_of_panels">Number of Panels</label>
                                    <input
                                        type="number"
                                        id="edit_number_of_panels"
                                        name="number_of_panels"
                                        min="1"
                                        max={balance + (parseInt(editingProductionRecord.number_of_panels) || 0)}
                                        value={editingProductionRecord.number_of_panels}
                                        onChange={(e) => setEditingProductionRecord(prev => ({ 
                                            ...prev, 
                                            number_of_panels: e.target.value 
                                        }))}
                                        onWheel={handleWheel}
                                        className="form-input"
                                        required
                                    />
                                    <small className="form-hint">
                                        Max: {balance + (parseInt(editingProductionRecord.number_of_panels) || 0)} panels
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="edit_status">Status</label>
                                    <select
                                        id="edit_status"
                                        name="status"
                                        value={editingProductionRecord.status}
                                        onChange={(e) => setEditingProductionRecord(prev => ({ 
                                            ...prev, 
                                            status: e.target.value 
                                        }))}
                                        className="form-input"
                                    >
                                        <option value="pending">⏳ Pending</option>
                                        <option value="in_progress">⚙️ In Progress</option>
                                        <option value="completed">✅ Completed</option>
                                    </select>
                                </div>

                                {localError && <div className="alert alert-danger">{localError}</div>}

                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={closeEditProductionRecord}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="primary-btn" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Update Record'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ViewPanelPage = () => {
    const navigate = useNavigate();
    const [panels, setPanels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newPanel, setNewPanel] = useState({
        job_no: '',
        type: '',
        panel_thk: '',
        joint: '',
        surface_front: '',
        surface_back: '',
        surface_front_thk: '',
        surface_back_thk: '',
        surface_type: '',
        width: '',
        length: '',
        qty: '',
        cutting: '',
        status: 'pending',
        production_meter: '',
        balance: '',
        salesman: '',
        brand: '',
        estimated_delivery: '',
        notes: ''
    });
    
    const [filters, setFilters] = useState({
        reference_number: '',
        job_no: '',
        type: '',
        brand: '',
        status: '',
        balance_status: '',
        search: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    // Duplicate modal states
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [selectedPanelToDuplicate, setSelectedPanelToDuplicate] = useState(null);
    const [numberOfCopies, setNumberOfCopies] = useState(1);

    useEffect(() => {
        fetchPanels();
    }, []);

    // Handle wheel event to prevent number input scrolling
    const handleWheel = (e) => {
        e.target.blur();
    };

    const fetchPanels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await viewPanelAPI.getAll();
            
            if (Array.isArray(data)) {
                const validPanels = data.filter(panel => panel && panel.id);
                const panelsWithBalance = validPanels.map(panel => ({
                    ...panel,
                    balance: panel.balance !== undefined ? panel.balance : panel.qty
                }));
                setPanels(panelsWithBalance);
            } else {
                console.error('Expected array but got:', data);
                setError('Failed to load panels. Invalid data received from server.');
                setPanels([]);
            }
        } catch (err) {
            console.error('Failed to fetch panels:', err);
            setError('Failed to load panels. Please try again. Error: ' + (err.message || 'Unknown error'));
            setPanels([]);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshPanels = async () => {
        try {
            const data = await viewPanelAPI.getAll();
            
            if (Array.isArray(data)) {
                const validPanels = data.filter(panel => panel && panel.id);
                const panelsWithBalance = validPanels.map(panel => ({
                    ...panel,
                    balance: panel.balance !== undefined ? panel.balance : panel.qty
                }));
                setPanels(panelsWithBalance);
            }
        } catch (err) {
            console.error('Failed to refresh panels:', err);
        }
    };

    // Duplicate panel functions
    const openDuplicateModal = (panel) => {
        setSelectedPanelToDuplicate(panel);
        setNumberOfCopies(1);
        setIsDuplicateModalOpen(true);
    };

    const closeDuplicateModal = () => {
        setIsDuplicateModalOpen(false);
        setSelectedPanelToDuplicate(null);
        setNumberOfCopies(1);
    };

    const handleDuplicatePanel = async (panel, count = 1) => {
        try {
            // Generate all reference numbers at once
            const existingRefs = panels.map(p => p.reference_number);
            const baseDate = new Date();
            const year = baseDate.getFullYear().toString().slice(-2);
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            const todayPrefix = `REF-${year}${month}${day}`;
            
            // Find the highest sequence number for today
            let maxSequence = 0;
            const todayRefs = existingRefs.filter(ref => ref && ref.startsWith(todayPrefix));
            if (todayRefs.length > 0) {
                const sequences = todayRefs.map(ref => {
                    const match = ref.match(/\d+$/);
                    return match ? parseInt(match[0]) : 0;
                });
                maxSequence = Math.max(...sequences);
            }
            
            // Generate reference numbers
            const referenceNumbers = [];
            for (let i = 1; i <= count; i++) {
                const sequence = maxSequence + i;
                referenceNumbers.push(`${todayPrefix}-${String(sequence).padStart(3, '0')}`);
            }
            
            // Create all copies
            const newPanels = [];
            
            for (let i = 0; i < count; i++) {
                // Create a modified job number by adding "Copy" to the original
                const originalJobNo = panel.job_no || '';
                const newJobNo = count === 1 
                    ? `${originalJobNo} (Copy)`
                    : `${originalJobNo} (Copy ${i + 1})`;
                
                // Create notes indicating this is a duplicate
                const originalNotes = panel.notes || '';
                const newNotes = originalNotes 
                    ? `${originalNotes}\n\n---\nDuplicate of ${panel.reference_number}`
                    : `Duplicate of ${panel.reference_number}`;
                
                // FIX: Format the estimated_delivery to YYYY-MM-DD
                let formattedEstimatedDelivery = null;
                if (panel.estimated_delivery) {
                    try {
                        const date = new Date(panel.estimated_delivery);
                        if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            formattedEstimatedDelivery = `${year}-${month}-${day}`;
                        }
                    } catch (error) {
                        console.error('Error formatting estimated_delivery:', error);
                        formattedEstimatedDelivery = null;
                    }
                }
                
                const panelData = {
                    job_no: newJobNo,
                    type: panel.type || null,
                    panel_thk: panel.panel_thk ? parseFloat(panel.panel_thk) : null,
                    joint: panel.joint || null,
                    surface_front: panel.surface_front || null,
                    surface_back: panel.surface_back || null,
                    surface_front_thk: panel.surface_front_thk ? parseFloat(panel.surface_front_thk) : null,
                    surface_back_thk: panel.surface_back_thk ? parseFloat(panel.surface_back_thk) : null,
                    surface_type: panel.surface_type || null,
                    width: panel.width ? parseFloat(panel.width) : 0,
                    length: panel.length ? parseFloat(panel.length) : 0,
                    qty: panel.qty ? parseInt(panel.qty) : null,
                    cutting: panel.cutting || null,
                    status: 'pending',
                    production_meter: panel.production_meter ? parseFloat(panel.production_meter) : null,
                    balance: panel.qty ? parseInt(panel.qty) : null,
                    salesman: panel.salesman || null,
                    notes: newNotes,
                    reference_number: referenceNumbers[i],
                    brand: panel.brand || null,
                    // Use the formatted date instead of the raw one
                    estimated_delivery: formattedEstimatedDelivery
                };
                
                // Remove empty string values to avoid sending '' to the backend
                Object.keys(panelData).forEach(key => {
                    if (panelData[key] === '' || panelData[key] === undefined) {
                        panelData[key] = null;
                    }
                });
                
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({
                    ...createdPanel,
                    balance: createdPanel.balance !== undefined ? createdPanel.balance : createdPanel.qty
                });
            }
            
            // Add all new panels to the beginning of the list
            setPanels(prev => [...newPanels, ...prev]);
            
            // Close the duplicate modal
            closeDuplicateModal();
            
            // Show success message
            setError(null);
            
            if (count === 1) {
                alert(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            } else {
                alert(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
            }
            
        } catch (err) {
            console.error('Failed to duplicate panel:', err);
            setError('Failed to duplicate panel: ' + (err.message || 'Unknown error'));
        }
    };

    const filteredPanels = useMemo(() => {
        let filtered = panels.filter(panel => {
            if (!panel || !panel.id) return false;
            
            if (filters.reference_number && !panel.reference_number?.toLowerCase().includes(filters.reference_number.toLowerCase())) return false;
            if (filters.job_no && !panel.job_no?.toString().toLowerCase().includes(filters.job_no.toLowerCase())) return false;
            if (filters.type && panel.type !== filters.type) return false;
            if (filters.brand && panel.brand !== filters.brand) return false;
            if (filters.status && panel.status !== filters.status) return false;
            
            if (filters.balance_status) {
                const balance = panel.balance !== undefined ? panel.balance : panel.qty;
                switch (filters.balance_status) {
                    case 'positive':
                        if (balance <= 0) return false;
                        break;
                    case 'zero':
                        if (balance !== 0) return false;
                        break;
                    case 'negative':
                        if (balance >= 0) return false;
                        break;
                    case 'low':
                        if (balance > panel.qty * 0.1) return false;
                        break;
                    default:
                        break;
                }
            }
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    (panel.reference_number?.toLowerCase().includes(searchLower)) ||
                    (panel.job_no?.toString().toLowerCase().includes(searchLower)) ||
                    (panel.type?.toLowerCase().includes(searchLower)) ||
                    (panel.brand?.toLowerCase().includes(searchLower)) ||
                    (panel.salesman?.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'balance') {
                    aValue = a.balance !== undefined ? a.balance : a.qty;
                    bValue = b.balance !== undefined ? b.balance : b.qty;
                }

                if (sortConfig.key === 'reference_number') {
                    const aNum = parseInt(aValue?.split('-').pop() || '0');
                    const bNum = parseInt(bValue?.split('-').pop() || '0');
                    aValue = aNum;
                    bValue = bNum;
                }

                if (sortConfig.key === 'job_no') {
                    const aNum = parseInt(aValue) || 0;
                    const bNum = parseInt(bValue) || 0;
                    if (aNum && bNum) {
                        aValue = aNum;
                        bValue = bNum;
                    }
                }

                if (sortConfig.key === 'width' || sortConfig.key === 'length' || 
                    sortConfig.key === 'surface_front_thk' || sortConfig.key === 'surface_back_thk' ||
                    sortConfig.key === 'panel_thk' || sortConfig.key === 'qty' || 
                    sortConfig.key === 'production_meter') {
                    aValue = parseFloat(aValue) || 0;
                    bValue = parseFloat(bValue) || 0;
                }

                if (sortConfig.key === 'created_at' || sortConfig.key === 'estimated_delivery') {
                    aValue = new Date(aValue || 0).getTime();
                    bValue = new Date(bValue || 0).getTime();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return filtered;
    }, [panels, filters, sortConfig]);

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingPanel(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };

    const handleNewPanelInputChange = (e) => {
        const { name, value } = e.target;
        setNewPanel(prev => ({ 
            ...prev, 
            [name]: value 
        }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSearchChange = (e) => {
        setFilters(prev => ({
            ...prev,
            search: e.target.value
        }));
    };

    const handleUpdatePanel = async (e) => {
        e.preventDefault();
        if (!editingPanel.job_no?.trim()) {
            setError('Job No is required');
            return;
        }
        
        if (!editingPanel.width || !editingPanel.length) {
            setError('Width and Length are required');
            return;
        }
        
        try {
            const panelToUpdate = {
                ...editingPanel,
                width: editingPanel.width ? parseFloat(editingPanel.width) : 0,
                length: editingPanel.length ? parseFloat(editingPanel.length) : 0,
                surface_front_thk: editingPanel.surface_front_thk ? parseFloat(editingPanel.surface_front_thk) : null,
                surface_back_thk: editingPanel.surface_back_thk ? parseFloat(editingPanel.surface_back_thk) : null,
                panel_thk: editingPanel.panel_thk ? parseFloat(editingPanel.panel_thk) : null,
                qty: editingPanel.qty ? parseInt(editingPanel.qty) : null,
                production_meter: editingPanel.production_meter ? parseFloat(editingPanel.production_meter) : null,
                salesman: editingPanel.salesman || null,
                notes: editingPanel.notes || null,
                balance: editingPanel.qty
            };
            
            Object.keys(panelToUpdate).forEach(key => {
                if (panelToUpdate[key] === '') {
                    panelToUpdate[key] = null;
                }
            });
            
            const updatedPanel = await viewPanelAPI.update(editingPanel.id, panelToUpdate);
            setPanels(prev => prev.map(panel => 
                panel.id === updatedPanel.id ? {
                    ...updatedPanel,
                    balance: updatedPanel.balance !== undefined ? updatedPanel.balance : updatedPanel.qty
                } : panel
            ));
            setIsEditModalOpen(false);
            setEditingPanel(null);
            setError(null);
        } catch (err) {
            console.error('Failed to update panel:', err);
            setError('Failed to update panel: ' + (err.message || 'Unknown error'));
        }
    };

    const handleCreatePanel = async (e) => {
        e.preventDefault();
        
        if (!newPanel.job_no?.trim()) {
            setError('Job No is required');
            return;
        }
        
        if (!newPanel.width || !newPanel.length) {
            setError('Width and Length are required');
            return;
        }
        
        try {
            const existingRefs = panels.map(p => p.reference_number);
            const referenceNumber = generateReferenceNumber(existingRefs);
            
            const panelData = {
                ...newPanel,
                reference_number: referenceNumber,
                width: newPanel.width ? parseFloat(newPanel.width) : 0,
                length: newPanel.length ? parseFloat(newPanel.length) : 0,
                surface_front_thk: newPanel.surface_front_thk ? parseFloat(newPanel.surface_front_thk) : null,
                surface_back_thk: newPanel.surface_back_thk ? parseFloat(newPanel.surface_back_thk) : null,
                panel_thk: newPanel.panel_thk ? parseFloat(newPanel.panel_thk) : null,
                qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                balance: newPanel.qty,
                production_meter: newPanel.production_meter ? parseFloat(newPanel.production_meter) : null,
                salesman: newPanel.salesman || null,
                notes: newPanel.notes || null,
                brand: newPanel.brand || null,
                estimated_delivery: newPanel.estimated_delivery || null
            };
            
            Object.keys(panelData).forEach(key => {
                if (panelData[key] === '') {
                    panelData[key] = null;
                }
            });
            
            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [{
                ...createdPanel,
                balance: createdPanel.balance !== undefined ? createdPanel.balance : createdPanel.qty
            }, ...prev]);
            setIsCreateModalOpen(false);
            setNewPanel({
                job_no: '',
                type: '',
                panel_thk: '',
                joint: '',
                surface_front: '',
                surface_back: '',
                surface_front_thk: '',
                surface_back_thk: '',
                surface_type: '',
                width: '',
                length: '',
                qty: '',
                cutting: '',
                status: 'pending',
                production_meter: '',
                balance: '',
                salesman: '',
                brand: '',
                estimated_delivery: '',
                notes: ''
            });
            setError(null);
        } catch (err) {
            console.error('Failed to create panel:', err);
            setError('Failed to create panel: ' + (err.message || 'Unknown error'));
        }
    };

    const handleDeletePanel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this panel? All production records will also be deleted.')) return;

        try {
            await viewPanelAPI.delete(id);
            setPanels(prev => prev.filter(panel => panel.id !== id));
        } catch (err) {
            console.error('Failed to delete panel:', err);
            setError('Failed to delete panel: ' + (err.message || 'Unknown error'));
        }
    };

    const handleToggleProduction = async (panelId, showProduction) => {
        console.log(`Panel ${panelId} production view: ${showProduction}`);
    };

    const openEditModal = (panel) => {
        setEditingPanel({ 
            ...panel,
            job_no: panel.job_no || '',
            type: panel.type || '',
            panel_thk: panel.panel_thk || '',
            joint: panel.joint || '',
            surface_front: panel.surface_front || '',
            surface_back: panel.surface_back || '',
            surface_front_thk: panel.surface_front_thk || '',
            surface_back_thk: panel.surface_back_thk || '',
            surface_type: panel.surface_type || '',
            width: panel.width || '',
            length: panel.length || '',
            qty: panel.qty || '',
            cutting: panel.cutting || '',
            status: panel.status || 'pending',
            production_meter: panel.production_meter || '',
            brand: panel.brand || '',
            estimated_delivery: panel.estimated_delivery || '',
            salesman: panel.salesman || '',
            notes: panel.notes || ''
        });
        setIsEditModalOpen(true);
        setError(null);
    };

    const openCreateModal = () => {
        setIsCreateModalOpen(true);
        setError(null);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingPanel(null);
        setError(null);
    };

    const closeCreateModal = () => {
        setIsCreateModalOpen(false);
        setNewPanel({
            job_no: '',
            type: '',
            panel_thk: '',
            joint: '',
            surface_front: '',
            surface_back: '',
            surface_front_thk: '',
            surface_back_thk: '',
            surface_type: '',
            width: '',
            length: '',
            qty: '',
            cutting: '',
            status: 'pending',
            production_meter: '',
            balance: '',
            salesman: '',
            brand: '',
            estimated_delivery: '',
            notes: ''
        });
        setError(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid date';
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined || num === '') return 'N/A';
        const number = parseFloat(num);
        if (isNaN(number)) return 'N/A';
        return number.toLocaleString('en-US');
    };

    const formatDecimal = (num) => {
        if (num === null || num === undefined || num === '') return 'N/A';
        const number = parseFloat(num);
        if (isNaN(number)) return 'N/A';
        return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

   const uniqueJobNos = useMemo(() => {
        // Convert all job numbers to strings and trim whitespace
        const jobNos = panels
            .map(panel => {
                if (panel.job_no) {
                    return String(panel.job_no).trim();
                }
                return null;
            })
            .filter(p => p);
        
        // Use Set to remove duplicates, then convert to array and sort
        const unique = [...new Set(jobNos)];
        
        return unique.sort((a, b) => {
            // Try to parse as numbers for numeric sorting
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            
            // If not both numbers, sort as strings
            return a.localeCompare(b, undefined, { numeric: true });
        });
    }, [panels]);

    const uniqueTypes = useMemo(() => {
        const types = panels.map(panel => panel.type).filter(p => p);
        return [...new Set(types)].sort();
    }, [panels]);

    const uniqueBrands = useMemo(() => {
        const brands = panels.map(panel => panel.brand).filter(p => p);
        return [...new Set(brands)].sort();
    }, [panels]);

    const uniqueStatuses = useMemo(() => {
        const statuses = panels.map(panel => panel.status).filter(p => p);
        return [...new Set(statuses)].sort();
    }, [panels]);

    const uniqueSalesmen = useMemo(() => {
        const salesmen = panels.map(panel => panel.salesman).filter(p => p);
        return [...new Set(salesmen)].sort();
    }, [panels]);

    const stats = useMemo(() => {
        const totalPanels = panels.length;
        const totalQty = panels.reduce((sum, panel) => sum + (parseInt(panel.qty) || 0), 0);
        const totalProduced = panels.reduce((sum, panel) => {
            const panelQty = parseInt(panel.qty) || 0;
            const balance = panel.balance !== undefined ? panel.balance : panel.qty;
            return sum + (panelQty - balance);
        }, 0);
        const totalBalance = panels.reduce((sum, panel) => {
            const balance = panel.balance !== undefined ? panel.balance : panel.qty;
            return sum + (parseInt(balance) || 0);
        }, 0);
        const totalProductionMeter = panels.reduce((sum, panel) => sum + (parseFloat(panel.production_meter) || 0), 0);
        
        const statusCounts = {};
        panels.forEach(panel => {
            const status = panel.status || 'pending';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        const salesmanCounts = {};
        panels.forEach(panel => {
            const salesman = panel.salesman || 'Not Assigned';
            salesmanCounts[salesman] = (salesmanCounts[salesman] || 0) + 1;
        });
        
        const balanceStats = {
            positive: 0,
            zero: 0,
            negative: 0,
            low: 0
        };
        
        panels.forEach(panel => {
            const panelQty = parseInt(panel.qty) || 0;
            const balance = panel.balance !== undefined ? panel.balance : panel.qty;
            
            if (balance > 0) {
                balanceStats.positive++;
                if (balance <= panelQty * 0.1) {
                    balanceStats.low++;
                }
            } else if (balance === 0) {
                balanceStats.zero++;
            } else {
                balanceStats.negative++;
            }
        });

        return {
            totalPanels,
            totalQty,
            totalProduced,
            totalBalance,
            totalProductionMeter,
            statusCounts,
            salesmanCounts,
            balanceStats
        };
    }, [panels]);

    return (
        <div className="view-panel-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate(0)}>
                        ← Back
                    </button>
                    <h1 className="header-title">Panel Management System</h1>
                </div>
                <div className="header-right">
                    <button className="create-panel-btn" onClick={openCreateModal}>
                        + Create New Panel
                    </button>
                </div>
            </header>

            <div className="filters-section">
                <div className="filter-row">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search panels..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>
                    <div className="filter-group">
                        <select 
                            name="job_no" 
                            value={filters.job_no} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Job Numbers</option>
                            {uniqueJobNos.map(jobNo => (
                                <option key={jobNo} value={jobNo}>{jobNo}</option>
                            ))}
                        </select>

                        <select 
                            name="type" 
                            value={filters.type} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Types</option>
                            {uniqueTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <select 
                            name="brand" 
                            value={filters.brand} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Brands</option>
                            {uniqueBrands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>

                        <select 
                            name="salesman" 
                            value={filters.salesman} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Salesmen</option>
                            {uniqueSalesmen.map(salesman => (
                                <option key={salesman} value={salesman}>{salesman}</option>
                            ))}
                        </select>

                        <select 
                            name="status" 
                            value={filters.status} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="stats-cards">
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <h3>Total Panels</h3>
                        <p className="stat-value">{stats.totalPanels}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📦</div>
                    <div className="stat-content">
                        <h3>Total Quantity</h3>
                        <p className="stat-value">{formatNumber(stats.totalQty)}</p>
                    </div>
                </div>
            </div>

            <div className="panels-display-container">
                {error && <div className="alert alert-danger">{error}</div>}

                {isLoading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading panels...</p>
                    </div>
                ) : filteredPanels.length === 0 && panels.length > 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <h3>No panels match your filters</h3>
                        <p>Try adjusting your search criteria</p>
                    </div>
                ) : filteredPanels.length === 0 && panels.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <h3>No panels available</h3>
                        <p>Start by adding your first panel</p>
                    </div>
                ) : (
                    <>
                        <div className="cards-header">
                            <h3>Panels ({filteredPanels.length} of {panels.length})</h3>
                            <div className="sort-controls">
                                <select 
                                    value={sortConfig.key}
                                    onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value }))}
                                    className="form-select"
                                >
                                    <option value="created_at">Date Created</option>
                                    <option value="reference_number">Reference Number</option>
                                    <option value="job_no">Job Number</option>
                                    <option value="type">Type</option>
                                    <option value="brand">Brand</option>
                                    <option value="salesman">Salesman</option>
                                    <option value="qty">Quantity</option>
                                    <option value="balance">Balance</option>
                                    <option value="status">Status</option>
                                    <option value="production_meter">Production Meter</option>
                                </select>
                                <button 
                                    className="sort-direction-btn"
                                    onClick={() => setSortConfig(prev => ({ 
                                        ...prev, 
                                        direction: prev.direction === 'asc' ? 'desc' : 'asc' 
                                    }))}
                                >
                                    {sortConfig.direction === 'asc' ? '↑ Asc' : '↓ Desc'}
                                </button>
                            </div>
                        </div>
                        <div className="panels-grid-horizontal">
                            {filteredPanels
                                .filter(panel => panel && panel.id)
                                .map(panel => (
                                <PanelCard
                                    key={panel.id}
                                    panel={panel}
                                    onEdit={openEditModal}
                                    onDuplicate={openDuplicateModal}
                                    onDelete={handleDeletePanel}
                                    onToggleProduction={handleToggleProduction}
                                    formatNumber={formatNumber}
                                    formatDecimal={formatDecimal}
                                    formatDate={formatDate}
                                    refreshPanels={refreshPanels}
                                />
                            ))}
                        </div>
                    </>
                )}

                {filteredPanels.length > 0 && (
                    <div className="display-footer">
                        <div className="display-summary">
                            Showing {filteredPanels.length} of {panels.length} panels
                            {filters.search && ` matching "${filters.search}"`}
                            {filters.status && ` with status: ${filters.status}`}
                            {filters.balance_status && ` with ${filters.balance_status} balance`}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal-content wide-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Panel</h2>
                            <button type="button" className="close-button" onClick={closeCreateModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreatePanel} className="panel-form horizontal-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="job_no">Job No *</label>
                                        <input
                                            type="text"
                                            id="job_no"
                                            name="job_no"
                                            value={newPanel.job_no}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="type">Type</label>
                                        <input
                                            type="text"
                                            id="type"
                                            name="type"
                                            value={newPanel.type}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="panel_thk">Panel Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="panel_thk"
                                            name="panel_thk"
                                            value={newPanel.panel_thk}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="joint">Joint</label>
                                        <input
                                            type="text"
                                            id="joint"
                                            name="joint"
                                            value={newPanel.joint}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="surface_front">Surface Front</label>
                                        <input
                                            type="text"
                                            id="surface_front"
                                            name="surface_front"
                                            value={newPanel.surface_front}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="surface_back">Surface Back</label>
                                        <input
                                            type="text"
                                            id="surface_back"
                                            name="surface_back"
                                            value={newPanel.surface_back}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="surface_front_thk">Front Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="surface_front_thk"
                                            name="surface_front_thk"
                                            value={newPanel.surface_front_thk}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="surface_back_thk">Back Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="surface_back_thk"
                                            name="surface_back_thk"
                                            value={newPanel.surface_back_thk}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="surface_type">Surface Type</label>
                                        <input
                                            type="text"
                                            id="surface_type"
                                            name="surface_type"
                                            value={newPanel.surface_type}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="width">Width (mm) *</label>
                                        <input
                                            type="number"
                                            id="width"
                                            name="width"
                                            value={newPanel.width}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="length">Length (mm) *</label>
                                        <input
                                            type="number"
                                            id="length"
                                            name="length"
                                            value={newPanel.length}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="qty">Quantity</label>
                                        <input
                                            type="number"
                                            id="qty"
                                            name="qty"
                                            value={newPanel.qty}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="cutting">Cutting</label>
                                        <input
                                            type="text"
                                            id="cutting"
                                            name="cutting"
                                            value={newPanel.cutting}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="status">Status</label>
                                        <select
                                            id="status"
                                            name="status"
                                            value={newPanel.status}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="production_meter">Production Meter (m)</label>
                                        <input
                                            type="number"
                                            id="production_meter"
                                            name="production_meter"
                                            value={newPanel.production_meter}
                                            onChange={handleNewPanelInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="salesman">Salesman</label>
                                        <input
                                            type="text"
                                            id="salesman"
                                            name="salesman"
                                            value={newPanel.salesman}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="brand">Brand</label>
                                        <input
                                            type="text"
                                            id="brand"
                                            name="brand"
                                            value={newPanel.brand}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="estimated_delivery">Est. Delivery</label>
                                        <input
                                            type="date"
                                            id="estimated_delivery"
                                            name="estimated_delivery"
                                            value={newPanel.estimated_delivery}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group full-width">
                                        <label htmlFor="notes">Notes</label>
                                        <textarea
                                            id="notes"
                                            name="notes"
                                            value={newPanel.notes}
                                            onChange={handleNewPanelInputChange}
                                            className="form-input"
                                            rows="3"
                                        />
                                    </div>
                                </div>

                                {error && <div className="alert alert-danger">{error}</div>}
                                
                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={closeCreateModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="primary-btn">
                                        Create Panel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingPanel && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content wide-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Panel: {editingPanel.reference_number}</h2>
                            <button type="button" className="close-button" onClick={closeEditModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleUpdatePanel} className="panel-form horizontal-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_job_no">Job No *</label>
                                        <input
                                            type="text"
                                            id="edit_job_no"
                                            name="job_no"
                                            value={editingPanel.job_no}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_type">Type</label>
                                        <input
                                            type="text"
                                            id="edit_type"
                                            name="type"
                                            value={editingPanel.type}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_panel_thk">Panel Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="edit_panel_thk"
                                            name="panel_thk"
                                            value={editingPanel.panel_thk}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_joint">Joint</label>
                                        <input
                                            type="text"
                                            id="edit_joint"
                                            name="joint"
                                            value={editingPanel.joint}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_front">Surface Front</label>
                                        <input
                                            type="text"
                                            id="edit_surface_front"
                                            name="surface_front"
                                            value={editingPanel.surface_front}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_back">Surface Back</label>
                                        <input
                                            type="text"
                                            id="edit_surface_back"
                                            name="surface_back"
                                            value={editingPanel.surface_back}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_front_thk">Front Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="edit_surface_front_thk"
                                            name="surface_front_thk"
                                            value={editingPanel.surface_front_thk}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_back_thk">Back Thickness (mm)</label>
                                        <input
                                            type="number"
                                            id="edit_surface_back_thk"
                                            name="surface_back_thk"
                                            value={editingPanel.surface_back_thk}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_type">Surface Type</label>
                                        <input
                                            type="text"
                                            id="edit_surface_type"
                                            name="surface_type"
                                            value={editingPanel.surface_type}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_width">Width (mm) *</label>
                                        <input
                                            type="number"
                                            id="edit_width"
                                            name="width"
                                            value={editingPanel.width}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_length">Length (mm) *</label>
                                        <input
                                            type="number"
                                            id="edit_length"
                                            name="length"
                                            value={editingPanel.length}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_qty">Quantity</label>
                                        <input
                                            type="number"
                                            id="edit_qty"
                                            name="qty"
                                            value={editingPanel.qty}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_cutting">Cutting</label>
                                        <input
                                            type="text"
                                            id="edit_cutting"
                                            name="cutting"
                                            value={editingPanel.cutting}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_status">Status</label>
                                        <select
                                            id="edit_status"
                                            name="status"
                                            value={editingPanel.status}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_production_meter">Production Meter (m)</label>
                                        <input
                                            type="number"
                                            id="edit_production_meter"
                                            name="production_meter"
                                            value={editingPanel.production_meter}
                                            onChange={handleEditInputChange}
                                            onWheel={handleWheel}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_salesman">Salesman</label>
                                        <input
                                            type="text"
                                            id="edit_salesman"
                                            name="salesman"
                                            value={editingPanel.salesman}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_brand">Brand</label>
                                        <input
                                            type="text"
                                            id="edit_brand"
                                            name="brand"
                                            value={editingPanel.brand}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_estimated_delivery">Est. Delivery</label>
                                        <input
                                            type="date"
                                            id="edit_estimated_delivery"
                                            name="estimated_delivery"
                                            value={editingPanel.estimated_delivery}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group full-width">
                                        <label htmlFor="edit_notes">Notes</label>
                                        <textarea
                                            id="edit_notes"
                                            name="notes"
                                            value={editingPanel.notes}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                            rows="3"
                                        />
                                    </div>
                                </div>

                                {error && <div className="alert alert-danger">{error}</div>}
                                
                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={closeEditModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="primary-btn">
                                        Update Panel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Modal */}
            {isDuplicateModalOpen && selectedPanelToDuplicate && (
                <div className="modal-overlay" onClick={closeDuplicateModal}>
                    <div className="modal-content small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Duplicate Panel</h2>
                            <button type="button" className="close-button" onClick={closeDuplicateModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="duplicate-modal-content">
                                <p>How many copies of panel <strong>{selectedPanelToDuplicate.reference_number}</strong> would you like to create?</p>
                                
                                <div className="form-group">
                                    <label htmlFor="copyCount">Number of copies:</label>
                                    <div className="input-with-validation">
                                        <input
                                            type="number"
                                            id="copyCount"
                                            min="1"
                                            max="100"
                                            value={numberOfCopies}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                
                                                // Allow user to delete (empty) and type
                                                if (value === '') {
                                                    setNumberOfCopies('');
                                                } else {
                                                    const numValue = parseInt(value);
                                                    
                                                    // Validate input
                                                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                                                        setNumberOfCopies(numValue);
                                                    }
                                                    // If invalid (like 0 or negative), don't update state
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                // Auto-correct on blur
                                                if (value === '' || parseInt(value) < 1 || isNaN(parseInt(value))) {
                                                    setNumberOfCopies(1);
                                                } else if (parseInt(value) > 100) {
                                                    setNumberOfCopies(100);
                                                }
                                            }}
                                            className="form-input"
                                            onWheel={handleWheel}
                                            placeholder="Enter number"
                                        />
                                        <div className="input-actions">
                                            <button 
                                                type="button" 
                                                className="input-action-btn"
                                                onClick={() => setNumberOfCopies(Math.max(1, numberOfCopies - 1))}
                                                disabled={numberOfCopies <= 1}
                                            >
                                                −
                                            </button>
                                            <button 
                                                type="button" 
                                                className="input-action-btn"
                                                onClick={() => setNumberOfCopies(Math.min(100, (numberOfCopies || 0) + 1))}
                                                disabled={numberOfCopies >= 100}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="validation-hint">
                                        <span className={`hint-text ${(!numberOfCopies || numberOfCopies < 1) ? 'error' : ''}`}>
                                            {(!numberOfCopies || numberOfCopies < 1) ? 'Minimum 1 copy required' : 'Enter 1 to 100'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="duplicate-info">
                                    <p><strong>Note:</strong> Duplicated panels will have:</p>
                                    <ul>
                                        <li>New reference numbers</li>
                                        <li>Job No will have "(Copy)" appended</li>
                                        <li>Notes will indicate it's a duplicate</li>
                                        <li>Pending status</li>
                                        <li>Balance reset to original quantity</li>
                                    </ul>
                                </div>
                                
                                {error && <div className="alert alert-danger">{error}</div>}
                                
                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={closeDuplicateModal}>
                                        Cancel
                                    </button>
                                    <button 
                                        type="button" 
                                        className="primary-btn"
                                        onClick={() => {
                                            let count = numberOfCopies;
                                            if (count === '' || count < 1 || isNaN(count)) {
                                                count = 1;
                                            }
                                            handleDuplicatePanel(selectedPanelToDuplicate, count);
                                        }}
                                        disabled={!numberOfCopies || numberOfCopies < 1}
                                    >
                                        Create {numberOfCopies >= 1 ? numberOfCopies : 1} {numberOfCopies >= 1 ? (numberOfCopies === 1 ? 'Copy' : 'Copies') : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewPanelPage;