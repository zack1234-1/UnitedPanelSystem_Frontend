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

const ProductionDetailsModal = ({ panel, onClose, updatePanelBalance, formatNumber, formatDate }) => {
    const [productionDate, setProductionDate] = useState('');
    const [numberOfPanels, setNumberOfPanels] = useState(1);
    const [productionStatus, setProductionStatus] = useState('pending');
    const [isSaving, setIsSaving] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [localSuccess, setLocalSuccess] = useState(null);
    const [productionRecords, setProductionRecords] = useState([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(true);
    const [currentPanel, setCurrentPanel] = useState(panel);

    const balance = currentPanel.balance !== undefined ? currentPanel.balance : currentPanel.qty || 0;
    const panelQty = parseInt(currentPanel.qty) || 0;
    const panelLength = parseFloat(currentPanel.length) || 0;

    const totalProducedPanels = useMemo(() => {
        return productionRecords.reduce((sum, record) => 
            sum + (parseInt(record.number_of_panels) || 0), 0
        );
    }, [productionRecords]);

    const totalProductionLength = useMemo(() => {
        return (totalProducedPanels * panelLength) / 1000;
    }, [totalProducedPanels, panelLength]);

    useEffect(() => {
        fetchProductionRecords();
        fetchCurrentPanelData();
    }, [panel.id]);

    const fetchCurrentPanelData = async () => {
        try {
            const data = await viewPanelAPI.getById(panel.id);
            if (data) {
                setCurrentPanel({
                    ...data,
                    balance: data.balance !== undefined ? data.balance : data.qty
                });
            }
        } catch (err) {
            console.error('Failed to fetch panel data:', err);
        }
    };

    const handleWheel = (e) => {
        e.target.blur();
    };

    const fetchProductionRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const data = await productionAPI.getByPanelId(panel.id);
            setProductionRecords(Array.isArray(data) ? data : []);
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

        if (balance <= 0) {
            setLocalError('No panels available for production');
            return;
        }

        if (numberOfPanels > balance) {
            setLocalError(`Cannot produce ${numberOfPanels} panels. Only ${balance} available.`);
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
                reference_number: currentPanel.reference_number,
                status: productionStatus || 'pending',
                notes: `Production for job ${currentPanel.job_no}`
            };

            const result = await viewPanelAPI.createProductionWithBalance(panel.id, productionRecordData);
            
            if (result && result.production_record) {
                setProductionRecords(prev => [result.production_record, ...prev]);
                
                if (updatePanelBalance && result.updated_balance !== undefined) {
                    updatePanelBalance(panel.id, result.updated_balance);
                }
                
                setCurrentPanel(prev => ({
                    ...prev,
                    balance: result.updated_balance !== undefined ? result.updated_balance : prev.balance
                }));
                
                setProductionDate('');
                setProductionStatus('pending');
                
                const newBalance = result.updated_balance || balance - numberOfPanels;
                if (newBalance > 0) {
                    setNumberOfPanels(Math.min(1, newBalance));
                } else {
                    setNumberOfPanels(0);
                }
                
                setLocalSuccess('Production record added successfully! Balance updated.');
                
                setTimeout(() => {
                    setLocalSuccess(null);
                }, 3000);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (err) {
            console.error('Failed to create production record:', err);
            setLocalError('Failed to add production record: ' + (err.message || 'Unknown error'));
            fetchProductionRecords();
            fetchCurrentPanelData();
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
            
            if (updatePanelBalance && result.updated_balance !== undefined) {
                updatePanelBalance(panel.id, result.updated_balance);
            }
            
            setCurrentPanel(prev => ({
                ...prev,
                balance: result.updated_balance !== undefined ? result.updated_balance : prev.balance
            }));
            
            const newBalance = result.updated_balance || balance + numberOfPanels;
            if (newBalance > 0) {
                setNumberOfPanels(Math.min(1, newBalance));
            }
            
            setLocalSuccess('Production record deleted. Balance restored.');
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);
            
        } catch (err) {
            console.error('Failed to delete production record:', err);
            setLocalError('Failed to delete production record: ' + (err.message || 'Unknown error'));
            fetchProductionRecords();
            fetchCurrentPanelData();
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

    const calculateRecordLength = (record) => {
        const panels = parseInt(record.number_of_panels) || 0;
        return ((panels * panelLength) / 1000).toFixed(2);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Production Management: {currentPanel.reference_number}</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        ×
                    </button>
                </div>
                
                <div className="modal-body">
                    {localError && (
                        <div className="alert alert-danger">
                            {localError}
                        </div>
                    )}
                    
                    {localSuccess && (
                        <div className="alert alert-success">
                            {localSuccess}
                        </div>
                    )}

                    <div className="production-modal-content">
                        <div className="production-stats-summary">
                            <div className="stat-box">
                                <span className="stat-label">Total Quantity</span>
                                <span className="stat-value">{formatNumber(panelQty)}</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-label">Already Produced</span>
                                <span className="stat-value">{formatNumber(totalProducedPanels)}</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-label">Production Length</span>
                                <span className="stat-value">
                                    {totalProductionLength.toFixed(2)} m
                                </span>
                                <div className="stat-hint">
                                    ({totalProducedPanels} × {formatNumber(panelLength)} mm ÷ 1000)
                                </div>
                            </div>
                            <div className="stat-box highlight">
                                <span className="stat-label">Available Balance</span>
                                <span className={`stat-value ${balance <= 0 ? 'zero-balance' : ''}`}>
                                    {formatNumber(balance)}
                                </span>
                            </div>
                        </div>

                        <div className="production-form-section">
                            <h3>Add Production Record</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Production Date *</label>
                                    <input 
                                        type="date" 
                                        className="form-input"
                                        value={productionDate}
                                        onChange={(e) => {
                                            setProductionDate(e.target.value);
                                            setLocalError(null);
                                        }}
                                        disabled={isSaving || balance <= 0}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Number of Panels *</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        max={balance}
                                        step="1"
                                        className="form-input"
                                        value={numberOfPanels}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setNumberOfPanels('');
                                            } else {
                                                const numValue = parseInt(value);
                                                if (!isNaN(numValue) && numValue >= 1) {
                                                    if (balance > 0 && numValue > balance) {
                                                        setNumberOfPanels(balance);
                                                    } else {
                                                        setNumberOfPanels(numValue);
                                                    }
                                                }
                                            }
                                            setLocalError(null);
                                        }}
                                        onBlur={(e) => {
                                            if (numberOfPanels === '' || parseInt(numberOfPanels) < 1 || isNaN(parseInt(numberOfPanels))) {
                                                setNumberOfPanels(Math.min(1, balance));
                                            }
                                        }}
                                        onWheel={handleWheel}
                                        disabled={isSaving || balance <= 0}
                                    />
                                    {balance > 0 && (
                                        <div className="form-hint">Max: {balance} panels available</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Production Length</label>
                                    <div className="calculated-length">
                                        <span className="length-value">
                                            {((numberOfPanels || 0) * panelLength / 1000).toFixed(2)} m
                                        </span>
                                        <div className="length-formula">
                                            ({numberOfPanels || 0} × {formatNumber(panelLength)} mm ÷ 1000)
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        className="form-input"
                                        value={productionStatus}
                                        onChange={(e) => setProductionStatus(e.target.value)}
                                        disabled={isSaving}
                                    >
                                        <option value="pending">⏳ Pending</option>
                                        <option value="in_progress">⚙️ In Progress</option>
                                        <option value="completed">✅ Completed</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <button
                                        className={`btn btn-primary full-width ${balance <= 0 ? 'disabled' : ''}`}
                                        onClick={handleCreateProductionRecord}
                                        disabled={isSaving || !productionDate || !numberOfPanels || parseInt(numberOfPanels) < 1 || parseInt(numberOfPanels) > balance || balance <= 0}
                                    >
                                        {isSaving ? 'Saving...' : 'Add Production Record'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="production-records-section">
                            <h3>Production Records ({productionRecords.length})</h3>
                            
                            {isLoadingRecords ? (
                                <div className="loading-state">
                                    <div className="loading-spinner"></div>
                                    <p>Loading records...</p>
                                </div>
                            ) : productionRecords.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">📅</div>
                                    <p>No production records yet.</p>
                                </div>
                            ) : (
                                <div className="records-table-container">
                                    <table className="records-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Panels</th>
                                                <th>Length</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productionRecords.map((record) => {
                                                const recordDate = new Date(record.date);
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const isPastDue = recordDate < today;
                                                const recordLength = calculateRecordLength(record);
                                                
                                                return (
                                                    <tr key={record.id} className={isPastDue ? 'past-due' : ''}>
                                                        <td>
                                                            {formatDate(record.date)}
                                                            {isPastDue && <span className="past-due-badge">!</span>}
                                                        </td>
                                                        <td>{record.number_of_panels || 1}</td>
                                                        <td className="record-length-cell">
                                                            <span className="length-value">{recordLength} m</span>
                                                            <div className="length-detail">
                                                                {record.number_of_panels || 1} × {formatNumber(panelLength)} mm ÷ 1000
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="status-dropdown"
                                                                value={record.status || 'pending'}
                                                                onChange={(e) => handleUpdateProductionStatus(record.id, e.target.value)}
                                                                disabled={isSaving}
                                                            >
                                                                <option value="pending">⏳ Pending</option>
                                                                <option value="in_progress">⚙️ In Progress</option>
                                                                <option value="completed">✅ Completed</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => handleDeleteProductionRecord(record.id)}
                                                                disabled={isSaving}
                                                                title="Delete"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="records-total">
                                                <td colSpan="2">
                                                    <strong>Total:</strong>
                                                </td>
                                                <td className="total-length">
                                                    <strong>{totalProductionLength.toFixed(2)} m</strong>
                                                    <div className="total-detail">
                                                        {totalProducedPanels} panels × {formatNumber(panelLength)} mm ÷ 1000
                                                    </div>
                                                </td>
                                                <td colSpan="2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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
        search: '',
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
        cutting: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [selectedPanelToDuplicate, setSelectedPanelToDuplicate] = useState(null);
    const [numberOfCopies, setNumberOfCopies] = useState(1);
    const [selectedPanelForProduction, setSelectedPanelForProduction] = useState(null);

    useEffect(() => {
        fetchPanels();
    }, []);

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
                    balance: panel.balance !== undefined ? panel.balance : (panel.qty || 0)
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

    const updatePanelBalance = (panelId, newBalance) => {
        setPanels(prev => prev.map(panel => 
            panel.id === panelId ? { 
                ...panel, 
                balance: Math.max(0, newBalance)
            } : panel
        ));
    };

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
            const existingRefs = panels.map(p => p.reference_number);
            const baseDate = new Date();
            const year = baseDate.getFullYear().toString().slice(-2);
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            const todayPrefix = `REF-${year}${month}${day}`;
            
            let maxSequence = 0;
            const todayRefs = existingRefs.filter(ref => ref && ref.startsWith(todayPrefix));
            if (todayRefs.length > 0) {
                const sequences = todayRefs.map(ref => {
                    const match = ref.match(/\d+$/);
                    return match ? parseInt(match[0]) : 0;
                });
                maxSequence = Math.max(...sequences);
            }
            
            const referenceNumbers = [];
            for (let i = 1; i <= count; i++) {
                const sequence = maxSequence + i;
                referenceNumbers.push(`${todayPrefix}-${String(sequence).padStart(3, '0')}`);
            }
            
            const newPanels = [];
            
            for (let i = 0; i < count; i++) {
                const originalJobNo = panel.job_no || '';
                const newJobNo = count === 1 
                    ? `${originalJobNo} (Copy)`
                    : `${originalJobNo} (Copy ${i + 1})`;
                
                const originalNotes = panel.notes || '';
                const newNotes = originalNotes 
                    ? `${originalNotes}\n\n---\nDuplicate of ${panel.reference_number}`
                    : `Duplicate of ${panel.reference_number}`;
                
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
                    estimated_delivery: formattedEstimatedDelivery
                };
                
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
            
            setPanels(prev => [...newPanels, ...prev]);
            closeDuplicateModal();
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
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const searchFields = [
                    panel.reference_number,
                    panel.job_no?.toString(),
                    panel.type,
                    panel.brand,
                    panel.salesman,
                    panel.joint,
                    panel.surface_front,
                    panel.surface_back,
                    panel.surface_type,
                    panel.cutting
                ];
                
                if (!searchFields.some(field => 
                    field && field.toString().toLowerCase().includes(searchLower)
                )) return false;
            }
            
            if (filters.reference_number && !panel.reference_number?.toLowerCase().includes(filters.reference_number.toLowerCase())) return false;
            if (filters.job_no && !panel.job_no?.toString().toLowerCase().includes(filters.job_no.toLowerCase())) return false;
            if (filters.type && panel.type !== filters.type) return false;
            if (filters.brand && panel.brand !== filters.brand) return false;
            if (filters.status && panel.status !== filters.status) return false;
            if (filters.panel_thk && panel.panel_thk !== filters.panel_thk) return false;
            if (filters.joint && panel.joint !== filters.joint) return false;
            if (filters.surface_front && panel.surface_front !== filters.surface_front) return false;
            if (filters.surface_back && panel.surface_back !== filters.surface_back) return false;
            if (filters.surface_front_thk && panel.surface_front_thk !== filters.surface_front_thk) return false;
            if (filters.surface_back_thk && panel.surface_back_thk !== filters.surface_back_thk) return false;
            if (filters.surface_type && panel.surface_type !== filters.surface_type) return false;
            if (filters.cutting && panel.cutting !== filters.cutting) return false;
            
            if (filters.width) {
                const panelWidth = parseFloat(panel.width) || 0;
                const filterWidth = parseFloat(filters.width);
                if (panelWidth !== filterWidth) return false;
            }
            
            if (filters.length) {
                const panelLength = parseFloat(panel.length) || 0;
                const filterLength = parseFloat(filters.length);
                if (panelLength !== filterLength) return false;
            }
            
            if (filters.qty) {
                const panelQty = parseInt(panel.qty) || 0;
                const filterQty = parseInt(filters.qty);
                if (panelQty !== filterQty) return false;
            }
            
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
                balance: editingPanel.qty ? parseInt(editingPanel.qty) : null
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
                balance: newPanel.qty ? parseInt(newPanel.qty) : null,
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

    const openProductionModal = (panel) => {
        setSelectedPanelForProduction(panel);
    };

    const closeProductionModal = () => {
        setSelectedPanelForProduction(null);
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

    const uniqueValues = useMemo(() => {
        const getUnique = (key, isNumeric = false) => {
            const values = panels
                .map(panel => {
                    const value = panel[key];
                    if (value === null || value === undefined || value === '') return null;
                    
                    if (isNumeric) {
                        const numValue = parseFloat(value);
                        return isNaN(numValue) ? null : numValue.toString();
                    }
                    
                    return value.toString().trim();
                })
                .filter(p => p);
            
            const unique = [...new Set(values)];
            
            if (isNumeric) {
                return unique.sort((a, b) => parseFloat(a) - parseFloat(b));
            }
            
            return unique.sort();
        };

        return {
            jobNos: getUnique('job_no'),
            types: getUnique('type'),
            brands: getUnique('brand'),
            statuses: getUnique('status'),
            salesmen: getUnique('salesman'),
            panelThks: getUnique('panel_thk', true),
            joints: getUnique('joint'),
            surfaceFronts: getUnique('surface_front'),
            surfaceBacks: getUnique('surface_back'),
            surfaceFrontThks: getUnique('surface_front_thk', true),
            surfaceBackThks: getUnique('surface_back_thk', true),
            surfaceTypes: getUnique('surface_type'),
            widths: getUnique('width', true),
            lengths: getUnique('length', true),
            qtys: getUnique('qty', true),
            cuttings: getUnique('cutting')
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
                            placeholder="Search all fields..."
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
                            {uniqueValues.jobNos.map(jobNo => (
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
                            {uniqueValues.types.map(type => (
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
                            {uniqueValues.brands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>

                        <select 
                            name="status" 
                            value={filters.status} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Status</option>
                            {uniqueValues.statuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="filter-row second-row">
                    <div className="filter-group">
                        <select 
                            name="panel_thk" 
                            value={filters.panel_thk} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Panel Thickness</option>
                            {uniqueValues.panelThks.map(thk => (
                                <option key={thk} value={thk}>{thk} mm</option>
                            ))}
                        </select>

                        <select 
                            name="joint" 
                            value={filters.joint} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Joint</option>
                            {uniqueValues.joints.map(joint => (
                                <option key={joint} value={joint}>{joint}</option>
                            ))}
                        </select>

                        <select 
                            name="surface_front" 
                            value={filters.surface_front} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Surface Front</option>
                            {uniqueValues.surfaceFronts.map(surface => (
                                <option key={surface} value={surface}>{surface}</option>
                            ))}
                        </select>

                        <select 
                            name="surface_back" 
                            value={filters.surface_back} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Surface Back</option>
                            {uniqueValues.surfaceBacks.map(surface => (
                                <option key={surface} value={surface}>{surface}</option>
                            ))}
                        </select>

                        <select 
                            name="surface_front_thk" 
                            value={filters.surface_front_thk} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Front Thickness</option>
                            {uniqueValues.surfaceFrontThks.map(thk => (
                                <option key={thk} value={thk}>{thk} mm</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="filter-row third-row">
                    <div className="filter-group">
                        <select 
                            name="surface_back_thk" 
                            value={filters.surface_back_thk} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Back Thickness</option>
                            {uniqueValues.surfaceBackThks.map(thk => (
                                <option key={thk} value={thk}>{thk} mm</option>
                            ))}
                        </select>

                        <select 
                            name="surface_type" 
                            value={filters.surface_type} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Surface Type</option>
                            {uniqueValues.surfaceTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <select 
                            name="width" 
                            value={filters.width} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Width</option>
                            {uniqueValues.widths.map(width => (
                                <option key={width} value={width}>{width} mm</option>
                            ))}
                        </select>

                        <select 
                            name="length" 
                            value={filters.length} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Length</option>
                            {uniqueValues.lengths.map(length => (
                                <option key={length} value={length}>{length} mm</option>
                            ))}
                        </select>

                        <select 
                            name="cutting" 
                            value={filters.cutting} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Cutting</option>
                            {uniqueValues.cuttings.map(cutting => (
                                <option key={cutting} value={cutting}>{cutting}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="filter-row balance-row">
                    <div className="filter-group">
                        <select 
                            name="balance_status" 
                            value={filters.balance_status} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Balance Status</option>
                            <option value="positive">Positive Balance</option>
                            <option value="zero">Zero Balance</option>
                            <option value="low">Low Balance (&lt;10%)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-container">
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
                        <div className="table-header">
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
                        
                        <div className="responsive-table-wrapper">
                            <table className="panels-table">
                                <thead>
                                    <tr>
                                        <th>JobNo.</th>
                                        <th>Type</th>
                                        <th>PanelThk</th>
                                        <th>Joint</th>
                                        <th>Surface Front</th>
                                        <th>Surface Back</th>
                                        <th>Surface FrontThk</th>
                                        <th>SurfaceBackThk</th>
                                        <th>SurfaceType</th>
                                        <th>Width</th>
                                        <th>Length</th>
                                        <th>Qty</th>
                                        <th>Cutting</th>
                                        <th>Balance</th>
                                        <th>Production Meter</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPanels
                                        .filter(panel => panel && panel.id)
                                        .map(panel => {
                                            const panelQty = parseInt(panel.qty) || 0;
                                            const balance = panel.balance !== undefined ? panel.balance : panel.qty;
                                            const panelLength = parseFloat(panel.length) || 0;
                                            
                                            const alreadyProduced = panelQty - balance;
                                            const productionMeter = (alreadyProduced * panelLength) / 1000;
                                            
                                            return (
                                                <tr key={panel.id} className="panel-row">
                                                    <td>
                                                        <div className="job-no-cell">
                                                            <strong>{panel.job_no || 'N/A'}</strong>
                                                            <div className="panel-ref">{panel.reference_number}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="type-cell">
                                                            {panel.type || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="panel-thk-cell">
                                                            {panel.panel_thk ? `${formatNumber(panel.panel_thk)} mm` : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="joint-cell">
                                                            {panel.joint || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="surface-cell">
                                                            {panel.surface_front || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="surface-cell">
                                                            {panel.surface_back || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="surface-thk-cell">
                                                            {panel.surface_front_thk ? `${formatNumber(panel.surface_front_thk)} mm` : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="surface-thk-cell">
                                                            {panel.surface_back_thk ? `${formatNumber(panel.surface_back_thk)} mm` : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="surface-type-cell">
                                                            {panel.surface_type || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dimension-cell">
                                                            {panel.width ? `${formatNumber(panel.width)} mm` : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dimension-cell">
                                                            {panel.length ? `${formatNumber(panel.length)} mm` : 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="qty-cell">
                                                            {formatNumber(panel.qty)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="cutting-cell">
                                                            {panel.cutting || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={`balance-cell ${balance <= 0 ? 'zero' : ''}`}>
                                                            {formatNumber(balance)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="production-meter-cell">
                                                            <div className="meter-value">
                                                                {productionMeter.toFixed(2)} m
                                                            </div>
                                                            <div className="meter-detail">
                                                                ({formatNumber(alreadyProduced)} × {formatNumber(panelLength)} mm ÷ 1000)
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="actions-cell">
                                                            <button
                                                                onClick={() => openEditModal(panel)}
                                                                className="action-btn edit-btn"
                                                                title="Edit"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => openDuplicateModal(panel)}
                                                                className="action-btn duplicate-btn"
                                                                title="Duplicate"
                                                            >
                                                                ⎘
                                                            </button>
                                                            <button
                                                                onClick={() => openProductionModal(panel)}
                                                                className="action-btn production-btn"
                                                                title="Production"
                                                            >
                                                                🏭
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePanel(panel.id)}
                                                                className="action-btn delete-btn"
                                                                title="Delete"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {filteredPanels.length > 0 && (
                    <div className="table-footer">
                        <div className="table-summary">
                            Showing {filteredPanels.length} of {panels.length} panels
                            {filters.search && ` matching "${filters.search}"`}
                        </div>
                    </div>
                )}
            </div>

            {selectedPanelForProduction && (
                <ProductionDetailsModal
                    panel={selectedPanelForProduction}
                    onClose={closeProductionModal}
                    updatePanelBalance={updatePanelBalance}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                />
            )}

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
                                                
                                                if (value === '') {
                                                    setNumberOfCopies('');
                                                } else {
                                                    const numValue = parseInt(value);
                                                    
                                                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                                                        setNumberOfCopies(numValue);
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
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