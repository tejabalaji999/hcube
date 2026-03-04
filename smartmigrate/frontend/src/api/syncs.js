import api from './axios';

export const getSyncs = () => api.get('/syncs');
export const getSync = (id) => api.get(`/syncs/${id}`);
export const createSync = (data) => api.post('/syncs', data);
export const deleteSync = (id) => api.delete(`/syncs/${id}`);
export const runSync = (id) => api.post(`/syncs/${id}/run`);
export const getSyncLogs = (id) => api.get(`/syncs/${id}/logs`);
export const getSyncStats = (id) => api.get(`/syncs/${id}/stats`);
export const toggleSync = (id) => api.put(`/syncs/${id}/toggle`);
export const updateSchedule = (id, scheduleType) => api.put(`/syncs/${id}/schedule`, { scheduleType });
export const updateSyncConfig = (id, config) => api.put(`/syncs/${id}/config`, config);
