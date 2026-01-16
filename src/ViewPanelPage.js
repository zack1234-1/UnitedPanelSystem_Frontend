import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    const [numberOfPanels, setNumberOfPanels] = useState('');
    const [productionStatus, setProductionStatus] = useState('pending');
    const [isSaving, setIsSaving] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [localSuccess, setLocalSuccess] = useState(null);
    const [productionRecords, setProductionRecords] = useState([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(true);
    const [currentPanel, setCurrentPanel] = useState(panel);
    const [activeTab, setActiveTab] = useState('all');

    const balance = currentPanel.balance !== undefined ? currentPanel.balance : (currentPanel.qty || 0);
    const panelQty = parseInt(currentPanel.qty) || 0;
    const panelLength = parseFloat(currentPanel.length) || 0;

    const generateProductionReferenceNumber = (date, existingRecords = []) => {
        if (!date) return '';
        const prodDate = new Date(date);
        const year = prodDate.getFullYear().toString().slice(-2);
        const month = String(prodDate.getMonth() + 1).padStart(2, '0');
        const day = String(prodDate.getDate()).padStart(2, '0');
        
        const datePrefix = `PROD-${year}${month}${day}`;
        
        const sameDateRecords = existingRecords.filter(record => {
            if (!record.date) return false;
            const recordDate = new Date(record.date);
            return recordDate.getFullYear() === prodDate.getFullYear() &&
                   recordDate.getMonth() === prodDate.getMonth() &&
                   recordDate.getDate() === prodDate.getDate();
        });
        
        let sequence = 1;
        if (sameDateRecords.length > 0) {
            const sequences = sameDateRecords.map(record => {
                if (record.reference_number && record.reference_number.startsWith(datePrefix)) {
                    const match = record.reference_number.match(/\d+$/);
                    return match ? parseInt(match[0]) : 0;
                }
                return 0;
            });
            const maxSequence = Math.max(...sequences, 0);
            sequence = maxSequence + 1;
        }
        
        return `${datePrefix}-${String(sequence).padStart(3, '0')}`;
    };

    const productionTotals = useMemo(() => {
        let totalPanels = 0;
        let totalLength = 0;
        const statusCounts = {
            pending: { count: 0, panels: 0, length: 0 },
            in_progress: { count: 0, panels: 0, length: 0 },
            completed: { count: 0, panels: 0, length: 0 }
        };

        productionRecords.forEach(record => {
            const panels = parseInt(record.number_of_panels) || 0;
            const length = (panels * panelLength) / 1000;
            
            totalPanels += panels;
            totalLength += length;
            
            const status = record.status || 'pending';
            if (statusCounts[status]) {
                statusCounts[status].count += 1;
                statusCounts[status].panels += panels;
                statusCounts[status].length += length;
            }
        });

        return { totalPanels, totalLength, statusCounts };
    }, [productionRecords, panelLength]);

    const overallTotals = useMemo(() => {
        const producedPanels = productionTotals.totalPanels;
        const remainingPanels = Math.max(0, panelQty - producedPanels);
        const totalProductionLength = productionTotals.totalLength;
        const remainingLength = (remainingPanels * panelLength) / 1000;
        
        return {
            producedPanels,
            remainingPanels,
            totalProductionLength,
            remainingLength,
            totalQuantity: panelQty
        };
    }, [productionTotals, panelQty, panelLength]);

    const filteredProductionRecords = useMemo(() => {
        if (activeTab === 'all') {
            return [...productionRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return productionRecords
            .filter(record => record.status === activeTab)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [productionRecords, activeTab]);

    useEffect(() => {
        fetchProductionRecords();
        fetchCurrentPanelData();
    }, [panel.id]);

    useEffect(() => {
        if (balance > 0 && (numberOfPanels === '' || parseInt(numberOfPanels) < 1)) {
            setNumberOfPanels('1');
        } else if (balance <= 0) {
            setNumberOfPanels('');
        }
    }, [balance]);

    const fetchCurrentPanelData = async () => {
        try {
            const data = await viewPanelAPI.getById(panel.id);
            if (data) {
                setCurrentPanel({
                    ...data,
                    balance: data.balance !== undefined ? data.balance : (data.qty || 0)
                });
            }
        } catch (err) {
            console.error('Failed to fetch panel data:', err);
        }
    };

    const handleWheel = (e) => {
        // Only prevent wheel on number inputs
        if (e.target.type === 'number') {
            e.preventDefault();
            e.target.blur();
        }
    };

// Also add this CSS to your ViewPanelPage.css to help with the issue:
/*
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

input[type="number"] {
    -moz-appearance: textfield;
}
*/

    const fetchProductionRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const data = await productionAPI.getByPanelId(panel.id);
            const sortedData = Array.isArray(data) 
                ? data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                : [];
            setProductionRecords(sortedData);
        } catch (err) {
            console.error('Failed to fetch production records:', err);
            setLocalError('Failed to load production records');
            setProductionRecords([]);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    const handleNumberOfPanelsChange = (e) => {
        const value = e.target.value;
        
        if (value === '') {
            setNumberOfPanels('');
            return;
        }
        
        const numValue = parseInt(value);
        
        if (!isNaN(numValue) && numValue >= 1) {
            if (balance > 0 && numValue > balance) {
                setNumberOfPanels(balance.toString());
            } else {
                setNumberOfPanels(numValue.toString());
            }
        }
        setLocalError(null);
    };

    const handleNumberOfPanelsBlur = (e) => {
        const value = numberOfPanels;
        if (value === '' || parseInt(value) < 1 || isNaN(parseInt(value))) {
            setNumberOfPanels(balance > 0 ? '1' : '');
        }
    };

    const handleCreateProductionRecord = async () => {
        const panelsToProduce = parseInt(numberOfPanels);
        if (!panelsToProduce || panelsToProduce < 1) {
            setLocalError('Please enter a valid number of panels');
            return;
        }

        if (balance <= 0) {
            setLocalError('No panels available for production');
            return;
        }

        if (panelsToProduce > balance) {
            setLocalError(`Cannot produce ${panelsToProduce} panels. Only ${balance} available.`);
            return;
        }

        setIsSaving(true);
        setLocalError(null);
        setLocalSuccess(null);

        try {
            const productionRef = generateProductionReferenceNumber(productionDate, productionRecords);
            
            const productionRecordData = {
                number_of_panels: panelsToProduce,
                delivery_date: productionDate,
                reference_number: productionRef,
                panel_reference: currentPanel.reference_number,
                status: productionStatus || 'pending',
                notes: `Production for job ${currentPanel.job_no} - Panel: ${currentPanel.reference_number}`,
                job_no: currentPanel.job_no,
                length: panelLength,
                width: parseFloat(currentPanel.width) || 0
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
                
                const newBalance = result.updated_balance || balance - panelsToProduce;
                if (newBalance > 0) {
                    setNumberOfPanels('1');
                } else {
                    setNumberOfPanels('');
                }
                
                setLocalSuccess(`Production record added successfully! Reference: ${productionRef}`);
                setActiveTab(result.production_record.status || 'pending');
                
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
            
            const newBalance = result.updated_balance || balance + parseInt(numberOfPanels || 0);
            if (newBalance > 0) {
                setNumberOfPanels('1');
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

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return '#ffc107';
            case 'in_progress': return '#17a2b8';
            case 'completed': return '#28a745';
            case 'cancelled': return '#dc3545';
            case 'on_hold': return '#6c757d';
            default: return '#ffc107';
        }
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'pending': return 'status-pending';
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            case 'cancelled': return 'status-cancelled';
            case 'on_hold': return 'status-on-hold';
            default: return 'status-pending';
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
                        <div className="overall-production-summary">
                            <h3>Overall Production Summary</h3>
                            <div className="summary-stats-grid">
                                <div className="summary-stat total-quantity">
                                    <div className="summary-icon">📊</div>
                                    <div className="summary-details">
                                        <div className="summary-label">Total Quantity</div>
                                        <div className="summary-value">{formatNumber(overallTotals.totalQuantity)}</div>
                                        <div className="summary-description">Original panel quantity</div>
                                    </div>
                                </div>
                                <div className="summary-stat remaining">
                                    <div className="summary-icon">⏳</div>
                                    <div className="summary-details">
                                        <div className="summary-label">Remaining</div>
                                        <div className="summary-value">{formatNumber(overallTotals.remainingPanels)}</div>
                                        <div className="summary-description">{overallTotals.remainingLength.toFixed(2)} m</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="production-status-summary">
                            <h4>Production Status Breakdown</h4>
                            <div className="status-breakdown-grid">
                                <div className="status-breakdown pending">
                                    <div className="status-header">
                                        <span className="status-icon">⏳</span>
                                        <span className="status-title">Pending</span>
                                        <span className="status-count">{productionTotals.statusCounts.pending.count}</span>
                                    </div>
                                    <div className="status-details">
                                        <div className="status-panels">{productionTotals.statusCounts.pending.panels} panels</div>
                                        <div className="status-length">{productionTotals.statusCounts.pending.length.toFixed(2)} m</div>
                                    </div>
                                </div>
                                <div className="status-breakdown in-progress">
                                    <div className="status-header">
                                        <span className="status-icon">⚙️</span>
                                        <span className="status-title">In Progress</span>
                                        <span className="status-count">{productionTotals.statusCounts.in_progress.count}</span>
                                    </div>
                                    <div className="status-details">
                                        <div className="status-panels">{productionTotals.statusCounts.in_progress.panels} panels</div>
                                        <div className="status-length">{productionTotals.statusCounts.in_progress.length.toFixed(2)} m</div>
                                    </div>
                                </div>
                                <div className="status-breakdown completed">
                                    <div className="status-header">
                                        <span className="status-icon">✅</span>
                                        <span className="status-title">Completed</span>
                                        <span className="status-count">{productionTotals.statusCounts.completed.count}</span>
                                    </div>
                                    <div className="status-details">
                                        <div className="status-panels">{productionTotals.statusCounts.completed.panels} panels</div>
                                        <div className="status-length">{productionTotals.statusCounts.completed.length.toFixed(2)} m</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="production-form-section">
                            <h3>Add New Production Record</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Number of Panels *</label>
                                    <div className="input-with-actions">
                                        <input 
                                            type="number"
                                            min="1"
                                            max={balance}
                                            step="1"
                                            className="form-input"
                                            value={numberOfPanels}
                                            onChange={handleNumberOfPanelsChange}
                                            onBlur={handleNumberOfPanelsBlur}
                                            onWheel={handleWheel}
                                            disabled={isSaving || balance <= 0}
                                            placeholder={balance > 0 ? "Enter number" : "No balance"}
                                        />
                                        <div className="input-buttons">
                                            <button 
                                                type="button" 
                                                className="input-btn minus"
                                                onClick={() => {
                                                    const current = parseInt(numberOfPanels) || 0;
                                                    if (current > 1) {
                                                        setNumberOfPanels((current - 1).toString());
                                                    }
                                                }}
                                                disabled={isSaving || balance <= 0 || (parseInt(numberOfPanels) || 0) <= 1}
                                            >
                                                -
                                            </button>
                                            <button 
                                                type="button" 
                                                className="input-btn plus"
                                                onClick={() => {
                                                    const current = parseInt(numberOfPanels) || 0;
                                                    const newValue = current + 1;
                                                    if (balance > 0 && newValue <= balance) {
                                                        setNumberOfPanels(newValue.toString());
                                                    }
                                                }}
                                                disabled={isSaving || balance <= 0 || (parseInt(numberOfPanels) || 0) >= balance}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    {balance > 0 ? (
                                        <div className="form-hint">
                                            Available: {balance} panels • Max: {balance}
                                        </div>
                                    ) : (
                                        <div className="form-hint text-danger">No panels available for production</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <button
                                        className={`btn btn-primary full-width ${balance <= 0 ? 'disabled' : ''}`}
                                        onClick={handleCreateProductionRecord}
                                        disabled={isSaving || !numberOfPanels || parseInt(numberOfPanels) < 1 || parseInt(numberOfPanels) > balance || balance <= 0}
                                    >
                                        {isSaving ? 'Saving...' : 'Add Production Record'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="production-records-section">
                            <div className="records-header">
                                <h3>
                                    Production Records 
                                    <span className="records-count">({productionRecords.length} total)</span>
                                </h3>
                                <div className="status-tabs">
                                    <button 
                                        className={`status-tab ${activeTab === 'all' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('all')}
                                    >
                                        All ({productionRecords.length})
                                    </button>
                                    <button 
                                        className={`status-tab ${activeTab === 'pending' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('pending')}
                                    >
                                        ⏳ Pending ({productionTotals.statusCounts.pending.count})
                                    </button>
                                    <button 
                                        className={`status-tab ${activeTab === 'in_progress' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('in_progress')}
                                    >
                                        ⚙️ In Progress ({productionTotals.statusCounts.in_progress.count})
                                    </button>
                                    <button 
                                        className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('completed')}
                                    >
                                        ✅ Completed ({productionTotals.statusCounts.completed.count})
                                    </button>
                                </div>
                            </div>
                            
                            {isLoadingRecords ? (
                                <div className="loading-state">
                                    <div className="loading-spinner"></div>
                                    <p>Loading production records...</p>
                                </div>
                            ) : filteredProductionRecords.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">
                                        {activeTab === 'all' ? '📋' : 
                                         activeTab === 'pending' ? '⏳' : 
                                         activeTab === 'in_progress' ? '⚙️' : '✅'}
                                    </div>
                                    <p>
                                        {activeTab === 'all' 
                                            ? 'No production records yet.' 
                                            : `No ${activeTab.replace('_', ' ')} production records.`
                                        }
                                    </p>
                                    {activeTab !== 'all' && (
                                        <button 
                                            className="btn btn-secondary"
                                            onClick={() => setActiveTab('all')}
                                        >
                                            View All Records
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="records-table-container">
                                        <table className="records-table">
                                            <thead>
                                                <tr>
                                                    <th>Production Ref</th>
                                                    <th>Panels</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredProductionRecords.map((record) => {
                                                    const recordDate = new Date(record.date);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    const isPastDue = recordDate < today && record.status !== 'completed';
                                                    const recordLength = calculateRecordLength(record);
                                                    const statusColor = getStatusColor(record.status);
                                                    const statusClass = getStatusClass(record.status);
                                                    
                                                    return (
                                                        <tr key={record.id} className={`production-record ${statusClass} ${isPastDue ? 'past-due' : ''}`}>
                                                            <td className="production-ref-cell">
                                                                <div className="production-ref">
                                                                    <strong>{record.reference_number || 'N/A'}</strong>
                                                                </div>
                                                                <div className="production-subtext">
                                                                    Panel: {record.panel_reference || currentPanel.reference_number}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="panels-count">
                                                                    {record.number_of_panels || 1}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="status-cell">
                                                                    <select
                                                                        className={`status-dropdown ${statusClass}`}
                                                                        value={record.status || 'pending'}
                                                                        onChange={(e) => handleUpdateProductionStatus(record.id, e.target.value)}
                                                                        disabled={isSaving}
                                                                    >
                                                                        <option value="pending">⏳ Pending</option>
                                                                        <option value="in_progress">⚙️ In Progress</option>
                                                                        <option value="completed">✅ Completed</option>
                                                                    </select>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="record-actions">
                                                                    <button
                                                                        className="btn btn-sm btn-danger"
                                                                        onClick={() => handleDeleteProductionRecord(record.id)}
                                                                        disabled={isSaving}
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
                                    <div className="records-footer">
                                        <div className="records-totals">
                                            <span>Total Panels: <strong>{productionTotals.totalPanels}</strong></span>
                                        </div>
                                    </div>
                                </>
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
    const [success, setSuccess] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [selectedPanelToDuplicate, setSelectedPanelToDuplicate] = useState(null);
    const [numberOfCopies, setNumberOfCopies] = useState(1);
    const [selectedPanelForProduction, setSelectedPanelForProduction] = useState(null);
    
    const [isCreateFormDuplicateModalOpen, setIsCreateFormDuplicateModalOpen] = useState(false);
    const [duplicateFormCopies, setDuplicateFormCopies] = useState(1);
    
    const [productionMeterDate, setProductionMeterDate] = useState('');
    const [dailyProductionMeter, setDailyProductionMeter] = useState({
        totalMeter: 0,
        panelCount: 0
    });

    const [isPrintSelectionModalOpen, setIsPrintSelectionModalOpen] = useState(false);
    const [isColumnSelectionModalOpen, setIsColumnSelectionModalOpen] = useState(false);

    // Add states for production data
    const [allProductionRecords, setAllProductionRecords] = useState([]);
    const [productionRefs, setProductionRefs] = useState([]);

    // Define all available columns with their display names and default visibility
    const defaultColumns = [
        { id: 'job_no', label: 'Job No', visible: true, order: 1 },
        { id: 'type', label: 'Type', visible: true, order: 2 },
        { id: 'panel_thk', label: 'Panel Thk', visible: true, order: 3 },
        { id: 'joint', label: 'Joint', visible: true, order: 4 },
        { id: 'surface_front', label: 'Front', visible: true, order: 5 },
        { id: 'surface_back', label: 'Back', visible: true, order: 6 },
        { id: 'surface_front_thk', label: 'Front Thk', visible: true, order: 7 },
        { id: 'surface_back_thk', label: 'Back Thk', visible: true, order: 8 },
        { id: 'surface_type', label: 'Finishes', visible: true, order: 9 },
        { id: 'width', label: 'Width(mm)', visible: true, order: 10 },
        { id: 'length', label: 'Length(mm)', visible: true, order: 11 },
        { id: 'salesman', label: 'Salesman', visible: true, order: 12 },
        { id: 'application', label: 'Application', visible: true, order: 13 },
        { id: 'area', label: 'Area(m2)', visible: true, order: 14 },
        { id: 'brand', label: 'Brand', visible: true, order: 15 },
        { id: 'qty', label: 'Qty', visible: true, order: 16 },
        { id: 'cutting', label: 'Cutting', visible: true, order: 17 },
        { id: 'balance', label: 'Balance', visible: true, order: 18 },
        { id: 'production_meter', label: 'Production Meter(mm)', visible: true, order: 19 },
        { id: 'created_at', label: 'Production Date', visible: true, order: 20 },
        { id: 'estimated_delivery', label: 'Estimated Delivery', visible: true, order: 21 },
        { id: 'actions', label: 'Actions', visible: true, order: 22, alwaysVisible: true }
    ];

    const [columns, setColumns] = useState(() => {
        // Load from localStorage or use defaults
        const savedColumns = localStorage.getItem('panelTableColumns');
        return savedColumns ? JSON.parse(savedColumns) : defaultColumns;
    });

    const defaultPanelValues = {
        job_no: 'UPS.0525.18802',
        application: '',
        type: 'PIR',
        panel_thk: '100',
        joint: 'Clip Joint',
        surface_front: 'PPGI',
        surface_back: 'PPGI',
        surface_front_thk: '0.5',
        surface_back_thk: '0.5',
        surface_type: 'RIB',
        width: '1150',
        length: '3000',
        qty: '',
        cutting: '',
        status: 'pending',
        production_meter: '',
        balance: '',
        salesman: '',
        brand: '',
        estimated_delivery: '',
        notes: ''
    };

    const [newPanel, setNewPanel] = useState({...defaultPanelValues});
    
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
        cutting: '',
        created_at: '',      
        estimated_delivery: '',
        production_reference_number: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    const createModalRef = useRef(null);
    const inputRefs = useRef([]);
    
    const formLayout = useMemo(() => [
        ['job_no', 'type', 'panel_thk'],
        ['application', 'joint', 'surface_front'],
        ['surface_back', 'surface_front_thk', 'surface_back_thk'],
        ['surface_type', 'width', 'length'],
        ['qty', 'cutting', 'status'],
        ['production_meter', 'salesman', 'brand'],
        ['estimated_delivery','created_at', 'notes', '']
    ], []);

    // Save columns to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('panelTableColumns', JSON.stringify(columns));
    }, [columns]);

    // Fetch all production records and references
    useEffect(() => {
        const fetchAllProductionData = async () => {
            try {
                const data = await productionAPI.getAll();
                if (Array.isArray(data)) {
                    setAllProductionRecords(data);
                    
                    // Extract unique production reference numbers
                    const uniqueRefs = [...new Set(
                        data
                            .map(record => record.reference_number)
                            .filter(ref => ref && ref.trim() !== '')
                    )].sort();
                    
                    setProductionRefs(uniqueRefs);
                }
            } catch (err) {
                console.error('Failed to fetch production data:', err);
                setAllProductionRecords([]);
                setProductionRefs([]);
            }
        };
        
        fetchAllProductionData();
    }, []);

    useEffect(() => {
        fetchPanels();
    }, []);

    useEffect(() => {
        if (productionMeterDate) {
            calculateDailyProductionMeter();
        } else {
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0
            });
        }
    }, [productionMeterDate, panels]);

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

    const calculateDailyProductionMeter = () => {
        if (!productionMeterDate) return;
        
        try {
            let totalMeter = 0;
            let panelCount = 0;
            
            const datePanels = panels.filter(panel => {
                if (!panel.created_at) return false;

                const date = new Date(panel.created_at);

                const panelDate = date.getFullYear() + '-' + 
                                String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                                String(date.getDate()).padStart(2, '0');

                return panelDate === productionMeterDate;
            });
            
            datePanels.forEach(panel => {
                const length = parseFloat(panel.length) || 0;
                const qty = parseInt(panel.qty) || 0;
                const balance = parseInt(panel.balance) || 0;
                const panelcount = parseInt(qty-balance) || 0;
                
                const panelMeter = length * (qty - balance);
                totalMeter += panelMeter;
                panelCount+=panelcount;
            });
            
            setDailyProductionMeter({
                totalMeter,
                panelCount
            });
            
        } catch (err) {
            console.error('Failed to calculate daily production meter:', err);
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0
            });
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
                    application: panel.application || null,
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
                    balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0)
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

    const calculateArea = (width, length,quantity) => {
        const w = parseFloat(width) || 0;
        const l = parseFloat(length) || 0;
        const q = parseInt(quantity) || 0;
        if (w <= 0 || l <= 0) return 0;
        return (w * l * q);
    };

    const handleDuplicateFromCreateForm = async () => {
        if (!newPanel.job_no?.trim()) {
            setError('Job No is required');
            return;
        }
        
        if (!newPanel.width || !newPanel.length) {
            setError('Width and Length are required');
            return;
        }

        const count = duplicateFormCopies || 1;
        
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
                const originalJobNo = newPanel.job_no || '';
                const newJobNo = count === 1 
                    ? `${originalJobNo} (Copy)`
                    : `${originalJobNo} (Copy ${i + 1})`;
                
                const originalNotes = newPanel.notes || '';
                const newNotes = originalNotes 
                    ? `${originalNotes}\n\n---\nCreated from form`
                    : `Created from form`;
                
                const panelData = {
                    job_no: newJobNo,
                    application: newPanel.application || null,
                    type: newPanel.type || null,
                    panel_thk: newPanel.panel_thk ? parseFloat(newPanel.panel_thk) : null,
                    joint: newPanel.joint || null,
                    surface_front: newPanel.surface_front || null,
                    surface_back: newPanel.surface_back || null,
                    surface_front_thk: newPanel.surface_front_thk ? parseFloat(newPanel.surface_front_thk) : null,
                    surface_back_thk: newPanel.surface_back_thk ? parseFloat(newPanel.surface_back_thk) : null,
                    surface_type: newPanel.surface_type || null,
                    width: newPanel.width ? parseFloat(newPanel.width) : 0,
                    length: newPanel.length ? parseFloat(newPanel.length) : 0,
                    qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                    cutting: newPanel.cutting || null,
                    status: 'pending',
                    production_meter: newPanel.production_meter ? parseFloat(newPanel.production_meter) : null,
                    balance: newPanel.qty ? parseInt(newPanel.qty) : null,
                    salesman: newPanel.salesman || null,
                    notes: newNotes,
                    reference_number: referenceNumbers[i],
                    brand: newPanel.brand || null,
                    estimated_delivery: newPanel.estimated_delivery || null
                };
                
                Object.keys(panelData).forEach(key => {
                    if (panelData[key] === '' || panelData[key] === undefined) {
                        panelData[key] = null;
                    }
                });
                
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({
                    ...createdPanel,
                    balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0)
                });
            }
            
            setPanels(prev => [...newPanels, ...prev]);
            setIsCreateFormDuplicateModalOpen(false);
            setNewPanel({...defaultPanelValues});
            setError(null);
            
            if (count === 1) {
                setSuccess(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            } else {
                setSuccess(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
            }
            
            setTimeout(() => {
                setSuccess(null);
            }, 5000);
            
        } catch (err) {
            console.error('Failed to duplicate from form:', err);
            setError('Failed to duplicate from form: ' + (err.message || 'Unknown error'));
        }
    };

    const handleDuplicateInCreateModal = () => {
        setIsCreateFormDuplicateModalOpen(true);
        setDuplicateFormCopies(1);
        setError(null);
    };

    const uniqueValues = useMemo(() => {
        const getUnique = (key, isNumeric = false, isDate = false) => {
            const values = panels
                .map(panel => {
                    const value = panel[key];
                    if (value === null || value === undefined || value === '') return null;
                    
                    if (isNumeric) {
                        const numValue = parseFloat(value);
                        return isNaN(numValue) ? null : numValue.toString();
                    }
                    
                    if (isDate) {
                        try {
                            const date = new Date(value);
                            if (isNaN(date.getTime())) return null;
                            // Format as YYYY-MM-DD for consistent comparison
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        } catch (error) {
                            return null;
                        }
                    }
                    
                    return value.toString().trim();
                })
                .filter(p => p);
            
            const unique = [...new Set(values)];
            
            if (isNumeric) {
                return unique.sort((a, b) => parseFloat(a) - parseFloat(b));
            }
            
            if (isDate) {
                return unique.sort((a, b) => new Date(b) - new Date(a));
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
            cuttings: getUnique('cutting'),
            applications: getUnique('application'),
            createdDates: getUnique('created_at', false, true), 
            estimatedDeliveries: getUnique('estimated_delivery', false, true),
            referenceNumbers: getUnique('reference_number'),
            productionRefs: productionRefs
        };
    }, [panels, productionRefs]);

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
                    panel.cutting,
                    panel.application
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
            
            if (filters.panel_thk) {
                const panelThk = parseFloat(panel.panel_thk) || 0;
                const filterThk = parseFloat(filters.panel_thk);
                if (panelThk !== filterThk) return false;
            }
            
            if (filters.joint && panel.joint !== filters.joint) return false;
            if (filters.surface_front && panel.surface_front !== filters.surface_front) return false;
            if (filters.surface_back && panel.surface_back !== filters.surface_back) return false;
            
            if (filters.surface_front_thk) {
                const panelFrontThk = parseFloat(panel.surface_front_thk) || 0;
                const filterFrontThk = parseFloat(filters.surface_front_thk);
                if (panelFrontThk !== filterFrontThk) return false;
            }
            
            if (filters.surface_back_thk) {
                const panelBackThk = parseFloat(panel.surface_back_thk) || 0;
                const filterBackThk = parseFloat(filters.surface_back_thk);
                if (panelBackThk !== filterBackThk) return false;
            }
            
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
                const balance = panel.balance !== undefined ? panel.balance : (panel.qty || 0);
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
            
            // Filter by production reference number
            if (filters.production_reference_number) {
                // Find production records for this panel
                const panelProdRecords = allProductionRecords.filter(record => 
                    record.panel_id === panel.id
                );
                
                // Check if any production record has the matching reference
                const hasMatchingProdRef = panelProdRecords.some(record =>
                    record.reference_number && 
                    record.reference_number.toLowerCase().includes(filters.production_reference_number.toLowerCase())
                );
                
                if (!hasMatchingProdRef) return false;
            }
            
            return true;
        });

        filtered.sort((a, b) => {
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'balance') {
                    aValue = a.balance !== undefined ? a.balance : (a.qty || 0);
                    bValue = b.balance !== undefined ? b.balance : (b.qty || 0);
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
    }, [panels, filters, sortConfig, allProductionRecords]);

    // Get visible columns sorted by order
    const visibleColumns = useMemo(() => {
        return columns
            .filter(col => col.visible || col.alwaysVisible)
            .sort((a, b) => a.order - b.order);
    }, [columns]);

    // Handle column visibility toggle
    const toggleColumnVisibility = (columnId) => {
        setColumns(prev => prev.map(col => 
            col.id === columnId ? { ...col, visible: !col.visible } : col
        ));
    };

    // Handle column reordering
    const moveColumn = (columnId, direction) => {
        setColumns(prev => {
            const newColumns = [...prev];
            const index = newColumns.findIndex(col => col.id === columnId);
            
            if (direction === 'up' && index > 0) {
                [newColumns[index], newColumns[index - 1]] = [newColumns[index - 1], newColumns[index]];
            } else if (direction === 'down' && index < newColumns.length - 1) {
                [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
            }
            
            // Update order based on new positions
            return newColumns.map((col, idx) => ({ ...col, order: idx + 1 }));
        });
    };

    // Reset to default columns
    const resetToDefaultColumns = () => {
        setColumns(defaultColumns);
    };

    // Select all columns
    const selectAllColumns = () => {
        setColumns(prev => prev.map(col => ({ ...col, visible: true })));
    };

    // Deselect all columns (except always visible ones)
    const deselectAllColumns = () => {
        setColumns(prev => prev.map(col => ({ 
            ...col, 
            visible: col.alwaysVisible ? true : false 
        })));
    };

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

    const handleProductionMeterDateChange = (e) => {
        setProductionMeterDate(e.target.value);
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
                balance: editingPanel.qty ? parseInt(editingPanel.qty) : null,
                application: editingPanel.application || null,
                created_at: editingPanel.created_at || null, // Add this
                estimated_delivery: editingPanel.estimated_delivery || null
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
                    balance: updatedPanel.balance !== undefined ? updatedPanel.balance : (updatedPanel.qty || 0)
                } : panel
            ));
            setIsEditModalOpen(false);
            setEditingPanel(null);
            setError(null);
            setSuccess('Panel updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
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
                estimated_delivery: newPanel.estimated_delivery || null,
                application: newPanel.application || null
            };
            
            Object.keys(panelData).forEach(key => {
                if (panelData[key] === '') {
                    panelData[key] = null;
                }
            });
            
            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [{
                ...createdPanel,
                balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0)
            }, ...prev]);
            
            setSuccess(`Panel created successfully! Reference: ${referenceNumber}`);
            setError(null);
            
            setNewPanel({...defaultPanelValues});
            
            setTimeout(() => {
                const firstInput = createModalRef.current?.querySelector('input, select, textarea');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
            
        } catch (err) {
            console.error('Failed to create panel:', err);
            setError('Failed to create panel: ' + (err.message || 'Unknown error'));
        }
    };

    const handleResetForm = () => {
        setNewPanel({...defaultPanelValues});
        setError(null);
        setSuccess('Form reset to default values.');
        
        setTimeout(() => {
            const firstInput = createModalRef.current?.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    };

    const handleDeletePanel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this panel? All production records will also be deleted.')) return;

        try {
            await viewPanelAPI.delete(id);
            setPanels(prev => prev.filter(panel => panel.id !== id));
            setSuccess('Panel deleted successfully!');
            setTimeout(() => setSuccess(null), 3000);
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

        const formatDateForInput = (dateString) => {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                return date.toISOString().split('T')[0];
            } catch (error) {
                return '';
            }
        };
    
        setEditingPanel({ 
            ...panel,
            job_no: panel.job_no || '',
            application: panel.application || '',
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
            created_at: formatDateForInput(panel.created_at),
            salesman: panel.salesman || '',
            notes: panel.notes || ''
        });
        setIsEditModalOpen(true);
        setError(null);
    };

    const openCreateModal = () => {
        setIsCreateModalOpen(true);
        setError(null);
        setSuccess(null);
        setNewPanel({...defaultPanelValues});
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingPanel(null);
        setError(null);
    };

    const closeCreateModal = () => {
        setIsCreateModalOpen(false);
        setNewPanel({...defaultPanelValues});
        setError(null);
        setSuccess(null);
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

    const formatDateForFilter = (dateString) => {
        if (!dateString) return 'N/A';
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

    const handleKeyDown = (e, rowIndex, colIndex, fieldName) => {
        const rows = formLayout.length;
        const cols = 3;
        
        // Only handle Enter for form navigation, not for textareas
        if (e.key === 'Enter' && fieldName !== 'notes') {
            e.preventDefault();
            
            // If Tab or Enter is pressed in the last field of a row
            if (rowIndex < rows - 1) {
                const newRow = rowIndex + 1;
                const newCol = Math.min(colIndex, formLayout[newRow].length - 1);
                if (formLayout[newRow][newCol]) {
                    const input = createModalRef.current?.querySelector(`[name="${formLayout[newRow][newCol]}"]`);
                    if (input) input.focus();
                }
            } else {
                // If in last row, move to first button
                const firstButton = createModalRef.current?.querySelector('.footer-actions button');
                if (firstButton) firstButton.focus();
            }
            return;
        }
        
        // Handle Tab for navigation
        if (e.key === 'Tab') {
            // Let default Tab behavior work for most fields
            if (fieldName === 'notes' && !e.shiftKey) {
                // For notes field with Tab, move to buttons
                e.preventDefault();
                const firstButton = createModalRef.current?.querySelector('.footer-actions button');
                if (firstButton) firstButton.focus();
            }
            return;
        }
        
        // For notes field, allow Shift+Enter for new lines
        if (fieldName === 'notes' && e.key === 'Enter' && e.shiftKey) {
            // Allow default behavior (new line)
            return;
        }
        
        // For other arrow keys, only handle if they're not in a text field that needs them
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            // Don't prevent default for arrow keys in text fields
            if (fieldName !== 'notes') {
                // For non-textarea fields, handle arrow navigation
                e.preventDefault();
                handleArrowNavigation(e.key, rowIndex, colIndex);
            }
        }
    };

    const handleArrowNavigation = (key, rowIndex, colIndex) => {
        const rows = formLayout.length;
        const cols = 3;
        
        switch(key) {
            case 'ArrowUp':
                if (rowIndex > 0) {
                    const newRow = rowIndex - 1;
                    const newCol = Math.min(colIndex, formLayout[newRow].length - 1);
                    if (formLayout[newRow][newCol]) {
                        const input = createModalRef.current?.querySelector(`[name="${formLayout[newRow][newCol]}"]`);
                        if (input) input.focus();
                    }
                }
                break;
                
            case 'ArrowDown':
                if (rowIndex < rows - 1) {
                    const newRow = rowIndex + 1;
                    const newCol = Math.min(colIndex, formLayout[newRow].length - 1);
                    if (formLayout[newRow][newCol]) {
                        const input = createModalRef.current?.querySelector(`[name="${formLayout[newRow][newCol]}"]`);
                        if (input) input.focus();
                    }
                }
                break;
                
            case 'ArrowLeft':
                if (colIndex > 0) {
                    const newCol = colIndex - 1;
                    if (formLayout[rowIndex][newCol]) {
                        const input = createModalRef.current?.querySelector(`[name="${formLayout[rowIndex][newCol]}"]`);
                        if (input) input.focus();
                    }
                }
                break;
                
            case 'ArrowRight':
                if (colIndex < cols - 1 && colIndex < formLayout[rowIndex].length - 1) {
                    const newCol = colIndex + 1;
                    if (formLayout[rowIndex][newCol]) {
                        const input = createModalRef.current?.querySelector(`[name="${formLayout[rowIndex][newCol]}"]`);
                        if (input) input.focus();
                    }
                }
                break;
        }
    };

    // PRINT FUNCTION
    const handlePrint = (specificPanel = null) => {
        try {
            // Create a new window for printing
            const printWindow = window.open('', '_blank');
            
            if (!printWindow) {
                alert('Please allow popups to print the table');
                return;
            }

            // Determine which panels to print
            let panelsToPrint = filteredPanels;
            if (specificPanel) {
                panelsToPrint = [specificPanel];
            }

            // Create the print HTML content
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Panels Report - ${new Date().toLocaleDateString()}</title>
                    <style>
                        @media print {
                            @page {
                                size: landscape;
                                margin: 10mm;
                            }
                            body {
                                font-family: Arial, sans-serif;
                                font-size: 10pt;
                                margin: 0;
                                padding: 0;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                table-layout: auto;
                            }
                            th, td {
                                border: 1px solid #000;
                                padding: 4px 6px;
                                text-align: left;
                                font-size: 9pt;
                                vertical-align: top;
                                word-wrap: break-word;
                                max-width: 80px;
                                overflow-wrap: break-word;
                            }
                            th {
                                background-color: #f2f2f2;
                                font-weight: bold;
                            }
                            .no-print {
                                display: none !important;
                            }
                            .print-header {
                                text-align: center;
                                margin-bottom: 15px;
                                border-bottom: 2px solid #000;
                                padding-bottom: 10px;
                            }
                            .print-title {
                                font-size: 16pt;
                                font-weight: bold;
                                margin-bottom: 5px;
                            }
                            .print-subtitle {
                                font-size: 11pt;
                                color: #666;
                                margin-bottom: 10px;
                            }
                            .print-summary {
                                margin-bottom: 15px;
                                font-size: 10pt;
                            }
                            .total-area {
                                font-weight: bold;
                                margin-top: 10px;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .page-break {
                                page-break-before: always;
                            }
                            .panel-row:nth-child(even) {
                                background-color: #f9f9f9;
                            }
                        }
                        @media screen {
                            body {
                                font-family: Arial, sans-serif;
                                font-size: 12px;
                                padding: 20px;
                            }
                            .no-screen {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <div class="print-title">Panel Management System - Report</div>
                        <div class="print-subtitle">Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
                        <div class="print-summary">
                            Total Panels: ${panelsToPrint.length} | 
                            Printed: ${specificPanel ? 'Single Panel' : 'Filtered List'} |
                            Printed by: ${localStorage.getItem('username') || 'System User'}
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Ref No</th>
                                <th>Job No</th>
                                <th>Type</th>
                                <th>Panel Thk (mm)</th>
                                <th>Joint</th>
                                <th>Surface Front</th>
                                <th>Surface Back</th>
                                <th>Front Thk</th>
                                <th>Back Thk</th>
                                <th>Surface Type</th>
                                <th>Width (mm)</th>
                                <th>Length (mm)</th>
                                <th>Salesman</th>
                                <th>Application</th>
                                <th>Area (m²)</th>
                                <th>Brand</th>
                                <th>Qty</th>
                                <th>Cutting</th>
                                <th>Balance</th>
                                <th>Prod Meter (mm)</th>
                                <th>Created Date</th>
                                <th>Est. Delivery</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${panelsToPrint.map((panel, index) => {
                                const panelQty = parseInt(panel.qty) || 0;
                                const balance = panel.balance !== undefined ? panel.balance : (panel.qty || 0);
                                const panelLength = parseFloat(panel.length) || 0;
                                const panelWidth = parseFloat(panel.width) || 0;
                                const alreadyProduced = panelQty - balance;
                                const totalProductionMeter = (alreadyProduced * panelLength);
                                const area = calculateArea(panelWidth, panelLength, panelQty) / 1000000;
                                
                                return `
                                    <tr class="panel-row">
                                        <td>${panel.reference_number || 'N/A'}</td>
                                        <td>${panel.job_no || 'N/A'}</td>
                                        <td>${panel.type || 'N/A'}</td>
                                        <td>${panel.panel_thk ? formatNumber(panel.panel_thk) : 'N/A'}</td>
                                        <td>${panel.joint || 'N/A'}</td>
                                        <td>${panel.surface_front || 'N/A'}</td>
                                        <td>${panel.surface_back || 'N/A'}</td>
                                        <td>${panel.surface_front_thk ? formatNumber(panel.surface_front_thk) : 'N/A'}</td>
                                        <td>${panel.surface_back_thk ? formatNumber(panel.surface_back_thk) : 'N/A'}</td>
                                        <td>${panel.surface_type || 'N/A'}</td>
                                        <td>${panel.width ? formatNumber(panel.width) : 'N/A'}</td>
                                        <td>${panel.length ? formatNumber(panel.length) : 'N/A'}</td>
                                        <td>${panel.salesman || 'N/A'}</td>
                                        <td>${panel.application || 'N/A'}</td>
                                        <td>${area > 0 ? area.toFixed(3) : '0'}</td>
                                        <td>${panel.brand || 'N/A'}</td>
                                        <td>${formatNumber(panel.qty)}</td>
                                        <td>${panel.cutting || 'N/A'}</td>
                                        <td>${formatNumber(balance)}</td>
                                        <td>${totalProductionMeter.toFixed(2)}</td>
                                        <td>${formatDate(panel.created_at)}</td>
                                        <td>${formatDate(panel.estimated_delivery)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    
                    <div class="total-area no-print" style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #000;">
                        <strong>Total Area:</strong> ${panelsToPrint.reduce((sum, panel) => {
                            const width = parseFloat(panel.width) || 0;
                            const length = parseFloat(panel.length) || 0;
                            const qty = parseInt(panel.qty) || 0;
                            return sum + (width * length * qty) / 1000000;
                        }, 0).toFixed(3)} m²
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; font-size: 9pt; color: #666;" class="no-print">
                        <p>--- End of Report ---</p>
                        <p>This document is generated from Panel Management System</p>
                    </div>
                </body>
                </html>
            `;

            // Write the content to the print window
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Wait for content to load then print
            printWindow.onload = function() {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    // printWindow.close(); // Uncomment to auto-close after printing
                }, 500);
            };

        } catch (error) {
            console.error('Error printing:', error);
            alert('Error generating print document. Please try again.');
        }
    };

    // Function to handle column selection from the chips
    const handleColumnChipClick = (columnId) => {
        toggleColumnVisibility(columnId);
    };

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

            {success && (
                <div className="alert alert-success global-success">
                    {success}
                </div>
            )}

            <div className="daily-production-meter-section">
                <div className="filter-card">
                    <h3>Production Meter by Creation Date</h3>
                    <div className="daily-filter-row">
                        <div className="form-group">
                            <label>Select Panel Creation Date</label>
                            <input
                                type="date"
                                value={productionMeterDate}
                                onChange={handleProductionMeterDateChange}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setProductionMeterDate('')}
                            >
                                Clear Date
                            </button>
                        </div>
                    </div>
                    
                    {productionMeterDate && (
                        <div className="daily-production-summary">
                            <div className="summary-card">
                                <h4>Production Meter Summary for Panels Created on {formatDate(productionMeterDate)}</h4>
                                <div className="summary-stats">
                                    <div className="daily-stat">
                                        <span className="stat-label">Total Production Meter:</span>
                                        <span className="stat-value">{dailyProductionMeter.totalMeter.toFixed(2)} mm</span>
                                    </div>
                                    <div className="daily-stat">
                                        <span className="stat-label">Number of Panels:</span>
                                        <span className="stat-value">{dailyProductionMeter.panelCount}</span>
                                    </div>
                                    <div className="daily-stat">
                                        <span className="stat-label">Average Meter per Panel:</span>
                                        <span className="stat-value">
                                            {dailyProductionMeter.panelCount > 0 
                                                ? (dailyProductionMeter.totalMeter / dailyProductionMeter.panelCount).toFixed(2) 
                                                : '0'} mm
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="filters-section">
                <div className="filter-row">
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
                    </div>
                </div>

                <div className="filter-row">
                    <div className="filter-group">
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

                <div className="filter-row">
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
                    </div>
                </div>

                <div className="filter-row">
                    <div className="filter-group">
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
                    </div>
                </div>

                <div className="filter-row">
                    <div className="filter-group">
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
                    </div>
                </div>

                <div className="filter-row">
                    <div className="filter-group">
                        <select 
                            name="created_at" 
                            value={filters.created_at} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Production Date</option>
                            {uniqueValues.createdDates.map(date => {
                                try {
                                    const dateObj = new Date(date);
                                    const formattedDate = formatDateForFilter(date);
                                    return (
                                        <option key={date} value={date}>
                                            {formattedDate}
                                        </option>
                                    );
                                } catch (error) {
                                    return null;
                                }
                            })}
                        </select>

                        <select 
                            name="estimated_delivery" 
                            value={filters.estimated_delivery} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Est. Delivery</option>
                            {uniqueValues.estimatedDeliveries.map(date => {
                                try {
                                    const dateObj = new Date(date);
                                    const formattedDate = formatDateForFilter(date);
                                    return (
                                        <option key={date} value={date}>
                                            {formattedDate}
                                        </option>
                                    );
                                } catch (error) {
                                    return null;
                                }
                            })}
                        </select>
                    </div>
                </div>

                {/* New row for reference number filters */}
                <div className="filter-row">
                    <div className="filter-group">
                        <select 
                            name="reference_number" 
                            value={filters.reference_number} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Panel Reference Number</option>
                            {uniqueValues.referenceNumbers?.map(ref => (
                                <option key={ref} value={ref}>{ref}</option>
                            ))}
                        </select>

                        <select 
                            name="production_reference_number" 
                            value={filters.production_reference_number} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">Production Record Reference</option>
                            {uniqueValues.productionRefs?.map(ref => (
                                <option key={ref} value={ref}>{ref}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-container">
                {error && <div className="alert alert-danger">{error}</div>}

                {/* Column Selection Chips */}
                <div className="column-selection-chips">
                    <div className="chips-header">
                        <h4>Selected Columns ({visibleColumns.length - 1})</h4>
                        <div className="chips-controls">
                            <button 
                                className="btn btn-sm btn-secondary"
                                onClick={() => setIsColumnSelectionModalOpen(true)}
                            >
                                <span className="chip-icon">⚙️</span> Manage Columns
                            </button>
                            <button 
                                className="btn btn-sm btn-outline"
                                onClick={selectAllColumns}
                            >
                                Select All
                            </button>
                            <button 
                                className="btn btn-sm btn-outline"
                                onClick={deselectAllColumns}
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>
                    <div className="chips-container">
                        {columns
                            .filter(col => !col.alwaysVisible)
                            .sort((a, b) => a.order - b.order)
                            .map(column => (
                                <div 
                                    key={column.id}
                                    className={`column-chip ${column.visible ? 'active' : 'inactive'}`}
                                    onClick={() => handleColumnChipClick(column.id)}
                                >
                                    <span className="chip-label">{column.label}</span>
                                    <span className="chip-indicator">
                                        {column.visible ? '✓' : '✗'}
                                    </span>
                                </div>
                            ))
                        }
                    </div>
                </div>

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
                            <div className="table-header-controls">
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
                                        <option value="application">Application</option>
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
                                <div className="action-controls">
                                    <button 
                                        className="print-btn"
                                        onClick={() => setIsPrintSelectionModalOpen(true)}
                                        title="Print Panels"
                                    >
                                        🖨️ Print
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="responsive-table-wrapper">
                            <table className="panels-table">
                                <thead>
                                    <tr>
                                        {visibleColumns.map(column => (
                                            <th key={column.id}>{column.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPanels
                                        .filter(panel => panel && panel.id)
                                        .map(panel => {
                                            const panelQty = parseInt(panel.qty) || 0;
                                            const balance = panel.balance !== undefined ? panel.balance : (panel.qty || 0);
                                            const panelLength = parseFloat(panel.length) || 0;
                                            const panelWidth = parseFloat(panel.width) || 0;
                                            
                                            const alreadyProduced = panelQty - balance;
                                            const totalProductionMeter = (alreadyProduced * panelLength);
                                            const area = calculateArea(panelWidth, panelLength,panelQty)/1000000;
                                            
                                            return (
                                                <tr key={panel.id} className="panel-row">
                                                    {visibleColumns.map(column => {
                                                        // Render each cell based on column ID
                                                        switch(column.id) {
                                                            case 'job_no':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="job-no-cell">
                                                                            <strong>{panel.job_no || 'N/A'}</strong>
                                                                            <div className="panel-ref">{panel.reference_number}</div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'type':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="type-cell">
                                                                            {panel.type || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'panel_thk':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="panel-thk-cell">
                                                                            {panel.panel_thk ? `${formatNumber(panel.panel_thk)} mm` : 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'joint':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="joint-cell">
                                                                            {panel.joint || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'surface_front':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="surface-cell">
                                                                            {panel.surface_front || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'surface_back':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="surface-cell">
                                                                            {panel.surface_back || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'surface_front_thk':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="surface-thk-cell">
                                                                            {panel.surface_front_thk ? `${formatNumber(panel.surface_front_thk)}` : 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'surface_back_thk':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="surface-thk-cell">
                                                                            {panel.surface_back_thk ? `${formatNumber(panel.surface_back_thk)}` : 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'surface_type':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="surface-type-cell">
                                                                            {panel.surface_type || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'width':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="dimension-cell">
                                                                            {panel.width ? `${formatNumber(panel.width)}` : 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'length':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="dimension-cell">
                                                                            {panel.length ? `${formatNumber(panel.length)}` : 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'salesman':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="salesman-cell">
                                                                            {panel.salesman || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'application':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="application-cell">
                                                                            {panel.application || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'area':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="area-cell">
                                                                            <div className="area-value">
                                                                                {area > 0 ? area.toFixed(3) : '0'}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'brand':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="brand-cell">
                                                                            {panel.brand || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'qty':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="qty-cell">
                                                                            {formatNumber(panel.qty)}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'cutting':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="cutting-cell">
                                                                            {panel.cutting || 'N/A'}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'balance':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className={`balance-cell ${balance <= 0 ? 'zero' : ''}`}>
                                                                            {formatNumber(balance)}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'production_meter':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="production-meter-cell">
                                                                            <div className="meter-value">
                                                                                {totalProductionMeter.toFixed(2)}
                                                                            </div>
                                                                            <div className="meter-details">
                                                                                ({alreadyProduced} panels)
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'created_at':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="created-date-cell">
                                                                            {formatDate(panel.created_at)}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'estimated_delivery':
                                                                return (
                                                                    <td key={column.id}>
                                                                        <div className="estimated-delivery-cell">
                                                                            {formatDate(panel.estimated_delivery)}
                                                                            {panel.estimated_delivery && (
                                                                                <div className="delivery-status">
                                                                                    {new Date(panel.estimated_delivery) < new Date() ? 
                                                                                        <span className="past-due" title="Past due">⚠️</span> : 
                                                                                        <span className="upcoming" title="Upcoming">📅</span>
                                                                                    }
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'actions':
                                                                return (
                                                                    <td key={column.id}>
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
                                                                                onClick={() => handlePrint(panel)}
                                                                                className="action-btn print-btn"
                                                                                title="Print"
                                                                            >
                                                                                🖨️
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
                                                                );
                                                            default:
                                                                return <td key={column.id}>N/A</td>;
                                                        }
                                                    })}
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </>
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
                    <div className="modal-content create-modal" onClick={e => e.stopPropagation()} ref={createModalRef}>
                        <div className="modal-header">
                            <h2>Create New Panel</h2>
                            <button type="button" className="close-button" onClick={closeCreateModal}>
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            {error && (
                                <div className="alert alert-danger">
                                    {error}
                                </div>
                            )}
                            
                            {success && (
                                <div className="alert alert-success">
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleCreatePanel}>
                                <div className="form-grid">
                                    {formLayout.map((row, rowIndex) => (
                                        <div key={rowIndex} className="form-row">
                                            {row.map((fieldName, colIndex) => {
                                                if (!fieldName) {
                                                    return <div key={colIndex} className="form-group"></div>;
                                                }
                                                
                                                const fieldConfig = {
                                                    job_no: { label: 'Job No *', type: 'text', required: true },
                                                    application: { label: 'Application', type: 'text' },
                                                    type: { label: 'Type', type: 'text'  },
                                                    panel_thk: { label: 'Panel Thickness (mm)', type: 'number' },
                                                    joint: { label: 'Joint', type: 'text'  },
                                                    surface_front: { label: 'Surface Front', type: 'text' },
                                                    surface_back: { label: 'Surface Back', type: 'text' },
                                                    surface_front_thk: { label: 'Front Thickness (mm)', type: 'number' },
                                                    surface_back_thk: { label: 'Back Thickness (mm)', type: 'number' },
                                                    surface_type: { label: 'Surface Type', type: 'text'  },
                                                    width: { label: 'Width (mm) *', type: 'number', required: true },
                                                    length: { label: 'Length (mm) *', type: 'number', required: true },
                                                    qty: { label: 'Quantity', type: 'number' },
                                                    cutting: { label: 'Cutting', type: 'text' },
                                                    status: { label: 'Status', type: 'text' },
                                                    production_meter: { label: 'Production Meter', type: 'number' },
                                                    salesman: { label: 'Salesman', type: 'text' },
                                                    brand: { label: 'Brand', type: 'text' },
                                                    estimated_delivery: { label: 'Estimated Delivery', type: 'date' },
                                                    created_at: { label: 'Created Date', type: 'date' },
                                                    notes: { label: 'Notes', type: 'textarea' }
                                                }[fieldName] || { label: fieldName, type: 'text' };
                                                
                                                const isRequired = fieldConfig.required || false;
                                                const inputId = `create-${fieldName}-${rowIndex}-${colIndex}`;
                                                
                                                return (
                                                    <div key={colIndex} className="form-group">
                                                        <label htmlFor={inputId}>
                                                            {fieldConfig.label}
                                                            {isRequired && <span className="required-star"> *</span>}
                                                        </label>
                                                        
                                                        {fieldConfig.type === 'select' ? (
                                                            <select
                                                                id={inputId}
                                                                name={fieldName}
                                                                value={newPanel[fieldName] || ''}
                                                                onChange={handleNewPanelInputChange}
                                                                className="form-input"
                                                                onWheel={handleWheel}
                                                                required={isRequired}
                                                            >
                                                                <option value="">Select...</option>
                                                                {fieldConfig.options.map(option => (
                                                                    <option key={option} value={option}>
                                                                        {option}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : fieldConfig.type === 'textarea' ? (
                                                            <textarea
                                                                id={inputId}
                                                                name={fieldName}
                                                                value={newPanel[fieldName] || ''}
                                                                onChange={handleNewPanelInputChange}
                                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex, fieldName)}
                                                                className="form-input"
                                                                rows="3"
                                                                placeholder="Enter notes here..."
                                                            />
                                                        ) : (
                                                            <input
                                                                id={inputId}
                                                                type={fieldConfig.type}
                                                                name={fieldName}
                                                                value={newPanel[fieldName] || ''}
                                                                onChange={handleNewPanelInputChange}
                                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex, fieldName)}
                                                                className="form-input"
                                                                onWheel={handleWheel}
                                                                required={isRequired}
                                                                min={fieldConfig.type === 'number' ? "0" : undefined}
                                                                step={fieldConfig.type === 'number' ? "0.01" : undefined}
                                                                ref={el => {
                                                                    if (rowIndex === 0 && colIndex === 0 && el) {
                                                                        inputRefs.current[0] = el;
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="modal-footer">
                                    <div className="footer-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={handleResetForm}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    const notesField = createModalRef.current?.querySelector('[name="notes"]');
                                                    if (notesField) notesField.focus();
                                                }
                                            }}
                                        >
                                            Reset Form
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-info"
                                            onClick={handleDuplicateInCreateModal}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowLeft') {
                                                    e.preventDefault();
                                                    const resetButton = createModalRef.current?.querySelector('.footer-actions button.btn-secondary');
                                                    if (resetButton) resetButton.focus();
                                                } else if (e.key === 'ArrowRight') {
                                                    e.preventDefault();
                                                    const createButton = createModalRef.current?.querySelector('.footer-actions button.btn-primary');
                                                    if (createButton) createButton.focus();
                                                }
                                            }}
                                        >
                                            Duplicate
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowLeft') {
                                                    e.preventDefault();
                                                    const duplicateButton = createModalRef.current?.querySelector('.footer-actions button.btn-info');
                                                    if (duplicateButton) duplicateButton.focus();
                                                }
                                            }}
                                        >
                                            Create Panel
                                        </button>
                                    </div>
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
                                        <label htmlFor="edit_application">Application</label>
                                        <input
                                            type="text"
                                            id="edit_application"
                                            name="application"
                                            value={editingPanel.application}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
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
                                </div>

                                <div className="form-row">
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
                                </div>

                                <div className="form-row">
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
                                </div>

                                <div className="form-row">
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
                                </div>

                                <div className="form-row">
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
                                </div>

                                <div className="form-row">
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
                                    <div className="form-group">
                                        <label htmlFor="edit_created_at">Created Date</label>
                                        <input
                                            type="date"
                                            id="edit_created_at"
                                            name="created_at"
                                            value={editingPanel.created_at ? new Date(editingPanel.created_at).toISOString().split('T')[0] : ''}
                                            onChange={handleEditInputChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        {/* Empty cell for alignment */}
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

            {isCreateFormDuplicateModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>
                    <div className="modal-content duplicate-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Duplicate Panel from Form</h2>
                            <button 
                                type="button" 
                                className="close-button" 
                                onClick={() => setIsCreateFormDuplicateModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            {error && (
                                <div className="alert alert-danger">
                                    {error}
                                </div>
                            )}

                            <div className="duplicate-form-content">
                                <div className="duplicate-info">
                                    <div className="info-icon">📋</div>
                                    <div className="info-content">
                                        <h4>Create Multiple Copies</h4>
                                        <p>You are about to create duplicate panels based on the current form data. Each copy will have a unique reference number.</p>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="duplicateCopies">Number of Copies *</label>
                                    <div className="input-with-stepper">
                                        <input
                                            id="duplicateCopies"
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={duplicateFormCopies}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value) && value >= 1 && value <= 100) {
                                                    setDuplicateFormCopies(value);
                                                }
                                            }}
                                            onWheel={handleWheel}
                                            className="form-input"
                                            required
                                        />
                                        <div className="stepper-buttons">
                                            <button
                                                type="button"
                                                className="stepper-btn minus"
                                                onClick={() => {
                                                    if (duplicateFormCopies > 1) {
                                                        setDuplicateFormCopies(prev => prev - 1);
                                                    }
                                                }}
                                            >
                                                -
                                            </button>
                                            <button
                                                type="button"
                                                className="stepper-btn plus"
                                                onClick={() => {
                                                    if (duplicateFormCopies < 100) {
                                                        setDuplicateFormCopies(prev => prev + 1);
                                                    }
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-hint">
                                        Maximum 100 copies. Each copy will have a unique reference number.
                                    </div>
                                </div>

                                <div className="preview-summary">
                                    <h4>Preview Summary</h4>
                                    <div className="preview-details">
                                        <div className="preview-row">
                                            <span className="preview-label">Job No:</span>
                                            <span className="preview-value">{newPanel.job_no || 'N/A'}</span>
                                        </div>
                                        <div className="preview-row">
                                            <span className="preview-label">Type:</span>
                                            <span className="preview-value">{newPanel.type || 'N/A'}</span>
                                        </div>
                                        <div className="preview-row">
                                            <span className="preview-label">Dimensions:</span>
                                            <span className="preview-value">
                                                {newPanel.width || 0}mm × {newPanel.length || 0}mm
                                            </span>
                                        </div>
                                        <div className="preview-row">
                                            <span className="preview-label">Quantity per copy:</span>
                                            <span className="preview-value">{newPanel.qty || 1}</span>
                                        </div>
                                        <div className="preview-row">
                                            <span className="preview-label">Total panels to create:</span>
                                            <span className="preview-value">
                                                {duplicateFormCopies} × {newPanel.qty || 1} = {duplicateFormCopies * (parseInt(newPanel.qty) || 1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <div className="footer-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setIsCreateFormDuplicateModalOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleDuplicateFromCreateForm}
                                            disabled={!newPanel.job_no?.trim() || !newPanel.width || !newPanel.length}
                                        >
                                            Create {duplicateFormCopies} Cop{duplicateFormCopies === 1 ? 'y' : 'ies'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPrintSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsPrintSelectionModalOpen(false)}>
                    <div className="modal-content print-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Print Panels</h2>
                            <button type="button" className="close-button" onClick={() => setIsPrintSelectionModalOpen(false)}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="print-options">
                                <div className="print-option" onClick={() => {
                                    handlePrint();
                                    setIsPrintSelectionModalOpen(false);
                                }}>
                                    <div className="print-option-content">
                                        <div className="print-option-title">Print All Visible Panels</div>
                                        <div className="print-option-details">
                                            Print all {filteredPanels.length} panels currently visible in the table
                                        </div>
                                    </div>
                                </div>
                                
                                {filteredPanels.slice(0, 10).map(panel => (
                                    <div key={panel.id} className="print-option" onClick={() => {
                                        handlePrint(panel);
                                        setIsPrintSelectionModalOpen(false);
                                    }}>
                                        <div className="print-option-content">
                                            <div className="print-option-title">{panel.job_no || 'N/A'} - {panel.reference_number}</div>
                                            <div className="print-option-details">
                                                {panel.type} | {panel.width}mm × {panel.length}mm | Qty: {panel.qty}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isColumnSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsColumnSelectionModalOpen(false)}>
                    <div className="modal-content column-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Select Columns to Display</h2>
                            <button type="button" className="close-button" onClick={() => setIsColumnSelectionModalOpen(false)}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="column-selection-content">
                                <div className="selection-header">
                                    <p>Select which columns you want to see in the table. Drag to reorder.</p>
                                    <div className="selection-actions">
                                        <button 
                                            className="btn btn-sm btn-secondary"
                                            onClick={selectAllColumns}
                                        >
                                            Select All
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-secondary"
                                            onClick={deselectAllColumns}
                                        >
                                            Deselect All
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-secondary"
                                            onClick={resetToDefaultColumns}
                                        >
                                            Reset to Default
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="columns-list">
                                    {columns
                                        .filter(col => !col.alwaysVisible)
                                        .sort((a, b) => a.order - b.order)
                                        .map(column => (
                                            <div key={column.id} className="column-item">
                                                <div className="column-controls">
                                                    <button 
                                                        className="move-btn"
                                                        onClick={() => moveColumn(column.id, 'up')}
                                                        disabled={column.order === 1}
                                                        title="Move Up"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button 
                                                        className="move-btn"
                                                        onClick={() => moveColumn(column.id, 'down')}
                                                        disabled={column.order === columns.length - 1}
                                                        title="Move Down"
                                                    >
                                                        ↓
                                                    </button>
                                                </div>
                                                <div className="column-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        id={`col-${column.id}`}
                                                        checked={column.visible}
                                                        onChange={() => toggleColumnVisibility(column.id)}
                                                    />
                                                    <label htmlFor={`col-${column.id}`}>
                                                        {column.label}
                                                    </label>
                                                </div>
                                                <div className="column-info">
                                                    <span className="column-position">Position: {column.order}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                
                                <div className="selection-summary">
                                    <div className="summary-item">
                                        <span className="summary-label">Total Columns:</span>
                                        <span className="summary-value">{columns.length - 1}</span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Visible Columns:</span>
                                        <span className="summary-value">{visibleColumns.length - 1}</span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Hidden Columns:</span>
                                        <span className="summary-value">{(columns.length - 1) - (visibleColumns.length - 1)}</span>
                                    </div>
                                </div>
                                
                                <div className="modal-footer">
                                    <div className="footer-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setIsColumnSelectionModalOpen(false)}
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => setIsColumnSelectionModalOpen(false)}
                                        >
                                            Apply Selection
                                        </button>
                                    </div>
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