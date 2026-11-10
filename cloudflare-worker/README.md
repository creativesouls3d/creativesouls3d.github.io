# Product marketing Worker

This Worker replaces the product-marketing and ImageKit-auth Firebase callables. Firebase Authentication and Firestore remain on the Firebase Spark plan. It validates Firebase ID tokens, restricts product uploads and AI copy to the configured admins, and checks order ownership for customer ticket uploads.

## Deploy for free

1. Install Node.js 20 or newer and Wrangler: `npm install --global wrangler`.
2. Run `wrangler login` and authenticate to your Cloudflare account.
3. Create a Gemini API key in Google AI Studio. The free tier has model-specific limits and terms; see <https://ai.google.dev/gemini-api/docs/pricing>.
4. Store the Gemini key as a Worker secret: `wrangler secret put GEMINI_API_KEY --config cloudflare-worker/wrangler.toml` (paste the key at the prompt; do not commit it).
5. Store the ImageKit private key as a Worker secret: `wrangler secret put IMAGEKIT_PRIVATE_KEY --config cloudflare-worker/wrangler.toml` (paste the private key at the prompt; do not commit it).
6. Deploy: `wrangler deploy --config cloudflare-worker/wrangler.toml`.
7. Copy the `workers.dev` URL printed by Wrangler into `cloudflare-worker-config.js` in the repository root, replacing the empty string. Commit and publish the site.

The admin editor has separate actions for generating a formatted description and SEO tags; each action updates only its own field. Generated descriptions use the site's supported rich-text markup (headings, bold, lists, line spacing, and restrained text styling); the shared sanitizer filters the result before it is saved or rendered. The Worker also signs ImageKit upload requests for product images and order-ticket attachments, and exposes an authenticated `/improve-ticket-reply` endpoint for admins to rewrite ticket replies. Deploy the Worker after changing its source so the new reply improvement endpoint is available. The project config uses `gemini-3.5-flash-lite`; change `GEMINI_MODEL` in `wrangler.toml` if that model is unavailable for your Gemini API project. The Worker accepts requests from the configured GitHub Pages site and local development origins on port 5500.

## Order tracking on Firebase Spark

Public parcel tracking uses this Worker instead of the Firebase `getTrackingOrder` Cloud Function, which requires the Firebase Blaze plan. Create a Google Cloud service account for the Firebase project, grant it the **Cloud Datastore Viewer** role, and create a private key. Keep the key private. From the repository root, configure the Worker secrets:

```powershell
wrangler secret put FIREBASE_SERVICE_ACCOUNT_EMAIL --config cloudflare-worker/wrangler.toml
wrangler secret put FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY --config cloudflare-worker/wrangler.toml
```

Enter the service account email for the first secret and the full PEM private key for the second. Then deploy the Worker with `wrangler deploy --config cloudflare-worker/wrangler.toml`. The tracking page sends the order ID and checkout phone number; the Worker verifies both and returns order progress without exposing the customer's address, email, or full phone number. No Firebase Cloud Function deployment is needed for parcel tracking.
