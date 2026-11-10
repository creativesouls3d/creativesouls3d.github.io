# Product link previews

The Share Product button and catalog product links use a Firebase HTTPS function to return product-specific Open Graph and Twitter metadata. The function then redirects visitors to the normal GitHub Pages product page.

## Deploy

From the repository root, with the Firebase CLI installed and signed in to an account that can deploy to `creative-souls-3d`:

```sh
cd functions
npm install
cd ..
firebase deploy --only functions:productPreview
```

Cloud Functions deployment requires the Firebase project to use the Blaze plan. The function reads public product fields with the Firebase Admin SDK and does not expose order or customer data.

After deployment, shared and catalog links use:

```text
https://us-central1-creative-souls-3d.cloudfunctions.net/productPreview?id=PRODUCT_ID
```

Preview platforms may cache link metadata. Use the platform's link debugger or cache refresh after the first deployment. Links copied directly from the address bar still point to GitHub Pages and will not contain dynamic preview metadata; use the product page's Share Product button or copy the preview URL above.
