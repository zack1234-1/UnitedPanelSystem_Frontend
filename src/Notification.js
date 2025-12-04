import React, { useState, useEffect } from 'react';
import Notification from './Notification'; // Import your Notification component
import { getAllActivityLogs, searchActivityLogs } from './apiService'; // Import your API functions

const NotificationPage = ({ clearAllNotifications }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dismissedLogs, setDismissedLogs] = useState([]);
    const [filterType, setFilterType] = useState('all');

    // Activity type options for filtering
    const activityTypes = [
        { value: 'all', label: 'All Activities' },
        { value: 'project_created', label: 'Project Created' },
        { value: 'project_updated', label: 'Project Updated' },
        { value: 'project_deleted', label: 'Project Deleted' },
        { value: 'task_created', label: 'Task Created' },
        { value: 'task_updated', label: 'Task Updated' },
        { value: 'task_deleted', label: 'Task Deleted' },
        { value: 'file_uploaded', label: 'File Uploaded' },
        { value: 'file_deleted', label: 'File Deleted' },
        { value: 'login', label: 'User Login' },
        { value: 'logout', label: 'User Logout' }
    ];

    // Fetch all activity logs on component mount
    useEffect(() => {
        fetchActivityLogs();
        
        // Load dismissed logs from localStorage
        const savedDismissed = localStorage.getItem('dismissedActivityLogs');
        if (savedDismissed) {
            setDismissedLogs(JSON.parse(savedDismissed));
        }
    }, []);

    const fetchActivityLogs = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getAllActivityLogs();
            
            if (response.success) {
                setLogs(response.data || []);
            } else {
                throw new Error(response.error || 'Failed to fetch activity logs');
            }
        } catch (err) {
            console.error('Error fetching activity logs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            fetchActivityLogs();
            return;
        }

        try {
            setLoading(true);
            const response = await searchActivityLogs(searchTerm);
            
            if (response.success) {
                setLogs(response.data || []);
            } else {
                throw new Error(response.error || 'Search failed');
            }
        } catch (err) {
            console.error('Error searching activity logs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (type) => {
        setFilterType(type);
        // For client-side filtering
        fetchActivityLogs(); // Will fetch all logs and then filter client-side
    };

    const removeNotification = (logId) => {
        const newDismissed = [...dismissedLogs, logId];
        setDismissedLogs(newDismissed);
        localStorage.setItem('dismissedActivityLogs', JSON.stringify(newDismissed));
    };

    const handleClearAllNotifications = () => {
        const allLogIds = visibleLogs.map(log => log.id);
        const newDismissed = [...dismissedLogs, ...allLogIds];
        setDismissedLogs(newDismissed);
        localStorage.setItem('dismissedActivityLogs', JSON.stringify(newDismissed));
        
        // Call the parent's clearAllNotifications if provided
        if (clearAllNotifications) {
            clearAllNotifications();
        }
    };

    const handleUndismissAll = () => {
        setDismissedLogs([]);
        localStorage.removeItem('dismissedActivityLogs');
    };

    const refreshLogs = () => {
        fetchActivityLogs();
    };

    // Filter out dismissed logs and apply type filter
    const visibleLogs = logs.filter(log => {
        // Don't show dismissed logs
        if (dismissedLogs.includes(log.id)) {
            return false;
        }
        
        // Apply type filter if not 'all'
        if (filterType !== 'all' && log.activity_type !== filterType) {
            return false;
        }
        
        // Apply search filter if search term exists
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                log.message?.toLowerCase().includes(searchLower) ||
                log.activity_type?.toLowerCase().includes(searchLower) ||
                (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
            );
        }
        
        return true;
    });

    // Sort logs by timestamp (newest first)
    const sortedLogs = [...visibleLogs].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    if (loading) {
        return (
            <div className="notification-page">
                <header className="page-header">
                    <h1>📋 Activity Logs</h1>
                </header>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading activity logs...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="notification-page">
                <header className="page-header">
                    <h1>📋 Activity Logs</h1>
                </header>
                <div className="error-state">
                    <p>Error: {error}</p>
                    <button onClick={fetchActivityLogs} className="retry-btn">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="notification-page">
            <header className="page-header">
                <h1>📋 Activity Logs</h1>
                <div className="header-controls">
                    <div className="search-filter-container">
                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button onClick={handleSearch} className="search-btn">
                                Search
                            </button>
                        </div>
                        
                        <select 
                            value={filterType}
                            onChange={(e) => handleFilterChange(e.target.value)}
                            className="filter-select"
                        >
                            {activityTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        
                        <button onClick={refreshLogs} className="refresh-btn" title="Refresh logs">
                            ↻
                        </button>
                    </div>
                    
                    {sortedLogs.length > 0 && (
                        <button 
                            onClick={handleClearAllNotifications} 
                            className="secondary clear-all-btn"
                        >
                            Clear All Notifications
                        </button>
                    )}
                    {dismissedLogs.length > 0 && (
                        <button 
                            onClick={handleUndismissAll} 
                            className="secondary undismiss-btn"
                        >
                            Restore Dismissed ({dismissedLogs.length})
                        </button>
                    )}
                </div>
            </header>

            <main className="notification-page-content">
                {sortedLogs.length === 0 ? (
                    <div className="no-notifications-page">
                        <div className="empty-state">
                            <span className="empty-icon">🎉</span>
                            <h2>You're all caught up!</h2>
                            <p>No activity logs to display.</p>
                            {dismissedLogs.length > 0 && (
                                <p className="dismissed-info">
                                    You have {dismissedLogs.length} dismissed logs.
                                    <button 
                                        onClick={handleUndismissAll} 
                                        className="text-btn"
                                    >
                                        Restore them
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="notification-list-page">
                        <div className="notification-stats">
                            <p>Showing <strong>{sortedLogs.length}</strong> of {logs.length} total logs</p>
                            <p className="dismissed-count">
                                {dismissedLogs.length} dismissed
                            </p>
                        </div>
                        <div className="notifications-grid">
                            {sortedLogs.map(log => (
                                <div key={log.id} className="log-item-wrapper">
                                    <Notification
                                        log={log}
                                        onClose={() => removeNotification(log.id)}
                                        isPermanent={true}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default NotificationPage;