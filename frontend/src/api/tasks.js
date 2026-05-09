import api from './axios';

export const createTask = (data) => api.post('/api/tasks', data);
export const getTasks = () => api.get('/api/tasks');
export const getTask = (id) => api.get(`/api/tasks/${id}`);