import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import { DistrictConfig } from './districtConfig';

export interface ClasslinkSession {
  http: ReturnType<typeof wrapper>;
  cookieJar: CookieJar;
  districtId: string;
  userId: number;
  loggedInAt: Date;
}

const sessions = new Map<number, ClasslinkSession>();

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function loginClasslink(
  userId: number,
  username: string,
  password: string,
  district: DistrictConfig
): Promise<ClasslinkSession> {
  const jar = new CookieJar();
  const http = wrapper(axios.create({
    jar,
    withCredentials: true,
    headers: BROWSER_HEADERS,
    maxRedirects: 10,
    timeout: 20000,
  }));

  // Step 1: GET the launchpad page — this sets cookies and may redirect to the
  // district's IdP (ClassLink, Google, ADFS, etc.)
  const launchpadUrl = `https://launchpad.classlink.com/${district.classlink.tenant}`;
  const loginPageResp = await http.get(launchpadUrl);
  const finalLandingUrl: string = (loginPageResp.request?.res?.responseUrl as string) || launchpadUrl;
  const $ = cheerio.load(loginPageResp.data as string);

  // Detect Google SSO redirect
  const isGoogleSSO =
    finalLandingUrl.includes('accounts.google.com') ||
    $('a[href*="accounts.google.com"]').length > 0 ||
    $('form[action*="accounts.google.com"]').length > 0;

  if (isGoogleSSO) {
    throw new Error(
      `CLASSLINK_GOOGLE_SSO: District "${district.id}" uses Google SSO. ` +
      `ClassLink credential login is not available.`
    );
  }

  // Extract CSRF token from the login form
  const csrfToken =
    ($('input[name="_csrf"]').val() as string) ||
    ($('input[name="csrf_token"]').val() as string) ||
    ($('input[name="authenticity_token"]').val() as string) ||
    '';

  // Determine the form action — ClassLink IdP uses /idp/login or the form's own action
  const formAction = ($('form').attr('action') as string | undefined) || '';
  const loginPostUrl = formAction.startsWith('http')
    ? formAction
    : formAction
      ? new URL(formAction, finalLandingUrl).toString()
      : `https://launchpad.classlink.com/idp/login`;

  // Step 2: POST credentials
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  if (csrfToken) formData.append('_csrf', csrfToken);

  await http.post(loginPostUrl, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': finalLandingUrl,
    },
  });

  // Step 3: Verify login — launchpad should load without redirecting back to /login
  const verifyResp = await http.get(launchpadUrl);
  const verifyUrl: string = (verifyResp.request?.res?.responseUrl as string) || '';

  if (verifyUrl.includes('/login') || verifyUrl.includes('/signin') || verifyUrl.includes('idp/login')) {
    throw new Error('CLASSLINK_INVALID_CREDENTIALS: Login failed. Check username and password.');
  }

  const session: ClasslinkSession = {
    http,
    cookieJar: jar,
    districtId: district.id,
    userId,
    loggedInAt: new Date(),
  };

  sessions.set(userId, session);
  return session;
}

export function getClasslinkSession(userId: number): ClasslinkSession | undefined {
  return sessions.get(userId);
}

export function clearClasslinkSession(userId: number): void {
  sessions.delete(userId);
}

export async function getOrRefreshSession(
  userId: number,
  username: string,
  password: string,
  district: DistrictConfig
): Promise<ClasslinkSession> {
  const existing = sessions.get(userId);
  if (existing) {
    const ageMs = Date.now() - existing.loggedInAt.getTime();
    if (ageMs < 45 * 60 * 1000) return existing;
  }
  return loginClasslink(userId, username, password, district);
}
