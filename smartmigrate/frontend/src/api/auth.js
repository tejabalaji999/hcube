import api from './axios';

export const login = (username, password) =>
  api.post('/auth/login', { username, password });
