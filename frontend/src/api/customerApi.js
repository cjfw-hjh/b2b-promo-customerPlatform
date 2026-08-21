import { request } from './client';

export function listCustomers() {
  return request('/customers');
}

export function getCustomerKnowhow(id) {
  return request(`/customers/${id}/knowhow`);
}
