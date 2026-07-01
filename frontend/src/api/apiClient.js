const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1';

class ApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('tiki_access_token');
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      response.status === 401
        ? '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.'
        : typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
        ? data.detail.map((e) => e.msg).join(', ')
        : '요청을 처리하지 못했습니다.';
    throw new ApiError(message, { status: response.status, detail: data?.detail ?? null });
  }

  return data;
}

export async function loginUser({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function signupUser({ name, email, password, role }) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });
}

export async function getCurrentUser() {
  return request('/auth/me');
}

export function saveAuthSession(authResponse) {
  localStorage.setItem('tiki_access_token', authResponse.access_token);
  localStorage.setItem('tiki_user', JSON.stringify(authResponse.user));
  window.dispatchEvent(new Event('tiki-auth-changed'));
}

export function clearAuthSession() {
  localStorage.removeItem('tiki_access_token');
  localStorage.removeItem('tiki_user');
  window.dispatchEvent(new Event('tiki-auth-changed'));
}

export function isUnauthorizedError(error) {
  return error instanceof ApiError && error.status === 401;
}

export async function createProject({
  name,
  description,
  category = '일반',
  color,
  visibility,
  meetingTemplate,
  meeting_template,
  members,
}) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      category,
      ...(color ? { color } : {}),
      ...(visibility ? { visibility } : {}),
      ...(meetingTemplate || meeting_template ? { meeting_template: meetingTemplate || meeting_template } : {}),
      ...(Array.isArray(members) ? { members } : {}),
    }),
  });
}

export async function listProjects() {
  return request('/projects');
}

export async function getProject(projectId) {
  return request(`/projects/${projectId}`);
}

export async function updateProject(projectId, payload) {
  return request(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId) {
  return request(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function inviteProjectMember(projectId, payload) {
  return request(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeProjectMember(projectId, memberId) {
  return request(`/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function listProjectTickets(projectId, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request(`/projects/${projectId}/tickets${suffix}`);
}

export async function listProjectMeetings(projectId) {
  return request(`/projects/${projectId}/meetings`);
}

export async function createProjectMeeting(projectId, payload) {
  return request(`/projects/${projectId}/meetings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProjectMeeting(projectId, meetingId, payload) {
  return request(`/projects/${projectId}/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectMeeting(projectId, meetingId) {
  return request(`/projects/${projectId}/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}

export async function uploadFiles({ projectId, projectKey, projectName, files }) {
  const formData = new FormData();
  if (projectId) formData.append('project_id', projectId);
  formData.append('project_key', projectKey || String(projectId || 'default'));
  formData.append('project_name', projectName || '프로젝트');
  files.forEach((file) => formData.append('files', file));

  return request('/uploads', {
    method: 'POST',
    body: formData,
  });
}

export async function listUploads(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request(`/uploads${suffix}`);
}

export async function getUploadedFile(fileId) {
  return request(`/uploads/${fileId}`);
}

export async function retryUploadAnalysis(fileId) {
  return request(`/uploads/${fileId}/retry`, {
    method: 'POST',
  });
}

export async function getUploadAnalysis(fileId) {
  return request(`/uploads/${fileId}/analysis`);
}

export async function listUploadTickets(fileId) {
  return request(`/uploads/${fileId}/tickets`);
}

export async function getSubscription() {
  return request('/subscription/me');
}

export async function getSubscriptionPlans() {
  return request('/subscription/plans');
}

export async function subscribePlan({ planId, billing }) {
  return request('/subscription/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId, billing }),
  });
}
