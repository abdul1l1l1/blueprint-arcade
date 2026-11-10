// Platform sidecar authentication; never use public bucket ACLs or signed URLs in data.
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: 'http://127.0.0.1:1106/token',
    type: 'external_account',
    credential_source: {
      url: 'http://127.0.0.1:1106/credential',
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});
function assetFile(entry) {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) throw new Error('App Storage is not configured.');
  return storage.bucket(bucket).file(entry.objectKey);
}
module.exports = { storage, assetFile };
