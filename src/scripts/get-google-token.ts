import { google } from 'googleapis';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify', // For archiving and labeling emails
  'https://www.googleapis.com/auth/gmail.compose', // For creating drafts
  'https://www.googleapis.com/auth/gmail.labels', // For creating labels
];

async function getRefreshToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is required. Please add it to your .env file.');
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is required. Please add it to your .env file.');
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // This is important to get a refresh token
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to ensure refresh token
  });

  console.log('\n🔐 Google OAuth Setup\n');
  console.log('1. Open this URL in your browser:');
  console.log(`\n${authUrl}\n`);
  console.log('2. Authorize the application');
  console.log('3. You will be redirected - the script will handle it\n');
  console.log('Waiting for authorization...\n');

  // Start server to catch callback
  return new Promise<string>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (req.url?.startsWith('/oauth2callback')) {
        const url = new URL(req.url, `http://localhost:3000`);
        const code = url.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>✅ Authorization successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          server.close();

          try {
            const { tokens } = await oauth2Client.getToken(code);
            
            console.log('\n✅ Tokens received!\n');
            console.log('Add these to your .env file:\n');
            console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token || ''}`);
            console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || ''}\n`);

            if (!tokens.refresh_token) {
              console.log('⚠️  WARNING: No refresh token received!');
              console.log('You may need to revoke access at https://myaccount.google.com/permissions');
              console.log('and try again.\n');
            } else {
              console.log('✅ Refresh token received! Copy it to your .env file.\n');
            }

            resolve(tokens.refresh_token || '');
          } catch (error) {
            console.error('Error exchanging code for tokens:', error);
            reject(error);
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Error: No code received</h1></body></html>');
          server.close();
          reject(new Error('No authorization code received'));
        }
      }
    });

    server.listen(3000, () => {
      console.log('Server listening on http://localhost:3000\n');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout: No authorization received within 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

getRefreshToken()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });

