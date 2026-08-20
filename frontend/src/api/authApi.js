import { request } from './client';

export function signup(data) {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
}

export function login(data) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getSession() {
  return request('/auth/me');
}
