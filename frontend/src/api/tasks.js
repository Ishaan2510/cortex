import api from './axios';

export const createTask  = (formData)  => api.post('/api/tasks', formData);
export const getTasks    = (page = 1)  => api.get(`/api/tasks?page=${page}`);
export const getTask     = (id)        => api.get(`/api/tasks/${id}`);
export const deleteTask  = (id)        => api.delete(`/api/tasks/${id}`);