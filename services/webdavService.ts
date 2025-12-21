
import { WebDavConfig } from "../types";

const PROXY_ENDPOINT = '/api/proxy';

const normalizeUrl = (url: string) => {
    let clean = url.trim();
    return clean.endsWith('/') ? clean : `${clean}/`;
}

// Helper: Route requests through the local Vercel proxy to avoid CORS
const proxyFetch = async (targetUrl: string, init: RequestInit) => {
    // Encode the target URL as a query parameter
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    
    // We pass the configuration (Headers, Method, Body) to the proxy
    return fetch(proxyUrl, init);
}

const ensureDirectory = async (url: string, auth: string) => {
     // Check if it exists implicitly by trying MKCOL via Proxy
     const response = await proxyFetch(url, {
        method: 'MKCOL',
        headers: {
            'Authorization': auth
        }
    });
    
    // 201 Created: Success
    // 405 Method Not Allowed: Often means resource already exists (Standard WebDAV)
    if (!response.ok && response.status !== 405) {
        console.warn(`WebDAV MKCOL ${url} status: ${response.status} ${response.statusText}`);
    }
}

export const uploadToWebDav = async (config: WebDavConfig, jsonData: string) => {
    if (!config.url || !config.username || !config.password) {
        throw new Error("Missing WebDAV credentials");
    }

    const auth = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const baseUrl = normalizeUrl(config.url);
    
    // Target Structure: [Root]/SyncLingua/handbackup/synclingua_data.json
    const folder1 = `${baseUrl}SyncLingua`;
    const folder2 = `${baseUrl}SyncLingua/handbackup`;
    const targetFile = `${baseUrl}SyncLingua/handbackup/synclingua_data.json`;

    // 1. Attempt to create directory structure (Sequential)
    try {
        await ensureDirectory(folder1, auth);
        await ensureDirectory(folder2, auth);
    } catch (e) {
        console.warn("Folder creation error (ignoring to attempt PUT):", e);
    }

    // 2. Upload File via Proxy
    const response = await proxyFetch(targetFile, {
        method: 'PUT',
        headers: {
            'Authorization': auth,
            'Content-Type': 'application/json'
        },
        body: jsonData
    });

    if (!response.ok) {
        throw new Error(`Upload Failed: ${response.status} ${response.statusText}`);
    }
}

export const downloadFromWebDav = async (config: WebDavConfig): Promise<string> => {
    if (!config.url || !config.username || !config.password) {
        throw new Error("Missing WebDAV credentials");
    }

    const auth = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const baseUrl = normalizeUrl(config.url);
    const targetFile = `${baseUrl}SyncLingua/handbackup/synclingua_data.json`;

    const response = await proxyFetch(targetFile, {
        method: 'GET',
        headers: {
            'Authorization': auth,
            'Cache-Control': 'no-cache'
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Backup file 'SyncLingua/handbackup/synclingua_data.json' not found on server.");
        }
        throw new Error(`Download Failed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}
