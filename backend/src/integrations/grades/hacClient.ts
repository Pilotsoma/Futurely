/**
 * HAC (Home Access Center) scraping client.
 * Debug-friendly version for NextStep local beta.
 */

import fs from 'fs'
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { saveSession, getSessionByToken, StoredSession } from './sessionStore'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

function getFormAction($: cheerio.CheerioAPI, fallbackUrl: string, link: string): string {
  const action = $('form').first().attr('action')

  if (!action) return fallbackUrl

  if (action.startsWith('http://') || action.startsWith('https://')) {
    return action
  }

  if (action.startsWith('/')) {
    return `${link.replace(/\/$/, '')}${action}`
  }

  return `${link}${action}`
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
  const { jar, http } = makeAxiosSession()

  console.log('[HAC CLIENT] loginHAC started', {
    baseUrl,
    link,
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

  const loginPageUrl = `${link}HomeAccess/Account/LogOn`

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

  const loginPostUrl = getFormAction($, loginPageUrl, link)

  try {
    console.log('[HAC CLIENT] Posting HAC login form:', loginPostUrl)

    const postRes = await http.post(loginPostUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: link.replace(/\/$/, ''),
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
    // This catches cases where HAC redirects to an error page (not the login page)
    // instead of throwing an explicit credential rejection.
    const homeUrl = `${link}HomeAccess/Home.aspx`
    console.log('[HAC CLIENT] Verifying session via Home.aspx:', homeUrl)

    const homeRes = await http.get(homeUrl, {
      headers: { Referer: loginPostUrl },
      validateStatus: (status: number) => status >= 200 && status < 500,
    })

    const homeBody = homeRes.data as string
    const homeFinalUrl: string =
      (homeRes.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? homeUrl

    console.log('[HAC CLIENT] Home.aspx response', {
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

    // Catch redirect to error page (e.g., SSO/MFA failure, expired session)
    const homeRedirectedToError =
      homeFinalUrl.includes('/Error') &&
      !homeFinalUrl.includes('Home.aspx')

    if (homeRedirectedToError) {
      throw new Error('Invalid credentials — HAC authentication failed (session not established; district may require SSO/MFA)')
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

  const hacDomain = link.replace(/\/$/, '')
  const allCookies = jar.getCookiesSync(hacDomain)
  console.log('[HAC CLIENT] Saving session — baseUrl (with slash):', link)
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

  const sessionToken = saveSession(userId, 'HAC', link, serializeJar(jar))

  console.log('[HAC CLIENT] HAC session saved', {
    userId,
    hasSessionToken: Boolean(sessionToken),
  })

  return sessionToken
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
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http, jar } = restoreSession(stored)
  const link = stored.baseUrl

  // Log cookies before fetch to verify session is being carried
  const cookieDomain = link.replace(/\/$/, '')
  const cookiesBeforeFetch = jar.getCookiesSync(cookieDomain)
  console.log('[HAC CLIENT] Cookies in jar before grades fetch:', cookiesBeforeFetch.map(c => c.key))
  console.log('[HAC CLIENT] Cookie count:', cookiesBeforeFetch.length)
  console.log('[HAC CLIENT] baseUrl from session (with slash):', link)
  console.log('[HAC CLIENT] Domain for cookie lookup (no slash):', cookieDomain)

  await sleep(800 + Math.random() * 400) // 0.8–1.2s delay
  const res = await http.get(`${link}HomeAccess/Content/Student/Assignments.aspx`, {
    headers: {
      Referer: `${link}HomeAccess/Home.aspx`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  // DEBUG: save raw HTML so we can inspect selectors
  const debugHtml = res.data as string
  fs.writeFileSync('hac_debug_grades.html', debugHtml, 'utf8')
  console.log('[HAC DEBUG] Saved grades page HTML to hac_debug_grades.html')
  console.log('[HAC DEBUG] HTML length:', debugHtml.length)
  console.log('[HAC DEBUG] Has .AssignmentClass:', debugHtml.includes('AssignmentClass'))
  console.log('[HAC DEBUG] Has .sg-header:', debugHtml.includes('sg-header'))
  console.log('[HAC DEBUG] Has classBlock:', debugHtml.includes('classBlock'))
  console.log('[HAC DEBUG] Has sg-content-grid:', debugHtml.includes('sg-content-grid'))
  console.log('[HAC DEBUG] HTML preview:\n', debugHtml.slice(0, 3000))

  const $ = cheerio.load(res.data as string)

  // Log final URL and page title — detect if we were redirected away from Assignments
  const finalUrl = (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? 'unknown'
  console.log('[HAC CLIENT] Grades page final URL:', finalUrl)
  console.log('[HAC CLIENT] Grades page title:', $('title').text().trim())
  console.log('[HAC CLIENT] Grades page HTML length:', typeof res.data === 'string' ? res.data.length : 0)

  if (!finalUrl.includes('Assignments') && $('title').text().trim() !== 'Assignments') {
    console.error('[HAC CLIENT] Redirected away from Assignments page — session likely expired or cookie domain mismatch')
    throw new Error('School session expired — please disconnect and reconnect your school portal')
  }

  const pageTitle = $('title').text().trim()
  const hasAssignmentClass = $('.AssignmentClass').length
  const hasSgHeader = $('.sg-header').length

  console.log('[HAC CLIENT] getGrades page structure:', {
    pageTitle,
    hasAssignmentClass,
    hasSgHeader,
    htmlLength: typeof res.data === 'string' ? res.data.length : 0,
  })

  if (hasAssignmentClass === 0) {
    console.warn('[HAC CLIENT] No .AssignmentClass elements found. Page may use different selectors.')
    console.warn('[HAC CLIENT] Page title:', pageTitle)
  }

  const classes: HACClass[] = []

  $('.AssignmentClass').each((_i, el) => {
    const header = $(el).find('.sg-header .sg-header-heading').text().trim()

    // Robust course name parsing — strip period indicators from end
    const name = header
      .replace(/\s*[-–]\s*Period\s*\d+.*$/i, '')
      .replace(/\s*[-–]\s*Pd\.?\s*\d+.*$/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim() || header.trim()

    const period = extractPeriod($(el), $)
    const average = extractAverage($(el), $)

    // Extract column headers to determine cell positions dynamically
    const colHeaders: string[] = []
    $(el).find('tr.sg-asp-table-header-row th, thead th').each((_i2, th) => {
      colHeaders.push($(th).text().trim().toLowerCase())
    })

    console.log('[HAC CLIENT] Assignment table headers for', name, ':', colHeaders)

    // Helper to find cell index by header keyword
    const colIdx = (keywords: string[]): number => {
      for (const kw of keywords) {
        const idx = colHeaders.findIndex(h => h.includes(kw))
        if (idx !== -1) return idx
      }
      return -1
    }

    const nameIdx  = colIdx(['assignment', 'name', 'description', 'title'])
    const dateIdx  = colIdx(['due', 'date'])
    const catIdx   = colIdx(['category', 'type'])
    const scoreIdx = colIdx(['score', 'points earned', 'earned'])
    const totalIdx = colIdx(['total', 'out of', 'possible'])
    const pctIdx   = colIdx(['%', 'percent', 'average'])

    const scores: HACScore[] = []

    $(el)
      .find('tr.sg-asp-table-data-row')
      .each((_j, row) => {
        const cells = $(row).find('td')

        // Fallback to hardcoded indices if header detection failed
        const aName     = nameIdx  >= 0 ? cells.eq(nameIdx).text().trim()  : cells.eq(0).text().trim()
        const dateDue   = dateIdx  >= 0 ? cells.eq(dateIdx).text().trim()  : cells.eq(1).text().trim()
        const category  = catIdx   >= 0 ? cells.eq(catIdx).text().trim()   : cells.eq(3).text().trim()
        const scoreRaw  = scoreIdx >= 0 ? cells.eq(scoreIdx).text().trim() : cells.eq(5).text().trim()
        const totalRaw  = totalIdx >= 0 ? cells.eq(totalIdx).text().trim() : cells.eq(6).text().trim()
        const pctRaw    = pctIdx   >= 0 ? cells.eq(pctIdx).text().trim()   : cells.eq(7).text().trim()

        const score = parseFloat(scoreRaw) || null
        const totalPoints = parseFloat(totalRaw) || null

        if (aName) {
          scores.push({ name: aName, category, score, totalPoints, percentage: pctRaw, dateDue })
        }
      })

    if (name) {
      classes.push({
        name,
        period,
        teacher: '',
        room: '',
        average,
        scores,
      })
    }
  })

  // FALLBACK STRATEGY: if standard selectors found nothing, try alternatives
  if (classes.length === 0) {
    console.warn('[HAC CLIENT] Standard selectors returned 0 classes — trying fallback selectors')

    $('div[id*="plnMain_rptAssigClasses"]').each((_i, el) => {
      const nameEl = $(el).find('span[id*="lblHeading"], .sg-header-heading, h3, .ClassHeader').first()
      const avgEl  = $(el).find('span[id*="lblAverage"], .sg-header-average, span[id*="Average"]').first()
      const name   = nameEl.text().replace(/\s*[-–]\s*Period\s*\d+.*$/i, '').trim()
      const avgRaw = avgEl.text().replace(/Student\s*Avg[:.]?\s*/i, '').trim()
      const average = avgRaw && avgRaw !== '--' && avgRaw !== 'N/A' ? avgRaw : null

      if (!name) return

      const scores: HACScore[] = []
      $(el).find('tr').each((_j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 3) return
        const aName = cells.eq(0).text().trim()
        if (!aName || aName.toLowerCase().includes('assignment')) return
        scores.push({
          name: aName,
          category: cells.eq(2).text().trim() || 'Uncategorized',
          score: parseFloat(cells.eq(4).text()) || null,
          totalPoints: parseFloat(cells.eq(5).text()) || null,
          percentage: cells.eq(6).text().trim() || '',
          dateDue: cells.eq(1).text().trim() || '',
        })
      })

      classes.push({ name, period: String(_i + 1), teacher: '', room: '', average, scores })
    })
  }

  // FALLBACK 2: look for any table that looks like a grade table
  if (classes.length === 0) {
    console.warn('[HAC CLIENT] Fallback 1 also found nothing — trying generic table scan')

    $('table').each((_i, table) => {
      const rows = $(table).find('tr')
      if (rows.length < 2) return

      const firstRowText = rows.first().text().toLowerCase()
      if (!firstRowText.includes('assignment') && !firstRowText.includes('grade') && !firstRowText.includes('date')) return

      const heading = $(table).prevAll('h2, h3, span[id*="Heading"], .sg-header-heading').first().text().trim()
      if (!heading) return

      const scores: HACScore[] = []
      rows.each((_j, row) => {
        if (_j === 0) return
        const cells = $(row).find('td')
        if (cells.length < 2) return
        const aName = cells.eq(0).text().trim()
        if (!aName) return
        scores.push({
          name: aName,
          category: 'Uncategorized',
          score: null,
          totalPoints: null,
          percentage: cells.eq(cells.length - 1).text().trim(),
          dateDue: cells.eq(1).text().trim(),
        })
      })

      if (scores.length > 0) {
        classes.push({ name: heading, period: '', teacher: '', room: '', average: null, scores })
      }
    })
  }

  try {
    const schedRes = await http.get(`${link}HomeAccess/Content/Student/Classes.aspx`)
    const $s = cheerio.load(schedRes.data as string)

    $s('tr.sg-asp-table-data-row').each((_i, row) => {
      const cells = $s(row).find('td')
      const cn = cells.eq(1).text().trim()
      const teacher = cells.eq(3).find('a').text().trim() || cells.eq(3).text().trim()
      const room = cells.eq(4).text().trim()
      const match = classes.find(c => c.name === cn)

      if (match) {
        match.teacher = teacher
        match.room = room
      }
    })
  } catch {
    // schedule enrichment is best-effort
  }

  return classes
}

export async function getTranscript(sessionToken: string): Promise<HACTranscript> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const link = stored.baseUrl

  await sleep(800 + Math.random() * 400) // 0.8–1.2s delay
  const res = await http.get(`${link}HomeAccess/Content/Student/Transcript.aspx`)
  const $ = cheerio.load(res.data as string)

  const semesters: HACTranscriptEntry[] = []

  $('td.sg-transcript-group').each((_i, group) => {
    const header = $(group).find('.sg-transcript-group-heading').text().trim()
    const yearMatch = header.match(/(\d{4})/)
    const semMatch = header.match(/Semester\s*(\d)/i)
    const courses: Array<{ name: string; grade: string; credits: string }> = []

    $(group)
      .find('tr.sg-asp-table-data-row')
      .each((_j, row) => {
        const cells = $(row).find('td')

        courses.push({
          name: cells.eq(0).text().trim(),
          grade: cells.eq(1).text().trim(),
          credits: cells.eq(2).text().trim(),
        })
      })

    semesters.push({
      year: yearMatch?.[1] ?? '',
      semester: semMatch?.[1] ?? '',
      courses,
    })
  })

  const gpaText = $('#plnMain_rpTranscriptGroup_tblCumGPAInfo').text()
  const gpaMatch = gpaText.match(/[\d.]+/)

  return {
    semesters,
    cumulativeGPA: gpaMatch?.[0] ?? null,
    classRank: null,
  }
}

export async function getSchedule(sessionToken: string): Promise<object[]> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const link = stored.baseUrl

  await sleep(800 + Math.random() * 400) // 0.8–1.2s delay
  const res = await http.get(`${link}HomeAccess/Content/Student/Classes.aspx`)
  const $ = cheerio.load(res.data as string)

  const headers: string[] = []

  $('tr.sg-asp-table-header-row th').each((_i, th) => {
    headers.push($(th).text().trim())
  })

  const schedule: object[] = []

  $('tr.sg-asp-table-data-row').each((_i, row) => {
    const entry: Record<string, string> = {}

    $(row)
      .find('td')
      .each((j, td) => {
        if (headers[j]) entry[headers[j]] = $(td).text().trim()
      })

    schedule.push(entry)
  })

  return schedule
}

export async function getStudentInfo(sessionToken: string): Promise<HACStudentInfo> {
  const stored = getSessionByToken(sessionToken)
  if (!stored) throw new Error('School session expired or not found — please log in again')

  const { http } = restoreSession(stored)
  const link = stored.baseUrl

  const res = await http.get(`${link}HomeAccess/Content/Student/Registration.aspx`)
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