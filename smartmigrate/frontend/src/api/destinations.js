import api from './axios';

export const getDestinations = () => api.get('/destinations');
export const getDestination = (id) => api.get(`/destinations/${id}`);
export const createDestination = (data) => api.post('/destinations', data);
export const updateDestination = (id, data) => api.put(`/destinations/${id}`, data);
export const deleteDestination = (id) => api.delete(`/destinations/${id}`);
export const testDestination = (id) => api.post(`/destinations/${id}/test`);
