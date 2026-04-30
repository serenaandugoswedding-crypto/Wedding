import { google } from 'googleapis';

let _auth = null;

function getAuth() {
  if (_auth) return _auth;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  console.log('[drive-client] GOOGLE_SERVICE_ACCOUNT_JSON first 80 chars:', raw ? raw.slice(0, 80) : '(undefined)');
  console.log('[drive-client] env var length:', raw ? raw.length : 0);

  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error('[drive-client] JSON.parse failed:', err.message);
    console.error('[drive-client] raw value (first 200 chars):', raw.slice(0, 200));
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${err.message}`);
  }

  console.log('[drive-client] parsed ok, type:', json.type, 'client_email:', json.client_email);

  _auth = new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return _auth;
}

export async function uploadToDrive({ buffer, filename, mimeType }) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('[drive-client] uploading', filename, 'to folder', folderId);

  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name:    filename,
      parents: [folderId],
    },
    media: { mimeType, body: stream },
    fields: 'id, webContentLink, webViewLink',
  });

  await drive.permissions.create({
    fileId:      res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  console.log('[drive-client] upload ok, file id:', res.data.id);
  return {
    drive_file_id: res.data.id,
    drive_url:     res.data.webContentLink,
  };
}
