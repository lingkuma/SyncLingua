
import { WebDavConfig } from "../types";

const normalizeUrl = (url: string) => {
    let clean = url.trim();
    return clean.endsWith('/') ? clean : `${clean}/`;
}

const ensureDirectory = async (url: string, auth: string) => {
     // Check if it exists implicitly by trying MKCOL.
     const response = await fetch(url, {
        method: 'MKCOL',
        headers: {
            'Authorization': auth
        }
    });
    
    // 201 Created: Success
    // 405 Method Not Allowed: Often means resource already exists (Standard WebDAV)
    // 301/302: Redirects might occur
    if (!response.ok && response.status !== 405) {
        // We log warning but don't throw, as the PUT might still work if the server is weird
        // or if it's a permission issue on an existing folder.
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
    // Note: Some WebDAV servers are picky about trailing slashes for collections
    const folder1 = `${baseUrl}SyncLingua`;
    const folder2 = `${baseUrl}SyncLingua/handbackup`;
    const targetFile = `${baseUrl}SyncLingua/handbackup/synclingua_data.json`;

    // 1. Attempt to create directory structure
    // We do this sequentially to ensure parents exist
    try {
        await ensureDirectory(folder1, auth);
        await ensureDirectory(folder2, auth);
    } catch (e) {
        console.warn("Folder creation error (ignoring to attempt PUT):", e);
    }

    // 2. Upload File
    const response = await fetch(targetFile, {
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

    const response = await fetch(targetFile, {
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
