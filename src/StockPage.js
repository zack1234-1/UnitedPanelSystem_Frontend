import React, { useState, useEffect, useMemo } from 'react';
import { stockAPI } from './apiService';
import './PanelSlab.css'; // reuse the same CSS

const StockPage = ({ onBack }) => {
    const [stockItems, setStockItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // Form states
    const [newItem, setNewItem] = useState({
        name: '',
        quantity: '',
        unit: 'pcs',
        location: '',
        category: '',
        minStock: '',
        notes: ''
    });

    useEffect(() => {
        fetchStockItems();
    }, []);

   const fetchStockItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await stockAPI.getAll();
            // ✅ Ensure we always set an array
            if (Array.isArray(data)) {
                setStockItems(data);
            } else if (data && Array.isArray(data.data)) {
                // fallback if the response is wrapped like { data: [...] }
                setStockItems(data.data);
            } else {
                console.error('Unexpected stock API response:', data);
                setStockItems([]);
                setError('Received invalid data format from server.');
            }
        } catch (err) {
            console.error('Failed to fetch stock items:', err);
            setError('Failed to load stock items. Please ensure the backend is running.');
            setStockItems([]); // important: reset to empty array
        } finally {
            setIsLoading(false);
        }
    };
    
    // Get unique categories for filter dropdown
    const categories = useMemo(() => {
        const cats = stockItems.map(item => item.category).filter(c => c);
        return ['all', ...new Set(cats)];
    }, [stockItems]);

    // Filter items based on search and category
    const filteredItems = useMemo(() => {
        let filtered = stockItems;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.name?.toLowerCase().includes(lower) ||
                item.location?.toLowerCase().includes(lower)
            );
        }
        if (filterCategory !== 'all') {
            filtered = filtered.filter(item => item.category === filterCategory);
        }
        return filtered;
    }, [stockItems, searchTerm, filterCategory]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingItem(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!newItem.name.trim()) {
            setError('Item name is required');
            return;
        }
        try {
            const created = await stockAPI.create(newItem);
            setStockItems(prev => [...prev, created]);
            closeAddModal();
        } catch (err) {
            console.error('Failed to create stock item:', err);
            setError('Failed to create item.');
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingItem.name.trim()) {
            setError('Item name is required');
            return;
        }
        try {
            const updated = await stockAPI.update(editingItem.id, editingItem);
            setStockItems(prev => prev.map(item => item.id === updated.id ? updated : item));
            closeEditModal();
        } catch (err) {
            console.error('Failed to update stock item:', err);
            setError('Failed to update item.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this stock item?')) return;
        try {
            await stockAPI.delete(id);
            setStockItems(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error('Failed to delete stock item:', err);
            setError('Failed to delete item.');
        }
    };

    const openAddModal = () => {
        setNewItem({
            name: '',
            quantity: '',
            unit: 'pcs',
            location: '',
            category: '',
            minStock: '',
            notes: ''
        });
        setError(null);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setError(null);
    };

    const openEditModal = (item) => {
        setEditingItem({ ...item });
        setError(null);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
        setError(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const isLowStock = (item) => {
        return item.minStock && Number(item.quantity) <= Number(item.minStock);
    };

    return (
        <div className="panel-slab-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={onBack}>
                        ← Back to Panel Tasks
                    </button>
                    <h1>📦 Stock Management</h1>
                </div>
                <div className="header-right">
                    <button className="header-btn create-btn" onClick={openAddModal}>
                        + Add Stock Item
                    </button>
                </div>
            </header>

            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <div className="card-icon">📦</div>
                    <div className="card-content">
                        <h3>Total Items</h3>
                        <p className="card-value">{stockItems.length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">⚠️</div>
                    <div className="card-content">
                        <h3>Low Stock</h3>
                        <p className="card-value">{stockItems.filter(isLowStock).length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">🏭</div>
                    <div className="card-content">
                        <h3>Categories</h3>
                        <p className="card-value">{categories.length - 1}</p>
                    </div>
                </div>
            </div>

            <div className="filters-section">
                <div className="filter-row">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Search by name or location..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="filter-group">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="form-select"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="tasks-table-container">
                {error && <div className="alert alert-danger">{error}</div>}

                {isLoading ? (
                    <div className="loading-state"><p>Loading stock items... 🔄</p></div>
                ) : filteredItems.length === 0 ? (
                    <div className="empty-state">
                        <h3>No stock items found</h3>
                        <p>Click "Add Stock Item" to create one.</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="tasks-table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Location</th>
                                    <th>Category</th>
                                    <th>Min Stock</th>
                                    <th>Status</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="task-row" style={isLowStock(item) ? { backgroundColor: '#fff3cd' } : {}}>
                                        <td className="task-title-cell">
                                            <div className="task-title-main">{item.name}</div>
                                            {item.notes && <div className="task-sub">{item.notes}</div>}
                                        </td>
                                        <td><strong>{item.quantity}</strong></td>
                                        <td>{item.unit}</td>
                                        <td>{item.location || '-'}</td>
                                        <td>{item.category || '-'}</td>
                                        <td>{item.minStock || '-'}</td>
                                        <td>
                                            {isLowStock(item) ? (
                                                <span className="status-badge" style={{ backgroundColor: '#dc3545', color: 'white' }}>⚠️ Low Stock</span>
                                            ) : (
                                                <span className="status-badge" style={{ backgroundColor: '#28a745', color: 'white' }}>✓ OK</span>
                                            )}
                                        </td>
                                        <td>{formatDate(item.updatedAt)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button onClick={() => openEditModal(item)} className="edit-btn" title="Edit">✏️</button>
                                                <button onClick={() => handleDelete(item.id)} className="delete-btn" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredItems.length > 0 && (
                    <div className="table-footer">
                        <div className="table-summary">
                            Showing {filteredItems.length} of {stockItems.length} items
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="modal-overlay" onClick={closeAddModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>➕ Add Stock Item</h2>
                            <button type="button" className="close-button" onClick={closeAddModal}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleAddSubmit} className="task-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input type="text" name="name" value={newItem.name} onChange={handleInputChange} required className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Quantity *</label>
                                        <input type="number" name="quantity" value={newItem.quantity} onChange={handleInputChange} required className="form-input" step="0.01" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Unit</label>
                                        <select name="unit" value={newItem.unit} onChange={handleInputChange} className="form-select">
                                            <option value="pcs">pcs</option>
                                            <option value="kg">kg</option>
                                            <option value="m">m</option>
                                            <option value="L">L</option>
                                            <option value="box">box</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Location</label>
                                        <input type="text" name="location" value={newItem.location} onChange={handleInputChange} className="form-input" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Category</label>
                                        <input type="text" name="category" value={newItem.category} onChange={handleInputChange} className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Min Stock Alert</label>
                                        <input type="number" name="minStock" value={newItem.minStock} onChange={handleInputChange} className="form-input" step="0.01" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea name="notes" value={newItem.notes} onChange={handleInputChange} className="form-input" rows="2"></textarea>
                                </div>
                                {error && <div className="alert alert-danger">{error}</div>}
                                <div className="modal-actions">
                                    <button type="button" className="secondary" onClick={closeAddModal}>Cancel</button>
                                    <button type="submit" className="primary">Add Item</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingItem && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>✏️ Edit Stock Item</h2>
                            <button type="button" className="close-button" onClick={closeEditModal}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleEditSubmit} className="task-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input type="text" name="name" value={editingItem.name} onChange={handleEditInputChange} required className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Quantity *</label>
                                        <input type="number" name="quantity" value={editingItem.quantity} onChange={handleEditInputChange} required className="form-input" step="0.01" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Unit</label>
                                        <select name="unit" value={editingItem.unit} onChange={handleEditInputChange} className="form-select">
                                            <option value="pcs">pcs</option>
                                            <option value="kg">kg</option>
                                            <option value="m">m</option>
                                            <option value="L">L</option>
                                            <option value="box">box</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Location</label>
                                        <input type="text" name="location" value={editingItem.location} onChange={handleEditInputChange} className="form-input" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Category</label>
                                        <input type="text" name="category" value={editingItem.category} onChange={handleEditInputChange} className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Min Stock Alert</label>
                                        <input type="number" name="minStock" value={editingItem.minStock} onChange={handleEditInputChange} className="form-input" step="0.01" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea name="notes" value={editingItem.notes} onChange={handleEditInputChange} className="form-input" rows="2"></textarea>
                                </div>
                                {error && <div className="alert alert-danger">{error}</div>}
                                <div className="modal-actions">
                                    <button type="button" className="secondary" onClick={closeEditModal}>Cancel</button>
                                    <button type="submit" className="primary">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockPage;