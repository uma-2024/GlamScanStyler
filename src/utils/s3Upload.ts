import { API_BASE_URL_WITH_API } from '../config/api';

type UploadImageInput = {
  uri?: string;
  base64?: string;
  userId: string;
  folder: 'profile-images' | 'verification-documents' | 'certificates' | string;
  fileName?: string | null;
  contentType?: string | null;
};

const contentTypeFromUri = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  if (lower.includes('.heif')) return 'image/heif';
  return 'image/jpeg';
};

const fileNameFromUri = (uri: string, fallback: string): string => {
  const withoutQuery = uri.split('?')[0];
  const name = withoutQuery.split('/').pop();
  return name && name.includes('.') ? name : fallback;
};

export const uploadImageToS3 = async ({
  uri,
  base64,
  userId,
  folder,
  fileName,
  contentType,
}: UploadImageInput): Promise<string> => {
  if (!uri && !base64) {
    throw new Error('Image URI or Base64 is missing');
  }
  if (!userId) {
    throw new Error('User ID is missing');
  }

  const finalContentType = contentType || contentTypeFromUri(uri || 'image.jpg');
  const finalFileName = fileName || fileNameFromUri(uri || '', `image-${Date.now()}.jpg`);
  
  let body: FormData | string;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'x-folder': folder,
    'x-user-id': userId,
    'x-file-name': finalFileName,
  };

  console.log(`[Frontend S3Upload] Preparing to upload. Folder: ${folder}, UserID: ${userId}, FileName: ${finalFileName}`);

  if (uri && !uri.startsWith('data:')) {
    const formData = new FormData();
    formData.append('image', {
      uri: uri,
      type: finalContentType,
      name: finalFileName,
    } as any);
    body = formData;
    console.log(`[Frontend S3Upload] Using FormData. ContentType: ${finalContentType}, URI: ${uri}`);
  } else if (base64) {
    body = JSON.stringify({
      image: base64,
      fileName: finalFileName,
      contentType: finalContentType,
    });
    headers['Content-Type'] = 'application/json';
    console.log(`[Frontend S3Upload] Using JSON Body (Base64). Body size: ${body.length} characters. ContentType: ${finalContentType}`);
  } else {
    throw new Error('No image data provided');
  }

  const uploadUrl = `${API_BASE_URL_WITH_API}/uploads/image`;

  console.log('📤 Uploading image file to S3 endpoint:', uploadUrl);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.timeout = 60000;

    xhr.onload = () => {
      let result: any = null;
      try {
        result = JSON.parse(xhr.responseText || 'null');
      } catch {
        result = null;
      }

      if (xhr.status < 200 || xhr.status >= 300 || !result?.success || !result?.data?.url) {
        const responseMessage =
          result?.message ||
          result?.error ||
          xhr.responseText?.slice?.(0, 180) ||
          `HTTP ${xhr.status}`;
        reject(new Error(`Image upload failed: ${responseMessage}`));
        return;
      }
      resolve(result.data.url);
    };

    xhr.onerror = () => {
      reject(new Error(`File upload failed before server response: ${uploadUrl}`));
    };
    xhr.ontimeout = () => reject(new Error('Image upload timed out'));
    xhr.send(body);
  });
};
