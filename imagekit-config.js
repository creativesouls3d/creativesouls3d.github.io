const IMAGEKIT_PUBLIC_KEY = "public_QWPInA+QOboSQx0bQtEdRLP9w1M=";
const IMAGEKIT_PRIVATE_KEY = "private_Bq0y/Hs1sGel5+XgbDIyrVoHBUM=";
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const IMAGEKIT_FOLDER = "/order-tickets";
const IMAGEKIT_MAX_FILE_BYTES = 25 * 1024 * 1024;

function imageKitAuthParams() {
  const token = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `ik_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const expire = Math.floor(Date.now() / 1000) + 2400;
  const signature = CryptoJS.HmacSHA1(token + String(expire), IMAGEKIT_PRIVATE_KEY).toString(CryptoJS.enc.Hex);
  return { token, expire, signature };
}

async function uploadFileToImageKit(file, folder = IMAGEKIT_FOLDER) {
  if (!file) throw new Error("No file selected.");
  if (file.size > IMAGEKIT_MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 25 MB. Please upload a smaller photo or video.`);
  }

  const { token, expire, signature } = imageKitAuthParams();
  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name || `ticket-${Date.now()}`);
  form.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  form.append("signature", signature);
  form.append("expire", String(expire));
  form.append("token", token);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_URL, { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "ImageKit upload failed.");
  }

  return {
    url: payload.url || "",
    thumbnailUrl: payload.thumbnailUrl || payload.url || "",
    fileId: payload.fileId || "",
    name: payload.name || file.name,
    fileType: payload.fileType || file.type || "",
    size: Number(payload.size || file.size || 0)
  };
}
