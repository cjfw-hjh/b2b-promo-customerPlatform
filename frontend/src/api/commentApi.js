import { request } from './client';

export function listComments(salesLogId) {
  return request(`/sales-logs/${salesLogId}/comments`);
}

export function createComment(salesLogId, content) {
  return request(`/sales-logs/${salesLogId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function listManagedComments() {
  return request('/managed/comments');
}
