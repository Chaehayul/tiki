const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1';

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
      typeof data?.detail === 'string'
        ? data.detail
        : '요청을 처리하지 못했습니다.';
    throw new Error(message);
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
