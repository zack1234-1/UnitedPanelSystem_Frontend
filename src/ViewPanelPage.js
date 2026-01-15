import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { viewPanelAPI, productionAPI } from '../src/apiService';
import './ViewPanelPage.css';

// Icons for better visual experience
const Icons = {
  Back: '←',
  Edit: '✏️',
  Duplicate: '⎘',
  Production: '🏭',
  Delete: '🗑️',
  Search: '🔍',
  Filter: '⚙️',
  Sort: '↕️',
  Add: '+',
  Check: '✓',
  Warning: '⚠️',
  Info: 'ℹ️',
  Calendar: '📅',
  User: '👤',
  Package: '📦',
  Meter: '📏',
  Area: '⬜',
  Thickness: '📐',
  Surface: '🎨',
  Loading: '⏳',
  Success: '✅',
  Error: '❌',
  Close: '×',
  ArrowUp: '↑',
  ArrowDown: '↓'
};

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

const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending':
        return { label: 'Pending', className: 'status-pending', icon: Icons.Loading };
      case 'in_progress':
      case 'in-progress':
        return { label: 'In Progress', className: 'status-in-progress', icon: '⚙️' };
      case 'completed':
        return { label: 'Completed', className: 'status-completed', icon: Icons.Success };
      case 'cancelled':
        return { label: 'Cancelled', className: 'status-cancelled', icon: Icons.Error };
      case 'on_hold':
      case 'on-hold':
        return { label: 'On Hold', className: 'status-on-hold', icon: '⏸️' };
      default:
        return { label: 'Pending', className: 'status-pending', icon: Icons.Loading };
    }
  };
  
  const config = getStatusConfig(status);
  
  return (
    <span className={`status-badge ${config.className}`}>
      <span className="status-icon">{config.icon}</span>
      <span className="status-text">{config.label}</span>
    </span>
  );
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
      
      setLocalSuccess(`Status updated to ${newStatus}`);
      setTimeout(() => {
        setLocalSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to update production status:', err);
      setLocalError('Failed to update status: ' + (err.message || 'Unknown error'));
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
          <h2>
            <span className="modal-title-icon">{Icons.Production}</span>
            Production Management: {currentPanel.reference_number}
          </h2>
          <button type="button" className="close-button" onClick={onClose}>
            {Icons.Close}
          </button>
        </div>
        
        <div className="modal-body">
          {localError && (
            <div className="alert alert-danger">
              <span className="alert-icon">{Icons.Error}</span>
              {localError}
            </div>
          )}
          
          {localSuccess && (
            <div className="alert alert-success">
              <span className="alert-icon">{Icons.Success}</span>
              {localSuccess}
            </div>
          )}

          <div className="production-modal-content">
            <div className="production-stats-summary">
              <div className="stat-box">
                <div className="stat-icon">{Icons.Package}</div>
                <div className="stat-content">
                  <span className="stat-label">Total Quantity</span>
                  <span className="stat-value">{formatNumber(panelQty)}</span>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <span className="stat-label">Already Produced</span>
                  <span className="stat-value">{formatNumber(totalProducedPanels)}</span>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-icon">{Icons.Meter}</div>
                <div className="stat-content">
                  <span className="stat-label">Production Length</span>
                  <span className="stat-value">
                    {totalProductionLength.toFixed(2)} m
                  </span>
                  <div className="stat-hint">
                    ({totalProducedPanels} × {formatNumber(panelLength)} mm ÷ 1000)
                  </div>
                </div>
              </div>
              <div className="stat-box highlight">
                <div className="stat-icon">{balance <= 0 ? Icons.Warning : Icons.Check}</div>
                <div className="stat-content">
                  <span className="stat-label">Available Balance</span>
                  <span className={`stat-value ${balance <= 0 ? 'zero-balance' : ''}`}>
                    {formatNumber(balance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="production-form-section">
              <h3 className="section-title">
                <span className="section-title-icon">{Icons.Add}</span>
                Add Production Record
              </h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">{Icons.Calendar}</span>
                    Production Date *
                  </label>
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
                  <label className="form-label">
                    <span className="label-icon">{Icons.Package}</span>
                    Number of Panels *
                  </label>
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
                    <div className="form-hint">
                      <span className="hint-icon">{Icons.Info}</span>
                      Max: {balance} panels available
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">{Icons.Meter}</span>
                    Production Length
                  </label>
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
                  <label className="form-label">
                    <span className="label-icon">📊</span>
                    Status
                  </label>
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
                <div className="form-group full-width">
                  <button
                    className={`btn btn-primary full-width ${balance <= 0 ? 'disabled' : ''}`}
                    onClick={handleCreateProductionRecord}
                    disabled={isSaving || !productionDate || !numberOfPanels || parseInt(numberOfPanels) < 1 || parseInt(numberOfPanels) > balance || balance <= 0}
                  >
                    {isSaving ? (
                      <>
                        <span className="spinner-small"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">{Icons.Add}</span>
                        Add Production Record
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="production-records-section">
              <h3 className="section-title">
                <span className="section-title-icon">📋</span>
                Production Records ({productionRecords.length})
              </h3>
              
              {isLoadingRecords ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading records...</p>
                </div>
              ) : productionRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <h4>No production records yet</h4>
                  <p>Start by adding your first production record above</p>
                </div>
              ) : (
                <div className="records-table-container">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th><span className="table-header-icon">{Icons.Calendar}</span> Date</th>
                        <th><span className="table-header-icon">{Icons.Package}</span> Panels</th>
                        <th><span className="table-header-icon">{Icons.Meter}</span> Length</th>
                        <th><span className="table-header-icon">📊</span> Status</th>
                        <th><span className="table-header-icon">{Icons.Edit}</span> Actions</th>
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
                              <div className="record-date-cell">
                                <span className="date-icon">{Icons.Calendar}</span>
                                {formatDate(record.date)}
                                {isPastDue && <span className="past-due-badge" title="Past Due">!</span>}
                              </div>
                            </td>
                            <td>
                              <div className="record-panels-cell">
                                <span className="panels-icon">{Icons.Package}</span>
                                {record.number_of_panels || 1}
                              </div>
                            </td>
                            <td>
                              <div className="record-length-cell">
                                <span className="length-value">{recordLength} m</span>
                                <div className="length-detail">
                                  {record.number_of_panels || 1} × {formatNumber(panelLength)} mm ÷ 1000
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="status-cell">
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
                              </div>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteProductionRecord(record.id)}
                                disabled={isSaving}
                                title="Delete"
                              >
                                <span className="btn-icon">{Icons.Delete}</span>
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
  const [success, setSuccess] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedPanelToDuplicate, setSelectedPanelToDuplicate] = useState(null);
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const [selectedPanelForProduction, setSelectedPanelForProduction] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalPanels: 0,
    totalQuantity: 0,
    totalBalance: 0,
    completed: 0,
    inProgress: 0,
    pending: 0
  });

  const defaultPanelValues = {
    job_no: 'UPS.0525.18802',
    number: '',
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
    cutting: ''
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc'
  });

  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Refs for keyboard navigation in create modal
  const createModalRef = useRef(null);
  
  const formLayout = useMemo(() => [
    ['job_no', 'type', 'panel_thk'],
    ['number', 'application', 'joint'],
    ['surface_front', 'surface_back', 'surface_front_thk'],
    ['surface_back_thk', 'surface_type', 'width'],
    ['length', 'qty', 'cutting'],
    ['status', 'production_meter', 'salesman'],
    ['brand', 'estimated_delivery', ''],
    ['notes']
  ], []);

  useEffect(() => {
    fetchPanels();
  }, []);

  useEffect(() => {
    // Calculate stats whenever panels change
    if (panels.length > 0) {
      const stats = {
        totalPanels: panels.length,
        totalQuantity: panels.reduce((sum, panel) => sum + (parseInt(panel.qty) || 0), 0),
        totalBalance: panels.reduce((sum, panel) => sum + (panel.balance || panel.qty || 0), 0),
        completed: panels.filter(p => p.status === 'completed').length,
        inProgress: panels.filter(p => p.status === 'in_progress').length,
        pending: panels.filter(p => p.status === 'pending').length
      };
      setStats(stats);
    }
  }, [panels]);

  // Setup keyboard navigation when create modal opens
  useEffect(() => {
    if (isCreateModalOpen && createModalRef.current) {
      setTimeout(() => {
        const firstInput = createModalRef.current.querySelector('input, select, textarea');
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);

      const handleKeyDown = (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && 
          (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
          e.preventDefault();
          
          const formElements = Array.from(createModalRef.current.querySelectorAll('input, select, textarea'));
          const currentIndex = formElements.indexOf(e.target);
          
          if (currentIndex !== -1) {
            let nextIndex = currentIndex;
            
            let currentRow = -1;
            let currentCol = -1;
            
            for (let row = 0; row < formLayout.length; row++) {
              const rowFields = formLayout[row];
              for (let col = 0; col < rowFields.length; col++) {
                const fieldName = rowFields[col];
                if (fieldName) {
                  const element = createModalRef.current.querySelector(`[name="${fieldName}"]`);
                  if (element === e.target) {
                    currentRow = row;
                    currentCol = col;
                    break;
                  }
                }
              }
              if (currentRow !== -1) break;
            }
            
            if (currentRow !== -1 && currentCol !== -1) {
              switch (e.key) {
                case 'ArrowUp':
                  for (let row = currentRow - 1; row >= 0; row--) {
                    const targetField = formLayout[row][currentCol];
                    if (targetField) {
                      const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                      if (targetElement) {
                        targetElement.focus();
                        return;
                      }
                    }
                  }
                  break;
                  
                case 'ArrowDown':
                  for (let row = currentRow + 1; row < formLayout.length; row++) {
                    const targetField = formLayout[row][currentCol];
                    if (targetField) {
                      const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                      if (targetElement) {
                        targetElement.focus();
                        return;
                      }
                    }
                  }
                  break;
                  
                case 'ArrowLeft':
                  for (let col = currentCol - 1; col >= 0; col--) {
                    const targetField = formLayout[currentRow][col];
                    if (targetField) {
                      const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                      if (targetElement) {
                        targetElement.focus();
                        return;
                      }
                    }
                  }
                  for (let row = currentRow - 1; row >= 0; row--) {
                    for (let col = formLayout[row].length - 1; col >= 0; col--) {
                      const targetField = formLayout[row][col];
                      if (targetField) {
                        const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                        if (targetElement) {
                          targetElement.focus();
                          return;
                        }
                      }
                    }
                  }
                  break;
                  
                case 'ArrowRight':
                  for (let col = currentCol + 1; col < formLayout[currentRow].length; col++) {
                    const targetField = formLayout[currentRow][col];
                    if (targetField) {
                      const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                      if (targetElement) {
                        targetElement.focus();
                        return;
                      }
                    }
                  }
                  for (let row = currentRow + 1; row < formLayout.length; row++) {
                    for (let col = 0; col < formLayout[row].length; col++) {
                      const targetField = formLayout[row][col];
                      if (targetField) {
                        const targetElement = createModalRef.current.querySelector(`[name="${targetField}"]`);
                        if (targetElement) {
                          targetElement.focus();
                          return;
                        }
                      }
                    }
                  }
                  break;
              }
            }
          }
        }
        
        if (e.ctrlKey && e.key === 'd') {
          e.preventDefault();
          handleDuplicateInCreateModal();
        }
      };

      createModalRef.current.addEventListener('keydown', handleKeyDown);
      
      return () => {
        if (createModalRef.current) {
          createModalRef.current.removeEventListener('keydown', handleKeyDown);
        }
      };
    }
  }, [isCreateModalOpen, formLayout]);

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
          number: panel.number || null,
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

  const calculateArea = (width, length) => {
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    if (w <= 0 || l <= 0) return 0;
    return (w * l);
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
        balance: editingPanel.qty ? parseInt(editingPanel.qty) : null,
        number: editingPanel.number || null,
        application: editingPanel.application || null
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
        number: newPanel.number || null,
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
        balance: createdPanel.balance !== undefined ? createdPanel.balance : createdPanel.qty
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

  const handleDuplicateInCreateModal = () => {
    const panelToDuplicate = {
      ...newPanel,
      job_no: newPanel.job_no ? `${newPanel.job_no} (Copy)` : ''
    };
    
    setNewPanel(panelToDuplicate);
    
    setTimeout(() => {
      const firstInput = createModalRef.current?.querySelector('input, select, textarea');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
    
    setSuccess('Form values duplicated! Edit and click Create Panel.');
    setError(null);
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
    setEditingPanel({ 
      ...panel,
      job_no: panel.job_no || '',
      number: panel.number || '',
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

  const clearFilters = () => {
    setFilters({
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
  };

  return (
    <div className="view-panel-container">
      <header className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(0)}>
            <span className="btn-icon">{Icons.Back}</span>
            Back to Dashboard
          </button>
          <div className="header-title-section">
            <h1 className="header-title">Panel Management System</h1>
            <p className="header-subtitle">Manage and track your panel production efficiently</p>
          </div>
        </div>
        <div className="header-right">
          <button className="create-panel-btn primary-btn" onClick={openCreateModal}>
            <span className="btn-icon">{Icons.Add}</span>
            Create New Panel
          </button>
        </div>
      </header>

      {success && (
        <div className="alert alert-success global-success">
          <span className="alert-icon">{Icons.Success}</span>
          {success}
        </div>
      )}

      <div className="stats-cards">
        <div className="stat-card highlight">
          <div className="stat-icon">{Icons.Package}</div>
          <div className="stat-content">
            <h3>Total Panels</h3>
            <div className="stat-value">{stats.totalPanels}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Quantity</h3>
            <div className="stat-value">{formatNumber(stats.totalQuantity)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚖️</div>
          <div className="stat-content">
            <h3>Available Balance</h3>
            <div className="stat-value">{formatNumber(stats.totalBalance)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Status Distribution</h3>
            <div className="stat-value">
              <span className="status-badge status-completed mini">{stats.completed}</span>
              <span className="status-badge status-in-progress mini">{stats.inProgress}</span>
              <span className="status-badge status-pending mini">{stats.pending}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filters-header">
          <h3 className="filters-title">
            <span className="filters-title-icon">{Icons.Filter}</span>
            Filters & Search
          </h3>
          <button className="clear-filters-btn secondary-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
        
        <div className="filter-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search panels by reference, job number, type, brand..."
              value={filters.search}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
          <div className="view-toggle">
            <div className="toggle-switch-container">
              <button 
                className={`toggle-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <span className="toggle-icon">📋</span>
                Table View
              </button>
              <button 
                className={`toggle-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <span className="toggle-icon">🗂️</span>
                Grid View
              </button>
            </div>
          </div>
        </div>

        <div className="advanced-filters">
          <div className="filter-group">
            <div className="form-group">
              <label className="filter-label">Job Number</label>
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
            </div>

            <div className="form-group">
              <label className="filter-label">Type</label>
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

            <div className="form-group">
              <label className="filter-label">Brand</label>
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
            </div>

            <div className="form-group">
              <label className="filter-label">Status</label>
              <select 
                name="status" 
                value={filters.status} 
                onChange={handleFilterChange} 
                className="form-select"
              >
                <option value="">All Status</option>
                {uniqueValues.statuses.map(status => (
                  <option key={status} value={status}>
                    <StatusBadge status={status} />
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="panels-display-container">
        <div className="cards-header">
          <div className="header-left-section">
            <h3>
              <span className="header-icon">{viewMode === 'table' ? '📋' : '🗂️'}</span>
              {viewMode === 'table' ? 'Panel Table' : 'Panel Grid'} ({filteredPanels.length} of {panels.length})
            </h3>
            {filteredPanels.length > 0 && (
              <div className="results-info">
                <span className="info-item">
                  <span className="info-icon">{Icons.Package}</span>
                  {filteredPanels.length} panels
                </span>
                <span className="info-item">
                  <span className="info-icon">{Icons.Meter}</span>
                  {filteredPanels.reduce((sum, p) => sum + (parseFloat(p.length) || 0) * (parseInt(p.qty) || 0), 0).toFixed(2)} mm total length
                </span>
              </div>
            )}
          </div>
          
          <div className="sort-controls">
            <div className="sort-selector">
              <label className="sort-label">Sort by:</label>
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
            </div>
            <button 
              className="sort-direction-btn"
              onClick={() => setSortConfig(prev => ({ 
                ...prev, 
                direction: prev.direction === 'asc' ? 'desc' : 'asc' 
              }))}
            >
              <span className="sort-icon">
                {sortConfig.direction === 'asc' ? Icons.ArrowUp : Icons.ArrowDown}
              </span>
              {sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading panels...</p>
            <p className="loading-subtext">Please wait while we fetch your data</p>
          </div>
        ) : filteredPanels.length === 0 && panels.length > 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{Icons.Search}</div>
            <h3>No panels match your filters</h3>
            <p>Try adjusting your search criteria or clear filters</p>
            <button className="primary-btn" onClick={clearFilters}>
              Clear All Filters
            </button>
          </div>
        ) : filteredPanels.length === 0 && panels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{Icons.Package}</div>
            <h3>No panels available</h3>
            <p>Start by adding your first panel</p>
            <button className="primary-btn" onClick={openCreateModal}>
              <span className="btn-icon">{Icons.Add}</span>
              Create Your First Panel
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <>
            <div className="responsive-table-wrapper">
              <table className="panels-table">
                <thead>
                  <tr>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Package}</span>
                        JobNo.
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">📝</span>
                        Type
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Thickness}</span>
                        PanelThk
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">🔗</span>
                        Joint
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Surface}</span>
                        Surface Front
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Surface}</span>
                        Surface Back
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Thickness}</span>
                        FrontThk
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Thickness}</span>
                        BackThk
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">🎨</span>
                        SurfaceType
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">📏</span>
                        Width
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">📏</span>
                        Length
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Area}</span>
                        Area
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">📦</span>
                        Qty
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">✂️</span>
                        Cutting
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">⚖️</span>
                        Balance
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">{Icons.Meter}</span>
                        Production
                      </div>
                    </th>
                    <th>
                      <div className="table-header-cell">
                        <span className="header-icon">⚡</span>
                        Actions
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPanels
                    .filter(panel => panel && panel.id)
                    .map(panel => {
                      const panelQty = parseInt(panel.qty) || 0;
                      const balance = panel.balance !== undefined ? panel.balance : panel.qty;
                      const panelLength = parseFloat(panel.length) || 0;
                      const panelWidth = parseFloat(panel.width) || 0;
                      
                      const alreadyProduced = panelQty - balance;
                      const productionMeter = (alreadyProduced * panelLength);
                      const area = calculateArea(panelWidth, panelLength);
                      
                      return (
                        <tr key={panel.id} className="panel-row">
                          <td>
                            <div className="job-no-cell">
                              <strong>{panel.job_no || 'N/A'}</strong>
                              <div className="panel-ref">
                                <span className="ref-icon">🏷️</span>
                                {panel.reference_number}
                              </div>
                              <div className="panel-status">
                                <StatusBadge status={panel.status} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="type-cell">
                              {panel.type || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="panel-thk-cell">
                              <span className="value-icon">{Icons.Thickness}</span>
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
                              <span className="surface-icon">{Icons.Surface}</span>
                              {panel.surface_front || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="surface-cell">
                              <span className="surface-icon">{Icons.Surface}</span>
                              {panel.surface_back || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="surface-thk-cell">
                              <span className="value-icon">{Icons.Thickness}</span>
                              {panel.surface_front_thk ? `${formatNumber(panel.surface_front_thk)} mm` : 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="surface-thk-cell">
                              <span className="value-icon">{Icons.Thickness}</span>
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
                              <span className="dimension-icon">📏</span>
                              {panel.width ? `${formatNumber(panel.width)} mm` : 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="dimension-cell">
                              <span className="dimension-icon">📏</span>
                              {panel.length ? `${formatNumber(panel.length)} mm` : 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className="area-cell">
                              <div className="area-value">
                                <span className="area-icon">{Icons.Area}</span>
                                {area > 0 ? area.toFixed(3) : '0'} m²
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="qty-cell">
                              <span className="qty-icon">📦</span>
                              {formatNumber(panel.qty)}
                            </div>
                          </td>
                          <td>
                            <div className="cutting-cell">
                              {panel.cutting || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div className={`balance-cell ${balance <= 0 ? 'zero' : balance <= panelQty * 0.1 ? 'low' : ''}`}>
                              <div className="balance-value">
                                <span className="balance-icon">⚖️</span>
                                {formatNumber(balance)}
                              </div>
                              {balance <= 0 && (
                                <div className="balance-warning">
                                  <span className="warning-icon">{Icons.Warning}</span>
                                  Out of stock
                                </div>
                              )}
                              {balance <= panelQty * 0.1 && balance > 0 && (
                                <div className="balance-warning low">
                                  <span className="warning-icon">{Icons.Warning}</span>
                                  Low stock
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="production-meter-cell">
                              <div className="meter-value">
                                <span className="meter-icon">{Icons.Meter}</span>
                                {productionMeter.toFixed(2)} mm
                              </div>
                              <div className="meter-progress">
                                <div className="progress-bar-small">
                                  <div 
                                    className="progress" 
                                    style={{ width: `${(alreadyProduced / panelQty) * 100}%` }}
                                  ></div>
                                </div>
                                <div className="progress-text">
                                  {Math.round((alreadyProduced / panelQty) * 100)}%
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button
                                onClick={() => openEditModal(panel)}
                                className="action-btn edit-btn"
                                title="Edit Panel"
                              >
                                <span className="action-icon">{Icons.Edit}</span>
                                Edit
                              </button>
                              <button
                                onClick={() => openDuplicateModal(panel)}
                                className="action-btn duplicate-btn"
                                title="Duplicate Panel"
                              >
                                <span className="action-icon">{Icons.Duplicate}</span>
                                Copy
                              </button>
                              <button
                                onClick={() => openProductionModal(panel)}
                                className="action-btn production-btn"
                                title="Production Management"
                              >
                                <span className="action-icon">{Icons.Production}</span>
                                Produce
                              </button>
                              <button
                                onClick={() => handleDeletePanel(panel.id)}
                                className="action-btn delete-btn"
                                title="Delete Panel"
                              >
                                <span className="action-icon">{Icons.Delete}</span>
                                Delete
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
        ) : (
          <div className="panels-grid">
            {filteredPanels
              .filter(panel => panel && panel.id)
              .map(panel => {
                const panelQty = parseInt(panel.qty) || 0;
                const balance = panel.balance !== undefined ? panel.balance : panel.qty;
                const panelLength = parseFloat(panel.length) || 0;
                const panelWidth = parseFloat(panel.width) || 0;
                const area = calculateArea(panelWidth, panelLength);
                const alreadyProduced = panelQty - balance;
                
                return (
                  <div key={panel.id} className="panel-card">
                    <div className="card-header">
                      <div className="card-title">
                        <h3>{panel.job_no || 'N/A'}</h3>
                        <StatusBadge status={panel.status} />
                      </div>
                      <div className="card-meta">
                        <span className="job-no">
                          <span className="meta-icon">🏷️</span>
                          {panel.reference_number}
                        </span>
                        <span className="created-date">
                          <span className="meta-icon">{Icons.Calendar}</span>
                          {formatDate(panel.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="card-body">
                      <div className="card-section">
                        <h4 className="card-section-title">
                          <span className="section-icon">{Icons.Info}</span>
                          Panel Details
                        </h4>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">Type</span>
                            <span className="info-value">{panel.type || 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Thickness</span>
                            <span className="info-value">{panel.panel_thk || 'N/A'} mm</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Joint</span>
                            <span className="info-value">{panel.joint || 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Dimensions</span>
                            <span className="info-value">{panel.width || 'N/A'} × {panel.length || 'N/A'} mm</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Area</span>
                            <span className="info-value">{area > 0 ? area.toFixed(3) : '0'} m²</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="card-section">
                        <h4 className="card-section-title">
                          <span className="section-icon">{Icons.Surface}</span>
                          Surface Details
                        </h4>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">Front</span>
                            <span className="info-value">{panel.surface_front || 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Back</span>
                            <span className="info-value">{panel.surface_back || 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Surface Type</span>
                            <span className="info-value">{panel.surface_type || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="card-section">
                        <h4 className="card-section-title">
                          <span className="section-icon">📊</span>
                          Production Status
                        </h4>
                        <div className="balance-display">
                          <div className="balance-row">
                            <span className="balance-label">Quantity</span>
                            <span className="balance-value">{formatNumber(panel.qty)}</span>
                          </div>
                          <div className="balance-row">
                            <span className="balance-label">Balance</span>
                            <span className={`balance-value ${balance <= 0 ? 'zero-balance' : ''}`}>
                              {formatNumber(balance)}
                            </span>
                          </div>
                          <div className="balance-row highlight">
                            <span className="balance-label">Progress</span>
                            <span className="balance-value">
                              {Math.round((alreadyProduced / panelQty) * 100)}%
                            </span>
                          </div>
                          <div className="progress-container">
                            <div className="progress-bar">
                              <div 
                                className="progress" 
                                style={{ width: `${(alreadyProduced / panelQty) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {panel.notes && (
                        <div className="card-section">
                          <h4 className="card-section-title">
                            <span className="section-icon">📝</span>
                            Notes
                          </h4>
                          <div className="notes-content">
                            {panel.notes}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="card-footer">
                      <button
                        onClick={() => openEditModal(panel)}
                        className="card-btn edit-btn"
                      >
                        <span className="btn-icon">{Icons.Edit}</span>
                        Edit
                      </button>
                      <button
                        onClick={() => openProductionModal(panel)}
                        className="card-btn production-btn"
                      >
                        <span className="btn-icon">{Icons.Production}</span>
                        Production
                      </button>
                      <button
                        onClick={() => handleDeletePanel(panel.id)}
                        className="card-btn delete-btn"
                      >
                        <span className="btn-icon">{Icons.Delete}</span>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {filteredPanels.length > 0 && (
          <div className="display-footer">
            <div className="display-summary">
              Showing {filteredPanels.length} of {panels.length} panels
              {filters.search && ` matching "${filters.search}"`}
              <div className="summary-stats">
                <span className="stat-item">
                  <span className="stat-icon">{Icons.Package}</span>
                  Total Quantity: {formatNumber(filteredPanels.reduce((sum, p) => sum + (parseInt(p.qty) || 0), 0))}
                </span>
                <span className="stat-item">
                  <span className="stat-icon">⚖️</span>
                  Total Balance: {formatNumber(filteredPanels.reduce((sum, p) => sum + (p.balance || p.qty || 0), 0))}
                </span>
              </div>
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
          <div 
            className="modal-content wide-modal" 
            onClick={e => e.stopPropagation()}
            ref={createModalRef}
          >
            <div className="modal-header">
              <h2>
                <span className="modal-title-icon">{Icons.Add}</span>
                Create New Panel
              </h2>
              <button type="button" className="close-button" onClick={closeCreateModal}>
                {Icons.Close}
              </button>
            </div>
            <div className="modal-body">
              <div className="keyboard-hint">
                <span className="hint-icon">{Icons.Info}</span>
                Tip: Use <kbd>Ctrl</kbd> + <kbd>D</kbd> to duplicate form values
              </div>
              
              <form onSubmit={handleCreatePanel} className="panel-form horizontal-form">
                {formLayout.map((row, rowIndex) => (
                  <div key={rowIndex} className="form-row">
                    {row.map((field, colIndex) => {
                      if (!field) return <div key={colIndex} className="form-group"></div>;
                      
                      const fieldConfig = {
                        'job_no': { label: 'Job No *', type: 'text', required: true, icon: '🏷️' },
                        'type': { label: 'Type', type: 'text', icon: '📝' },
                        'panel_thk': { label: 'Panel Thickness (mm)', type: 'number', icon: Icons.Thickness },
                        'number': { label: 'Number', type: 'text', icon: '🔢' },
                        'application': { label: 'Application', type: 'text', icon: '📄' },
                        'joint': { label: 'Joint', type: 'text', icon: '🔗' },
                        'surface_front': { label: 'Surface Front', type: 'text', icon: Icons.Surface },
                        'surface_back': { label: 'Surface Back', type: 'text', icon: Icons.Surface },
                        'surface_front_thk': { label: 'Front Thickness (mm)', type: 'number', icon: Icons.Thickness },
                        'surface_back_thk': { label: 'Back Thickness (mm)', type: 'number', icon: Icons.Thickness },
                        'surface_type': { label: 'Surface Type', type: 'text', icon: '🎨' },
                        'width': { label: 'Width (mm) *', type: 'number', required: true, icon: '📏' },
                        'length': { label: 'Length (mm) *', type: 'number', required: true, icon: '📏' },
                        'qty': { label: 'Quantity', type: 'number', icon: '📦' },
                        'cutting': { label: 'Cutting', type: 'text', icon: '✂️' },
                        'status': { label: 'Status', type: 'select', icon: '📊' },
                        'production_meter': { label: 'Production Meter (m)', type: 'number', icon: Icons.Meter },
                        'salesman': { label: 'Salesman', type: 'text', icon: Icons.User },
                        'brand': { label: 'Brand', type: 'text', icon: '🏢' },
                        'estimated_delivery': { label: 'Est. Delivery', type: 'date', icon: Icons.Calendar },
                        'notes': { label: 'Notes', type: 'textarea', icon: '📝' }
                      };
                      
                      const config = fieldConfig[field] || { label: field, type: 'text' };
                      
                      return (
                        <div key={field} className={`form-group ${field === 'notes' ? 'full-width' : ''}`}>
                          <label htmlFor={field} className="form-label">
                            <span className="label-icon">{config.icon}</span>
                            {config.label}
                          </label>
                          {config.type === 'textarea' ? (
                            <textarea
                              id={field}
                              name={field}
                              value={newPanel[field]}
                              onChange={handleNewPanelInputChange}
                              className="form-input form-textarea"
                              rows="4"
                              placeholder="Enter notes..."
                            />
                          ) : config.type === 'select' ? (
                            <select
                              id={field}
                              name={field}
                              value={newPanel[field]}
                              onChange={handleNewPanelInputChange}
                              className="form-input"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          ) : (
                            <input
                              type={config.type}
                              id={field}
                              name={field}
                              value={newPanel[field]}
                              onChange={handleNewPanelInputChange}
                              onWheel={config.type === 'number' ? handleWheel : undefined}
                              className="form-input"
                              required={config.required}
                              placeholder={`Enter ${config.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                
                <div className="form-actions">
                  <button type="button" className="secondary-btn" onClick={handleResetForm}>
                    <span className="btn-icon">🔄</span>
                    Reset Form
                  </button>
                  <button 
                    type="button" 
                    className="secondary-btn"
                    onClick={handleDuplicateInCreateModal}
                  >
                    <span className="btn-icon">{Icons.Duplicate}</span>
                    Duplicate Form
                  </button>
                  <button type="button" className="secondary-btn" onClick={closeCreateModal}>
                    <span className="btn-icon">{Icons.Close}</span>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn">
                    <span className="btn-icon">{Icons.Add}</span>
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
              <h2>
                <span className="modal-title-icon">{Icons.Edit}</span>
                Edit Panel: {editingPanel.reference_number}
              </h2>
              <button type="button" className="close-button" onClick={closeEditModal}>
                {Icons.Close}
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdatePanel} className="panel-form horizontal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_job_no" className="form-label">
                      <span className="label-icon">🏷️</span>
                      Job No *
                    </label>
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
                    <label htmlFor="edit_type" className="form-label">
                      <span className="label-icon">📝</span>
                      Type
                    </label>
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
                    <label htmlFor="edit_panel_thk" className="form-label">
                      <span className="label-icon">{Icons.Thickness}</span>
                      Panel Thickness (mm)
                    </label>
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
                    <label htmlFor="edit_number" className="form-label">
                      <span className="label-icon">🔢</span>
                      Number
                    </label>
                    <input
                      type="text"
                      id="edit_number"
                      name="number"
                      value={editingPanel.number}
                      onChange={handleEditInputChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit_application" className="form-label">
                      <span className="label-icon">📄</span>
                      Application
                    </label>
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
                    <label htmlFor="edit_joint" className="form-label">
                      <span className="label-icon">🔗</span>
                      Joint
                    </label>
                    <input
                      type="text"
                      id="edit_joint"
                      name="joint"
                      value={editingPanel.joint}
                      onChange={handleEditInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_surface_front" className="form-label">
                      <span className="label-icon">{Icons.Surface}</span>
                      Surface Front
                    </label>
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
                    <label htmlFor="edit_surface_back" className="form-label">
                      <span className="label-icon">{Icons.Surface}</span>
                      Surface Back
                    </label>
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
                    <label htmlFor="edit_surface_front_thk" className="form-label">
                      <span className="label-icon">{Icons.Thickness}</span>
                      Front Thickness (mm)
                    </label>
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
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_surface_back_thk" className="form-label">
                      <span className="label-icon">{Icons.Thickness}</span>
                      Back Thickness (mm)
                    </label>
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
                    <label htmlFor="edit_surface_type" className="form-label">
                      <span className="label-icon">🎨</span>
                      Surface Type
                    </label>
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
                    <label htmlFor="edit_width" className="form-label">
                      <span className="label-icon">📏</span>
                      Width (mm) *
                    </label>
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
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_length" className="form-label">
                      <span className="label-icon">📏</span>
                      Length (mm) *
                    </label>
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
                    <label htmlFor="edit_qty" className="form-label">
                      <span className="label-icon">📦</span>
                      Quantity
                    </label>
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
                    <label htmlFor="edit_cutting" className="form-label">
                      <span className="label-icon">✂️</span>
                      Cutting
                    </label>
                    <input
                      type="text"
                      id="edit_cutting"
                      name="cutting"
                      value={editingPanel.cutting}
                      onChange={handleEditInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_status" className="form-label">
                      <span className="label-icon">📊</span>
                      Status
                    </label>
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
                    <label htmlFor="edit_production_meter" className="form-label">
                      <span className="label-icon">{Icons.Meter}</span>
                      Production Meter (m)
                    </label>
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
                    <label htmlFor="edit_salesman" className="form-label">
                      <span className="label-icon">{Icons.User}</span>
                      Salesman
                    </label>
                    <input
                      type="text"
                      id="edit_salesman"
                      name="salesman"
                      value={editingPanel.salesman}
                      onChange={handleEditInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit_brand" className="form-label">
                      <span className="label-icon">🏢</span>
                      Brand
                    </label>
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
                    <label htmlFor="edit_estimated_delivery" className="form-label">
                      <span className="label-icon">{Icons.Calendar}</span>
                      Est. Delivery
                    </label>
                    <input
                      type="date"
                      id="edit_estimated_delivery"
                      name="estimated_delivery"
                      value={editingPanel.estimated_delivery}
                      onChange={handleEditInputChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group"></div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="edit_notes" className="form-label">
                      <span className="label-icon">📝</span>
                      Notes
                    </label>
                    <textarea
                      id="edit_notes"
                      name="notes"
                      value={editingPanel.notes}
                      onChange={handleEditInputChange}
                      className="form-input"
                      rows="4"
                    />
                  </div>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}
                
                <div className="form-actions">
                  <button type="button" className="secondary-btn" onClick={closeEditModal}>
                    <span className="btn-icon">{Icons.Close}</span>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn">
                    <span className="btn-icon">{Icons.Success}</span>
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
              <h2>
                <span className="modal-title-icon">{Icons.Duplicate}</span>
                Duplicate Panel
              </h2>
              <button type="button" className="close-button" onClick={closeDuplicateModal}>
                {Icons.Close}
              </button>
            </div>
            <div className="modal-body">
              <div className="duplicate-modal-content">
                <div className="panel-preview">
                  <h4>Duplicating:</h4>
                  <div className="panel-info">
                    <div className="panel-info-item">
                      <span className="info-label">Reference:</span>
                      <span className="info-value">{selectedPanelToDuplicate.reference_number}</span>
                    </div>
                    <div className="panel-info-item">
                      <span className="info-label">Job No:</span>
                      <span className="info-value">{selectedPanelToDuplicate.job_no}</span>
                    </div>
                    <div className="panel-info-item">
                      <span className="info-label">Type:</span>
                      <span className="info-value">{selectedPanelToDuplicate.type}</span>
                    </div>
                    <div className="panel-info-item">
                      <span className="info-label">Quantity:</span>
                      <span className="info-value">{selectedPanelToDuplicate.qty}</span>
                    </div>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="copyCount" className="form-label">
                    <span className="label-icon">📋</span>
                    Number of copies:
                  </label>
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
                  <h4>
                    <span className="info-icon">{Icons.Info}</span>
                    What will be duplicated:
                  </h4>
                  <ul>
                    <li>✅ New reference numbers will be generated</li>
                    <li>✅ Job No will have "(Copy)" appended</li>
                    <li>✅ Notes will indicate it's a duplicate</li>
                    <li>✅ Status will be set to Pending</li>
                    <li>✅ Balance will be reset to original quantity</li>
                  </ul>
                </div>
                
                {error && <div className="alert alert-danger">{error}</div>}
                
                <div className="form-actions">
                  <button type="button" className="secondary-btn" onClick={closeDuplicateModal}>
                    <span className="btn-icon">{Icons.Close}</span>
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
                    <span className="btn-icon">{Icons.Duplicate}</span>
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