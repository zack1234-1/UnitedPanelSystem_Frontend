import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { viewPanelAPI, productionAPI } from '../src/apiService';
import './ViewPanelPage.css';

// Generate unique reference number
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

// PanelCard Component
const PanelCard = ({ panel, onEdit, onDelete, onToggleProduction, formatNumber, formatDecimal, formatDate }) => {
    const [showProductionDetails, setShowProductionDetails] = useState(false);
    const [productionDate, setProductionDate] = useState('');
    const [numberOfPanels, setNumberOfPanels] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [localSuccess, setLocalSuccess] = useState(null);
    const [productionRecords, setProductionRecords] = useState([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);

    useEffect(() => {
        if (showProductionDetails) {
            fetchProductionRecords();
        }
    }, [showProductionDetails, panel.id]);

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
            setProductionRecords(data || []);
        } catch (err) {
            console.error('Failed to fetch production records:', err);
            setLocalError('Failed to load production records');
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

        setIsSaving(true);
        setLocalError(null);
        setLocalSuccess(null);

        try {
            const productionRecordData = {
                date: productionDate,
                number_of_panels: numberOfPanels,
                delivery_date: productionDate,
                reference_number: panel.reference_number,
                panel_id: panel.id,
                job_no: panel.job_no,
                brand: panel.brand || '',
                delivery: panel.delivery || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const newRecord = await productionAPI.create(panel.id, productionRecordData);
            
            setProductionRecords(prev => [newRecord, ...prev]);
            setProductionDate('');
            setNumberOfPanels(1);
            
            setLocalSuccess('Production record added successfully!');
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);

        } catch (err) {
            console.error('Failed to create production record:', err);
            setLocalError('Failed to add production record: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProductionRecord = async (recordId) => {
        if (!window.confirm('Are you sure you want to delete this production record?')) {
            return;
        }

        setIsSaving(true);
        setLocalError(null);

        try {
            await productionAPI.delete(panel.id, recordId);
            
            setProductionRecords(prev => prev.filter(record => record.id !== recordId));
            setLocalSuccess('Production record deleted successfully!');
            
            setTimeout(() => {
                setLocalSuccess(null);
            }, 3000);
            
        } catch (err) {
            console.error('Failed to delete production record:', err);
            setLocalError('Failed to delete production record: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const totalProducedPanels = useMemo(() => {
        return productionRecords.reduce((sum, record) => 
            sum + (parseInt(record.number_of_panels) || 0), 0
        );
    }, [productionRecords]);

    return (
        <div key={panel.id} className="panel-card">
            <div className="card-header">
                <div className="card-title">
                    <h3>{panel.reference_number}</h3>
                    <span className="panel-status">
                        {panel.status === 'completed' ? '✓' : 
                         panel.status === 'in_progress' ? '⟳' : 
                         panel.status === 'pending' ? '⏳' : ''}
                    </span>
                </div>
                <div className="card-meta">
                    <span className="job-no">Job: {panel.job_no || 'N/A'}</span>
                    <span className="created-date">
                        {formatDate(panel.created_at)}
                    </span>
                </div>
            </div>
            
            <div className="toggle-switch-container">
                <button 
                    className={`toggle-view-btn ${showProductionDetails ? 'active' : ''}`}
                    onClick={toggleProductionView}
                >
                    {showProductionDetails ? '📋 View Panel Details' : '🏭 View Production Details'}
                </button>
            </div>
            
            <div className="card-body">
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

                        <div className="card-section">
                            <h4 className="card-section-title">Add Production Record</h4>
                            
                            <div className="card-row">
                                <span className="card-label">Delivery Date:</span>
                                <div className="production-date-container">
                                    <input 
                                        type="date" 
                                        className="card-value-input"
                                        value={productionDate}
                                        onChange={(e) => {
                                            setProductionDate(e.target.value);
                                            setLocalError(null);
                                        }}
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                            
                            <div className="card-row">
                                <span className="card-label">Number of Panels:</span>
                                <div className="number-of-panels-container">
                                    <input 
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="card-value-input"
                                        value={numberOfPanels}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value) || 1;
                                            setNumberOfPanels(value);
                                            setLocalError(null);
                                        }}
                                        disabled={isSaving}
                                        placeholder="Enter number of panels"
                                    />
                                </div>
                            </div>
                            
                            <div className="production-action-row">
                                <button
                                    className="create-record-btn"
                                    onClick={handleCreateProductionRecord}
                                    disabled={isSaving || !productionDate || !numberOfPanels}
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="saving-spinner"></span>
                                            Saving...
                                        </>
                                    ) : (
                                        'Add Production Record'
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="card-section">
                            <h4 className="card-section-title">
                                Production Records ({productionRecords.length})
                            </h4>
                            
                            {isLoadingRecords ? (
                                <div className="loading-records">
                                    <div className="loading-spinner small"></div>
                                    <p>Loading records...</p>
                                </div>
                            ) : productionRecords.length === 0 ? (
                                <div className="empty-production-records">
                                    <div className="empty-icon">📅</div>
                                    <p>No production records yet.</p>
                                    <small>Add your first record using the form above.</small>
                                </div>
                            ) : (
                                <div className="production-records-list">
                                    {productionRecords.map((record) => (
                                        <div key={record.id} className="production-record-item">
                                            <div className="record-info">
                                                <div className="record-main">
                                                    <div className="record-date">
                                                        <strong>{formatDate(record.date)}</strong>
                                                    </div>
                                                    <div className="record-panels">
                                                        {record.number_of_panels || 1} panels
                                                    </div>
                                                </div>
                                                <div className="record-details">
                                                    <div className="record-reference">
                                                        <small>Ref: {record.reference_number}</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="record-actions">
                                                <button
                                                    className="delete-record-btn"
                                                    onClick={() => handleDeleteProductionRecord(record.id)}
                                                    disabled={isSaving}
                                                    title="Delete production record"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {productionRecords.length > 0 && (
                            <div className="card-section">
                                <h4 className="card-section-title">Production Summary</h4>
                                <div className="production-summary-grid">
                                    <div className="summary-item">
                                        <span className="summary-label">Total Records</span>
                                        <span className="summary-value">{productionRecords.length}</span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Total Panels</span>
                                        <span className="summary-value">{formatNumber(totalProducedPanels)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="card-section">
                            <h4 className="card-section-title">Basic Information</h4>
                            <div className="card-row">
                                <span className="card-label">Job No:</span>
                                <span className="card-value">{panel.job_no || 'N/A'}</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Type:</span>
                                <span className="card-value">{panel.type || 'N/A'}</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Brand:</span>
                                <span className="card-value">{panel.brand || 'N/A'}</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Panel Thk:</span>
                                <span className="card-value">{formatNumber(panel.panel_thk)} mm</span>
                            </div>
                        </div>

                        <div className="card-section">
                            <h4 className="card-section-title">Surface Details</h4>
                            <div className="card-row">
                                <span className="card-label">Surface Front:</span>
                                <span className="card-value">{panel.surface_front || 'N/A'}</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Surface Back:</span>
                                <span className="card-value">{panel.surface_back || 'N/A'}</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Surface Type:</span>
                                <span className="card-value">{panel.surface_type || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="card-section">
                            <h4 className="card-section-title">Dimensions & Quantity</h4>
                            <div className="card-row">
                                <span className="card-label">Width:</span>
                                <span className="card-value">{formatNumber(panel.width)} mm</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Length:</span>
                                <span className="card-value">{formatNumber(panel.length)} mm</span>
                            </div>
                            <div className="card-row">
                                <span className="card-label">Quantity:</span>
                                <span className="card-value">{formatNumber(panel.qty)}</span>
                            </div>
                        </div>

                        <div className="card-section">
                            <h4 className="card-section-title">Additional Information</h4>
                            <div className="card-row">
                                <span className="card-label">Estimated Delivery:</span>
                                <span className="card-value">{panel.estimated_delivery ? formatDate(panel.estimated_delivery) : 'N/A'}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            <div className="card-footer">
                <button
                    onClick={() => onEdit(panel)}
                    className="card-btn edit-btn"
                    title="Edit panel"
                >
                    Edit
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
        panel_tik: '',
        joint: '',
        surface_front: '',
        surface_back: '',
        surface_front_tik: '',
        surface_back_tik: '',
        surface_type: '',
        width: '',
        length: '',
        qty: '',
        cutting: '',
        status: 'pending'
    });
    
    // Updated Filters - Only Job No, Reference Number, Type, Brand
    const [filters, setFilters] = useState({
        reference_number: '',
        job_no: '',
        type: '',
        brand: '',
        search: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    useEffect(() => {
        fetchPanels();
    }, []);

    const fetchPanels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await viewPanelAPI.getAll();
            setPanels(data || []);
        } catch (err) {
            console.error('Failed to fetch panels:', err);
            setError('Failed to load panels. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPanels = useMemo(() => {
        let filtered = panels.filter(panel => {
            if (filters.reference_number && !panel.reference_number?.toLowerCase().includes(filters.reference_number.toLowerCase())) return false;
            if (filters.job_no && !panel.job_no?.toString().toLowerCase().includes(filters.job_no.toLowerCase())) return false;
            if (filters.type && panel.type !== filters.type) return false;
            if (filters.brand && panel.brand !== filters.brand) return false;
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    (panel.reference_number?.toLowerCase().includes(searchLower)) ||
                    (panel.job_no?.toString().toLowerCase().includes(searchLower)) ||
                    (panel.type?.toLowerCase().includes(searchLower)) ||
                    (panel.brand?.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

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
                    sortConfig.key === 'panel_thk' || sortConfig.key === 'qty') {
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
            };
            
            Object.keys(panelToUpdate).forEach(key => {
                if (panelToUpdate[key] === '') {
                    panelToUpdate[key] = null;
                }
            });
            
            const updatedPanel = await viewPanelAPI.update(editingPanel.id, panelToUpdate);
            setPanels(prev => prev.map(panel => 
                panel.id === updatedPanel.id ? updatedPanel : panel
            ));
            setIsEditModalOpen(false);
            setEditingPanel(null);
            setError(null);
        } catch (err) {
            console.error('Failed to update panel:', err);
            setError('Failed to update panel: ' + err.message);
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
                surface_front_tik: newPanel.surface_front_tik ? parseFloat(newPanel.surface_front_tik) : null,
                surface_back_tik: newPanel.surface_back_tik ? parseFloat(newPanel.surface_back_tik) : null,
                panel_tik: newPanel.panel_tik ? parseFloat(newPanel.panel_tik) : null,
                qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                brand: null, // Brand is not included in create modal
                estimated_delivery: null // Estimated delivery is not included in create modal
            };
            
            Object.keys(panelData).forEach(key => {
                if (panelData[key] === '') {
                    panelData[key] = null;
                }
            });
            
            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [createdPanel, ...prev]);
            setIsCreateModalOpen(false);
            setNewPanel({
                job_no: '',
                type: '',
                panel_tik: '',
                joint: '',
                surface_front: '',
                surface_back: '',
                surface_front_tik: '',
                surface_back_tik: '',
                surface_type: '',
                width: '',
                length: '',
                qty: '',
                cutting: '',
                status: 'pending'
            });
            setError(null);
        } catch (err) {
            console.error('Failed to create panel:', err);
            setError('Failed to create panel: ' + err.message);
        }
    };

    const handleDeletePanel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this panel?')) return;

        try {
            await viewPanelAPI.delete(id);
            setPanels(prev => prev.filter(panel => panel.id !== id));
        } catch (err) {
            console.error('Failed to delete panel:', err);
            setError('Failed to delete panel: ' + err.message);
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
            brand: panel.brand || '',
            estimated_delivery: panel.estimated_delivery || '',
            status: panel.status || 'pending'
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
            panel_tik: '',
            joint: '',
            surface_front: '',
            surface_back: '',
            surface_front_tik: '',
            surface_back_tik: '',
            surface_type: '',
            width: '',
            length: '',
            qty: '',
            cutting: '',
            status: 'pending'
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
        const jobNos = panels.map(panel => panel.job_no).filter(p => p);
        return [...new Set(jobNos)].sort((a, b) => {
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return String(a).localeCompare(String(b));
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

    const stats = useMemo(() => {
        const totalPanels = panels.length;
        const totalQty = panels.reduce((sum, panel) => sum + (parseInt(panel.qty) || 0), 0);
        
        // Count by type
        const typeCounts = {};
        panels.forEach(panel => {
            if (panel.type) {
                typeCounts[panel.type] = (typeCounts[panel.type] || 0) + 1;
            }
        });

        return {
            totalPanels,
            totalQty,
            typeCounts
        };
    }, [panels]);

    return (
        <div className="view-panel-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate(0)}>
                        ← Back to Panel / Slab
                    </button>
                    <h1 className="header-title">Panel Management System</h1>
                </div>
                <div className="header-right">
                    <button className="create-panel-btn" onClick={openCreateModal}>
                        + Create New Panel
                    </button>
                </div>
            </header>

            {/* Updated Filters Section */}
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
                            name="reference_number" 
                            value={filters.reference_number} 
                            onChange={handleFilterChange} 
                            className="form-select"
                        >
                            <option value="">All Reference Numbers</option>
                            {panels.map(panel => (
                                <option key={panel.reference_number} value={panel.reference_number}>
                                    {panel.reference_number}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
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

            {/* Panels Display */}
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
                                    <option value="qty">Quantity</option>
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
                        <div className="panels-grid">
                            {filteredPanels.map(panel => (
                                <PanelCard
                                    key={panel.id}
                                    panel={panel}
                                    onEdit={openEditModal}
                                    onDelete={handleDeletePanel}
                                    onToggleProduction={handleToggleProduction}
                                    formatNumber={formatNumber}
                                    formatDecimal={formatDecimal}
                                    formatDate={formatDate}
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
                        </div>
                    </div>
                )}
            </div>

            {/* Create Panel Modal */}
            {isCreateModalOpen && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Panel</h2>
                            <button type="button" className="close-button" onClick={closeCreateModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreatePanel} className="panel-form">
                                <div className="form-row">
                                    <div className="form-group required">
                                        <label htmlFor="create_job_no">Job No</label>
                                        <input 
                                            type="text" 
                                            id="create_job_no" 
                                            name="job_no" 
                                            value={newPanel.job_no || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Enter job number"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_type">Type</label>
                                        <input 
                                            type="text" 
                                            id="create_type" 
                                            name="type" 
                                            value={newPanel.type || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Panel type"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_panel_tik">Panel Thickness (mm)</label>
                                        <input 
                                            type="number" 
                                            id="create_panel_tik" 
                                            name="panel_tik" 
                                            value={newPanel.panel_tik || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Panel thickness"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_joint">Joint</label>
                                        <input 
                                            type="text" 
                                            id="create_joint" 
                                            name="joint" 
                                            value={newPanel.joint || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Joint type"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="create_surface_front">Surface Front</label>
                                        <input 
                                            type="text" 
                                            id="create_surface_front" 
                                            name="surface_front" 
                                            value={newPanel.surface_front || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Front surface"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_surface_back">Surface Back</label>
                                        <input 
                                            type="text" 
                                            id="create_surface_back" 
                                            name="surface_back" 
                                            value={newPanel.surface_back || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Back surface"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_surface_front_tik">Surface Front Thk (mm)</label>
                                        <input 
                                            type="number" 
                                            id="create_surface_front_tik" 
                                            name="surface_front_tik" 
                                            value={newPanel.surface_front_tik || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Front thickness"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_surface_back_tik">Surface Back Thk (mm)</label>
                                        <input 
                                            type="number" 
                                            id="create_surface_back_tik" 
                                            name="surface_back_tik" 
                                            value={newPanel.surface_back_tik || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Back thickness"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="create_surface_type">Surface Type</label>
                                        <input 
                                            type="text" 
                                            id="create_surface_type" 
                                            name="surface_type" 
                                            value={newPanel.surface_type || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Surface type"
                                        />
                                    </div>
                                    
                                    <div className="form-group required">
                                        <label htmlFor="create_width">Width (mm)</label>
                                        <input 
                                            type="number" 
                                            id="create_width" 
                                            name="width" 
                                            value={newPanel.width || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Width in mm"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group required">
                                        <label htmlFor="create_length">Length (mm)</label>
                                        <input 
                                            type="number" 
                                            id="create_length" 
                                            name="length" 
                                            value={newPanel.length || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Length in mm"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_qty">Quantity</label>
                                        <input 
                                            type="number" 
                                            id="create_qty" 
                                            name="qty" 
                                            value={newPanel.qty || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Quantity"
                                            min="0"
                                            step="1"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="create_cutting">Cutting</label>
                                        <input 
                                            type="text" 
                                            id="create_cutting" 
                                            name="cutting" 
                                            value={newPanel.cutting || ''} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input" 
                                            placeholder="Cutting type"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="create_status">Status</label>
                                        <select 
                                            id="create_status" 
                                            name="status" 
                                            value={newPanel.status || 'pending'} 
                                            onChange={handleNewPanelInputChange} 
                                            className="form-input"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
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

            {/* Edit Panel Modal */}
            {isEditModalOpen && editingPanel && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Panel: {editingPanel.reference_number}</h2>
                            <button type="button" className="close-button" onClick={closeEditModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleUpdatePanel} className="panel-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="reference_number">Reference Number</label>
                                        <input 
                                            type="text" 
                                            id="reference_number" 
                                            name="reference_number" 
                                            value={editingPanel.reference_number || ''} 
                                            readOnly
                                            className="form-input" 
                                        />
                                    </div>

                                    <div className="form-group required">
                                        <label htmlFor="job_no">Job No</label>
                                        <input 
                                            type="text" 
                                            id="job_no" 
                                            name="job_no" 
                                            value={editingPanel.job_no || ''} 
                                            onChange={handleEditInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Enter job number"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="type">Type</label>
                                        <input 
                                            type="text" 
                                            id="type" 
                                            name="type" 
                                            value={editingPanel.type || ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                            placeholder="Panel type"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="brand">Brand</label>
                                        <input 
                                            type="text" 
                                            id="brand" 
                                            name="brand" 
                                            value={editingPanel.brand || ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                            placeholder="Enter brand"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="panel_thk">Panel Thickness</label>
                                        <input 
                                            type="number" 
                                            id="panel_thk" 
                                            name="panel_thk" 
                                            value={editingPanel.panel_thk || ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                            placeholder="Panel thickness"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="surface_type">Surface Type</label>
                                        <input 
                                            type="text" 
                                            id="surface_type" 
                                            name="surface_type" 
                                            value={editingPanel.surface_type || ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                            placeholder="Surface type"
                                        />
                                    </div>
                                    
                                    <div className="form-group required">
                                        <label htmlFor="width">Width (mm)</label>
                                        <input 
                                            type="number" 
                                            id="width" 
                                            name="width" 
                                            value={editingPanel.width || ''} 
                                            onChange={handleEditInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Width in mm"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    
                                    <div className="form-group required">
                                        <label htmlFor="length">Length (mm)</label>
                                        <input 
                                            type="number" 
                                            id="length" 
                                            name="length" 
                                            value={editingPanel.length || ''} 
                                            onChange={handleEditInputChange} 
                                            required 
                                            className="form-input" 
                                            placeholder="Length in mm"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="qty">Quantity</label>
                                        <input 
                                            type="number" 
                                            id="qty" 
                                            name="qty" 
                                            value={editingPanel.qty || ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                            placeholder="Quantity"
                                            min="0"
                                            step="1"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="estimated_delivery">Estimated Delivery</label>
                                        <input 
                                            type="date" 
                                            id="estimated_delivery" 
                                            name="estimated_delivery" 
                                            value={editingPanel.estimated_delivery ? editingPanel.estimated_delivery.split('T')[0] : ''} 
                                            onChange={handleEditInputChange} 
                                            className="form-input" 
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="status">Status</label>
                                        <select 
                                            id="status" 
                                            name="status" 
                                            value={editingPanel.status || 'pending'} 
                                            onChange={handleEditInputChange} 
                                            className="form-input"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
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
        </div>
    );
};

export default ViewPanelPage;
