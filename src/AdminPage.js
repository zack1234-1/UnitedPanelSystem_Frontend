import React, { useState } from 'react';

// Column headers based on the image
const tableColumns = [
    'DATE', 'JOB NO.', 'SALES', 'CUSTOMER', 'SELL', 'COST', 'MARGIN', 'APPROVAL', 'REMARKS'
];

// Reusing the ProjectModal component structure from the previous step
const ProjectModal = ({ isOpen, onClose, columns, onSave }) => {
    // Initial state for the new project form, defaulting to empty strings
    const initialFormState = columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {});
    const [formData, setFormData] = useState(initialFormState);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        setFormData(initialFormState);
        onClose();
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h3>➕ Create New Project Entry</h3>
                <form onSubmit={handleSubmit}>
                    {columns.map(col => (
                        <div key={col} className="form-group">
                            <label htmlFor={col}>{col}:</label>
                            <input
                                id={col}
                                name={col}
                                type={['SELL', 'COST', 'MARGIN'].includes(col) ? 'number' : 'text'}
                                value={formData[col]}
                                onChange={handleChange}
                                required={['JOB NO.', 'CUSTOMER'].includes(col)}
                            />
                        </div>
                    ))}
                    <div className="modal-actions">
                        <button type="submit" className="action-btn primary">Save Project</button>
                        <button type="button" onClick={onClose} className="action-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const AdminPage = ({ projects, navigate, addNewProject }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Placeholder data transformation logic
    const formatProjectData = (project) => ({
        DATE: project.date || 'N/A',
        'JOB NO.': project.projectNo || 'N/A',
        SALES: project.salesperson || 'N/A',
        CUSTOMER: project.customer || 'N/A',
        SELL: project.sellValue ? `$${project.sellValue.toFixed(2)}` : 'N/A',
        COST: project.costValue ? `$${project.costValue.toFixed(2)}` : 'N/A',
        MARGIN: project.margin ? `${project.margin}%` : 'N/A',
        APPROVAL: project.isApproved ? '✅ Approved' : '❌ Pending',
        REMARKS: project.remarks || '-',
    });

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);
    
    const handleSaveNewProject = (newProjectData) => {
        console.log('New project data captured:', newProjectData);
        // This is where you would integrate the data saving logic
        // addNewProject(newProjectData); 
        alert(`New Project ${newProjectData['JOB NO.']} created!`);
    };

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>⚙️ Project Administration</h1>
                <p>Manage and monitor all projects in the system</p>
            </header>

            <main className="admin-content">
                <div className="admin-section project-table-section">
                    <div className="table-header-row">
                        <h2>Project Tracker 📋</h2>
                        <button 
                            className="create-icon-btn"
                            onClick={openModal}
                            title="Create New Project"
                        >
                            ➕ **Create New Entry**
                        </button>
                    </div>
                    
                    <div className="project-table-container">
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
                                {projects.length > 0 ? (
                                    projects.map(project => {
                                        const data = formatProjectData(project);
                                        return (
                                            <tr key={project.id || project.projectNo}>
                                                {tableColumns.map(col => (
                                                    <td key={`${project.id}-${col}`}>{data[col]}</td>
                                                ))}
                                                <td>
                                                    <button 
                                                        // 💥 CHANGED: Navigation now points to the files page
                                                        onClick={() => navigate(`/files/${project.projectNo}`)}
                                                        className="table-action-btn"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={tableColumns.length + 1} className="no-data">
                                            No projects found. Use the ➕ button to start tracking!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <ProjectModal 
                isOpen={isModalOpen}
                onClose={closeModal}
                columns={tableColumns}
                onSave={handleSaveNewProject}
            />
        </div>
    );
};

export default AdminPage;