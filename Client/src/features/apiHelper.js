// FOLLO SRP
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
export const API_V1 = `${API_URL}/api/v1`;

/**
 * Helper to make API calls with envelope handling
 */
export const apiCall = async (url, options, getToken) => {
    const token = await getToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });
    
    // Handle 204 No Content
    if (response.status === 204) {
        return { success: true, data: null };
    }
    
    const result = await response.json();
    
    // Handle new envelope format
    if (result.hasOwnProperty('success')) {
        if (!result.success) {
            throw new Error(result.error?.message || 'Request failed');
        }
        return result;
    }
    
    // Handle legacy format (backward compatibility)
    if (!response.ok) {
        throw new Error(result.error || 'Request failed');
    }
    
    return { success: true, data: result };
};
