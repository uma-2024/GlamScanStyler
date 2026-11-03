import { API_BASE_URL } from '../config/api';

const S3_SERVICE_HOST = 'https://glammefy.s3.ap-southeast-2.amazonaws.com';
const CLOUDFRONT_SERVICE_HOST = 'https://d38dbhulv5w1mt.cloudfront.net';

const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);
const isDataOrFileUrl = (url: string): boolean =>
  /^(data:image\/|file:\/\/|content:\/\/|asset:\/\/)/i.test(url);

export const toCloudFrontUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url
    .trim()
    .replace(/^[\\"'%]+|[\\"'%]+$/g, '')
    .replace(/^(%22|%27)+|(%22|%27)+$/gi, '');
  if (!trimmedUrl || trimmedUrl === 'null' || trimmedUrl === 'undefined') {
    return '';
  }

  if (isDataOrFileUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith(S3_SERVICE_HOST)) {
    return encodeURI(trimmedUrl.replace(S3_SERVICE_HOST, CLOUDFRONT_SERVICE_HOST));
  }

  if (isAbsoluteUrl(trimmedUrl)) {
    return encodeURI(trimmedUrl);
  }

  if (trimmedUrl.startsWith('/')) {
    return encodeURI(`${API_BASE_URL}${trimmedUrl}`);
  }

  if (/^(uploads|upload|images|services|profile|certificates)\//i.test(trimmedUrl)) {
    return encodeURI(`${API_BASE_URL}/${trimmedUrl}`);
  }

  return trimmedUrl;
};
