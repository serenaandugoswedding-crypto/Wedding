import { google } from 'googleapis';

let _auth = null;

function getAuth() {
  if (_auth) return _auth;
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  _auth = new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return _auth;
}

export async function uploadToDrive({ buffer, filename, mimeType }) {
  const auth   = getAuth();
  const drive  = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

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

  // Make file readable by anyone with the link
  await drive.permissions.create({
    fileId:    res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    drive_file_id: res.data.id,
    drive_url:     res.data.webContentLink,
  };
}
