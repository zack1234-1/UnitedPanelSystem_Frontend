// apiService.js
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
    };

    const response = await fetch(url, config);
    return handleResponse(response);
};

// =========================================================
// PROJECTS API
// =========================================================

export const projectsAPI = {
    // CRUD Operations
    getAll: () => apiRequest('/projects'),
    create: (projectData) => apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
    }),
    update: (projectId, projectData) => apiRequest(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(projectData),
    }),
    delete: (projectId) => apiRequest(`/projects/${projectId}`, {
        method: 'DELETE',
    }),

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
        body: JSON.stringify(taskData),
    }),
    update: (taskId, taskData) => apiRequest(`/panel-tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(taskData),
    }),
    delete: (taskId) => apiRequest(`/panel-tasks/${taskId}`, {
        method: 'DELETE',
    }),
};

// --- Door Tasks API ---
export const doorTasksAPI = {
    getAll: () => apiRequest('/door-tasks'), // 🚨 Path changed
    create: (taskData) => apiRequest('/door-tasks', { 
        method: 'POST',
        body: JSON.stringify(taskData),
    }),
    update: (taskId, taskData) => apiRequest(`/door-tasks/${taskId}`, { // 🚨 Path changed
        method: 'PATCH',
        body: JSON.stringify(taskData),
    }),
    delete: (taskId) => apiRequest(`/door-tasks/${taskId}`, { // 🚨 Path changed
        method: 'DELETE',
    }),
};

// --- Accessories Tasks API ---
export const accessoriesTasksAPI = {
    getAll: () => apiRequest('/accessories-tasks'), // 🚨 Path changed
    create: (taskData) => apiRequest('/accessories-tasks', { 
        method: 'POST',
        body: JSON.stringify(taskData),
    }),
    update: (taskId, taskData) => apiRequest(`/accessories-tasks/${taskId}`, { // 🚨 Path changed
        method: 'PATCH',
        body: JSON.stringify(taskData),
    }),
    delete: (taskId) => apiRequest(`/accessories-tasks/${taskId}`, { // 🚨 Path changed
        method: 'DELETE',
    }),
};

// --- Cutting Tasks API ---
export const cuttingTasksAPI = {
    getAll: () => apiRequest('/cutting-tasks'), // 🚨 Path changed
    create: (taskData) => apiRequest('/cutting-tasks', { 
        method: 'POST',
        body: JSON.stringify(taskData),
    }),
    update: (taskId, taskData) => apiRequest(`/cutting-tasks/${taskId}`, { // 🚨 Path changed
        method: 'PATCH',
        body: JSON.stringify(taskData),
    }),
    delete: (taskId) => apiRequest(`/cutting-tasks/${taskId}`, { // 🚨 Path changed
        method: 'DELETE',
    }),
};

// =========================================================
// LEGACY NAMED EXPORTS (for backward compatibility)
// =========================================================

// Projects
export const getAllProjects = projectsAPI.getAll;
export const createProject = projectsAPI.create;
export const updateProject = projectsAPI.update;
export const deleteProject = projectsAPI.delete;
export const uploadProjectFiles = projectsAPI.uploadFiles;
export const deleteProjectFile = projectsAPI.deleteFile;
export const getProjectFilesMetadata = projectsAPI.getFilesMetadata;
export const downloadFileBlob = projectsAPI.downloadFileBlob;

// Panel Tasks
export const getAllPanelTasks = panelTasksAPI.getAll;
export const createPanelTask = panelTasksAPI.create;
export const updatePanelTask = panelTasksAPI.update;
export const deletePanelTask = panelTasksAPI.delete;

// --- Cutting Tasks (NEW) ---
export const getAllCuttingTasks = cuttingTasksAPI.getAll;
export const createCuttingTask = cuttingTasksAPI.create;
export const updateCuttingTask = cuttingTasksAPI.update;
export const deleteCuttingTask = cuttingTasksAPI.delete;

// --- Accessories Tasks (NEW) ---
export const getAllAccessoriesTasks = accessoriesTasksAPI.getAll;
export const createAccessoriesTask = accessoriesTasksAPI.create;
export const updateAccessoriesTask = accessoriesTasksAPI.update;
export const deleteAccessoriesTask = accessoriesTasksAPI.delete;