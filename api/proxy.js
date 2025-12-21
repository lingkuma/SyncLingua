
export default async function handler(req, res) {
  const { url } = req.query;

  // 1. Set CORS Headers to allow the browser to talk to this proxy
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT,MKCOL');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const targetUrl = decodeURIComponent(url);
    
    // 2. Prepare Headers for the Target
    const headers = {};
    // Forward Authorization and Content-Type
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    // 3. Prepare Body
    let body;
    if (['PUT', 'POST', 'PATCH'].includes(req.method)) {
       // If Vercel parsed the JSON body, we stringify it back to send to WebDAV
       if (req.body && typeof req.body === 'object') {
           body = JSON.stringify(req.body);
       } else {
           body = req.body;
       }
    }

    // 4. Perform Request
    const response = await fetch(targetUrl, {
        method: req.method,
        headers: headers,
        body: body
    });

    // 5. Send Response back to Client
    const data = await response.text();
    res.status(response.status).send(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy Request Failed', details: error.message });
  }
}
