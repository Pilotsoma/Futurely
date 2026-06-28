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

  const loginUrl = district.classlink.loginUrl;

  // Step 1: GET login page to extract CSRF token and detect Google SSO
  const loginPageResp = await http.get(loginUrl);
  const $ = cheerio.load(loginPageResp.data as string);

  const isGoogleSSO =
    (loginPageResp.request?.res?.responseUrl as string | undefined)?.includes('accounts.google.com') ||
    $('a[href*="accounts.google.com"]').length > 0;

  if (isGoogleSSO) {
    throw new Error(
      `CLASSLINK_GOOGLE_SSO: District "${district.id}" uses Google SSO. ` +
      `ClassLink credential login is not available. Run debug-classlink.ts for raw page dump.`
    );
  }

  const csrfToken =
    ($('input[name="_csrf"]').val() as string) ||
    ($('input[name="csrf_token"]').val() as string) ||
    ($('input[name="authenticity_token"]').val() as string) ||
    '';

  // Step 2: POST credentials
  const loginPostUrl = loginUrl.replace(/\/$/, '') + '/login';
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  if (csrfToken) formData.append('_csrf', csrfToken);

  await http.post(loginPostUrl, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Step 3: Verify login by fetching the launchpad
  const launchpadUrl = `https://launchpad.classlink.com/${district.classlink.tenant}`;
  const launchpadResp = await http.get(launchpadUrl);
  const finalUrl: string = (launchpadResp.request?.res?.responseUrl as string) || '';

  if (finalUrl.includes('/login') || finalUrl.includes('/signin')) {
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
