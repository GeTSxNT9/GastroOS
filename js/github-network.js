/* GastroOS — utilidades de red seguras para GitHub Contents API. */
(function (root) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 20000;
  const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

  function buildContentsUrl(settings) {
    const owner = String(settings?.owner ?? '').trim();
    const repo = String(settings?.repo ?? '').trim();
    const rawPath = String(settings?.path ?? '').trim().replace(/^\/+/, '');
    if (!OWNER_RE.test(owner)) throw new Error('El propietario de GitHub no tiene un formato válido.');
    if (!REPO_RE.test(repo) || repo === '.' || repo === '..') throw new Error('El nombre del repositorio de GitHub no tiene un formato válido.');
    if (!rawPath || rawPath.length > 1024 || /[\u0000-\u001f\u007f]/.test(rawPath)) throw new Error('La ruta del archivo de GitHub no tiene un formato válido.');
    const segments = rawPath.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
      throw new Error('La ruta del archivo no puede contener segmentos vacíos, "." o "..".');
    }
    const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/');
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = Math.max(1000, Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
    const externalSignal = options.signal;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    let removeExternalAbort = () => {};
    if (externalSignal) {
      const abort = () => controller.abort(externalSignal.reason);
      if (externalSignal.aborted) abort();
      else {
        externalSignal.addEventListener('abort', abort, { once: true });
        removeExternalAbort = () => externalSignal.removeEventListener('abort', abort);
      }
    }
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error(`La petición a GitHub superó el límite de ${Math.round(timeout / 1000)} segundos.`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      removeExternalAbort();
    }
  }

  const api = Object.freeze({ buildContentsUrl, fetchWithTimeout, DEFAULT_TIMEOUT_MS });
  root.GastroOSGitHubNetwork = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
