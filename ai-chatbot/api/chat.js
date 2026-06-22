const { createHmac, createHash } = require('crypto');

function sha256(data) {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;

    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-west-2';

    if (!accessKey || !secretKey) {
      return res.status(500).json({ error: 'AWS credentials not configured' });
    }

    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;

    const requestBody = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: 'তুমি একটি helpful AI assistant। বাংলা এবং English দুটো ভাষায় কথা বলতে পারো। user যে ভাষায় কথা বলবে, তুমিও সেই ভাষায় reply দেবে।',
      messages: messages
    });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    const url = new URL(endpoint);
    const host = url.hostname;
    const path = url.pathname;

    const payloadHash = sha256(requestBody);
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/bedrock/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;

    const signingKey = getSignatureKey(secretKey, dateStamp, region, 'bedrock');
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-date': amzDate,
        'Authorization': authHeader
      },
      body: requestBody
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'AWS Error' });
    }

    return res.status(200).json({ reply: data.content[0].text });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
