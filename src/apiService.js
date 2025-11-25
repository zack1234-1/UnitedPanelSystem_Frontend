// src/apiService.js

// IMPORTANT: Ensure this base URL matches your Express server's address
const API_BASE_URL = 'http://localhost:5000/api/projects'; 

// Helper to handle standard API responses
const handleResponse = async (response) => {
    if (!response.ok) {
        // Attempt to parse JSON error message from the backend
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || response.statusText;
        throw new Error(`API Request Failed (${response.status}): ${errorMessage}`);
    }
    // Handle 204 No Content (DELETE) case gracefully
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

// =========================================================
// CRUD Operations
// =========================================================

/**
 * Fetches all projects from the database.
 * Corresponds to: GET /api/projects
 */
export async function getAllProjects() {
    const response = await fetch(API_BASE_URL);
    return handleResponse(response);
}

/**
 * Creates a new project in the database.
 * Corresponds to: POST /api/projects
 */
export async function createProject(newProjectData) {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProjectData),
    });
    console.log(response);
    return handleResponse(response);
}

/**
 * Updates an existing project by ID.
 * Corresponds to: PUT /api/projects/:id
 */
export async function updateProject(projectId, projectData) {
    const response = await fetch(`${API_BASE_URL}/${projectId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
    });
    console.log(response);
    return handleResponse(response);
}

/**
 * Deletes a project by ID (which triggers file cleanup on the backend).
 * Corresponds to: DELETE /api/projects/:id
 */
export async function deleteProject(projectId) {
    const response = await fetch(`${API_BASE_URL}/${projectId}`, {
        method: 'DELETE',
    });
    // This expects a 204 No Content response
    return handleResponse(response); 
}

// =========================================================
// File Upload Operations
// =========================================================

/**
 * Uploads multiple files for a given project number using FormData.
 * Corresponds to: POST /api/projects/upload
 * @param {FormData} formData - Must contain 'files' (array of File objects) and 'projectNo'.
 */

export const uploadProjectFiles = async (projectNo, filesToUpload) => {
    
    // 1. Create the FormData object
    const formData = new FormData();

    // 2. ⬅️ FIX: Append the projectNo as a plain text field
    // This will appear in req.body on the backend
    formData.append('projectNo', projectNo); 

    // 3. Append all files using the name Multer expects ('files' in this example)
    filesToUpload.forEach(file => {
        // We use 'files' here, which must match the field name in upload.array('files', ...) on the server
        formData.append('files', file); 
    });

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData, // Automatically sets Content-Type: multipart/form-data
        // IMPORTANT: Do NOT manually set the 'Content-Type' header here.
        // If you do, the boundary will be missing, and the server will fail to parse the body.
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText || response.statusText}`);
    }

    // Return the server response (e.g., list of newly created files or a success message)
    return response.json(); 
};


// =========================================================
// 🗑️ NEW: File Deletion Route (Used for single file management)
// =========================================================

/**
 * Deletes a single project file by its database ID.
 * Corresponds to: DELETE /api/projects/file/:id
 * @param {number} fileId - The ID of the file record in the project_files table.
 */
export async function deleteProjectFile(fileId) {
    const response = await fetch(`${API_BASE_URL}/file/${fileId}`, {
        method: 'DELETE',
    });
    // This expects a 200 OK or 204 No Content response
    return handleResponse(response); 
}

export async function getProjectFilesMetadata(projectNo) {
    const response = await fetch(`${API_BASE_URL}/files/${projectNo}`);
    return handleResponse(response);
}

export async function downloadFileBlob(fileId) 
{
    const response = await fetch(`${API_BASE_URL}/file/blob/${fileId}`);
    
    if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) {
        }
        throw new Error(errorMsg);
    }

    return response; 
}

