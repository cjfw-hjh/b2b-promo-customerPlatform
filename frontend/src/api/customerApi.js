import { request } from './client';

export function listCustomers() {
  return request('/customers');
}
