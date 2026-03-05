import axios from 'axios';

// Normaliza a URL do backend e faz fallback para a mesma origem (/api)
let RAW_BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Plataformas de deploy às vezes passam a string literal "undefined"/"null"
if (RAW_BACKEND_URL === 'undefined' || RAW_BACKEND_URL === 'null') {
  RAW_BACKEND_URL = '';
}

const BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, '');
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

const api = axios.create({
  baseURL: API,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;