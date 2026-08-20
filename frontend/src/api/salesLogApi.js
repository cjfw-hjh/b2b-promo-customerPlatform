import { request } from './client';

export function listSalesLogs(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  return request(`/sales-logs${query ? `?${query}` : ''}`);
}

export function createSalesLog(data) {
  return request('/sales-logs', { method: 'POST', body: JSON.stringify(data) });
}

export function getSalesLog(id) {
  return request(`/sales-logs/${id}`);
}

export function updateSalesLog(id, data) {
  return request(`/sales-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteSalesLog(id) {
  return request(`/sales-logs/${id}`, { method: 'DELETE' });
}
