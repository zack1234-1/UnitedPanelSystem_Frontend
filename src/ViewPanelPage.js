import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
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

const ProductionDetailsModal = ({ panel, onClose, updatePanelBalance, formatNumber, formatDate,
    onProductionRecordCreated }) => {
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
    const [brand, setBrand] = useState('');

    const generateProductionReferenceNumber = (existingRecords = []) => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayPrefix = `PRF-${year}${month}${day}`;
        const todayRefs = existingRecords.filter(record => record.reference_number && record.reference_number.startsWith(todayPrefix));
        let sequence = 1;
        if (todayRefs.length > 0) {
            const sequences = todayRefs.map(record => {
                const match = record.reference_number.match(/\d+$/);
                return match ? parseInt(match[0]) : 0;
            });
            sequence = Math.max(...sequences) + 1;
        }
        return `${todayPrefix}-${String(sequence).padStart(3, '0')}`;
    };

    useEffect(() => {
        if (panel) setBrand(panel.brand || '');
    }, [panel]);

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
        return { producedPanels, remainingPanels, totalProductionLength, remainingLength, totalQuantity: panelQty };
    }, [productionTotals, panelQty, panelLength]);

    const filteredProductionRecords = useMemo(() => {
        if (activeTab === 'all') return [...productionRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        return productionRecords.filter(record => record.status === activeTab).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [productionRecords, activeTab]);

    useEffect(() => {
        fetchProductionRecords();
        fetchCurrentPanelData();
    }, [panel.id]);

    useEffect(() => {
        if (balance > 0 && (numberOfPanels === '' || parseInt(numberOfPanels) < 1)) setNumberOfPanels('1');
        else if (balance <= 0) setNumberOfPanels('');
    }, [balance]);

    const fetchCurrentPanelData = async () => {
        try {
            const data = await viewPanelAPI.getById(panel.id);
            if (data) setCurrentPanel({ ...data, balance: data.balance !== undefined ? data.balance : (data.qty || 0) });
        } catch (err) { console.error('Failed to fetch panel data:', err); }
    };

    const handleWheel = (e) => e.target.blur();

    const fetchProductionRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const data = await productionAPI.getByPanelId(panel.id);
            const sortedData = Array.isArray(data) ? data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)) : [];
            setProductionRecords(sortedData);
        } catch (err) {
            console.error('Failed to fetch production records:', err);
            setLocalError('Failed to load production records');
            setProductionRecords([]);
        } finally { setIsLoadingRecords(false); }
    };

    const handleNumberOfPanelsChange = (e) => {
        const value = e.target.value;
        if (value === '') { setNumberOfPanels(''); return; }
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 1) {
            if (balance > 0 && numValue > balance) setNumberOfPanels(balance.toString());
            else setNumberOfPanels(numValue.toString());
        }
        setLocalError(null);
    };

    const handleNumberOfPanelsBlur = () => {
        if (numberOfPanels === '' || parseInt(numberOfPanels) < 1 || isNaN(parseInt(numberOfPanels))) {
            setNumberOfPanels(balance > 0 ? '1' : '');
        }
    };

    const handleCreateProductionRecord = async () => {
        const panelsToProduce = parseInt(numberOfPanels);
        if (!panelsToProduce || panelsToProduce < 1) { setLocalError('Please enter a valid number of panels'); return; }
        if (balance <= 0) { setLocalError('No panels available for production'); return; }
        if (panelsToProduce > balance) { setLocalError(`Cannot produce ${panelsToProduce} panels. Only ${balance} available.`); return; }

        setIsSaving(true);
        setLocalError(null);
        setLocalSuccess(null);

        try {
            const productionRef = generateProductionReferenceNumber(productionRecords);
            const productionRecordData = {
                number_of_panels: panelsToProduce,
                delivery_date: productionDate,
                reference_number: productionRef,
                panel_reference: currentPanel.reference_number,
                status: productionStatus || 'pending',
                notes: `Production for job ${currentPanel.job_no} - Panel: ${currentPanel.reference_number}`,
                job_no: currentPanel.job_no,
                length: panelLength,
                width: parseFloat(currentPanel.width) || 0,
                brand: brand
            };
            const result = await viewPanelAPI.createProductionWithBalance(panel.id, productionRecordData);
            if (result && result.production_record) {
                setProductionRecords(prev => [result.production_record, ...prev]);
                if (updatePanelBalance && result.updated_balance !== undefined) updatePanelBalance(panel.id, result.updated_balance);
                setCurrentPanel(prev => ({ ...prev, balance: result.updated_balance !== undefined ? result.updated_balance : prev.balance }));
                setProductionDate('');
                setProductionStatus('pending');
                setBrand(currentPanel.brand || '');
                const newBalance = result.updated_balance || balance - panelsToProduce;
                setNumberOfPanels(newBalance > 0 ? '1' : '');
                setLocalSuccess(`Production record added successfully! Reference: ${productionRef}`);
                setActiveTab(result.production_record.status || 'pending');
                if (onProductionRecordCreated) {
                    await onProductionRecordCreated();
                }
                setTimeout(() => setLocalSuccess(null), 3000);
            } else throw new Error('Invalid response from server');
        } catch (err) {
            console.error('Failed to create production record:', err);
            setLocalError('Failed to add production record: ' + (err.message || 'Unknown error'));
            fetchProductionRecords();
            fetchCurrentPanelData();
        } finally { setIsSaving(false); }
    };

    const handleDeleteProductionRecord = async (recordId) => {
        if (!window.confirm('Are you sure you want to delete this production record? This will restore the balance.')) return;
        setIsSaving(true);
        setLocalError(null);
        try {
            const result = await viewPanelAPI.deleteProductionWithBalance(panel.id, recordId);
            setProductionRecords(prev => prev.filter(record => record.id !== recordId));
            if (updatePanelBalance && result.updated_balance !== undefined) updatePanelBalance(panel.id, result.updated_balance);
            setCurrentPanel(prev => ({ ...prev, balance: result.updated_balance !== undefined ? result.updated_balance : prev.balance }));
            const newBalance = result.updated_balance || balance + parseInt(numberOfPanels || 0);
            if (newBalance > 0) setNumberOfPanels('1');
            setLocalSuccess('Production record deleted. Balance restored.');
            setTimeout(() => setLocalSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to delete production record:', err);
            setLocalError('Failed to delete production record: ' + (err.message || 'Unknown error'));
            fetchProductionRecords();
            fetchCurrentPanelData();
        } finally { setIsSaving(false); }
    };

    const handleUpdateProductionStatus = async (recordId, newStatus) => {
        try {
            const updatedRecord = await productionAPI.updateStatus(recordId, { status: newStatus });
            setProductionRecords(prev => prev.map(record => record.id === recordId ? updatedRecord : record));
            setLocalSuccess(`Status updated to ${getStatusDisplay(newStatus)}`);
            setTimeout(() => setLocalSuccess(null), 3000);
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

    const calculateRecordLength = (record) => ((parseInt(record.number_of_panels) || 0) * panelLength / 1000).toFixed(2);

    return (
        <div className="modal-overlay production-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()} style={{ width: '95vw', maxWidth: '1600px', height: '95vh', zIndex: 10001 }}>
                <div className="modal-header">
                    <h2>Production Management: {currentPanel.reference_number}</h2>
                    <button type="button" className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {localError && <div className="alert alert-danger">{localError}</div>}
                    {localSuccess && <div className="alert alert-success">{localSuccess}</div>}
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
                                        <input type="number" min="1" max={balance} step="1" className="form-input"
                                               value={numberOfPanels} onChange={handleNumberOfPanelsChange}
                                               onBlur={handleNumberOfPanelsBlur} onWheel={handleWheel}
                                               disabled={isSaving || balance <= 0}
                                               placeholder={balance > 0 ? "Enter number" : "No balance"}/>
                                        <div className="input-buttons">
                                            <button type="button" className="input-btn minus"
                                                    onClick={() => {
                                                        const current = parseInt(numberOfPanels) || 0;
                                                        if (current > 1) setNumberOfPanels((current - 1).toString());
                                                    }}
                                                    disabled={isSaving || balance <= 0 || (parseInt(numberOfPanels) || 0) <= 1}>-</button>
                                            <button type="button" className="input-btn plus"
                                                    onClick={() => {
                                                        const current = parseInt(numberOfPanels) || 0;
                                                        const newValue = current + 1;
                                                        if (balance > 0 && newValue <= balance) setNumberOfPanels(newValue.toString());
                                                    }}
                                                    disabled={isSaving || balance <= 0 || (parseInt(numberOfPanels) || 0) >= balance}>+</button>
                                        </div>
                                    </div>
                                    {balance > 0 ? (<div className="form-hint">Available: {balance} panels • Max: {balance}</div>)
                                                : (<div className="form-hint text-danger">No panels available for production</div>)}
                                </div>
                                <div className="form-group">
                                    <label>Brand</label>
                                    <input type="text" className="form-input" value={brand}
                                           onChange={(e) => setBrand(e.target.value)} placeholder="Enter brand for this production"
                                           disabled={isSaving}/>
                                </div>
                                <div className="form-group">
                                    <button className={`btn btn-primary full-width ${balance <= 0 ? 'disabled' : ''}`}
                                            onClick={handleCreateProductionRecord}
                                            disabled={isSaving || !numberOfPanels || parseInt(numberOfPanels) < 1 || parseInt(numberOfPanels) > balance || balance <= 0}>
                                        {isSaving ? 'Saving...' : 'Add Production Record'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="production-records-section">
                            <div className="records-header">
                                <h3>Production Records <span className="records-count">({productionRecords.length} total)</span></h3>
                                <div className="status-tabs">
                                    <button className={`status-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All ({productionRecords.length})</button>
                                    <button className={`status-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>⏳ Pending ({productionTotals.statusCounts.pending.count})</button>
                                    <button className={`status-tab ${activeTab === 'in_progress' ? 'active' : ''}`} onClick={() => setActiveTab('in_progress')}>⚙️ In Progress ({productionTotals.statusCounts.in_progress.count})</button>
                                    <button className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>✅ Completed ({productionTotals.statusCounts.completed.count})</button>
                                </div>
                            </div>
                            {isLoadingRecords ? (<div className="loading-state"><div className="loading-spinner"></div><p>Loading production records...</p></div>)
                            : filteredProductionRecords.length === 0 ? (<div className="empty-state"><div className="empty-icon">{activeTab === 'all' ? '📋' : activeTab === 'pending' ? '⏳' : activeTab === 'in_progress' ? '⚙️' : '✅'}</div><p>{activeTab === 'all' ? 'No production records yet.' : `No ${activeTab.replace('_', ' ')} production records.`}</p>{activeTab !== 'all' && (<button className="btn btn-secondary" onClick={() => setActiveTab('all')}>View All Records</button>)}</div>)
                            : (<><div className="records-table-container"><table className="records-table"><thead><tr><th>Production Ref</th><th>Panels</th><th>Brand</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredProductionRecords.map(record => {const recordDate = new Date(record.date);const today = new Date();today.setHours(0,0,0,0);const isPastDue = recordDate < today && record.status !== 'completed';const recordLength = calculateRecordLength(record);const statusColor = getStatusColor(record.status);const statusClass = getStatusClass(record.status);return (<tr key={record.id} className={`production-record ${statusClass} ${isPastDue ? 'past-due' : ''}`}><td className="production-ref-cell"><div className="production-ref"><strong>{record.reference_number || 'N/A'}</strong></div><div className="production-subtext">Panel: {record.panel_reference || currentPanel.reference_number}</div></td><td><div className="panels-count">{record.number_of_panels || 1}</div></td><td><div className="brand-cell">{record.brand || 'N/A'}</div></td><td><div className="status-cell"><select className={`status-dropdown ${statusClass}`} value={record.status || 'pending'} onChange={(e) => handleUpdateProductionStatus(record.id, e.target.value)} disabled={isSaving}><option value="pending">⏳ Pending</option><option value="in_progress">⚙️ In Progress</option><option value="completed">✅ Completed</option></select></div></td><td><div className="record-actions"><button className="btn btn-sm btn-danger" onClick={() => handleDeleteProductionRecord(record.id)} disabled={isSaving} title="Delete">🗑️</button></div></td></tr>);})}</tbody></table></div><div className="records-footer"><div className="records-totals"><span>Total Panels: <strong>{productionTotals.totalPanels}</strong></span></div></div></>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const JobOverviewContent = ({
  job,
  panels,
  editingRowId,
  editedRowData,
  handleCellClick,
  handleEditedFieldChange,
  handleSaveEdit,
  handleCancelEdit,
  formatDate,
  calculateArea,
  visibleColumns,
  openDuplicateModal,
  handlePrint,
  handleDeletePanel,
  openProductionModal,
  onAddNewPanel,
  isAddingNew,
  newRowData,
  setNewRowData,
  handleSaveNewPanel,
  onDeleteAllByJob,
  stickyTop = 0
}) => {
  const [jobFilters, setJobFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const filterDropdownRef = useRef(null);
  const [actionModalPanel, setActionModalPanel] = useState(null);

  const headerColors = [
    '#f8d7da', // light red
    '#fff3cd', // light yellow
    '#d1e7dd', // light green
    '#cfe2ff', // light blue
    '#e2d1f0', // light purple
    '#f9e1d2', // light orange
    '#d2d2d2', // light gray
    '#fadadd', // light pink
    '#c9e4f0', // light cyan
    '#fce4d6', // light peach
    '#e6d5b8', // light tan
    '#d9ead3', // light mint
    '#ffe5b4', // light apricot
    '#dcd3ff', // light lavender
    '#ffd1dc', // light rose
    ];

  const uniqueValues = useMemo(() => {
    const uniques = {};
    visibleColumns.forEach(col => {
      if (col.type === 'computed') return;
      const values = panels
        .map(p => {
          let val = p[col.key];
          if (col.type === 'date' && val) {
            val = new Date(val).toISOString().split('T')[0];
          }
          return val?.toString().trim() || null;
        })
        .filter(v => v != null && v !== '');
      uniques[col.key] = [...new Set(values)].sort();
    });
    return uniques;
  }, [panels, visibleColumns]);

  const filteredPanels = useMemo(() => {
    return panels.filter(panel => {
      for (let [key, filterVal] of Object.entries(jobFilters)) {
        if (!filterVal) continue;
        let panelVal = panel[key];
        if (key === 'created_at' || key === 'estimated_delivery') {
          panelVal = panelVal ? new Date(panelVal).toISOString().split('T')[0] : '';
        } else {
          panelVal = panelVal?.toString().trim() || '';
        }
        if (panelVal !== filterVal) return false;
      }
      return true;
    });
  }, [panels, jobFilters]);

  const totalQty = filteredPanels.reduce((sum, p) => sum + (parseInt(p.qty) || 0), 0);
  const totalBalance = filteredPanels.reduce((sum, p) => sum + (p.balance !== undefined ? p.balance : (parseInt(p.qty) || 0)), 0);
  const totalArea = filteredPanels.reduce((sum, p) => {
    const area = calculateArea(p.width, p.length, p.qty) / 1000000;
    return sum + area;
  }, 0);
  const totalProducedMeter = filteredPanels.reduce((sum, p) => {
    const qty = parseInt(p.qty) || 0;
    const balance = p.balance !== undefined ? p.balance : qty;
    const produced = qty - balance;
    const length = parseFloat(p.length) || 0;
    return sum + (produced * length);
  }, 0);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterSelect = (key, value) => {
    setJobFilters(prev => ({ ...prev, [key]: value }));
    setActiveFilterCol(null);
  };

  const clearFilter = (key) => {
    setJobFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const hasFilters = Object.keys(jobFilters).length > 0;

  const handleNewRowFieldChange = (field, value) => {
    setNewRowData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div className="job-summary" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3>Summary</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {hasFilters && (
              <button className="btn btn-sm btn-secondary" onClick={() => setJobFilters({})}>
                Clear Filters
              </button>
            )}
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onDeleteAllByJob(job)}
              title="Delete all panels in this job"
            >
              Delete All
            </button>
            <button className="btn btn-sm btn-success" onClick={onAddNewPanel} disabled={isAddingNew}>
              {isAddingNew ? 'Adding...' : '+ Add Row'}
            </button>
          </div>
        </div>
        <div className="summary-stats" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div className="stat-item"><span className="stat-label">Total Panels:</span><span className="stat-value">{filteredPanels.length} / {panels.length}</span></div>
          <div className="stat-item"><span className="stat-label">Total Quantity:</span><span className="stat-value">{totalQty}</span></div>
          <div className="stat-item"><span className="stat-label">Total Balance:</span><span className="stat-value">{totalBalance}</span></div>
          <div className="stat-item"><span className="stat-label">Total Area:</span><span className="stat-value">{totalArea.toFixed(2)} m²</span></div>
          <div className="stat-item"><span className="stat-label">Total Produced Meter:</span><span className="stat-value">{(totalProducedMeter / 1000).toFixed(2)} m</span></div>
        </div>
      </div>

      <div className="job-panels-table">
        <h3>Panels in this Job (click column header to filter, click cell to edit)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            tableLayout: 'fixed'
          }}>
           <thead>
            <tr>
                {visibleColumns.map((col, index) => (
                <th
                    key={col.key}
                    onClick={() => {
                    if (col.type !== 'computed') {
                        const rect = document.getElementById(`th-${col.key}`)?.getBoundingClientRect();
                        if (rect) {
                        setFilterDropdownPos({
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX
                        });
                        setActiveFilterCol(activeFilterCol === col.key ? null : col.key);
                        }
                    }
                    }}
                    style={{
                    padding: '4px 2px',
                    border: '1px solid #ccc',
                    whiteSpace: 'normal',
                    cursor: col.type !== 'computed' ? 'pointer' : 'default',
                    position: 'sticky',
                    top: stickyTop,
                    zIndex: 2,
                    backgroundColor: headerColors[index % headerColors.length],
                    boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)'
                    }}
                    id={`th-${col.key}`}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {col.label}
                    {jobFilters[col.key] && (
                        <span
                        style={{ marginLeft: '4px', fontSize: '10px', cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            clearFilter(col.key);
                        }}
                        title="Clear filter"
                        >
                        ✕
                        </span>
                    )}
                    </div>
                </th>
                ))}
                <th
                style={{
                    padding: '4px 2px',
                    border: '1px solid #ccc',
                    whiteSpace: 'normal',
                    position: 'sticky',
                    top: stickyTop,
                    zIndex: 2,
                    backgroundColor: headerColors[visibleColumns.length % headerColors.length],
                    boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)'
                }}
                >
                Actions
                </th>
            </tr>
            </thead>
            <tbody>
              {isAddingNew && (
                <tr style={{ backgroundColor: '#e6f7ff' }}>
                  {visibleColumns.map(col => {
                    if (col.type === 'computed') {
                      return <td key={col.key} style={{ padding: '4px 2px', border: '1px solid #ccc' }}>—</td>;
                    }
                    let inputElement;
                    if (col.type === 'number') {
                      inputElement = (
                        <input
                          type="number"
                          step="any"
                          value={newRowData[col.key] ?? ''}
                          onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                        />
                      );
                    } else if (col.type === 'date') {
                      inputElement = (
                        <input
                          type="date"
                          value={newRowData[col.key] ?? ''}
                          onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                        />
                      );
                    } else if (col.key === 'status') {
                      inputElement = (
                        <select
                          value={newRowData.status || 'pending'}
                          onChange={(e) => handleNewRowFieldChange('status', e.target.value)}
                          style={{ width: '100%', fontSize: '13px', padding: '2px' }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      );
                    } else {
                      inputElement = (
                        <input
                          type="text"
                          value={newRowData[col.key] ?? ''}
                          onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                        />
                      );
                    }
                    return (
                      <td key={col.key} style={{ padding: '4px 2px', border: '1px solid #ccc' }}>
                        {inputElement}
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 2px', border: '1px solid #ccc', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={handleSaveNewPanel}
                        style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Save"
                      >
                        💾
                      </button>
                      <button
                        onClick={() => setNewRowData(null)}
                        style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Cancel"
                      >
                        ❌
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filteredPanels.map(panel => {
                const isEditing = editingRowId === panel.id;
                const qty = parseInt(panel.qty) || 0;
                const balance = panel.balance !== undefined ? panel.balance : qty;
                const produced = qty - balance;
                const length = parseFloat(panel.length) || 0;
                const width = parseFloat(panel.width) || 0;
                const prodMeter = produced * length;
                const area = calculateArea(width, length, qty) / 1000000;

                return (
                  <tr key={panel.id}>
                    {visibleColumns.map(col => {
                      let value;
                      if (col.key === 'area') {
                        value = area.toFixed(3);
                      } else if (col.key === 'production_meter') {
                        value = prodMeter.toFixed(0);
                      } else if (col.key === 'created_at' || col.key === 'estimated_delivery') {
                        value = formatDate(panel[col.key]);
                      } else {
                        value = panel[col.key] ?? 'null';
                      }

                      if (isEditing && col.type !== 'computed') {
                        let inputElement;
                        if (col.type === 'number') {
                          inputElement = (
                            <input
                              type="number"
                              step="any"
                              value={editedRowData[col.key] ?? ''}
                              onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                            />
                          );
                        } else if (col.type === 'date') {
                          inputElement = (
                            <input
                              type="date"
                              value={editedRowData[col.key] ?? ''}
                              onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                            />
                          );
                        } else if (col.key === 'status') {
                          inputElement = (
                            <select
                              value={editedRowData.status || 'pending'}
                              onChange={(e) => handleEditedFieldChange('status', e.target.value)}
                              style={{ width: '100%', fontSize: '13px', padding: '2px' }}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          );
                        } else {
                          inputElement = (
                            <input
                              type="text"
                              value={editedRowData[col.key] ?? ''}
                              onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '2px' }}
                            />
                          );
                        }
                        return (
                          <td key={col.key} style={{ padding: '4px 2px', border: '1px solid #ccc' }}>
                            {inputElement}
                          </td>
                        );
                      } else {
                        return (
                          <td
                            key={col.key}
                            onClick={() => col.type !== 'computed' && handleCellClick(panel)}
                            style={{
                              padding: '4px 2px',
                              border: '1px solid #ccc',
                              cursor: col.type !== 'computed' ? 'pointer' : 'default',
                              wordBreak: 'break-word',
                              fontSize: '13px',
                              backgroundColor: jobFilters[col.key] === panel[col.key]?.toString().trim() ? '#e3f2fd' : 'transparent'
                            }}
                            title={col.type !== 'computed' ? 'Click to edit' : ''}
                          >
                            {value}
                          </td>
                        );
                      }
                    })}
                    <td style={{ padding: '4px 2px', border: '1px solid #ccc', textAlign: 'center', verticalAlign: 'middle' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={handleSaveEdit}
                            style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Save"
                          >
                            💾
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Cancel"
                          >
                            ❌
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActionModalPanel(panel)}
                          style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
                          title="Actions"
                        >
                          ⋮
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeFilterCol && ReactDOM.createPortal(
        <div
          className="filter-dropdown"
          ref={filterDropdownRef}
          style={{
            position: 'absolute',
            top: filterDropdownPos.top,
            left: filterDropdownPos.left,
            zIndex: 2000,
          }}
        >
          <div className="filter-dropdown-header">
            <span>Filter by {visibleColumns.find(c => c.key === activeFilterCol)?.label}</span>
            <button onClick={() => setActiveFilterCol(null)}>×</button>
          </div>
          <div className="filter-dropdown-list">
            <div
              className={`filter-option ${!jobFilters[activeFilterCol] ? 'selected' : ''}`}
              onClick={() => {
                setJobFilters(prev => ({ ...prev, [activeFilterCol]: '' }));
                setActiveFilterCol(null);
              }}
            >
              All
            </div>
            {uniqueValues[activeFilterCol]?.map(val => (
              <div
                key={val}
                className={`filter-option ${jobFilters[activeFilterCol] === val ? 'selected' : ''}`}
                onClick={() => handleFilterSelect(activeFilterCol, val)}
              >
                {val}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {actionModalPanel && ReactDOM.createPortal(
        <div
          className="modal-overlay"
          onClick={() => setActionModalPanel(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '150px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  openDuplicateModal(actionModalPanel);
                  setActionModalPanel(null);
                }}
                style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                title="Duplicate"
              >
                ⎘ Duplicate
              </button>
              <button
                onClick={() => {
                  handlePrint(actionModalPanel);
                  setActionModalPanel(null);
                }}
                style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                title="Print"
              >
                🖨️ Print
              </button>
              <button
                onClick={() => {
                  handleDeletePanel(actionModalPanel.id);
                  setActionModalPanel(null);
                }}
                style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                title="Delete"
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => {
                  openProductionModal(actionModalPanel);
                  setActionModalPanel(null);
                }}
                style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                title="Production"
              >
                🏭 Production
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const ViewPanelPage = () => {
    const navigate = useNavigate();
    const [panels, setPanels] = useState([]);
    const [allProductionRecords, setAllProductionRecords] = useState([]);
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
        panelCount: 0,
        totalMeterInMeters: 0,
        estimatedTimeMinutes: 0,
        estimatedTimeHours: 0,
        estimatedTimeRemainingMinutes: 0
    });
    const [isPrintSelectionModalOpen, setIsPrintSelectionModalOpen] = useState(false);
    const [isColumnSelectionModalOpen, setIsColumnSelectionModalOpen] = useState(false);
    const [estimatedRunningSpeed, setEstimatedRunningSpeed] = useState(4.8);

    const [activeView, setActiveView] = useState('table');
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    const [activeFilterColumn, setActiveFilterColumn] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const portalDropdownRef = useRef(null);

    const [isJobOverviewModalOpen, setIsJobOverviewModalOpen] = useState(false);
    const [selectedJobForOverview, setSelectedJobForOverview] = useState(null);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editedRowData, setEditedRowData] = useState(null);
    const [editError, setEditError] = useState(null);
    const [editSuccess, setEditSuccess] = useState(null);

    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newRowData, setNewRowData] = useState(null);

    const modalHeaderRef = useRef(null);
    const [modalHeaderHeight, setModalHeaderHeight] = useState(60);

    useEffect(() => {
        if (isJobOverviewModalOpen && modalHeaderRef.current) {
            setModalHeaderHeight(modalHeaderRef.current.offsetHeight);
        }
    }, [isJobOverviewModalOpen]);

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
        { id: 'width', label: 'Width', visible: true, order: 10 },
        { id: 'length', label: 'Length', visible: true, order: 11 },
        { id: 'salesman', label: 'Salesman', visible: true, order: 12 },
        { id: 'application', label: 'Applic', visible: true, order: 13 },
        { id: 'area', label: 'Area', visible: true, order: 14 },
        { id: 'qty', label: 'Qty', visible: true, order: 16 },
        { id: 'cutting', label: 'Cutting', visible: true, order: 17 },
        { id: 'balance', label: 'Balance', visible: true, order: 18 },
        { id: 'production_meter', label: 'Meter', visible: true, order: 19 },
        { id: 'created_at', label: 'Date', visible: true, order: 20 },
        { id: 'estimated_delivery', label: 'Estimated Delivery', visible: true, order: 21 },
        { id: 'actions', label: 'Actions', visible: true, order: 22, alwaysVisible: true }
    ];

    const [columns, setColumns] = useState(() => {
        const savedColumns = localStorage.getItem('panelTableColumns');
        if (savedColumns) {
            const parsedColumns = JSON.parse(savedColumns);
            const filteredColumns = parsedColumns.filter(col => col.id !== 'brand');
            if (filteredColumns.length !== parsedColumns.length) {
                localStorage.setItem('panelTableColumns', JSON.stringify(filteredColumns));
                return filteredColumns;
            }
            return parsedColumns;
        }
        return defaultColumns;
    });

    const refreshAllProductionRecords = async () => {
        await fetchAllProductionRecords();
    };

    const handleDeleteAllByJob = async (jobNo) => {
        if (!jobNo) return;
        const jobPanels = panels.filter(p => p.job_no === jobNo);
        if (jobPanels.length === 0) return;
        
        if (!window.confirm(`Are you sure you want to delete ALL ${jobPanels.length} panels for job "${jobNo}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            await viewPanelAPI.deleteByJob(jobNo);
            setSuccess(`All panels for job ${jobNo} deleted successfully.`);
            await fetchPanels();
        } catch (err) {
            console.error('Failed to delete panels by job:', err);
            setError('Failed to delete panels: ' + (err.message || 'Unknown error'));
        }
    };

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
        estimated_delivery: '',
        created_at: '',
        notes: ''
    };

    const [newPanel, setNewPanel] = useState({...defaultPanelValues});

    const [filters, setFilters] = useState({
        reference_number: '',
        job_no: '',
        type: '',
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
        estimated_delivery: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    const [uniqueValues, setUniqueValues] = useState({
        jobNos: [],
        types: [],
        statuses: [],
        salesmen: [],
        panelThks: [],
        joints: [],
        surfaceFronts: [],
        surfaceBacks: [],
        surfaceFrontThks: [],
        surfaceBackThks: [],
        surfaceTypes: [],
        widths: [],
        lengths: [],
        qtys: [],
        cuttings: [],
        applications: [],
        createdDates: [],
        estimatedDeliveries: [],
        referenceNumbers: []
    });

    const [productionRefs, setProductionRefs] = useState([]);
    const createModalRef = useRef(null);
    const inputRefs = useRef([]);

    const formLayout = useMemo(() => [
        ['job_no', 'type', 'panel_thk'],
        ['application', 'joint', 'surface_front'],
        ['surface_back', 'surface_front_thk', 'surface_back_thk'],
        ['surface_type', 'width', 'length'],
        ['qty', 'cutting', 'status'],
        ['production_meter', 'salesman'],
        ['estimated_delivery','created_at', 'notes', '']
    ], []);

    const formatDateForInput = (timestamp) => {
        if (!timestamp) return '';
        if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) return timestamp;
        if (typeof timestamp === 'string' && timestamp.includes('T')) return timestamp.split('T')[0];
        if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
            return timestamp.split(' ')[0];
        }
        if (timestamp instanceof Date) return timestamp.toISOString().split('T')[0];
        return timestamp || '';
    };

    const convertToISOString = (dateString) => {
        if (!dateString) return null;
        try {
            if (dateString.includes('T')) return dateString;
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString + 'T00:00:00.000Z').toISOString();
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) return date.toISOString();
            return null;
        } catch { return null; }
    };

    useEffect(() => {
        localStorage.setItem('panelTableColumns', JSON.stringify(columns));
    }, [columns]);

    useEffect(() => {
        fetchPanels();
        fetchAllProductionRecords();
        fetchProductionReferences();
    }, []);

    useEffect(() => {
        if (productionMeterDate) {
            calculateDailyProductionMeter();
        } else {
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0,
                totalMeterInMeters: 0,
                estimatedTimeMinutes: 0,
                estimatedTimeHours: 0,
                estimatedTimeRemainingMinutes: 0
            });
        }
    }, [productionMeterDate, allProductionRecords, estimatedRunningSpeed]);

    useEffect(() => {
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
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        } catch { return null; }
                    }
                    return value.toString().trim();
                })
                .filter(p => p);
            const unique = [...new Set(values)];
            if (isNumeric) return unique.sort((a, b) => parseFloat(a) - parseFloat(b));
            if (isDate) return unique.sort((a, b) => new Date(b) - new Date(a));
            return unique.sort();
        };

        setUniqueValues({
            jobNos: getUnique('job_no'),
            types: getUnique('type'),
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
            referenceNumbers: getUnique('reference_number')
        });
    }, [panels]);

    const fetchProductionReferences = async () => {
        try {
            const data = await productionAPI.getAll();
            if (Array.isArray(data)) {
                const refs = data.map(r => r.reference_number).filter(Boolean);
                setProductionRefs([...new Set(refs)].sort());
            }
        } catch (err) { console.error('Failed to fetch production references:', err); }
    };

    const fetchAllProductionRecords = async () => {
        try {
            const data = await productionAPI.getAll();
            if (Array.isArray(data)) {
                setAllProductionRecords(data);
            }
        } catch (err) {
            console.error('Failed to fetch all production records:', err);
        }
    };

    const handleWheel = (e) => e.target.blur();

    const fetchPanels = async () => {
        setIsLoading(true); setError(null);
        try {
            const data = await viewPanelAPI.getAll();
            if (Array.isArray(data)) {
                const valid = data.filter(p => p && p.id);
                const withBalance = valid.map(p => ({ ...p, balance: p.balance !== undefined ? p.balance : (p.qty || 0) }));
                setPanels(withBalance);
            } else { setError('Invalid data received'); setPanels([]); }
        } catch (err) { console.error('Failed to fetch panels:', err); setError('Failed to load panels.'); setPanels([]); }
        finally { setIsLoading(false); }
    };

    const calculateDailyProductionMeter = () => {
        if (!productionMeterDate) return;
        try {
            let totalMeter = 0;
            let panelCount = 0;
            const dateStr = productionMeterDate;

            allProductionRecords.forEach(record => {
                if (!record.created_at) return;
                const recordDate = new Date(record.created_at);
                const year = recordDate.getFullYear();
                const month = String(recordDate.getMonth() + 1).padStart(2, '0');
                const day = String(recordDate.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;

                if (localDateStr === dateStr) {
                    const panelsProduced = parseInt(record.number_of_panels) || 0;
                    const length = parseFloat(record.panel?.length) || 
                                   parseFloat(record.panel_length) || 
                                   parseFloat(record.length) || 
                                   0;
                    totalMeter += length * panelsProduced;
                    panelCount += panelsProduced;
                }
            });

            const totalMeterInMeters = totalMeter;
            const estimatedTimeMinutes = estimatedRunningSpeed > 0 ? totalMeterInMeters / estimatedRunningSpeed : 0;
            const estimatedTimeHours = Math.floor(estimatedTimeMinutes / 60);
            const estimatedTimeRemainingMinutes = Math.round(estimatedTimeMinutes % 60);

            setDailyProductionMeter({
                totalMeter,
                panelCount,
                totalMeterInMeters,
                estimatedTimeMinutes,
                estimatedTimeHours,
                estimatedTimeRemainingMinutes
            });
        } catch (err) {
            console.error('Failed to calculate daily production meter:', err);
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0,
                totalMeterInMeters: 0,
                estimatedTimeMinutes: 0,
                estimatedTimeHours: 0,
                estimatedTimeRemainingMinutes: 0
            });
        }
    };
    
    const updatePanelBalance = (panelId, newBalance) => setPanels(prev => prev.map(p => p.id === panelId ? { ...p, balance: Math.max(0, newBalance) } : p));

    const openDuplicateModal = (panel) => { setSelectedPanelToDuplicate(panel); setNumberOfCopies(1); setIsDuplicateModalOpen(true); };
    const closeDuplicateModal = () => { setIsDuplicateModalOpen(false); setSelectedPanelToDuplicate(null); setNumberOfCopies(1); };

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
                const sequences = todayRefs.map(ref => { const match = ref.match(/\d+$/); return match ? parseInt(match[0]) : 0; });
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
                const newJobNo = originalJobNo;
                const originalNotes = panel.notes || '';
                const newNotes = originalNotes ? `${originalNotes}\n\n---\nDuplicate of ${panel.reference_number}` : `Duplicate of ${panel.reference_number}`;
                let formattedEstimatedDelivery = null;
                if (panel.estimated_delivery) {
                    try { const date = new Date(panel.estimated_delivery); if (!isNaN(date.getTime())) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); formattedEstimatedDelivery = `${year}-${month}-${day}`; } }
                    catch (error) { formattedEstimatedDelivery = null; }
                }
                let formattedCreatedAt = null;
                if (panel.created_at) formattedCreatedAt = formatDateForInput(panel.created_at);
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
                    estimated_delivery: formattedEstimatedDelivery,
                    created_at: formattedCreatedAt ? convertToISOString(formattedCreatedAt) : null
                };
                Object.keys(panelData).forEach(key => { if (panelData[key] === '' || panelData[key] === undefined) panelData[key] = null; });
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({ ...createdPanel, balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0) });
            }
            setPanels(prev => [...newPanels, ...prev]);
            
            if (isJobOverviewModalOpen && selectedJobForOverview && selectedJobForOverview.job === panel.job_no) {
                const updatedJobPanels = panels
                    .filter(p => p.job_no === panel.job_no)
                    .concat(newPanels);
                setSelectedJobForOverview(prev => ({
                    ...prev,
                    panels: updatedJobPanels
                }));
            }
            
            closeDuplicateModal();
            setError(null);
            if (count === 1) alert(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            else alert(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
        } catch (err) { console.error('Failed to duplicate panel:', err); setError('Failed to duplicate panel: ' + (err.message || 'Unknown error')); }
    };

    const calculateArea = (width, length, quantity) => {
        const w = parseFloat(width) || 0;
        const l = parseFloat(length) || 0;
        const q = parseInt(quantity) || 0;
        if (w <= 0 || l <= 0) return 0;
        return (w * l * q);
    };

    const handleDuplicateFromCreateForm = async () => {
        if (!newPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!newPanel.width || !newPanel.length) { setError('Width and Length are required'); return; }
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
                const sequences = todayRefs.map(ref => { const match = ref.match(/\d+$/); return match ? parseInt(match[0]) : 0; });
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
                const newJobNo = originalJobNo;
                const originalNotes = newPanel.notes || '';
                const newNotes = originalNotes ? `${originalNotes}\n\n---\nCreated from form` : `Created from form`;
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
                    estimated_delivery: newPanel.estimated_delivery || null,
                    created_at: newPanel.created_at ? convertToISOString(newPanel.created_at) : null
                };
                Object.keys(panelData).forEach(key => { if (panelData[key] === '' || panelData[key] === undefined) panelData[key] = null; });
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({ ...createdPanel, balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0) });
            }
            setPanels(prev => [...newPanels, ...prev]);
            
            if (isJobOverviewModalOpen && selectedJobForOverview && selectedJobForOverview.job === newPanel.job_no) {
                const updatedJobPanels = panels
                    .filter(p => p.job_no === newPanel.job_no)
                    .concat(newPanels);
                setSelectedJobForOverview(prev => ({
                    ...prev,
                    panels: updatedJobPanels
                }));
            }
            
            setIsCreateFormDuplicateModalOpen(false);
            setNewPanel({...defaultPanelValues});
            setError(null);
            if (count === 1) setSuccess(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            else setSuccess(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) { console.error('Failed to duplicate from form:', err); setError('Failed to duplicate from form: ' + (err.message || 'Unknown error')); }
    };

    const handleDuplicateInCreateModal = () => { setIsCreateFormDuplicateModalOpen(true); setDuplicateFormCopies(1); setError(null); };

    const filteredPanels = useMemo(() => {
        let filtered = panels.filter(panel => {
            if (!panel || !panel.id) return false;
            if (filters.search) {
                const lower = filters.search.toLowerCase();
                const fields = [panel.reference_number, panel.job_no?.toString(), panel.type, panel.salesman, panel.joint,
                    panel.surface_front, panel.surface_back, panel.surface_type, panel.cutting, panel.application];
                if (!fields.some(f => f && f.toString().toLowerCase().includes(lower))) return false;
            }
            if (filters.reference_number && !panel.reference_number?.toLowerCase().includes(filters.reference_number.toLowerCase())) return false;
            if (filters.job_no && !panel.job_no?.toString().toLowerCase().includes(filters.job_no.toLowerCase())) return false;
            if (filters.type && panel.type !== filters.type) return false;
            if (filters.status && panel.status !== filters.status) return false;
            if (filters.panel_thk) { const pthk = parseFloat(panel.panel_thk) || 0; const fthk = parseFloat(filters.panel_thk); if (pthk !== fthk) return false; }
            if (filters.joint && panel.joint !== filters.joint) return false;
            if (filters.surface_front && panel.surface_front !== filters.surface_front) return false;
            if (filters.surface_back && panel.surface_back !== filters.surface_back) return false;
            if (filters.surface_front_thk) { const pft = parseFloat(panel.surface_front_thk) || 0; const fft = parseFloat(filters.surface_front_thk); if (pft !== fft) return false; }
            if (filters.surface_back_thk) { const pbt = parseFloat(panel.surface_back_thk) || 0; const fbt = parseFloat(filters.surface_back_thk); if (pbt !== fbt) return false; }
            if (filters.surface_type && panel.surface_type !== filters.surface_type) return false;
            if (filters.cutting && panel.cutting !== filters.cutting) return false;
            if (filters.width) { const pw = parseFloat(panel.width) || 0; const fw = parseFloat(filters.width); if (pw !== fw) return false; }
            if (filters.length) { const pl = parseFloat(panel.length) || 0; const fl = parseFloat(filters.length); if (pl !== fl) return false; }
            if (filters.qty) { const pq = parseInt(panel.qty) || 0; const fq = parseInt(filters.qty); if (pq !== fq) return false; }
            if (filters.balance_status) {
                const bal = panel.balance !== undefined ? panel.balance : (panel.qty || 0);
                switch (filters.balance_status) {
                    case 'positive': if (bal <= 0) return false; break;
                    case 'zero': if (bal !== 0) return false; break;
                    case 'negative': if (bal >= 0) return false; break;
                    case 'low': if (bal > (panel.qty || 0) * 0.1) return false; break;
                    default: break;
                }
            }
            return true;
        });

        filtered.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === 'balance') { aVal = a.balance !== undefined ? a.balance : (a.qty || 0); bVal = b.balance !== undefined ? b.balance : (b.qty || 0); }
            if (sortConfig.key === 'reference_number') { aVal = parseInt(aVal?.split('-').pop() || '0'); bVal = parseInt(bVal?.split('-').pop() || '0'); }
            if (['job_no', 'width', 'length', 'surface_front_thk', 'surface_back_thk', 'panel_thk', 'qty', 'production_meter'].includes(sortConfig.key)) {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }
            if (sortConfig.key === 'created_at' || sortConfig.key === 'estimated_delivery') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [panels, filters, sortConfig]);

    const groupedPanels = useMemo(() => {
        const groups = {};
        filteredPanels.forEach(panel => {
            const job = panel.job_no || 'No Job Number';
            if (!groups[job]) groups[job] = [];
            groups[job].push(panel);
        });
        return Object.keys(groups).sort().map(job => ({
            job,
            panels: groups[job]
        }));
    }, [filteredPanels]);

    const visibleColumns = useMemo(() => {
        return columns
            .filter(col => col.visible || col.alwaysVisible)
            .sort((a, b) => a.order - b.order);
    }, [columns]);

    const toggleColumnVisibility = (columnId) => {
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, visible: !col.visible } : col));
    };

    const moveColumn = (columnId, direction) => {
        setColumns(prev => {
            const newColumns = [...prev];
            const index = newColumns.findIndex(col => col.id === columnId);
            if (direction === 'up' && index > 0) {
                [newColumns[index], newColumns[index - 1]] = [newColumns[index - 1], newColumns[index]];
            } else if (direction === 'down' && index < newColumns.length - 1) {
                [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
            }
            return newColumns.map((col, idx) => ({ ...col, order: idx + 1 }));
        });
    };

    const resetToDefaultColumns = () => setColumns(defaultColumns);
    const selectAllColumns = () => setColumns(prev => prev.map(col => ({ ...col, visible: true })));
    const deselectAllColumns = () => setColumns(prev => prev.map(col => ({ ...col, visible: col.alwaysVisible ? true : false })));

    const handleEditInputChange = (e) => { const { name, value } = e.target; setEditingPanel(prev => ({ ...prev, [name]: value })); };
    const handleNewPanelInputChange = (e) => { const { name, value } = e.target; setNewPanel(prev => ({ ...prev, [name]: value })); };
    const handleFilterChange = (e) => { const { name, value } = e.target; setFilters(prev => ({ ...prev, [name]: value })); };
    const handleProductionMeterDateChange = (e) => setProductionMeterDate(e.target.value);
    const handleSearchChange = (e) => setFilters(prev => ({ ...prev, search: e.target.value }));
    const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const handleUpdatePanel = async (e) => {
        e.preventDefault();
        if (!editingPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!editingPanel.width || !editingPanel.length) { setError('Width and Length are required'); return; }
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
                estimated_delivery: convertToISOString(editingPanel.estimated_delivery),
                created_at: editingPanel.created_at ? convertToISOString(editingPanel.created_at) : null
            };
            Object.keys(panelToUpdate).forEach(key => { if (panelToUpdate[key] === '') panelToUpdate[key] = null; });
            const updatedPanel = await viewPanelAPI.update(editingPanel.id, panelToUpdate);
            setPanels(prev => prev.map(p => p.id === updatedPanel.id ? { ...updatedPanel, balance: updatedPanel.balance !== undefined ? updatedPanel.balance : (updatedPanel.qty || 0) } : p));
            
            if (isJobOverviewModalOpen && selectedJobForOverview) {
                const updatedPanels = selectedJobForOverview.panels.map(p => 
                    p.id === updatedPanel.id ? { ...p, ...updatedPanel, balance: updatedPanel.balance !== undefined ? updatedPanel.balance : (updatedPanel.qty || 0) } : p
                );
                setSelectedJobForOverview(prev => ({ ...prev, panels: updatedPanels }));
            }
            
            setIsEditModalOpen(false); setEditingPanel(null); setError(null); setSuccess('Panel updated successfully!'); setTimeout(() => setSuccess(null), 3000);
        } catch (err) { console.error('Failed to update panel:', err); setError('Failed to update panel: ' + (err.message || 'Unknown error')); }
    };

    const handleCreatePanel = async (e) => {
        e.preventDefault();
        if (!newPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!newPanel.width || !newPanel.length) { setError('Width and Length are required'); return; }
        try {
            const existingRefs = panels.map(p => p.reference_number);
            const referenceNumber = generateReferenceNumber(existingRefs);
            const panelData = {
                ...newPanel, reference_number: referenceNumber,
                width: newPanel.width ? parseFloat(newPanel.width) : 0,
                length: newPanel.length ? parseFloat(newPanel.length) : 0,
                surface_front_thk: newPanel.surface_front_thk ? parseFloat(newPanel.surface_front_thk) : null,
                surface_back_thk: newPanel.surface_back_thk ? parseFloat(newPanel.surface_back_thk) : null,
                panel_thk: newPanel.panel_thk ? parseFloat(newPanel.panel_thk) : null,
                qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                balance: newPanel.qty ? parseInt(newPanel.qty) : null,
                production_meter: newPanel.production_meter ? parseFloat(newPanel.production_meter) : null,
                salesman: newPanel.salesman || null, notes: newPanel.notes || null,
                estimated_delivery: convertToISOString(newPanel.estimated_delivery),
                created_at: newPanel.created_at ? convertToISOString(newPanel.created_at) : null,
                application: newPanel.application || null
            };
            Object.keys(panelData).forEach(key => { if (panelData[key] === '') panelData[key] = null; });
            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [{ ...createdPanel, balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0) }, ...prev]);
            setSuccess(`Panel created successfully! Reference: ${referenceNumber}`); setError(null);
            setNewPanel({...defaultPanelValues});
            setTimeout(() => { const firstInput = createModalRef.current?.querySelector('input, select, textarea'); if (firstInput) firstInput.focus(); }, 100);
        } catch (err) { console.error('Failed to create panel:', err); setError('Failed to create panel: ' + (err.message || 'Unknown error')); }
    };

    const handleResetForm = () => { setNewPanel({...defaultPanelValues}); setError(null); setSuccess('Form reset to default values.'); setTimeout(() => { const firstInput = createModalRef.current?.querySelector('input, select, textarea'); if (firstInput) firstInput.focus(); }, 100); };

    const handleDeletePanel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this panel? All production records will also be deleted.')) return;
        try {
            await viewPanelAPI.delete(id);
            setPanels(prev => prev.filter(panel => panel.id !== id));
            if (selectedJobForOverview) {
                const updatedPanels = selectedJobForOverview.panels.filter(p => p.id !== id);
                setSelectedJobForOverview(prev => ({ ...prev, panels: updatedPanels }));
            }
            setSuccess('Panel deleted successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to delete panel:', err);
            setError('Failed to delete panel: ' + (err.message || 'Unknown error'));
        }
    };

    const openProductionModal = (panel) => setSelectedPanelForProduction(panel);
    const closeProductionModal = () => setSelectedPanelForProduction(null);
    const openEditModal = (panel) => {
        setEditingPanel({ ...panel, job_no: panel.job_no || '', application: panel.application || '', type: panel.type || '',
            panel_thk: panel.panel_thk || '', joint: panel.joint || '', surface_front: panel.surface_front || '',
            surface_back: panel.surface_back || '', surface_front_thk: panel.surface_front_thk || '',
            surface_back_thk: panel.surface_back_thk || '', surface_type: panel.surface_type || '',
            width: panel.width || '', length: panel.length || '', qty: panel.qty || '', cutting: panel.cutting || '',
            status: panel.status || 'pending', production_meter: panel.production_meter || '',
            estimated_delivery: formatDateForInput(panel.estimated_delivery) || '',
            created_at: formatDateForInput(panel.created_at) || '', salesman: panel.salesman || '',
            notes: panel.notes || '' });
        setIsEditModalOpen(true); setError(null);
    };
    const openCreateModal = () => { setIsCreateModalOpen(true); setError(null); setSuccess(null); setNewPanel({...defaultPanelValues}); };
    const closeEditModal = () => { setIsEditModalOpen(false); setEditingPanel(null); setError(null); };
    const closeCreateModal = () => { setIsCreateModalOpen(false); setNewPanel({...defaultPanelValues}); setError(null); setSuccess(null); };

    const openJobOverview = (job) => {
        setSelectedJobForOverview(job);
        setIsJobOverviewModalOpen(true);
        setEditingRowId(null);
        setEditedRowData(null);
        setEditError(null);
        setEditSuccess(null);
        setIsAddingNew(false);
        setNewRowData(null);
    };
    const closeJobOverview = () => {
        setIsJobOverviewModalOpen(false);
        setSelectedJobForOverview(null);
        setEditingRowId(null);
        setEditedRowData(null);
        setEditError(null);
        setEditSuccess(null);
        setIsAddingNew(false);
        setNewRowData(null);
    };

    const handleCellClick = (panel) => {
        if (editingRowId === panel.id) return;
        setEditingRowId(panel.id);
        setEditedRowData({
            ...panel,
            created_at: formatDateForInput(panel.created_at),
            estimated_delivery: formatDateForInput(panel.estimated_delivery)
        });
        setEditError(null);
        setEditSuccess(null);
    };

    const handleEditedFieldChange = (field, value) => {
        setEditedRowData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editedRowData) return;
        const originalPanel = panels.find(p => p.id === editingRowId);
        if (!originalPanel) return;

        const updates = {};
        const fieldsToCheck = [
            'job_no', 'type', 'panel_thk', 'joint', 'surface_front', 'surface_back',
            'surface_front_thk', 'surface_back_thk', 'surface_type', 'width', 'length',
            'salesman', 'application', 'qty', 'cutting', 'balance', 'status',
            'created_at', 'estimated_delivery'
        ];

        fieldsToCheck.forEach(field => {
            let originalValue = originalPanel[field];
            let newValue = editedRowData[field];

            if (field === 'created_at' || field === 'estimated_delivery') {
                originalValue = originalValue ? convertToISOString(originalValue) : null;
                newValue = newValue ? convertToISOString(newValue) : null;
            } else if (field === 'panel_thk' || field === 'surface_front_thk' || field === 'surface_back_thk' || field === 'width' || field === 'length') {
                originalValue = originalValue ? parseFloat(originalValue) : null;
                newValue = newValue ? parseFloat(newValue) : null;
            } else if (field === 'qty' || field === 'balance') {
                originalValue = originalValue ? parseInt(originalValue) : null;
                newValue = newValue ? parseInt(newValue) : null;
            }

            if (originalValue !== newValue) {
                updates[field] = editedRowData[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            setEditError('No changes to save');
            return;
        }

        try {
            setEditError(null);
            setEditSuccess(null);
            const updatedPanel = await viewPanelAPI.update(editingRowId, updates);
            setPanels(prev => prev.map(p => p.id === editingRowId ? { ...p, ...updatedPanel, balance: updatedPanel.balance !== undefined ? updatedPanel.balance : (updatedPanel.qty || 0) } : p));
            setSelectedJobForOverview(prev => {
                if (!prev) return prev;
                const updatedPanels = prev.panels.map(p => p.id === editingRowId ? { ...p, ...updatedPanel, balance: updatedPanel.balance !== undefined ? updatedPanel.balance : (updatedPanel.qty || 0) } : p);
                return { ...prev, panels: updatedPanels };
            });
            setEditSuccess('Panel updated successfully');
            setEditingRowId(null);
            setEditedRowData(null);
        } catch (err) {
            console.error('Failed to update panel:', err);
            setEditError('Failed to update: ' + (err.message || 'Unknown error'));
        }
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedRowData(null);
        setEditError(null);
        setEditSuccess(null);
    };

    const handleAddNewPanel = () => {
        const initialNewRow = {};
        visibleColumns.forEach(col => {
            if (col.type !== 'computed') {
                if (col.key === 'status') initialNewRow.status = 'pending';
                else if (col.key === 'job_no') initialNewRow.job_no = selectedJobForOverview?.job || '';
                else initialNewRow[col.key] = '';
            }
        });
        setNewRowData(initialNewRow);
        setIsAddingNew(true);
    };

    const handleSaveNewPanel = async () => {
        if (!newRowData) return;

        let jobNo = newRowData.job_no?.trim();
        if (!jobNo && selectedJobForOverview?.job) {
            jobNo = selectedJobForOverview.job;
            setNewRowData(prev => ({ ...prev, job_no: jobNo }));
        }

        if (!jobNo) {
            setEditError('Job No is required');
            return;
        }
        if (!newRowData.width || !newRowData.length) {
            setEditError('Width and Length are required');
            return;
        }

        try {
            setEditError(null);
            const existingRefs = panels.map(p => p.reference_number);
            const referenceNumber = generateReferenceNumber(existingRefs);

            const panelData = {
                ...newRowData,
                job_no: jobNo,
                reference_number: referenceNumber,
                width: newRowData.width ? parseFloat(newRowData.width) : 0,
                length: newRowData.length ? parseFloat(newRowData.length) : 0,
                qty: newRowData.qty ? parseInt(newRowData.qty) : null,
                balance: newRowData.qty ? parseInt(newRowData.qty) : null,
                status: newRowData.status || 'pending',
                estimated_delivery: newRowData.estimated_delivery ? convertToISOString(newRowData.estimated_delivery) : null,
                created_at: newRowData.created_at ? convertToISOString(newRowData.created_at) : null,
            };

            Object.keys(panelData).forEach(key => {
                if (panelData[key] === '') panelData[key] = null;
            });

            const createdPanel = await viewPanelAPI.create(panelData);

            setPanels(prev => [{ ...createdPanel, balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0) }, ...prev]);

            setSelectedJobForOverview(prev => ({
                ...prev,
                panels: [{ ...createdPanel, balance: createdPanel.balance !== undefined ? createdPanel.balance : (createdPanel.qty || 0) }, ...prev.panels]
            }));

            setEditSuccess('Panel created successfully');
            setIsAddingNew(false);
            setNewRowData(null);
        } catch (err) {
            console.error('Failed to create panel:', err);
            setEditError('Failed to create panel: ' + (err.message || 'Unknown error'));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'null';
        try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Invalid date'; return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return 'Invalid date'; }
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined || num === '') return 'null';
        const number = parseFloat(num);
        if (isNaN(number)) return 'null';
        return number.toLocaleString('en-US');
    };

    const formatDateForFilter = (dateString) => {
        if (!dateString) return 'null';
        try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Invalid date'; return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
        catch { return 'Invalid date'; }
    };

    const handleKeyDown = (e, rowIndex, colIndex, fieldName) => {};

    const handlePrint = (specificPanel = null) => {
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) { alert('Please allow popups to print the table'); return; }
            let panelsToPrint = specificPanel ? [specificPanel] : filteredPanels;
            const printContent = `<!DOCTYPE html><html><head><title>Panels Report - ${new Date().toLocaleDateString()}</title><style>@media print{@page{size:landscape;margin:10mm;}body{font-family:Arial,sans-serif;font-size:10pt;margin:0;padding:0;}table{width:100%;border-collapse:collapse;table-layout:auto;}th,td{border:1px solid #000;padding:4px 6px;text-align:left;font-size:9pt;vertical-align:top;word-wrap:break-word;max-width:80px;overflow-wrap:break-word;}th{background-color:#f2f2f2;font-weight:bold;}.no-print{display:none!important;}.print-header{text-align:center;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px;}.print-title{font-size:16pt;font-weight:bold;margin-bottom:5px;}.print-subtitle{font-size:11pt;color:#666;margin-bottom:10px;}.print-summary{margin-bottom:15px;font-size:10pt;}.total-area{font-weight:bold;margin-top:10px;border-top:1px solid #000;padding-top:5px;}.page-break{page-break-before:always;}.panel-row:nth-child(even){background-color:#f9f9f9;}}@media screen{body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}.no-screen{display:none;}}</style></head><body><div class="print-header"><div class="print-title">Panel Management System - Report</div><div class="print-subtitle">Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div><div class="print-summary">Total Panels: ${panelsToPrint.length} | Printed: ${specificPanel ? 'Single Panel' : 'Filtered List'} | Printed by: ${localStorage.getItem('username') || 'System User'}</div></div><table><thead><tr><th>Ref No</th><th>Job No</th><th>Type</th><th>Panel Thk (mm)</th><th>Joint</th><th>Surface Front</th><th>Surface Back</th><th>Front Thk</th><th>Back Thk</th><th>Surface Type</th><th>Width (mm)</th><th>Length (mm)</th><th>Salesman</th><th>Application</th><th>Area (m²)</th><th>Qty</th><th>Cutting</th><th>Balance</th><th>Prod Meter (mm)</th><th>Created Date</th><th>Est. Delivery</th></tr></thead><tbody>${panelsToPrint.map((panel, index) => { const panelQty = parseInt(panel.qty) || 0; const balance = panel.balance !== undefined ? panel.balance : (panel.qty || 0); const panelLength = parseFloat(panel.length) || 0; const panelWidth = parseFloat(panel.width) || 0; const alreadyProduced = panelQty - balance; const totalProductionMeter = (alreadyProduced * panelLength); const area = calculateArea(panelWidth, panelLength, panelQty) / 1000000; return `<tr class="panel-row"><td>${panel.reference_number || 'N/A'}</td><td>${panel.job_no || 'N/A'}</td><td>${panel.type || 'N/A'}</td><td>${panel.panel_thk ? formatNumber(panel.panel_thk) : 'null'}</td><td>${panel.joint || 'null'}</td><td>${panel.surface_front || 'null'}</td><td>${panel.surface_back || 'null'}</td><td>${panel.surface_front_thk ? formatNumber(panel.surface_front_thk) : 'null'}</td><td>${panel.surface_back_thk ? formatNumber(panel.surface_back_thk) : 'null'}</td><td>${panel.surface_type || 'null'}</td><td>${panel.width ? formatNumber(panel.width) : 'null'}</td><td>${panel.length ? formatNumber(panel.length) : 'null'}</td><td>${panel.salesman || 'null'}</td><td>${panel.application || 'null'}</td><td>${area > 0 ? area.toFixed(3) : '0'}</td><td>${formatNumber(panel.qty)}</td><td>${panel.cutting || 'null'}</td><td>${formatNumber(balance)}</td><td>${totalProductionMeter.toFixed(2)}</td><td>${formatDate(panel.created_at)}</td><td>${formatDate(panel.estimated_delivery)}</td></tr>`; }).join('')}</tbody></table><div style="text-align:center; margin-top:20px; font-size:9pt; color:#666;" class="no-print"><p>--- End of Report ---</p><p>This document is generated from Panel Management System</p></div></body></html>`;
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.onload = function() { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500); };
        } catch (error) { console.error('Error printing:', error); alert('Error generating print document. Please try again.'); }
    };

    const handleColumnChipClick = (columnId) => toggleColumnVisibility(columnId);

    const renderCardField = (panel, column) => {
        const panelQty = parseInt(panel.qty) || 0;
        const balance = panel.balance !== undefined ? panel.balance : (panel.qty || 0);
        const panelLength = parseFloat(panel.length) || 0;
        const panelWidth = parseFloat(panel.width) || 0;
        const alreadyProduced = panelQty - balance;
        const totalProductionMeter = (alreadyProduced * panelLength);
        const area = calculateArea(panelWidth, panelLength, panelQty)/1000000;

        switch(column.id) {
            case 'job_no':
                return <div className="card-field"><span className="field-label">Job No:</span> <strong>{panel.job_no || 'null'}</strong><div className="panel-ref">{panel.reference_number}</div></div>;
            case 'type': return <div className="card-field"><span className="field-label">Type:</span> {panel.type || 'null'}</div>;
            case 'panel_thk': return <div className="card-field"><span className="field-label">Panel Thk:</span> {panel.panel_thk ? `${formatNumber(panel.panel_thk)} mm` : 'null'}</div>;
            case 'joint': return <div className="card-field"><span className="field-label">Joint:</span> {panel.joint || 'null'}</div>;
            case 'surface_front': return <div className="card-field"><span className="field-label">Front:</span> {panel.surface_front || 'null'}</div>;
            case 'surface_back': return <div className="card-field"><span className="field-label">Back:</span> {panel.surface_back || 'null'}</div>;
            case 'surface_front_thk': return <div className="card-field"><span className="field-label">Front Thk:</span> {panel.surface_front_thk ? `${formatNumber(panel.surface_front_thk)}` : 'null'}</div>;
            case 'surface_back_thk': return <div className="card-field"><span className="field-label">Back Thk:</span> {panel.surface_back_thk ? `${formatNumber(panel.surface_back_thk)}` : 'null'}</div>;
            case 'surface_type': return <div className="card-field"><span className="field-label">Finishes:</span> {panel.surface_type || 'null'}</div>;
            case 'width': return <div className="card-field"><span className="field-label">Width:</span> {panel.width ? `${formatNumber(panel.width)} mm` : 'null'}</div>;
            case 'length': return <div className="card-field"><span className="field-label">Length:</span> {panel.length ? `${formatNumber(panel.length)} mm` : 'null'}</div>;
            case 'salesman': return <div className="card-field"><span className="field-label">Salesman:</span> {panel.salesman || 'null'}</div>;
            case 'application': return <div className="card-field"><span className="field-label">Application:</span> {panel.application || 'null'}</div>;
            case 'area': return <div className="card-field"><span className="field-label">Area:</span> {area > 0 ? area.toFixed(3) : '0'} m²</div>;
            case 'qty': return <div className="card-field"><span className="field-label">Qty:</span> {formatNumber(panel.qty)}</div>;
            case 'cutting': return <div className="card-field"><span className="field-label">Cutting:</span> {panel.cutting || 'null'}</div>;
            case 'balance': return <div className="card-field"><span className="field-label">Balance:</span> <span className={`balance-value ${balance <= 0 ? 'zero' : ''}`}>{formatNumber(balance)}</span></div>;
            case 'production_meter': return <div className="card-field"><span className="field-label">Prod Meter:</span> {totalProductionMeter.toFixed(2)} mm <span className="meter-details">({alreadyProduced} panels)</span></div>;
            case 'created_at': return <div className="card-field"><span className="field-label">Created:</span> {formatDate(panel.created_at)}</div>;
            case 'estimated_delivery': return <div className="card-field"><span className="field-label">Est. Delivery:</span> {formatDate(panel.estimated_delivery)}{panel.estimated_delivery && (<span className="delivery-status">{new Date(panel.estimated_delivery) < new Date() ? <span className="past-due" title="Past due">⚠️</span> : <span className="upcoming" title="Upcoming">📅</span>}</span>)}</div>;
            default: return null;
        }
    };

    const toggleGroup = (job) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(job)) {
                newSet.delete(job);
            } else {
                newSet.add(job);
            }
            return newSet;
        });
    };

    const columnFilterMap = {
        job_no: { uniqueKey: 'jobNos', filterKey: 'job_no' },
        type: { uniqueKey: 'types', filterKey: 'type' },
        panel_thk: { uniqueKey: 'panelThks', filterKey: 'panel_thk' },
        joint: { uniqueKey: 'joints', filterKey: 'joint' },
        surface_front: { uniqueKey: 'surfaceFronts', filterKey: 'surface_front' },
        surface_back: { uniqueKey: 'surfaceBacks', filterKey: 'surface_back' },
        surface_front_thk: { uniqueKey: 'surfaceFrontThks', filterKey: 'surface_front_thk' },
        surface_back_thk: { uniqueKey: 'surfaceBackThks', filterKey: 'surface_back_thk' },
        surface_type: { uniqueKey: 'surfaceTypes', filterKey: 'surface_type' },
        width: { uniqueKey: 'widths', filterKey: 'width' },
        length: { uniqueKey: 'lengths', filterKey: 'length' },
        salesman: { uniqueKey: 'salesmen', filterKey: 'salesman' },
        application: { uniqueKey: 'applications', filterKey: 'application' },
        qty: { uniqueKey: 'qtys', filterKey: 'qty' },
        cutting: { uniqueKey: 'cuttings', filterKey: 'cutting' },
        balance: { filterKey: 'balance_status' },
        created_at: { uniqueKey: 'createdDates', filterKey: 'created_at' },
        estimated_delivery: { uniqueKey: 'estimatedDeliveries', filterKey: 'estimated_delivery' },
        reference_number: { uniqueKey: 'referenceNumbers', filterKey: 'reference_number' },
        status: { uniqueKey: 'statuses', filterKey: 'status' }
    };

    const handleFilterSelect = (columnId, value) => {
        const mapping = columnFilterMap[columnId];
        if (mapping) setFilters(prev => ({ ...prev, [mapping.filterKey]: value }));
        setActiveFilterColumn(null);
    };

    const handleFilterIconClick = (e, columnId) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX
        });
        setActiveFilterColumn(activeFilterColumn === columnId ? null : columnId);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (portalDropdownRef.current && !portalDropdownRef.current.contains(event.target)) {
                const filterIcon = document.querySelector(`.filter-icon-btn[data-column="${activeFilterColumn}"]`);
                if (filterIcon && filterIcon.contains(event.target)) {
                    return;
                }
                setActiveFilterColumn(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeFilterColumn]);

    const jobOverviewColumns = [
        { key: 'joint', label: 'Joint', type: 'text' },
        { key: 'type', label: 'Type', type: 'text' },
        { key: 'panel_thk', label: 'Panel Thk', type: 'number' },
        { key: 'surface_front', label: 'Front', type: 'text' },
        { key: 'surface_back', label: 'Back', type: 'text' },
        { key: 'surface_front_thk', label: 'Front Thk', type: 'number' },
        { key: 'surface_back_thk', label: 'Back Thk', type: 'number' },
        { key: 'surface_type', label: 'Finishes', type: 'text' },
        { key: 'width', label: 'Width', type: 'number' },
        { key: 'length', label: 'Length', type: 'number' },
        { key: 'salesman', label: 'Salesman', type: 'text' },
        { key: 'application', label: 'Applic', type: 'text' },
        { key: 'area', label: 'Area', type: 'computed' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'cutting', label: 'Cutting', type: 'text' },
        { key: 'balance', label: 'Balance', type: 'number' },
        { key: 'production_meter', label: 'Meter', type: 'computed' },
        { key: 'created_at', label: 'Date', type: 'date' },
        { key: 'estimated_delivery', label: 'Estimated Delivery', type: 'date' }
    ];

    const [jobOverviewVisibleColumns, setJobOverviewVisibleColumns] = useState(jobOverviewColumns.map(col => col.key));
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const selectorRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target)) {
                setShowColumnSelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const jobOverviewFilteredColumns = jobOverviewColumns.filter(col =>
        jobOverviewVisibleColumns.includes(col.key)
    );

    return (
        <div className="view-panel-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate(0)}>← Back</button>
                    <h1 className="header-title">Panel Management System</h1>
                </div>
            </header>

            {success && <div className="alert alert-success global-success">{success}</div>}

            <div className="view-toggle-buttons" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0' }}>
                <button 
                    className={`btn btn-primary ${activeView === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveView('table')}
                >
                    Panels Table
                </button>
                <button 
                    className={`btn btn-secondary ${activeView === 'productionMeter' ? 'active' : ''}`}
                    onClick={() => setActiveView('productionMeter')}
                >
                    Production Meter By Date
                </button>
                <button className="btn btn-success" onClick={openCreateModal}>
                    Create New Panel
                </button>
            </div>

            {activeView === 'productionMeter' && (
                <div className="daily-production-meter-section">
                    <div className="filter-card">
                        <h3>Production Meter by Production Date</h3>
                        <div className="daily-filter-row">
                            <div className="form-group">
                                <label>Select Production Date</label>
                                <input type="date" value={productionMeterDate} onChange={handleProductionMeterDateChange} className="form-input" />
                            </div>
                            <div className="form-group">
                                <button className="btn btn-secondary" onClick={() => setProductionMeterDate('')}>Clear Date</button>
                            </div>
                        </div>
                        {productionMeterDate && (
                            <div className="daily-production-summary">
                                <div className="summary-card">
                                    <h4>Production Meter Summary for {formatDate(productionMeterDate)}</h4>
                                    <div className="summary-stats">
                                        <div className="daily-stat"><span className="stat-label">Total Production Meter:</span><span className="stat-value">{dailyProductionMeter.totalMeter.toFixed(2)} mm</span></div>
                                        <div className="daily-stat"><span className="stat-label">Number of Panels:</span><span className="stat-value">{dailyProductionMeter.panelCount}</span></div>
                                        <div className="daily-stat"><span className="stat-label">Average Meter per Panel:</span><span className="stat-value">{dailyProductionMeter.panelCount > 0 ? (dailyProductionMeter.totalMeter / dailyProductionMeter.panelCount).toFixed(2) : '0'} mm</span><div className="stat-subtext">({dailyProductionMeter.panelCount > 0 ? (dailyProductionMeter.totalMeterInMeters / dailyProductionMeter.panelCount).toFixed(2) : '0'} meters)</div></div>
                                        <div className="daily-stat"><span className="stat-label">Estimated Running Speed:</span><span className="stat-value">{estimatedRunningSpeed.toFixed(1)} M/Minutes</span></div>
                                        <div className="daily-stat highlight"><span className="stat-label">Estimated Time to Complete:</span><span className="stat-value">{dailyProductionMeter.estimatedTimeHours > 0 ? `${dailyProductionMeter.estimatedTimeHours} hours ` : ''}{dailyProductionMeter.estimatedTimeRemainingMinutes} minutes</span><div className="stat-subtext">({dailyProductionMeter.estimatedTimeMinutes.toFixed(1)} total minutes)</div></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeView === 'table' && (
                <div className="table-container">
                    {error && <div className="alert alert-danger">{error}</div>}
                    <div className="column-selection-chips">
                        <div className="chips-header">
                            <h4>Selected Columns ({visibleColumns.length - 1})</h4>
                            <div className="chips-controls">
                                <button className="btn btn-sm btn-secondary" onClick={() => setIsColumnSelectionModalOpen(true)}>
                                    <span className="chip-icon">⚙️</span> Manage Columns
                                </button>
                                <button className="btn btn-sm btn-outline" onClick={selectAllColumns}>Select All</button>
                                <button className="btn btn-sm btn-outline" onClick={deselectAllColumns}>Deselect All</button>
                            </div>
                        </div>
                       <div className="chips-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {columns.filter(col => !col.alwaysVisible).sort((a, b) => a.order - b.order).map(column => (
                            <div 
                                key={column.id} 
                                className={`column-chip ${column.visible ? 'active' : 'inactive'}`}
                                onClick={() => handleColumnChipClick(column.id)}
                            >
                                <span className="chip-label">{column.label}</span>
                                <span className="chip-indicator">{column.visible ? '✓' : '✗'}</span>
                                <button
                                    className={`filter-icon-btn ${filters[columnFilterMap[column.id]?.filterKey] ? 'active' : ''}`}
                                    data-column={column.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterIconClick(e, column.id);
                                    }}
                                    style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                    title="Filter"
                                >
                                    🔽
                                </button>
                            </div>
                        ))}
                    </div>
                    </div>

                    {isLoading ? (
                        <div className="loading-state"><div className="loading-spinner"></div><p>Loading panels...</p></div>
                    ) : filteredPanels.length === 0 && panels.length > 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🔍</div><h3>No panels match your filters</h3><p>Try adjusting your search criteria</p></div>
                    ) : filteredPanels.length === 0 && panels.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No panels available</h3><p>Start by adding your first panel</p></div>
                    ) : (
                        <>
                            <div className="table-header">
                                <h3>Panels ({filteredPanels.length} of {panels.length})</h3>
                                <div className="table-header-controls">
                                    <div className="action-controls">
                                        <button className="print-btn" onClick={() => setIsPrintSelectionModalOpen(true)} title="Print Panels">🖨️ Print</button>
                                    </div>
                                </div>
                            </div>

                            <div className="grouped-cards">
                                {groupedPanels.map(group => (
                                    <div key={group.job} className="job-group">
                                        <div className="group-header" onClick={() => toggleGroup(group.job)}>
                                    <span className="group-toggle">{expandedGroups.has(group.job) ? '▼' : '▶'}</span>
                                    <span className="group-title">{group.job}</span>
                                    <span className="group-count">({group.panels.length} panel{group.panels.length !== 1 ? 's' : ''})</span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                        <button 
                                            className="overview-btn"
                                            onClick={(e) => { e.stopPropagation(); openJobOverview(group); }}
                                            title="View job overview"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                        >
                                            📋
                                        </button>
                                        <button 
                                            className="delete-job-btn"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteAllByJob(group.job); }}
                                            title="Delete all panels in this job"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#dc2626' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                        {expandedGroups.has(group.job) && (
                                            <div className="card-grid">
                                                {group.panels.map(panel => (
                                                    <div key={panel.id} className="panel-card">
                                                        <div className="card-header">
                                                            <span className="card-title">{panel.reference_number}</span>
                                                            <span className={`card-status status-${panel.status || 'pending'}`}>{panel.status || 'pending'}</span>
                                                        </div>
                                                        <div className="card-body">
                                                            {visibleColumns.filter(col => col.id !== 'actions').map(column => (
                                                                <React.Fragment key={column.id}>
                                                                    {renderCardField(panel, column)}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        <div className="card-actions">
                                                            <button onClick={() => openEditModal(panel)} className="action-btn edit-btn" title="Edit">✏️</button>
                                                            <button onClick={() => openDuplicateModal(panel)} className="action-btn duplicate-btn" title="Duplicate">⎘</button>
                                                            <button onClick={() => openProductionModal(panel)} className="action-btn production-btn" title="Production">🏭</button>
                                                            <button onClick={() => handlePrint(panel)} className="action-btn print-btn" title="Print">🖨️</button>
                                                            <button onClick={() => handleDeletePanel(panel.id)} className="action-btn delete-btn" title="Delete">🗑️</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {selectedPanelForProduction && (
                <ProductionDetailsModal
                    panel={selectedPanelForProduction}
                    onClose={closeProductionModal}
                    updatePanelBalance={updatePanelBalance}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                    onProductionRecordCreated={refreshAllProductionRecords}
                />
            )}

            {isJobOverviewModalOpen && selectedJobForOverview && (
                <div className="modal-overlay" onClick={closeJobOverview}>
                    <div className="modal-content" style={{ width: '98vw', maxWidth: '1600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" ref={modalHeaderRef}>
                            <h2>Job Overview: {selectedJobForOverview.job}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 , marginLeft: 'auto' }}>
                            <div className="column-selector" style={{ position: 'relative', margin: 0, padding: 0, marginRight: '-1px' }}>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                                    style={{ margin: 0 }}
                                >
                                    Columns
                                </button>
                                {showColumnSelector && (
                                    <div
                                        ref={selectorRef}
                                        className="column-selector-dropdown"
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            background: 'white',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                            padding: '8px',
                                            zIndex: 1000,
                                            maxHeight: '300px',
                                            overflowY: 'auto',
                                            minWidth: '200px',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {jobOverviewColumns.map(col => (
                                            <label key={col.key} style={{ display: 'block', marginBottom: '4px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={jobOverviewVisibleColumns.includes(col.key)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setJobOverviewVisibleColumns([...jobOverviewVisibleColumns, col.key]);
                                                        } else {
                                                            setJobOverviewVisibleColumns(jobOverviewVisibleColumns.filter(k => k !== col.key));
                                                        }
                                                    }}
                                                />
                                                {' '}{col.label}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={closeJobOverview}
                                style={{ margin: 0 }}
                            >
                                Close
                            </button>
                        </div>
                        </div>
                        <div className="modal-body">
                            {editError && <div className="alert alert-danger">{editError}</div>}
                            {editSuccess && <div className="alert alert-success">{editSuccess}</div>}
                            <JobOverviewContent
                                job={selectedJobForOverview.job}
                                panels={selectedJobForOverview.panels}
                                editingRowId={editingRowId}
                                editedRowData={editedRowData}
                                handleCellClick={handleCellClick}
                                handleEditedFieldChange={handleEditedFieldChange}
                                handleSaveEdit={handleSaveEdit}
                                handleCancelEdit={handleCancelEdit}
                                formatDate={formatDate}
                                calculateArea={calculateArea}
                                visibleColumns={jobOverviewFilteredColumns}
                                openDuplicateModal={openDuplicateModal}
                                handlePrint={handlePrint}
                                handleDeletePanel={handleDeletePanel}
                                openProductionModal={openProductionModal}
                                onAddNewPanel={handleAddNewPanel}
                                isAddingNew={isAddingNew}
                                newRowData={newRowData}
                                setNewRowData={setNewRowData}
                                handleSaveNewPanel={handleSaveNewPanel}
                                stickyTop={modalHeaderHeight}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal-content create-modal" onClick={e => e.stopPropagation()} ref={createModalRef}>
                        <div className="modal-header"><h2>Create New Panel</h2><button type="button" className="close-button" onClick={closeCreateModal}>×</button></div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            {success && <div className="alert alert-success">{success}</div>}
                            <form onSubmit={handleCreatePanel}>
                                <div className="form-grid">
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-job_no">Job No <span className="required-star">*</span></label><input id="create-job_no" type="text" name="job_no" value={newPanel.job_no || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 0, 0, 'job_no')} className="form-input" required ref={el => { if (el && inputRefs.current[0] !== el) inputRefs.current[0] = el; }}/></div><div className="form-group"><label htmlFor="create-application">Application</label><input id="create-application" type="text" name="application" value={newPanel.application || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 0, 1, 'application')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-type">Type</label><input id="create-type" type="text" name="type" value={newPanel.type || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 1, 0, 'type')} className="form-input"/></div><div className="form-group"><label htmlFor="create-panel_thk">Panel Thickness (mm)</label><input id="create-panel_thk" type="number" name="panel_thk" value={newPanel.panel_thk || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 1, 1, 'panel_thk')} className="form-input" onWheel={handleWheel} min="0" step="0.01"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-joint">Joint</label><input id="create-joint" type="text" name="joint" value={newPanel.joint || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 2, 0, 'joint')} className="form-input"/></div><div className="form-group"><label htmlFor="create-surface_front">Surface Front</label><input id="create-surface_front" type="text" name="surface_front" value={newPanel.surface_front || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 2, 1, 'surface_front')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-surface_back">Surface Back</label><input id="create-surface_back" type="text" name="surface_back" value={newPanel.surface_back || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 3, 0, 'surface_back')} className="form-input"/></div><div className="form-group"><label htmlFor="create-surface_front_thk">Front Thickness (mm)</label><input id="create-surface_front_thk" type="number" name="surface_front_thk" value={newPanel.surface_front_thk || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 3, 1, 'surface_front_thk')} className="form-input" onWheel={handleWheel} min="0" step="0.01"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-surface_back_thk">Back Thickness (mm)</label><input id="create-surface_back_thk" type="number" name="surface_back_thk" value={newPanel.surface_back_thk || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 4, 0, 'surface_back_thk')} className="form-input" onWheel={handleWheel} min="0" step="0.01"/></div><div className="form-group"><label htmlFor="create-surface_type">Surface Type</label><input id="create-surface_type" type="text" name="surface_type" value={newPanel.surface_type || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 4, 1, 'surface_type')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-width">Width (mm) <span className="required-star">*</span></label><input id="create-width" type="number" name="width" value={newPanel.width || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 5, 0, 'width')} className="form-input" onWheel={handleWheel} required min="0" step="0.01"/></div><div className="form-group"><label htmlFor="create-length">Length (mm) <span className="required-star">*</span></label><input id="create-length" type="number" name="length" value={newPanel.length || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 5, 1, 'length')} className="form-input" onWheel={handleWheel} required min="0" step="0.01"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-qty">Quantity</label><input id="create-qty" type="number" name="qty" value={newPanel.qty || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 6, 0, 'qty')} className="form-input" onWheel={handleWheel} min="0"/></div><div className="form-group"><label htmlFor="create-cutting">Cutting</label><input id="create-cutting" type="text" name="cutting" value={newPanel.cutting || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 6, 1, 'cutting')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-status">Status</label><select id="create_status" name="status" value={newPanel.status} onChange={handleNewPanelInputChange} className="form-input" onKeyDown={(e) => handleKeyDown(e, 7, 0, 'status')}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div><div className="form-group"><label htmlFor="create-salesman">Salesman</label><input id="create-salesman" type="text" name="salesman" value={newPanel.salesman || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 7, 1, 'salesman')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group"><label htmlFor="create-estimated_delivery">Estimated Delivery</label><input id="create-estimated_delivery" type="date" name="estimated_delivery" value={newPanel.estimated_delivery || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 8, 0, 'estimated_delivery')} className="form-input"/></div><div className="form-group"><label htmlFor="create-created_at">Production Date</label><input id="create-created_at" type="date" name="created_at" value={newPanel.created_at || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 8, 1, 'created_at')} className="form-input"/></div></div>
                                    <div className="form-row"><div className="form-group full-width"><label htmlFor="create-notes">Notes</label><textarea id="create-notes" name="notes" value={newPanel.notes || ''} onChange={handleNewPanelInputChange} onKeyDown={(e) => handleKeyDown(e, 9, 0, 'notes')} className="form-input" rows="3" placeholder="Enter notes here..."/></div></div>
                                </div>
                                <div className="modal-footer"><div className="footer-actions"><button type="button" className="btn btn-secondary" onClick={handleResetForm} onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); const notesField = createModalRef.current?.querySelector('[name="notes"]'); if (notesField) notesField.focus(); } }}>Reset Form</button><button type="button" className="btn btn-info" onClick={handleDuplicateInCreateModal} onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); const resetButton = createModalRef.current?.querySelector('.footer-actions button.btn-secondary'); if (resetButton) resetButton.focus(); } else if (e.key === 'ArrowRight') { e.preventDefault(); const createButton = createModalRef.current?.querySelector('.footer-actions button.btn-primary'); if (createButton) createButton.focus(); } }}>Duplicate</button><button type="submit" className="btn btn-primary" onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); const duplicateButton = createModalRef.current?.querySelector('.footer-actions button.btn-info'); if (duplicateButton) duplicateButton.focus(); } }}>Create Panel</button></div></div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

           {isEditModalOpen && editingPanel && (
            <div className="modal-overlay" onClick={closeEditModal}>
                <div className="modal-content wide-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header"><h2>Edit Panel: {editingPanel.reference_number}</h2><button type="button" className="close-button" onClick={closeEditModal}>×</button></div>
                    <div className="modal-body">
                        <form onSubmit={handleUpdatePanel} className="panel-form horizontal-form">
                            <div className="form-grid">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_job_no">Job No *</label>
                                        <input type="text" id="edit_job_no" name="job_no" value={editingPanel.job_no} onChange={handleEditInputChange} className="form-input" required/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_type">Type</label>
                                        <input type="text" id="edit_type" name="type" value={editingPanel.type} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_panel_thk">Panel Thickness (mm)</label>
                                        <input type="number" id="edit_panel_thk" name="panel_thk" value={editingPanel.panel_thk} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_application">Application</label>
                                        <input type="text" id="edit_application" name="application" value={editingPanel.application} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_joint">Joint</label>
                                        <input type="text" id="edit_joint" name="joint" value={editingPanel.joint} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_front">Surface Front</label>
                                        <input type="text" id="edit_surface_front" name="surface_front" value={editingPanel.surface_front} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_back">Surface Back</label>
                                        <input type="text" id="edit_surface_back" name="surface_back" value={editingPanel.surface_back} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_front_thk">Front Thickness (mm)</label>
                                        <input type="number" id="edit_surface_front_thk" name="surface_front_thk" value={editingPanel.surface_front_thk} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_back_thk">Back Thickness (mm)</label>
                                        <input type="number" id="edit_surface_back_thk" name="surface_back_thk" value={editingPanel.surface_back_thk} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_surface_type">Surface Type</label>
                                        <input type="text" id="edit_surface_type" name="surface_type" value={editingPanel.surface_type} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_width">Width (mm) *</label>
                                        <input type="number" id="edit_width" name="width" value={editingPanel.width} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input" required/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_length">Length (mm) *</label>
                                        <input type="number" id="edit_length" name="length" value={editingPanel.length} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input" required/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_qty">Quantity</label>
                                        <input type="number" id="edit_qty" name="qty" value={editingPanel.qty} onChange={handleEditInputChange} onWheel={handleWheel} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_cutting">Cutting</label>
                                        <input type="text" id="edit_cutting" name="cutting" value={editingPanel.cutting} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_status">Status</label>
                                        <select id="edit_status" name="status" value={editingPanel.status} onChange={handleEditInputChange} className="form-input">
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_salesman">Salesman</label>
                                        <input type="text" id="edit_salesman" name="salesman" value={editingPanel.salesman} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit_estimated_delivery">Est. Delivery</label>
                                        <input type="date" id="edit_estimated_delivery" name="estimated_delivery" value={editingPanel.estimated_delivery} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="edit_created_at">Production Date</label>
                                        <input type="date" id="edit_created_at" name="created_at" value={editingPanel.created_at || ''} onChange={handleEditInputChange} className="form-input"/>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group full-width">
                                        <label htmlFor="edit_notes">Notes</label>
                                        <textarea id="edit_notes" name="notes" value={editingPanel.notes} onChange={handleEditInputChange} className="form-input" rows="3"/>
                                    </div>
                                </div>
                            </div>

                            {error && <div className="alert alert-danger">{error}</div>}
                            <div className="form-actions">
                                <button type="button" className="secondary-btn" onClick={closeEditModal}>Cancel</button>
                                <button type="submit" className="primary-btn">Update Panel</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

            {isDuplicateModalOpen && selectedPanelToDuplicate && (
                <div className="modal-overlay" onClick={closeDuplicateModal}>
                    <div className="modal-content small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Duplicate Panel</h2><button type="button" className="close-button" onClick={closeDuplicateModal}>×</button></div>
                        <div className="modal-body">
                            <div className="duplicate-modal-content">
                                <p>How many copies of panel <strong>{selectedPanelToDuplicate.reference_number}</strong> would you like to create?</p>
                                <div className="form-group">
                                    <label htmlFor="copyCount">Number of copies:</label>
                                    <div className="input-with-validation">
                                        <input type="number" id="copyCount" min="1" max="100" value={numberOfCopies} onChange={(e) => { const value = e.target.value; if (value === '') setNumberOfCopies(''); else { const num = parseInt(value); if (!isNaN(num) && num >=1 && num<=100) setNumberOfCopies(num); } }} onBlur={() => { if (numberOfCopies === '' || parseInt(numberOfCopies)<1) setNumberOfCopies(1); else if (parseInt(numberOfCopies)>100) setNumberOfCopies(100); }} className="form-input" onWheel={handleWheel} placeholder="Enter number"/>
                                        <div className="input-actions"><button type="button" className="input-action-btn" onClick={() => setNumberOfCopies(Math.max(1, numberOfCopies-1))} disabled={numberOfCopies<=1}>−</button><button type="button" className="input-action-btn" onClick={() => setNumberOfCopies(Math.min(100, (numberOfCopies||0)+1))} disabled={numberOfCopies>=100}>+</button></div>
                                    </div>
                                    <div className="validation-hint"><span className={`hint-text ${(!numberOfCopies || numberOfCopies<1) ? 'error' : ''}`}>{(!numberOfCopies || numberOfCopies<1) ? 'Minimum 1 copy required' : 'Enter 1 to 100'}</span></div>
                                </div>
                                <div className="duplicate-info"><p><strong>Note:</strong> Duplicated panels will have:</p><ul><li>New reference numbers</li><li>Pending status</li><li>Balance reset to original quantity</li></ul></div>
                                {error && <div className="alert alert-danger">{error}</div>}
                                <div className="form-actions"><button type="button" className="secondary-btn" onClick={closeDuplicateModal}>Cancel</button><button type="button" className="primary-btn" onClick={() => { let count = numberOfCopies; if (count === '' || count<1) count=1; handleDuplicatePanel(selectedPanelToDuplicate, count); }} disabled={!numberOfCopies || numberOfCopies<1}>Create {numberOfCopies>=1 ? numberOfCopies : 1} {numberOfCopies>=1 ? (numberOfCopies===1 ? 'Copy' : 'Copies') : 'Copy'}</button></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCreateFormDuplicateModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>
                    <div className="modal-content duplicate-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Duplicate Panel from Form</h2><button type="button" className="close-button" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <div className="duplicate-form-content">
                                <div className="duplicate-info"><div className="info-icon">📋</div><div className="info-content"><h4>Create Multiple Copies</h4><p>You are about to create duplicate panels based on the current form data. Each copy will have a unique reference number.</p></div></div>
                                <div className="form-group">
                                    <label htmlFor="duplicateCopies">Number of Copies *</label>
                                    <div className="input-with-stepper">
                                        <input id="duplicateCopies" type="number" min="1" max="100" step="1" value={duplicateFormCopies} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val>=1 && val<=100) setDuplicateFormCopies(val); }} onWheel={handleWheel} className="form-input" required/>
                                        <div className="stepper-buttons"><button type="button" className="stepper-btn minus" onClick={() => { if (duplicateFormCopies>1) setDuplicateFormCopies(prev=>prev-1); }}>−</button><button type="button" className="stepper-btn plus" onClick={() => { if (duplicateFormCopies<100) setDuplicateFormCopies(prev=>prev+1); }}>+</button></div>
                                    </div>
                                    <div className="form-hint">Maximum 100 copies. Each copy will have a unique reference number.</div>
                                </div>
                                <div className="preview-summary"><h4>Preview Summary</h4><div className="preview-details"><div className="preview-row"><span className="preview-label">Job No:</span><span className="preview-value">{newPanel.job_no || 'N/A'}</span></div><div className="preview-row"><span className="preview-label">Type:</span><span className="preview-value">{newPanel.type || 'N/A'}</span></div><div className="preview-row"><span className="preview-label">Dimensions:</span><span className="preview-value">{newPanel.width || 0}mm × {newPanel.length || 0}mm</span></div><div className="preview-row"><span className="preview-label">Quantity per copy:</span><span className="preview-value">{newPanel.qty || 1}</span></div><div className="preview-row"><span className="preview-label">Total panels to create:</span><span className="preview-value">{duplicateFormCopies} × {newPanel.qty || 1} = {duplicateFormCopies * (parseInt(newPanel.qty) || 1)}</span></div></div></div>
                                <div className="modal-footer"><div className="footer-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleDuplicateFromCreateForm} disabled={!newPanel.job_no?.trim() || !newPanel.width || !newPanel.length}>Create {duplicateFormCopies} Cop{duplicateFormCopies===1 ? 'y' : 'ies'}</button></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPrintSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsPrintSelectionModalOpen(false)}>
                    <div className="modal-content print-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Print Panels</h2><button type="button" className="close-button" onClick={() => setIsPrintSelectionModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            <div className="print-options">
                                <div className="print-option" onClick={() => { handlePrint(); setIsPrintSelectionModalOpen(false); }}>
                                    <div className="print-option-content"><div className="print-option-title">Print All Visible Panels</div><div className="print-option-details">Print all {filteredPanels.length} panels currently visible in the table</div></div>
                                </div>
                                <div className="print-options-list">
                                    {filteredPanels.map(panel => (
                                        <div key={panel.id} className="print-option" onClick={() => { handlePrint(panel); setIsPrintSelectionModalOpen(false); }}>
                                            <div className="print-option-content"><div className="print-option-title">{panel.job_no || 'N/A'} - {panel.reference_number}</div><div className="print-option-details">{panel.type} | {panel.width}mm × {panel.length}mm | Qty: {panel.qty}</div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isColumnSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsColumnSelectionModalOpen(false)}>
                    <div className="modal-content column-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Select Columns to Display</h2><button type="button" className="close-button" onClick={() => setIsColumnSelectionModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            <div className="column-selection-content">
                                <div className="selection-header">
                                    <p>Select which columns you want to see in the table. Drag to reorder.</p>
                                    <div className="selection-actions">
                                        <button className="btn btn-sm btn-secondary" onClick={selectAllColumns}>Select All</button>
                                        <button className="btn btn-sm btn-secondary" onClick={deselectAllColumns}>Deselect All</button>
                                        <button className="btn btn-sm btn-secondary" onClick={resetToDefaultColumns}>Reset to Default</button>
                                    </div>
                                </div>
                                <div className="columns-list">
                                    {columns.filter(col => !col.alwaysVisible).sort((a, b) => a.order - b.order).map(column => (
                                        <div key={column.id} className="column-item">
                                            <div className="column-controls">
                                                <button className="move-btn" onClick={() => moveColumn(column.id, 'up')} disabled={column.order === 1} title="Move Up">↑</button>
                                                <button className="move-btn" onClick={() => moveColumn(column.id, 'down')} disabled={column.order === columns.length - 1} title="Move Down">↓</button>
                                            </div>
                                            <div className="column-checkbox">
                                                <input type="checkbox" id={`col-${column.id}`} checked={column.visible} onChange={() => toggleColumnVisibility(column.id)} />
                                                <label htmlFor={`col-${column.id}`}>{column.label}</label>
                                            </div>
                                            <div className="column-info"><span className="column-position">Position: {column.order}</span></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="selection-summary">
                                    <div className="summary-item"><span className="summary-label">Total Columns:</span><span className="summary-value">{columns.length - 1}</span></div>
                                    <div className="summary-item"><span className="summary-label">Visible Columns:</span><span className="summary-value">{visibleColumns.length - 1}</span></div>
                                    <div className="summary-item"><span className="summary-label">Hidden Columns:</span><span className="summary-value">{(columns.length - 1) - (visibleColumns.length - 1)}</span></div>
                                </div>
                                <div className="modal-footer"><div className="footer-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsColumnSelectionModalOpen(false)}>Close</button><button type="button" className="btn btn-primary" onClick={() => setIsColumnSelectionModalOpen(false)}>Apply Selection</button></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeFilterColumn && ReactDOM.createPortal(
                <div
                    className="filter-dropdown"
                    ref={portalDropdownRef}
                    style={{
                        position: 'absolute',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        zIndex: 2000,
                    }}
                >
                    <div className="filter-dropdown-header">
                        <span>Filter by {columns.find(c => c.id === activeFilterColumn)?.label}</span>
                        <button onClick={() => setActiveFilterColumn(null)}>×</button>
                    </div>
                    <div className="filter-dropdown-list">
                        <div
                            className={`filter-option ${!filters[columnFilterMap[activeFilterColumn]?.filterKey] ? 'selected' : ''}`}
                            onClick={() => handleFilterSelect(activeFilterColumn, '')}
                        >
                            All
                        </div>
                        {columnFilterMap[activeFilterColumn]?.uniqueKey &&
                            uniqueValues[columnFilterMap[activeFilterColumn].uniqueKey]?.map(val => (
                                <div
                                    key={val}
                                    className={`filter-option ${filters[columnFilterMap[activeFilterColumn].filterKey] === val ? 'selected' : ''}`}
                                    onClick={() => handleFilterSelect(activeFilterColumn, val)}
                                >
                                    {val}
                                </div>
                            ))}
                        {activeFilterColumn === 'balance' && (
                            <>
                                <div
                                    className={`filter-option ${filters.balance_status === 'positive' ? 'selected' : ''}`}
                                    onClick={() => handleFilterSelect(activeFilterColumn, 'positive')}
                                >
                                    Positive Balance
                                </div>
                                <div
                                    className={`filter-option ${filters.balance_status === 'zero' ? 'selected' : ''}`}
                                    onClick={() => handleFilterSelect(activeFilterColumn, 'zero')}
                                >
                                    Zero Balance
                                </div>
                                <div
                                    className={`filter-option ${filters.balance_status === 'negative' ? 'selected' : ''}`}
                                    onClick={() => handleFilterSelect(activeFilterColumn, 'negative')}
                                >
                                    Negative Balance
                                </div>
                                <div
                                    className={`filter-option ${filters.balance_status === 'low' ? 'selected' : ''}`}
                                    onClick={() => handleFilterSelect(activeFilterColumn, 'low')}
                                >
                                    Low Balance (&lt;10%)
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ViewPanelPage;