const BASE_URL = 'http://localhost:5000/api';

// Helper to handle standard API responses
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || response.statusText;
        throw new Error(`API Request Failed (${response.status}): ${errorMessage}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
        // Stringify body if it exists and is an object
        body: options.body && typeof options.body === 'object' 
            ? JSON.stringify(options.body) 
            : options.body,
    };

    const response = await fetch(url, config);
    return handleResponse(response);
};

// =========================================================
// PROJECTS API (Standard User/Public)
// =========================================================

export const projectsAPI = {
    // CRUD Operations
    getAll: () => apiRequest('/projects'),
    getByStatus: (status) => apiRequest(`/projects/status/${status}`), 
    create: (projectData) => apiRequest('/projects', {
        method: 'POST',
        body: projectData,
    }),
    update: (projectId, projectData) => apiRequest(`/projects/${projectId}`, {
        method: 'PUT',
        body: projectData,
    }),
    delete: (projectId) => apiRequest(`/projects/${projectId}`, {
        method: 'DELETE',
    }),

    updateStatus: (projectId, statusData) => apiRequest(`/projects/${projectId}/status`, {
        method: 'PATCH',
        body: statusData,
    }),

    // Get status counts - New
    getStatusCounts: () => apiRequest('/projects/status/counts'),

    // File Operations
    uploadFiles: async (projectNo, filesToUpload) => {
        const formData = new FormData();
        formData.append('projectNo', projectNo);
        filesToUpload.forEach(file => formData.append('files', file));

        const response = await fetch(`${BASE_URL}/projects/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText || response.statusText}`);
        }

        return response.json();
    },

    deleteFile: (fileId) => apiRequest(`/projects/file/${fileId}`, {
        method: 'DELETE',
    }),

    getFilesMetadata: (projectNo) => apiRequest(`/projects/files/${projectNo}`),

    downloadFileBlob: async (fileId) => {
        const response = await fetch(`${BASE_URL}/projects/file/blob/${fileId}`);
        
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // Ignore JSON parse error for non-JSON responses
            }
            throw new Error(errorMsg);
        }
        return response;
    },
};

// =========================================================
// PANEL TASKS API
// =========================================================

export const panelTasksAPI = {
    getAll: () => apiRequest('/panel-tasks'),
    create: (taskData) => apiRequest('/panel-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/panel-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/panel-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

// --- Door Tasks API ---
export const doorTasksAPI = {
    getAll: () => apiRequest('/door-tasks'),
    create: (taskData) => apiRequest('/door-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/door-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/door-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

// --- Accessories Tasks API ---
export const accessoriesTasksAPI = {
    getAll: () => apiRequest('/accessories-tasks'),
    create: (taskData) => apiRequest('/accessories-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/accessories-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/accessories-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

// --- Cutting Tasks API ---
export const cuttingTasksAPI = {
    getAll: () => apiRequest('/cutting-tasks'),
    create: (taskData) => apiRequest('/cutting-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/cutting-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/cutting-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

export const stripCurtainTasksAPI = {
    // Corrected path to reflect the 'strip curtain' category
    getAll: () => apiRequest('/strip-curtain-tasks'),
    create: (taskData) => apiRequest('/strip-curtain-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/strip-curtain-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/strip-curtain-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

export const systemTasksAPI = {
    // Corrected path to reflect the 'system' category
    getAll: () => apiRequest('/system-tasks'),
    create: (taskData) => apiRequest('/system-tasks', { 
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/system-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/system-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

export const projectAdminAPI = {
    // GET /api/admin/projects
    getAllProjects: () => apiRequest('/admin/projects'),

    // POST /api/admin/projects
    createProject: (projectData) => apiRequest('/admin/projects', {
        method: 'POST',
        body: projectData,
    }),

    // GET /api/admin/projects/:jobNo
    getProjectByJobNo: (jobNo) => apiRequest(`/admin/projects/${jobNo}`),

    // PUT /api/admin/projects/:jobNo
    updateProject: (jobNo, projectData) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'PUT',
        body: projectData,
    }),

    // DELETE /api/admin/projects/:jobNo
    deleteProject: (jobNo) => apiRequest(`/admin/projects/${jobNo}`, {
        method: 'DELETE',
    }),
};

// =========================================================
// PROJECT/JOB ADMIN API (NEW - Renamed for clarity)
// =========================================================

export const jobAdminAPI = { // 💥 RENAMED from projectAdminAPI to jobAdminAPI
    // GET /api/admin/projects
    getAllJobs: () => apiRequest('/admin/projects'), // Function renamed to getAllJobs

    // POST /api/admin/projects
    createJob: (jobData) => apiRequest('/admin/projects', { // Function renamed to createJob
        method: 'POST',
        body: jobData,
    }),

    // GET /api/admin/projects/:jobNo
    getJobByJobNo: (jobNo) => apiRequest(`/admin/projects/${jobNo}`), // Function renamed

    // PUT /api/admin/projects/:jobNo
    updateJob: (jobNo, jobData) => apiRequest(`/admin/projects/${jobNo}`, { // Function renamed
        method: 'PUT',
        body: jobData,
    }),

    // DELETE /api/admin/projects/:jobNo
    deleteJob: (jobNo) => apiRequest(`/admin/projects/${jobNo}`, { // Function renamed
        method: 'DELETE',
    }),
};

export const activityLogsAPI = {
    // Get all activity logs (with optional filtering)
    getAll: (params = {}) => {
        // Build query string if params provided
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/activity-logs?${queryString}` : '/activity-logs';
        return apiRequest(endpoint);
    },
    
};

export const transportationTasksAPI = {
    getAll: () => apiRequest('/transportation-tasks'),
    create: (taskData) => apiRequest('/transportation-tasks', {
        method: 'POST',
        body: taskData,
    }),
    update: (taskId, taskData) => apiRequest(`/transportation-tasks/${taskId}`, {
        method: 'PATCH',
        body: taskData,
    }),
    delete: (taskId) => apiRequest(`/transportation-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

// apiService.js (update this file)
export const viewPanelAPI = {
    // GET: Get all panels
    getAll: () => apiRequest('/panels'),

    // GET: Get single panel by ID
    getById: (panelId) => apiRequest(`/panels/${panelId}`),

    // POST: Create new panel
    create: (panelData) => apiRequest('/panels', { 
        method: 'POST',
        body: panelData,
    }),

    // PUT: Update panel
    update: (id, data) => {
        // Format dates before sending
        const formattedData = { ...data };
        
        if (formattedData.estimated_delivery) {
            const date = new Date(formattedData.estimated_delivery);
            if (!isNaN(date.getTime())) {
                formattedData.estimated_delivery = date.toISOString().split('T')[0];
            }
        }
        
        return apiRequest(`/panels/${id}`, {
            method: 'PUT',
            body: formattedData,
        });
    },
    
    // DELETE: Delete panel
    delete: (panelId) => apiRequest(`/panels/${panelId}`, {
        method: 'DELETE',
    }),

    // GET: Get production summary for a panel (including current balance)
    getProductionSummary: (panelId) => apiRequest(`/panels/${panelId}/production-summary`),

    // POST: Create production record with balance update
    createProductionWithBalance: (panelId, productionData) => apiRequest(`/panels/${panelId}/production-with-balance`, {
        method: 'POST',
        body: productionData,
    }),

    // DELETE: Delete production record with balance update
    deleteProductionWithBalance: (panelId, recordId) => apiRequest(`/panels/${panelId}/production/${recordId}/with-balance`, {
        method: 'DELETE',
    }),

    // POST: Duplicate panel
    duplicate: (panelId) => apiRequest(`/panels/${panelId}/duplicate`, {
        method: 'POST',
    }),

    // GET: Get balance history
    getBalanceHistory: (panelId) => apiRequest(`/panels/${panelId}/balance-history`),

    // PUT: Update panel balance
    updateBalance: (panelId, balanceData) => apiRequest(`/panels/${panelId}/balance`, {
        method: 'PUT',
        body: balanceData,
    }),

    // GET: Get overall statistics
    getStatsSummary: () => apiRequest('/panels/stats/summary'),
};

export const productionAPI = {
    // GET: Get production records for a panel
    getByPanelId: (panelId) => apiRequest(`/panels/${panelId}/production-records`),

    // POST: Create production record
    create: (panelId, productionData) => apiRequest(`/panels/${panelId}/production-records`, {
        method: 'POST',
        body: productionData,
    }),

    // PUT: Update production record
    update: (panelId, recordId, productionData) => apiRequest(`/panels/${panelId}/production-records/${recordId}`, {
        method: 'PUT',
        body: productionData,
    }),

    updateStatus: (recordId, statusData) => apiRequest(`/panels/production-records/${recordId}/status`, {
        method: 'PATCH',
        body: statusData,
        }),

    // DELETE: Delete production record
    delete: (panelId, recordId) => apiRequest(`/panels/${panelId}/production-records/${recordId}`, {
        method: 'DELETE',
    }),
};

// =========================================================
// LEGACY NAMED EXPORTS (for backward compatibility and convenience)
// =========================================================

// Projects (Standard)
export const getAllProjects = projectsAPI.getAll;
export const createProject = projectsAPI.create;
export const updateProject = projectsAPI.update;
export const deleteProject = projectsAPI.delete;
export const uploadProjectFiles = projectsAPI.uploadFiles;
export const deleteProjectFile = projectsAPI.deleteFile;
export const getProjectFilesMetadata = projectsAPI.getFilesMetadata;
export const downloadFileBlob = projectsAPI.downloadFileBlob;
export const updateProjectStatus = projectsAPI.updateStatus; 
export const getProjectStatusCounts = projectsAPI.getStatusCounts;
export const getProjectsByStatus = projectsAPI.getByStatus; 

// Panel Tasks
export const getAllPanelTasks = panelTasksAPI.getAll;
export const createPanelTask = panelTasksAPI.create;
export const updatePanelTask = panelTasksAPI.update;
export const deletePanelTask = panelTasksAPI.delete;

// Door Tasks
export const getAllDoorTasks = doorTasksAPI.getAll;
export const createDoorTask = doorTasksAPI.create;
export const updateDoorTask = doorTasksAPI.update;
export const deleteDoorTask = doorTasksAPI.delete;

// Cutting Tasks
export const getAllCuttingTasks = cuttingTasksAPI.getAll;
export const createCuttingTask = cuttingTasksAPI.create;
export const updateCuttingTask = cuttingTasksAPI.update;
export const deleteCuttingTask = cuttingTasksAPI.delete;

// Accessories Tasks
export const getAllAccessoriesTasks = accessoriesTasksAPI.getAll;
export const createAccessoriesTask = accessoriesTasksAPI.create;
export const updateAccessoriesTask = accessoriesTasksAPI.update;
export const deleteAccessoriesTask = accessoriesTasksAPI.delete;

// Strip Curtain Tasks
export const getAllStripCurtainTasks = stripCurtainTasksAPI.getAll;
export const createStripCurtainTask = stripCurtainTasksAPI.create;
export const updateStripCurtainTask = stripCurtainTasksAPI.update;
export const deleteStripCurtainTask = stripCurtainTasksAPI.delete;

// System Tasks
export const getAllSystemTasks = systemTasksAPI.getAll;
export const createSystemTask = systemTasksAPI.create;
export const updateSystemTask = systemTasksAPI.update;
export const deleteSystemTask = systemTasksAPI.delete;

// --- Project/Job Admin (NEW) ---
export const getAllAdminJobs = jobAdminAPI.getAllJobs; 
export const createAdminJob = jobAdminAPI.createJob;  
export const updateAdminJob = jobAdminAPI.updateJob;  
export const deleteAdminJob = jobAdminAPI.deleteJob;
export const getAdminJobByJobNo = jobAdminAPI.getJobByJobNo; 

export const getAllActivityLogs = activityLogsAPI.getAll;

// Transportation Tasks (NEW - Added)
export const getAllTransportationTasks = transportationTasksAPI.getAll;
export const createTransportationTask = transportationTasksAPI.create;
export const updateTransportationTask = transportationTasksAPI.update;
export const deleteTransportationTask = transportationTasksAPI.delete;

// Panels API (NEW - Added)
export const getAllPanels = viewPanelAPI.getAll;
export const getPanelById = viewPanelAPI.getById;
export const createPanel = viewPanelAPI.create;
export const updatePanel = viewPanelAPI.update;
export const deletePanel = viewPanelAPI.delete;
export const searchPanels = viewPanelAPI.search;
export const updatePanelStatus = viewPanelAPI.updateStatus;
export const updatePanelPriority = viewPanelAPI.updatePriority;
