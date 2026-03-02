import api from './axios';

export const getConnections = () => api.get('/connections');
export const getConnection = (id) => api.get(`/connections/${id}`);
export const createConnection = (data) => api.post('/connections', data);
export const updateConnection = (id, data) => api.put(`/connections/${id}`, data);
export const deleteConnection = (id) => api.delete(`/connections/${id}`);
export const testConnection = (id) => api.post(`/connections/${id}/test`);
export const fetchSchema    = (id) => api.get(`/connections/${id}/schema`);
