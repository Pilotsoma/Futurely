/**
 * HAC (Home Access Center) scraping client.
 * Debug-friendly version for NextStep local beta.
 */

import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { saveSession, getSessionByToken, StoredSession } from './sessionStore'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function dumpDebugHtml(filename: string, html: string): void {
  try {
    const debugPath = path.resolve('C:/Users/srika/Futurely-main/backend', `debug_${filename}.html`)
    fs.writeFileSync(debugPath, html, 'utf8')
    console.log(`[DEBUG] Wrote ${debugPath}`)
  } catch { /* ignore */ }
}

export interface HACClass {
  name: string
  period: string
  teacher: string
  room: string
  average: string | null
  scores: HACScore[]
}

export interface HACScore {
  name: string
  category: string
  score: number | null
  totalPoints: number | null
  percentage: string
  dateDue: string
}

export interface HACStudentInfo {
  name: string
  grade: string
  school: string
  district: string
  counselor: string
  cohortYear: string
}

export interface HACTranscriptEntry {
  year: string
  semester: string
  courses: Array<{ name: string; grade: string; credits: string }>
}

export interface HACTranscript {
  semesters: HACTranscriptEntry[]
  cumulativeGPA: string | null
  classRank: string | null
}

// ── Error helper ──────────────────────────────────────────────────────────────

function getAxiosErrorDetails(err: unknown): {
  message: string
  code?: string
  status?: number
  responseData?: unknown
  url?: string
  method?: string
} {
  const anyErr = err as {
    message?: string
    code?: string
    response?: {
      status?: number
      data?: unknown
    }
    config?: {
      url?: string
      method?: string
    }
  }

  return {
    message: anyErr?.message ?? 'Unknown error',
    code: anyErr?.code,
    status: anyErr?.response?.status,
    responseData: anyErr?.response?.data,
    url: anyErr?.config?.url,
    method: anyErr?.config?.method,
  }
}

function throwDetailedAxiosError(label: string, err: unknown): never {
  const details = getAxiosErrorDetails(err)

  console.error(`[HAC CLIENT] ${label} failed`, {
    message: details.message,
    code: details.code,
    status: details.status,
    url: details.url,
    method: details.method,
    responsePreview:
      typeof details.responseData === 'string'
        ? details.responseData.slice(0, 1000)
        : details.responseData,
  })

  if (details.code === 'ENOTFOUND') {
    throw new Error(`Cannot reach HAC URL. DNS lookup failed for ${details.url ?? 'unknown URL'}`)
  }

  if (details.code === 'ECONNREFUSED') {
    throw new Error(`Connection refused by HAC at ${details.url ?? 'unknown URL'}`)
  }

  if (details.code === 'ETIMEDOUT' || details.code === 'ECONNABORTED') {
    throw new Error(`Connection timed out while contacting HAC at ${details.url ?? 'unknown URL'}`)
  }

  if (details.status) {
    throw new Error(
      `HAC request failed with HTTP ${details.status} at ${details.url ?? 'unknown URL'}`,
    )
  }

  throw new Error(
    `HAC request failed: ${details.message}${details.code ? ` (${details.code})` : ''}`,
  )
}

// ── Session helpers ───────────────────────────────────────────────────────────

function makeAxiosSession() {
  const jar = new CookieJar()

  const client = axios.create({
    withCredentials: true,
    jar,
    timeout: 45_000,
    maxRedirects: 10,
    validateStatus: status => status >= 200 && status < 500,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  return {
    jar,
    http: wrapper(client),
  }
}

function serializeJar(jar: CookieJar): string {
  return JSON.stringify(jar.toJSON())
}

function deserializeJar(raw: string): CookieJar {
  return CookieJar.fromJSON(JSON.parse(raw)) as CookieJar
}

function restoreSession(stored: StoredSession) {
  const jar = deserializeJar(stored.sessionData)

  const client = axios.create({
    withCredentials: true,
    jar,
    timeout: 45_000,
    maxRedirects: 10,
    validateStatus: status => status >= 200 && status < 500,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  return {
    jar,
    http: wrapper(client),
  }
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

/**
 * Extract just the protocol + hostname from any URL.
 * Used for building scraping URLs — never for the login URL itself.
 * Example: 'https://homeaccess.katyisd.org/HomeAccess/Account/LogOn?...'
 *       → 'https://homeaccess.katyisd.org/'
 */
function extractOrigin(url: string): string {
  try {
    const parsed = new URL(url.trim())
    return `${parsed.protocol}//${parsed.host}/`
  } catch {
    const match = url.trim().match(/^(https?:\/\/[^/?#]+)/)
    return match ? `${match[1]}/` : url
  }
}

function getFormAction($: cheerio.CheerioAPI, fallbackUrl: string): string {
  const action = $('form').first().attr('action')

  if (!action) return fallbackUrl

  // Resolve absolute URLs, absolute paths, and relative paths against the
  // login page URL — handles SSO-bypass URLs that include a query string.
  try {
    return new URL(action, fallbackUrl).toString()
  } catch {
    return fallbackUrl
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function loginHAC(
  baseUrl: string,
  username: string,
  password: string,
  userId: number,
  clsessionCookie?: string,
): Promise<string> {
  const link = normalizeBaseUrl(baseUrl)
  const origin = extractOrigin(baseUrl) // e.g. https://homeaccess.katyisd.org/
  const { jar, http } = makeAxiosSession()

  console.log('[HAC CLIENT] loginHAC started', {
    baseUrl,
    link,
    origin,
    userId,
    usernameExists: Boolean(username),
    passwordExists: Boolean(password),
    hasClSessionCookie: Boolean(clsessionCookie),
  })

  if (clsessionCookie) {
    await jar.setCookie(
      `clsession=${clsessionCookie}; Domain=.classlink.com; Path=/`,
      'https://classlink.com',
    )
  }

  // If the user pasted the full SSO-bypass login URL (e.g. Katy ISD's
  // .../HomeAccess/Account/LogOn?ReturnUrl=...), use it exactly as given so
  // HAC shows the direct username/password form. Otherwise build the
  // standard login URL from the base.
  const loginPageUrl = /Account\/Log[Oo]n/.test(baseUrl)
    ? baseUrl.trim()
    : `${link}HomeAccess/Account/LogOn`

  let loginPageHtml: string

  try {
    console.log('[HAC CLIENT] Fetching login page:', loginPageUrl)

    const res = await http.get(loginPageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
      },
    })

    console.log('[HAC CLIENT] Login page fetched', {
      status: res.status,
      finalUrl: res.request?.res?.responseUrl,
      htmlLength: typeof res.data === 'string' ? res.data.length : 0,
    })

    loginPageHtml = res.data as string
  } catch (err: unknown) {
    throwDetailedAxiosError('fetch login page', err)
  }

  const $ = cheerio.load(loginPageHtml)

  const verificationToken =
    $("input[name='__RequestVerificationToken']").val() as string | undefined

  console.log('[HAC CLIENT] Verification token found:', Boolean(verificationToken))

  if (!verificationToken) {
    const title = $('title').text().trim()
    const bodyPreview = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500)

    console.error('[HAC CLIENT] Login form not found', {
      title,
      bodyPreview,
    })

    console.error('[HAC CLIENT] Page HTML (first 3000 chars):', loginPageHtml.slice(0, 3000))

    throw new Error(
      `Could not find login form on HAC page. Page title: ${title || 'unknown'}. The district may use SSO/ClassLink or a different login URL.`,
    )
  }

  const formData = new URLSearchParams()

  $('form input').each((_i, input) => {
    const name = $(input).attr('name')
    const value = $(input).attr('value') ?? ''

    if (name) {
      formData.set(name, value)
    }
  })

  formData.set('__RequestVerificationToken', verificationToken)
  formData.set('VerificationOption', 'UsernamePassword')
  // Set both dot-notation (ASP.NET MVC model binding) and underscore-notation (HTML ID form)
  formData.set('LogOnDetails.UserName', username)
  formData.set('LogOnDetails.Password', password)
  formData.set('LogOnDetails_UserName', username)
  formData.set('LogOnDetails_Password', password)
  // Some HAC implementations use tempUN/tempPW as intermediate fields
  if (formData.has('tempUN')) formData.set('tempUN', username)
  if (formData.has('tempPW')) formData.set('tempPW', password)

  if (!formData.has('Database')) {
    formData.set('Database', '10')
  }

  console.log('[HAC CLIENT] Login form fields:', Array.from(formData.keys()))

  const loginPostUrl = getFormAction($, loginPageUrl)

  try {
    console.log('[HAC CLIENT] Posting HAC login form:', loginPostUrl)

    const postRes = await http.post(loginPostUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin.replace(/\/$/, ''),
        Referer: loginPageUrl,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      maxRedirects: 10,
      validateStatus: (status: number) => status >= 200 && status < 500,
    })

    const postFinalUrl: string =
      (postRes.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? loginPostUrl
    const postHtml = postRes.data as string
    const $post = cheerio.load(postHtml)
    const postTitle = $post('title').text().trim()
    const postBodyPreview = $post('body').text().replace(/\s+/g, ' ').trim().slice(0, 500)

    console.log('[HAC CLIENT] Login POST completed', {
      status: postRes.status,
      finalUrl: postFinalUrl,
      htmlLength: typeof postHtml === 'string' ? postHtml.length : 0,
      title: postTitle,
      bodyPreview: postBodyPreview,
    })

    if (postRes.status >= 500) {
      throw new Error(`HAC login POST returned HTTP ${postRes.status}. Title: ${postTitle || 'unknown'}.`)
    }

    // Explicit credential rejection messages
    if (
      postHtml.includes('Invalid user name or password') ||
      postHtml.includes('Invalid username or password') ||
      postHtml.includes('The user name or password is incorrect') ||
      postHtml.includes('Login was unsuccessful')
    ) {
      throw new Error('Invalid credentials — HAC rejected the username or password')
    }

    const isStillOnLoginPage =
      postFinalUrl.includes('Account/LogOn') || postFinalUrl.includes('Account/Login')

    if (!isStillOnLoginPage) {
      console.log('[HAC CLIENT] POST redirected to non-login page:', postFinalUrl)
    }

    // Always verify session by navigating to a protected page.
    // Use the Demographic page — the normal authenticated landing page on
    // new PowerSchool HAC. (Home.aspx no longer exists and redirects to /Error,
    // which previously caused false "invalid credentials" failures.)
    const homeUrl = `${origin}HomeAccess/Registration/Demographic`
    console.log('[HAC CLIENT] Verifying session via Demographic page:', homeUrl)

    const homeRes = await http.get(homeUrl, {
      headers: { Referer: loginPostUrl },
      validateStatus: (status: number) => status >= 200 && status < 500,
    })

    const homeBody = homeRes.data as string
    const homeFinalUrl: string =
      (homeRes.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? homeUrl

    console.log('[HAC CLIENT] Demographic verification response', {
      status: homeRes.status,
      finalUrl: homeFinalUrl,
      htmlLength: typeof homeBody === 'string' ? homeBody.length : 0,
      bodyPreview: typeof homeBody === 'string' ? homeBody.slice(0, 500) : '',
    })

    const homeRedirectedToLogin =
      homeFinalUrl.includes('Account/LogOn') || homeFinalUrl.includes('Account/Login')

    if (homeRedirectedToLogin) {
      throw new Error('Invalid credentials — HAC rejected the username or password')
    }

    // A redirect to an error page is NOT proof of bad credentials (e.g. a
    // nonexistent page redirects to /Error even when authenticated). Only a
    // redirect back to the login page means the session was rejected — log
    // and let the cookie check below make the final call.
    if (homeFinalUrl.includes('/Error')) {
      console.warn('[HAC CLIENT] Verification page redirected to /Error — continuing; auth cookie check will decide')
    }

    // Content-based check: if Home.aspx still contains a login form, credentials failed.
    // This catches the case where HAC serves the page without a URL redirect but
    // renders an unauthenticated view with an embedded login form.
    if (typeof homeBody === 'string') {
      const $home = cheerio.load(homeBody)
      const hasLoginInput = $home(
        "input[name='LogOnDetails.UserName'], input[name='LogOnDetails_UserName'], input[name='tempUN']"
      ).length > 0

      if (hasLoginInput) {
        throw new Error('Invalid credentials — login form still present after authentication attempt')
      }
    }

    // Do NOT throw for the Demographic page — it is the normal authenticated
    // landing page for Katy ISD HAC after login.
    console.log('[HAC CLIENT] Login verified — landed on:', homeFinalUrl, '(Demographic page is normal)')
  } catch (err: unknown) {
    // Re-throw credential errors before the outer handler swallows them
    if (err instanceof Error && err.message.includes('Invalid credentials')) {
      throw err
    }
    if (err instanceof Error && err.message.includes('HAC login POST returned HTTP')) {
      throw err
    }
    throwDetailedAxiosError('submit login form', err)
  }

  const hacDomain = origin.replace(/\/$/, '')
  const allCookies = jar.getCookiesSync(hacDomain)
  console.log('[HAC CLIENT] Saving session — baseUrl (clean origin):', origin)
  console.log('[HAC CLIENT] Saving session — cookie lookup domain (no slash):', hacDomain)
  console.log('[HAC CLIENT] Saving session with cookies:', allCookies.map(c => ({ key: c.key, domain: c.domain })))

  // Final authentication check: standard HAC sets .ASPXAUTH; some districts set ASP.NET_SessionId.
  // If neither is present the login was rejected.
  const hasAspxAuth = allCookies.some(c => c.key === '.ASPXAUTH')
  const hasSessionCookie = allCookies.some(
    c =>
      c.key.toLowerCase().includes('aspxauth') ||
      c.key === 'ASP.NET_SessionId' ||
      c.key.toLowerCase().includes('session'),
  )

  if (!hasAspxAuth && !hasSessionCookie) {
    throw new Error('Invalid credentials — HAC did not set an authentication cookie')
  }
  if (!hasAspxAuth && hasSessionCookie) {
    console.warn('[HAC CLIENT] No .ASPXAUTH but session cookie found — proceeding')
    // home.aspx verification already confirmed authentication succeeded
  }

  // Save the CLEAN ORIGIN as the baseUrl — all scraping functions build their
  // URLs from this. The full SSO-bypass URL is only used for the login itself.
  const sessionToken = saveSession(userId, 'HAC', origin, serializeJar(jar))

  console.log('[HAC CLIENT] HAC session saved', {
    userId,
    hasSessionToken: Boolean(sessionToken),
  })

  return sessionToken
}

// ── Iframe helper ─────────────────────────────────────────────────────────────

/**
 * Many HAC pages (Transcript, Report Card, Attendance) load their actual data
 * inside a legacy iframe.  Fetch the outer page, detect the iframe src, then
 * return the iframe's content HTML so the scraper sees real data tables.
 */
async function fetchWithIframeFallback(
  http: ReturnType<typeof wrapper>,
  outerUrl: string,
  referer: string,
  debugLabel: string,
): Promise<string> {
  const outerRes = await http.get(outerUrl, {
    headers: { Referer: referer, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  const outerHtml = outerRes.data as string
  const $outer = cheerio.load(outerHtml)

  const iframeSrc = $outer('#sg-legacy-iframe, .sg-legacy-iframe, iframe[id*="legacy"]').attr('src')
  if (!iframeSrc) {
    dumpDebugHtml(debugLabel, outerHtml)
    return outerHtml
  }

  let iframeUrl: string
  try {
    iframeUrl = iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, outerUrl).toString()
  } catch {
    iframeUrl = iframeSrc
  }

  console.log(`[HAC CLIENT] ${debugLabel}: following iframe to`, iframeUrl)
  await sleep(400 + Math.random() * 200)
  const iframeRes = await http.get(iframeUrl, {
    headers: { Referer: outerUrl, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  const iframeHtml = iframeRes.data as string
  dumpDebugHtml(debugLabel, iframeHtml)
  return iframeHtml
}

// ── Scraping helpers ───────────────────────────────────────────────────────────

/**
 * Extract period from HAC class header.
 * Tries multiple selector strategies for district compatibility.
 */
function extractPeriod($el: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): string {
  // Strategy 1: direct child class (standard Skyward)
  const direct = $el.find('.sg-header-period').text().replace(/Period/i, '').trim()
  if (direct) return direct

  // Strategy 2: header text contains "Period X"
  const headerText = $el.find('.sg-header-heading').text()
  const periodMatch = headerText.match(/Period\s*(\d+)/i)
  if (periodMatch?.[1]) return periodMatch[1]

  // Strategy 3: look for a parenthetical like "(1)" or "Pd 1"
  const pdMatch = headerText.match(/Pd\.?\s*(\d+)|\((\d+)\)/)
  if (pdMatch) return pdMatch[1] ?? pdMatch[2] ?? ''

  return ''
}

/**
 * Extract class average from HAC class header.
 * Tries multiple selector strategies.
 */
function extractAverage($el: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): string | null {
  // Strategy 1: direct .sg-header-average class
  const direct = $el.find('.sg-header-average').text()
    .replace(/Student\s*Avg[:.]?\s*/i, '').trim()
  if (direct && direct !== '' && direct !== '--') return direct

  // Strategy 2: look for a percentage-like value in the header
  const headerText = $el.find('.sg-header-heading').text()
  const avgMatch = headerText.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%?$/)
  if (avgMatch?.[1]) {
    const num = parseFloat(avgMatch[1])
    if (!isNaN(num) && num >= 0 && num <= 100) return avgMatch[1]
  }

  // Strategy 3: look for "Avg:" text anywhere in the header
  const avgLabelMatch = headerText.match(/Avg[^:]*:\s*([\d.]+)/i)
  if (avgLabelMatch?.[1]) return avgLabelMatch[1]

  return null
}

// ── Data fetchers ──────────────────────────────────────────────────────────────

export async function getGrades(sessionToken: string): Promise<HACClass[]> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl // already cleaned to https://hostname/

  // The correct URL for grades and classwork in PowerSchool HAC
  const classworkUrl = `${origin}HomeAccess/Classes/Classwork`

  console.log('[HAC CLIENT] Fetching classwork from:', classworkUrl)

  await sleep(800 + Math.random() * 400) // 0.8–1.2s delay
  const res = await http.get(classworkUrl, {
    headers: {
      Referer: `${origin}HomeAccess/Home.aspx`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  const finalUrl = (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? ''
  const pageTitle = ('' + res.data).match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ''

  console.log('[HAC CLIENT] Classwork page:', { finalUrl, pageTitle, htmlLength: (res.data as string).length })

  // If redirected to login, session expired
  if (finalUrl.includes('Account/LogOn') || finalUrl.includes('Account/Login')) {
    throw new Error('School session expired — please log in again')
  }

  let pageHtml = res.data as string
  const $ = cheerio.load(pageHtml)

  // Katy ISD HAC (and similar PowerSchool districts) load the actual
  // classwork content inside an iframe.  If the outer page has no assignment
  // data but does reference an iframe src, fetch that URL to get the real data.
  const iframeSrc = $('iframe.sg-legacy-iframe, iframe[id*="legacy"], iframe[src*="Assignment"]')
    .attr('src')

  if (iframeSrc && ($('.AssignmentClass').length === 0 && $('table').length === 0)) {
    const iframeUrl = iframeSrc.startsWith('http')
      ? iframeSrc
      : new URL(iframeSrc, classworkUrl).toString()

    console.log('[HAC CLIENT] Outer page has no grade tables — fetching iframe content:', iframeUrl)

    try {
      await sleep(400 + Math.random() * 300)
      const iframeRes = await http.get(iframeUrl, {
        headers: {
          Referer: classworkUrl,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (typeof iframeRes.data === 'string' && iframeRes.data.length > 500) {
        pageHtml = iframeRes.data
        console.log('[HAC CLIENT] Iframe content fetched:', { htmlLength: pageHtml.length })
      } else {
        console.warn('[HAC CLIENT] Iframe content too short or empty — using outer page')
      }
    } catch (iframeErr) {
      console.warn('[HAC CLIENT] Failed to fetch iframe content:',
        iframeErr instanceof Error ? iframeErr.message : String(iframeErr))
    }
  }

  const $final = cheerio.load(pageHtml)

  dumpDebugHtml('classwork', pageHtml)

  // Log page structure to understand the HTML
  console.log('[HAC CLIENT] Classwork page structure check:', {
    hasAssignmentClass: $final('.AssignmentClass').length,
    hasSgHeader: $final('.sg-header').length,
    hasClassBlock: $final('[class*="classBlock"]').length,
    hasAssignmentGrid: $final('[id*="AssignmentGrid"]').length,
    hasRptAssig: $final('[id*="rptAssig"]').length,
    hasClassGrade: $final('[class*="ClassGrade"]').length,
    tableCount: $final('table').length,
    divCount: $final('div[class]').length,
  })

  const classes: HACClass[] = []

  // Strategy 1: Standard PowerSchool HAC selectors (.AssignmentClass blocks)
  if ($final('.AssignmentClass').length > 0) {
    console.log('[HAC CLIENT] Using Strategy 1: .AssignmentClass')
    $final('.AssignmentClass').each((_i, el) => {
      classes.push(parseClassBlock($, $(el)))
    })
  }

  // Strategy 2: Repeater pattern used by newer HAC instances
  else if ($final('[id*="rptAssigClasses"]').length > 0 || $final('[id*="plnMain_rptAssig"]').length > 0) {
    console.log('[HAC CLIENT] Using Strategy 2: rptAssigClasses pattern')
    $final('[id*="rptAssigClasses"] > div, [id*="plnMain_rptAssig"] > div').each((_i, el) => {
      classes.push(parseClassBlock($, $(el)))
    })
  }

  // Strategy 3: Look for class heading + table pairs anywhere on the page
  else {
    console.log('[HAC CLIENT] Using Strategy 3: generic heading + table scan')
    // Find all elements that look like course headers
    $final('a[id*="lnkCourse"], span[id*="lblHeading"], h3[class*="course"], .sg-header-heading').each((_i, heading) => {
      const $heading = $final(heading)
      const name = $heading.text().replace(/\s*[-–]\s*Period\s*\d+.*$/i, '').trim()
      if (!name) return

      // Find the next table after this heading
      const $table = $heading.closest('div, td').find('table').first()
      if ($table.length === 0) return

      const average = $heading.closest('div, td').find('[id*="lblAverage"], .sg-header-average').text()
        .replace(/Student\s*Avg[:.]\s*/i, '').trim() || null

      const scores: HACScore[] = []
      $table.find('tr').each((_j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const aName = cells.eq(0).text().trim()
        if (!aName || aName.toLowerCase() === 'assignment') return
        scores.push({
          name: aName,
          category: cells.eq(1).text().trim() || 'Uncategorized',
          score: parseFloat(cells.eq(2).text()) || null,
          totalPoints: parseFloat(cells.eq(3).text()) || null,
          percentage: cells.eq(4).text().trim() || '',
          dateDue: cells.eq(5).text().trim() || '',
        })
      })

      classes.push({ name, period: '', teacher: '', room: '', average, scores })
    })
  }

  console.log('[HAC CLIENT] Parsed', classes.length, 'classes from classwork page')
  return classes
}

// Helper: parse a single class block element into a HACClass
function parseClassBlock(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<AnyNode>
): HACClass {
  // Course name — prefer heading NOT marked .sg-right (which is the average side)
  const rawName = $el.find('.sg-header .sg-header-heading:not(.sg-right), .sg-header-heading:not(.sg-right), [id*="lblHeading"], h3, .course-title, a[id*="lnkCourse"]').first().text().trim()
  const name = rawName
    .replace(/\s*[-–]\s*Period\s*\d+.*$/i, '')
    .replace(/\s*[-–]\s*Pd\.?\s*\d+.*$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim() || rawName

  // Period
  const periodText = $el.find('.sg-header-period, [id*="lblPeriod"]').text().replace(/Period/i, '').trim()

  // Average — gradexis: the right-aligned heading holds the average as last word
  const sgRightText = $el.find('.sg-header .sg-header-heading.sg-right').text().trim()
  const sgRightVal  = sgRightText ? sgRightText.split(' ').pop()?.replace('%', '').trim() : undefined
  const avgFromRight = (sgRightVal && sgRightVal !== '--' && sgRightVal !== 'N/A' && !isNaN(parseFloat(sgRightVal)))
    ? sgRightVal : undefined
  const avgRaw = avgFromRight
    ?? $el.find('.sg-header-average, [id*="lblAverage"], [id*="lblHdrAverage"]').text()
        .replace(/Student\s*Avg[:.]\s*/i, '')
        .replace(/Classwork\s*Average\s*/i, '')
        .trim()
  const average = avgRaw && avgRaw !== '--' && avgRaw !== 'N/A' ? avgRaw : null

  // Teacher
  const teacher = $el.find('.sg-header-teacher, [id*="lblTeacher"]').text().trim()

  // Determine column positions dynamically from header row
  const colHeaders: string[] = []
  $el.find('tr.sg-asp-table-header-row th, thead th, tr:first-child th').each((_i, th) => {
    colHeaders.push($(th).text().trim().toLowerCase())
  })

  const colIdx = (keywords: string[]): number => {
    for (const kw of keywords) {
      const idx = colHeaders.findIndex(h => h.includes(kw))
      if (idx !== -1) return idx
    }
    return -1
  }

  const nameIdx  = colIdx(['assignment', 'name', 'description'])
  const dateIdx  = colIdx(['due', 'date'])
  const catIdx   = colIdx(['category', 'type'])
  const scoreIdx = colIdx(['score', 'earned', 'points earned'])
  const totalIdx = colIdx(['total', 'out of', 'possible', 'max'])
  const pctIdx   = colIdx(['%', 'percent'])

  const scores: HACScore[] = []

  $el.find('.sg-content-grid > .sg-asp-table > tbody > .sg-asp-table-data-row, tr.sg-asp-table-data-row, tbody tr').each((_j, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) return

    // Gradexis column order: 0=dateDue, 1=dateAssigned, 2=name, 3=category, 4=score, 5=totalPoints, 9=percentage
    const aName    = nameIdx  >= 0 ? cells.eq(nameIdx).text().trim()  : cells.eq(2).children().first().text().trim() || cells.eq(2).text().trim()
    const dateDue  = dateIdx  >= 0 ? cells.eq(dateIdx).text().trim()  : cells.eq(0).text().trim()
    const category = catIdx   >= 0 ? cells.eq(catIdx).text().trim()   : cells.eq(3).text().trim()
    const scoreRaw = scoreIdx >= 0 ? cells.eq(scoreIdx).text().trim() : cells.eq(4).text().trim()
    const totalRaw = totalIdx >= 0 ? cells.eq(totalIdx).text().trim() : cells.eq(5).text().trim()
    const pctRaw   = pctIdx   >= 0 ? cells.eq(pctIdx).text().trim()  : cells.eq(9).text().trim() || cells.eq(6).text().trim()

    if (!aName || aName.toLowerCase().includes('no assignment')) return

    scores.push({
      name: aName,
      category: category || 'Uncategorized',
      score: scoreRaw && scoreRaw !== '--' ? parseFloat(scoreRaw) || null : null,
      totalPoints: totalRaw && totalRaw !== '--' ? parseFloat(totalRaw) || null : null,
      percentage: pctRaw,
      dateDue,
    })
  })

  return { name, period: periodText, teacher, room: '', average, scores }
}

export async function getTranscript(sessionToken: string): Promise<HACTranscript> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  await sleep(800 + Math.random() * 400)
  const outerUrl = `${origin}HomeAccess/Grades/Transcript`
  const transcriptHtml = await fetchWithIframeFallback(http, outerUrl, `${origin}HomeAccess/Home.aspx`, 'transcript')
  const $ = cheerio.load(transcriptHtml)

  const semesters: HACTranscriptEntry[] = []

  // Strategy 1: gradexis — container is a <td> element with class sg-transcript-group
  $('td.sg-transcript-group').each((_i, group) => {
    const $group = $(group)
    let year = ''
    let semester = ''

    $group.find('span').each((_j, span) => {
      const id = $(span).attr('id') ?? ''
      if (id.includes('YearValue')) year = $(span).text().trim()
      if (id.includes('GroupValue')) semester = $(span).text().trim()
    })

    if (!year || !semester) {
      const header = $group.find('.sg-transcript-group-heading, [id*="lblHeading"], th').first().text().trim()
      const yearMatch = header.match(/(\d{4})/g)
      const semMatch  = header.match(/Semester\s*(\d)/i) || header.match(/(1st|2nd|First|Second)/i)
      if (!year && yearMatch) year = yearMatch[yearMatch.length - 1]
      if (!semester && semMatch) semester = semMatch[1] ?? String(_i + 1)
    }

    const courses: Array<{ name: string; grade: string; credits: string }> = []

    $group.find('table:nth-child(2) > tbody > tr.sg-asp-table-data-row, tr.sg-asp-table-data-row').each((_j, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return
      const courseName = cells.eq(0).text().trim()
      if (!courseName || /^(course|class|subject)/i.test(courseName)) return
      courses.push({
        name: courseName,
        grade: cells.eq(1).text().trim(),
        credits: cells.eq(2).text().trim(),
      })
    })

    if (courses.length > 0) {
      semesters.push({ year, semester: semester || String(_i + 1), courses })
    }
  })

  // Strategy 2: broader selectors fallback
  if (semesters.length === 0) {
    $('.sg-transcript-group, [id*="TranscriptGroup"], [id*="rptGroup"] > td').each((_i, group) => {
      const header = $(group).find('.sg-transcript-group-heading, [id*="lblHeading"]').text().trim()
        || $(group).find('th').first().text().trim()

      const yearMatch = header.match(/(\d{4})/g)
      const semMatch  = header.match(/Semester\s*(\d)/i) || header.match(/(1st|2nd|First|Second)/i)

      const courses: Array<{ name: string; grade: string; credits: string }> = []

      $(group).find('tr').each((_j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const courseName = cells.eq(0).text().trim()
        if (!courseName || courseName.toLowerCase().includes('course')) return
        courses.push({
          name: courseName,
          grade: cells.eq(1).text().trim(),
          credits: cells.eq(2).text().trim(),
        })
      })

      if (courses.length > 0) {
        semesters.push({
          year: yearMatch ? yearMatch[yearMatch.length - 1] : '',
          semester: semMatch ? semMatch[1] : String(_i + 1),
          courses,
        })
      }
    })
  }

  // Fallback: if no group selectors matched, scan all tables for course data
  if (semesters.length === 0) {
    console.warn('[TRANSCRIPT] No groups found with standard selectors — trying generic table scan')
    $('table').each((_tIdx, table) => {
      const rows = $(table).find('tr')
      if (rows.length < 2) return
      const courses: Array<{ name: string; grade: string; credits: string }> = []
      rows.each((_j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const name = cells.eq(0).text().trim()
        if (!name || /^(course|class|subject|total|gpa|grade)/i.test(name) || name.length < 4) return
        courses.push({
          name,
          grade: cells.eq(1).text().trim(),
          credits: cells.eq(2).text().trim() || '0.5',
        })
      })
      if (courses.length > 0) {
        semesters.push({ year: `Table ${_tIdx + 1}`, semester: String(_tIdx + 1), courses })
      }
    })
  }

  // Multi-strategy GPA extraction
  let cumulativeGPA: string | null = null

  // Strategy 1: direct element selectors (includes FriscoISDHACAPI patterns)
  const gpaSelectors = [
    '#plnMain_rpTranscriptGroup_lblCumGPA_0',
    '#plnMain_lblCumGPA',
    '[id*="rpTranscriptGroup"][id*="CumGPA"]',
    '[id*="rpTranscriptGroup"][id*="lblGPA"]',
    '[id*="GPACum"]', '[id*="CumGPA"]', '[id*="lblCumGPA"]', '[id*="CumulativeGPA"]',
    '[id*="lblGPA"]', '[id*="Gpa"]', '.sg-transcript-gpa', 'span[id$="GPA"]', '[id*="gpa"]',
  ]
  for (const sel of gpaSelectors) {
    const text = $(sel).text().trim()
    const match = text.match(/([\d]+\.[\d]+)/)
    if (match) {
      cumulativeGPA = match[1]
      console.log(`[TRANSCRIPT] GPA found via selector "${sel}": ${cumulativeGPA}`)
      break
    }
  }

  // Strategy 2: body text regex scan
  if (!cumulativeGPA) {
    const bodyText = $('body').text()
    const patterns = [
      /Cumulative\s+GPA[:\s]+([\d]+\.[\d]+)/i,
      /Cum(?:ulative)?\s+GPA[:\s]+([\d]+\.[\d]+)/i,
      /GPA[:\s]+([\d]+\.[\d]+)/i,
      /Grade\s+Point\s+Average[:\s]+([\d]+\.[\d]+)/i,
    ]
    for (const pattern of patterns) {
      const match = bodyText.match(pattern)
      if (match) {
        cumulativeGPA = match[1]
        console.log(`[TRANSCRIPT] GPA found via text scan: ${cumulativeGPA}`)
        break
      }
    }
  }

  // Strategy 3: table cell scan for GPA-adjacent float
  if (!cumulativeGPA) {
    $('td, th').each((_i, el) => {
      const text = $(el).text().trim()
      if (text.match(/^[0-4]\.\d{1,4}$/) && parseFloat(text) > 0) {
        const prev = $(el).prev().text().toLowerCase()
        const prevRow = $(el).closest('tr').prev().text().toLowerCase()
        if (prev.includes('gpa') || prevRow.includes('gpa') || prev.includes('average')) {
          cumulativeGPA = text
          console.log(`[TRANSCRIPT] GPA found via table scan: ${cumulativeGPA}`)
          return false
        }
      }
    })
  }

  if (!cumulativeGPA) {
    console.warn('[TRANSCRIPT] Could not extract GPA — table previews:')
    $('table').each((_i, table) => {
      console.warn('[TRANSCRIPT TABLE]', $(table).text().replace(/\s+/g, ' ').trim().substring(0, 200))
    })
  }

  return {
    semesters,
    cumulativeGPA,
    classRank: null,
  }
}

/**
 * Verify that a restored HAC session cookie is still accepted by the server.
 * Makes one lightweight GET to the Demographic page and returns true if not redirected to login.
 */
export async function verifySession(sessionToken: string): Promise<boolean> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) return false

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  try {
    const res = await http.get(`${origin}HomeAccess/Registration/Demographic`, {
      headers: { Referer: `${origin}HomeAccess/Home.aspx` },
      timeout: 15_000,
      validateStatus: (s: number) => s >= 200 && s < 500,
    })
    const finalUrl = (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? ''
    const expired = finalUrl.includes('Account/LogOn') || finalUrl.includes('Account/Login')
    console.log(`[HAC CLIENT] verifySession → expired=${expired}`)
    return !expired
  } catch {
    return false
  }
}

export async function getSchedule(sessionToken: string): Promise<object[]> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  await sleep(800 + Math.random() * 400)
  const outerUrl = `${origin}HomeAccess/Classes/Schedule`
  const html = await fetchWithIframeFallback(http, outerUrl, `${origin}HomeAccess/Home.aspx`, 'schedule')
  const $ = cheerio.load(html)

  const headers: string[] = []

  // Strategy 1: standard sg-asp-table headers
  $('tr.sg-asp-table-header-row th').each((_i, th) => {
    headers.push($(th).text().trim())
  })

  // Strategy 2: generic thead/th if no sg-asp headers
  if (headers.length === 0) {
    $('thead th, table:first th').each((_i, th) => {
      const t = $(th).text().trim()
      if (t) headers.push(t)
    })
  }

  const schedule: object[] = []

  // Strategy 1: gradexis fixed column positions — courseCode(0), courseName link(1), period(2), teacher(3), room(4)
  $('tr.sg-asp-table-data-row').each((_i, row) => {
    const $row = $(row)
    const children = $row.children()
    const code    = children.first().text().trim()
    const name    = children.eq(1).find('a').text().trim() || children.eq(1).text().trim()
    const period  = children.eq(2).text().trim().substring(0, 1)
    const teacher = children.eq(3).text().trim()
    const room    = children.eq(4).text().trim()

    if (name || code) {
      const entry: Record<string, string> = { courseCode: code, courseName: name, period, teacher, room }
      headers.forEach((h, j) => {
        const cell = $row.find('td').eq(j)
        if (h && !(h in entry)) entry[h] = cell.text().trim()
      })
      schedule.push(entry)
    }
  })

  // Strategy 2: generic tbody rows when sg-asp rows not found
  if (schedule.length === 0 && headers.length > 0) {
    $('tbody tr').each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return
      const entry: Record<string, string> = {}
      cells.each((j, td) => {
        if (headers[j]) entry[headers[j]] = $(td).text().trim()
      })
      if (Object.keys(entry).length > 0) schedule.push(entry)
    })
  }

  // Strategy 3: no headers found — infer from first row
  if (schedule.length === 0) {
    $('table').each((_tIdx, table) => {
      const rows = $(table).find('tr')
      if (rows.length < 2) return
      const hdrs: string[] = []
      rows.first().find('th, td').each((_j, cell) => {
        hdrs.push($(cell).text().trim() || `Col${_j + 1}`)
      })
      rows.slice(1).each((_j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const entry: Record<string, string> = {}
        cells.each((k, td) => { if (hdrs[k]) entry[hdrs[k]] = $(td).text().trim() })
        if (Object.keys(entry).length > 0) schedule.push(entry)
      })
      if (schedule.length > 0) return false
    })
  }

  console.log(`[SCHEDULE] Parsed ${schedule.length} rows`)
  if (schedule.length === 0) console.warn('[SCHEDULE] No rows found — check debug_schedule.html')
  return schedule
}

export async function getReportCard(sessionToken: string, period?: string): Promise<{
  reportingPeriods: string[]
  currentPeriod: string
  courses: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }>
}> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  await sleep(800 + Math.random() * 400)
  const outerUrl = `${origin}HomeAccess/Grades/ReportCard`

  // Report Card page loads data inside a legacy iframe
  // First fetch the outer page to detect the iframe URL, then fetch iframe content
  const outerRes = await http.get(outerUrl, {
    headers: { Referer: `${origin}HomeAccess/Home.aspx`, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  const outerHtml = outerRes.data as string
  const $outer = cheerio.load(outerHtml)
  const rcIframeSrc = $outer('#sg-legacy-iframe, .sg-legacy-iframe').attr('src')

  let iframeBaseUrl = outerUrl
  if (rcIframeSrc) {
    try {
      iframeBaseUrl = rcIframeSrc.startsWith('http') ? rcIframeSrc : new URL(rcIframeSrc, outerUrl).toString()
    } catch { iframeBaseUrl = rcIframeSrc }
    console.log('[REPORT CARD] Following iframe to:', iframeBaseUrl)
    await sleep(400 + Math.random() * 200)
  }

  const iframeRes = rcIframeSrc
    ? await http.get(iframeBaseUrl, { headers: { Referer: outerUrl } })
    : outerRes

  let html = iframeRes.data as string
  let $ = cheerio.load(html)

  // Extract reporting period dropdown options (#plnMain_ddlRCRuns)
  const reportingPeriods: string[] = []
  let currentPeriod = ''
  $('[id*="ddlRCRuns"] option, #plnMain_ddlRCRuns option').each((_i, opt) => {
    const text = $(opt).text().trim()
    if (text) {
      reportingPeriods.push(text)
      if ($(opt).attr('selected') || !currentPeriod) currentPeriod = text
    }
  })

  // If a specific period is requested, POST back to the iframe URL selecting it
  if (period && period !== currentPeriod && reportingPeriods.includes(period)) {
    let requestedValue = ''
    $('[id*="ddlRCRuns"] option, #plnMain_ddlRCRuns option').each((_i, opt) => {
      if ($(opt).text().trim() === period) { requestedValue = $(opt).attr('value') ?? ''; return false }
    })
    const dropdownName = $('[id*="ddlRCRuns"]').attr('name') ?? 'ctl00$plnMain$ddlRCRuns'
    const formData = new URLSearchParams({
      __EVENTTARGET: dropdownName,
      __EVENTARGUMENT: '',
      __VIEWSTATE: ($('[id="__VIEWSTATE"]').val() as string) ?? '',
      __EVENTVALIDATION: ($('[id="__EVENTVALIDATION"]').val() as string) ?? '',
      __VIEWSTATEGENERATOR: ($('[id="__VIEWSTATEGENERATOR"]').val() as string) ?? '',
      [dropdownName]: requestedValue,
    })
    const postRes = await http.post(iframeBaseUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: iframeBaseUrl },
    })
    html = postRes.data as string
    $ = cheerio.load(html)
    currentPeriod = period
  }

  dumpDebugHtml('reportcard', html)

  const courses: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }> = []

  const rowSelectors = [
    '.sg-asp-table-data-row',
    'table.sg-asp-table tr',
    '[id*="ReportCard"] tr',
    '[id*="dgReport"] tr',
    'table tr',
  ]

  for (const sel of rowSelectors) {
    const rows = $(sel)
    if (rows.length < 2) continue
    rows.each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 3) return
      const name = cells.eq(0).text().trim()
      if (!name || /^(course|class|subject|period|name)/i.test(name)) return
      courses.push({
        name,
        period: cells.eq(1).text().trim(),
        numericGrade: cells.eq(2).text().trim(),
        letterGrade: cells.eq(3).text().trim(),
        credits: cells.eq(4).text().trim() || '',
        teacher: cells.eq(5).text().trim() || '',
      })
    })
    if (courses.length > 0) break
  }

  console.log(`[REPORT CARD] Parsed ${courses.length} courses, ${reportingPeriods.length} periods`)
  if (courses.length === 0) console.warn('[REPORT CARD] No courses found — check debug_reportcard.html')
  return { reportingPeriods, currentPeriod, courses }
}

export async function getProgressReport(sessionToken: string, date?: string): Promise<{
  availableDates: string[]
  currentDate: string
  courses: Array<{ name: string; period: string; average: string; letterGrade: string; teacher: string }>
}> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  await sleep(800 + Math.random() * 400)
  const initialRes = await http.get(`${origin}HomeAccess/Grades/IPR`, {
    headers: { Referer: `${origin}HomeAccess/Home.aspx` },
  })

  let html = initialRes.data as string
  let $ = cheerio.load(html)

  // Extract IPR date dropdown options (#plnMain_ddlIPRDates)
  const availableDates: string[] = []
  let currentDate = ''
  $('[id*="ddlIPRDates"] option, #plnMain_ddlIPRDates option').each((_i, opt) => {
    const text = $(opt).text().trim()
    if (text) {
      availableDates.push(text)
      if ($(opt).attr('selected') || !currentDate) currentDate = text
    }
  })

  // If a specific date is requested, POST back to HAC selecting it
  if (date && date !== currentDate && availableDates.includes(date)) {
    let requestedValue = ''
    $('[id*="ddlIPRDates"] option, #plnMain_ddlIPRDates option').each((_i, opt) => {
      if ($(opt).text().trim() === date) { requestedValue = $(opt).attr('value') ?? ''; return false }
    })
    const dropdownName = $('[id*="ddlIPRDates"]').attr('name') ?? 'ctl00$plnMain$ddlIPRDates'
    const formData = new URLSearchParams({
      __EVENTTARGET: dropdownName,
      __EVENTARGUMENT: '',
      __VIEWSTATE: ($('[id="__VIEWSTATE"]').val() as string) ?? '',
      __EVENTVALIDATION: ($('[id="__EVENTVALIDATION"]').val() as string) ?? '',
      __VIEWSTATEGENERATOR: ($('[id="__VIEWSTATEGENERATOR"]').val() as string) ?? '',
      [dropdownName]: requestedValue,
    })
    const postRes = await http.post(`${origin}HomeAccess/Grades/IPR`, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${origin}HomeAccess/Grades/IPR` },
    })
    html = postRes.data as string
    $ = cheerio.load(html)
    currentDate = date
  }

  dumpDebugHtml('ipr', html)

  const courses: Array<{ name: string; period: string; average: string; letterGrade: string; teacher: string }> = []

  // Katy ISD IPR columns: 0=courseCode, 1=courseName, 2=period, 3=teacher, 4=room, 5=grade
  // Filter out comment legend rows (where col 0 is a short numeric code like "21", "22")
  const parseIPRRow = (row: AnyNode) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return
    const courseCode = cells.eq(0).text().trim()
    const name = cells.eq(1).text().trim() || courseCode
    // Skip header-like rows and comment legend rows (code is just 1-2 digits)
    if (!name || /^(course|class)/i.test(name) || /^\d{1,2}$/.test(courseCode)) return
    const grade = cells.eq(5).text().trim()
    courses.push({
      name,
      period: cells.eq(2).text().trim(),
      average: grade,
      letterGrade: grade,
      teacher: cells.eq(3).text().trim(),
    })
  }

  const dgIPRRows = $('#plnMain_dgIPR .sg-asp-table-data-row, #plnMain_dgIPR tr.sg-asp-table-data-row')
  if (dgIPRRows.length > 0) {
    dgIPRRows.each((_i, row) => parseIPRRow(row))
  }

  if (courses.length === 0) {
    $('.sg-asp-table-data-row').each((_i, row) => parseIPRRow(row))
  }

  if (courses.length === 0 && $('.AssignmentClass').length > 0) {
    $('.AssignmentClass').each((_i, el) => {
      const rawName = $(el).find('.sg-header-heading, [id*="lblCourseName"]').first().text().trim()
      const name = rawName.replace(/\s*[-–]\s*Period\s*\d+.*$/i, '').trim() || rawName
      const period = $(el).find('.sg-header-period, [id*="lblPeriod"]').text().replace(/Period/i, '').trim()
      const average = $(el).find('.sg-header-average, [id*="lblAverage"]').text().replace(/Student\s*Avg[:.]\s*/i, '').trim()
      const teacher = $(el).find('.sg-header-teacher, [id*="lblTeacher"]').text().trim()
      if (name) courses.push({ name, period, average, letterGrade: '', teacher })
    })
  }

  if (courses.length === 0) {
    $('table tr').each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 4) return
      const courseCode = cells.eq(0).text().trim()
      const name = cells.eq(1).text().trim() || courseCode
      if (!name || /^(course|class|subject|teacher)/i.test(name) || /^\d{1,2}$/.test(courseCode)) return
      courses.push({ name, period: cells.eq(2).text().trim(), average: cells.eq(5).text().trim(), letterGrade: cells.eq(5).text().trim(), teacher: cells.eq(3).text().trim() })
    })
  }

  console.log(`[IPR] Parsed ${courses.length} courses, ${availableDates.length} dates available`)
  if (courses.length === 0) console.warn('[IPR] No courses found — check debug_ipr.html')
  return { availableDates, currentDate, courses }
}

export async function getContactTeachers(sessionToken: string): Promise<{
  teachers: Array<{ name: string; courseName: string; period: string; email: null; emailNote: string; emailHint: string }>
}> {
  const classes = await getGrades(sessionToken)

  const teachers = classes
    .filter(c => c.teacher && c.teacher.trim() !== '')
    .map(c => {
      const parts = c.teacher.trim().split(/\s+/)
      const emailHint = parts.length >= 2
        ? `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}@katyisd.org`
        : `${c.teacher.toLowerCase().replace(/\s+/g, '.')}@katyisd.org`
      return {
        name: c.teacher,
        courseName: c.name,
        period: c.period,
        email: null as null,
        emailNote: 'Contact via school directory or Katy ISD staff search',
        emailHint,
      }
    })
    .filter((t, i, arr) => arr.findIndex(x => x.name === t.name) === i)

  return { teachers }
}

export async function getStudentInfo(sessionToken: string): Promise<HACStudentInfo> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl

  // The Demographic page IS the registration page on new HAC
  const res = await http.get(`${origin}HomeAccess/Registration/Demographic`, {
    headers: { Referer: `${origin}HomeAccess/Home.aspx` },
  })
  const $ = cheerio.load(res.data as string)

  // Helper: try multiple selectors, return first non-empty result
  function trySelectors(selectors: string[]): string {
    for (const sel of selectors) {
      const text = $(sel).text().trim()
      if (text) return text
    }
    return ''
  }

  return {
    name: trySelectors([
      '#plnMain_lblRegStudentName',
      '.sg-banner-student-name',
      '[id*="StudentName"]',
      '[id*="lblName"]',
      '.student-name',
    ]),
    grade: trySelectors([
      '#plnMain_lblGrade',
      '[id*="lblGrade"]',
      '[id*="GradeLevel"]',
    ]),
    school: trySelectors([
      '#plnMain_lblBuildingName',
      '[id*="BuildingName"]',
      '[id*="SchoolName"]',
      '.sg-banner-building',
    ]),
    district: trySelectors([
      'span.sg-banner-text',
      '.sg-banner-district',
      '[id*="District"]',
    ]),
    counselor: trySelectors([
      '#plnMain_lblCounselor',
      '[id*="Counselor"]',
    ]),
    cohortYear: trySelectors([
      '#plnMain_lblCohortYear',
      '[id*="CohortYear"]',
      '[id*="GraduationYear"]',
    ]),
  }
}

export async function getAttendance(sessionToken: string, monthOffset: number = 0): Promise<{
  month: string
  year: number
  monthIndex: number
  days: Array<{ date: string; dayOfWeek: string; status: string; code: string; description: string }>
  summary: { absences: number; tardies: number; excused: number }
}> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired — please log in again')

  const { http } = restoreSession(stored)
  const origin = stored.baseUrl
  const outerAttUrl = `${origin}HomeAccess/Attendance/MonthView`

  await sleep(800 + Math.random() * 400)

  // Attendance page loads data inside a legacy iframe at /HomeAccess/Content/Attendance/MonthlyView.aspx
  const outerRes = await http.get(outerAttUrl, {
    headers: { Referer: `${origin}HomeAccess/Home.aspx`, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  const outerAttHtml = outerRes.data as string
  const $outerAtt = cheerio.load(outerAttHtml)
  const attIframeSrc = $outerAtt('#sg-legacy-iframe, .sg-legacy-iframe').attr('src')

  let attIframeUrl = outerAttUrl
  if (attIframeSrc) {
    try {
      attIframeUrl = attIframeSrc.startsWith('http') ? attIframeSrc : new URL(attIframeSrc, outerAttUrl).toString()
    } catch { attIframeUrl = attIframeSrc }
    console.log('[ATTENDANCE] Following iframe to:', attIframeUrl)
    await sleep(400 + Math.random() * 200)
  }

  const iframeRes = attIframeSrc
    ? await http.get(attIframeUrl, { headers: { Referer: outerAttUrl } })
    : outerRes
  let html = iframeRes.data as string
  dumpDebugHtml('attendance', html)

  // Navigate months via ASP.NET postback against the iframe URL
  if (monthOffset !== 0) {
    const steps = Math.abs(monthOffset)
    for (let s = 0; s < steps; s++) {
      const $nav = cheerio.load(html)
      const prevId = $nav('[id*="lbPrev"]').attr('id') ?? 'ctl00$plnMain$lbPrev'
      const nextId = $nav('[id*="lbNext"]').attr('id') ?? 'ctl00$plnMain$lbNext'
      const target = (monthOffset < 0 ? prevId : nextId).replace(/#/g, '')
      const formData = new URLSearchParams({
        __EVENTTARGET: target,
        __EVENTARGUMENT: '',
        __VIEWSTATE: ($nav('[id="__VIEWSTATE"]').val() as string) ?? '',
        __EVENTVALIDATION: ($nav('[id="__EVENTVALIDATION"]').val() as string) ?? '',
        __VIEWSTATEGENERATOR: ($nav('[id="__VIEWSTATEGENERATOR"]').val() as string) ?? '',
      })
      const navRes = await http.post(attIframeUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: attIframeUrl },
      })
      html = navRes.data as string
      await sleep(300)
    }
    dumpDebugHtml('attendance_nav', html)
  }

  const $ = cheerio.load(html)

  // Extract month/year heading
  const heading = $('[id*="lblMonthYear"], [id*="lbMonthYear"], caption, .sg-header-heading, h2').first().text().trim()
  const monthYear = heading || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const MONTH_NAMES_ATT = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  let year = new Date().getFullYear()
  let monthIndex = new Date().getMonth()
  const mymatch = monthYear.match(/(\w+)\s+(\d{4})/)
  if (mymatch) {
    const mIdx = MONTH_NAMES_ATT.indexOf(mymatch[1].toLowerCase())
    if (mIdx >= 0) monthIndex = mIdx
    year = parseInt(mymatch[2])
  }

  const days: Array<{ date: string; dayOfWeek: string; status: string; code: string; description: string }> = []

  $('table td').each((_i, cell) => {
    const $cell = $(cell)
    const cellClass = ($cell.attr('class') ?? '').toLowerCase()
    const title = ($cell.attr('title') ?? '').toLowerCase()

    // Get the first visible number from this cell — that's the day number
    const dayText = $cell.find('[id*="lblDate"], .sg-cal-date, span').first().text().trim()
      || $cell.children('span').first().text().trim()
    const dayNum = parseInt(dayText)
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return

    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    const d = new Date(year, monthIndex, dayNum)
    const dayOfWeek = DAY_NAMES[d.getDay()] ?? ''

    // Determine attendance code from class names, title attribute, or child image IDs
    let code = ''
    let status = ''
    const childClasses = $cell.find('*').map((_j, el) => ($(el).attr('class') ?? '').toLowerCase()).get().join(' ')
    const allClasses = cellClass + ' ' + childClasses
    const hasImg = (id: string) => $cell.find(`[id*="${id}"]`).length > 0

    if (/absent/i.test(title) || /absent/.test(allClasses) || hasImg('imgAbsent') || hasImg('Absent')) { code = 'A'; status = 'Absent' }
    else if (/tardy/i.test(title) || /tardy/.test(allClasses) || hasImg('imgTardy') || hasImg('Tardy')) { code = 'T'; status = 'Tardy' }
    else if (/excused/i.test(title) || /excused/.test(allClasses) || hasImg('imgExcused') || hasImg('Excused')) { code = 'E'; status = 'Excused' }
    else if (/present/i.test(title) || /present/.test(allClasses)) { code = 'P'; status = 'Present' }

    days.push({ date: dateStr, dayOfWeek, status, code, description: ($cell.attr('title') ?? '') })
  })

  // De-duplicate by date (table can have multiple cells per day in some layouts)
  const seen = new Set<string>()
  const uniqueDays = days.filter(d => { if (seen.has(d.date)) return false; seen.add(d.date); return true })

  const absences = uniqueDays.filter(d => d.code === 'A').length
  const tardies  = uniqueDays.filter(d => d.code === 'T').length
  const excused  = uniqueDays.filter(d => d.code === 'E').length

  console.log(`[ATTENDANCE] ${monthYear}: ${uniqueDays.length} days parsed, A=${absences} T=${tardies} E=${excused}`)
  return { month: monthYear, year, monthIndex, days: uniqueDays, summary: { absences, tardies, excused } }
}