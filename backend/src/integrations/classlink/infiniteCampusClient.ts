import * as cheerio from 'cheerio';
import { ClasslinkSession } from './classlinkClient';
import { DistrictConfig } from './districtConfig';

export interface ICCourse {
  courseName: string;
  courseCode: string;
  period: string;
  teacherName: string;
  room: string;
  term: string;
  grade: string | null;
  letter: string | null;
  credits: number | null;
}

export interface ICAttendanceRecord {
  date: string;
  period: string;
  courseName: string;
  status: string;
}

export interface ICReportCard {
  term: string;
  courses: ICCourse[];
  gpa: string | null;
}

export interface ICStudentData {
  schedule: ICCourse[];
  reportCards: ICReportCard[];
  attendance: ICAttendanceRecord[];
  transcript: ICCourse[];
  counselorName: string | null;
  counselorEmail: string | null;
}

export async function getInfiniteCampusData(
  session: ClasslinkSession,
  district: DistrictConfig
): Promise<ICStudentData> {
  if (!district.infiniteCampus.enabled) {
    throw new Error(`Infinite Campus is not enabled for district "${district.id}".`);
  }

  const { http } = session;
  const icBase = district.infiniteCampus.baseUrl;
  const appName = district.infiniteCampus.appName;

  // Step 1: Navigate to IC via ClassLink SSO
  const icPortalUrl = `${icBase}/${appName}/portal/students/${district.id}.jsp`;
  const icResp = await http.get(icPortalUrl);
  const finalUrl: string = (icResp.request?.res?.responseUrl as string) || '';

  if (finalUrl.includes('/login') || finalUrl.includes('/LogOn') || finalUrl.includes('/auth')) {
    // Try via ClassLink launchpad SSO redirect
    const ssoResp = await http.get(`https://launchpad.classlink.com/${district.classlink.tenant}`, { maxRedirects: 15 });
    const $launchpad = cheerio.load(ssoResp.data as string);
    const icAppLink = $launchpad('a[href*="infinitecampus"]').first().attr('href') || '';
    if (icAppLink) {
      await http.get(icAppLink.startsWith('http') ? icAppLink : `https://launchpad.classlink.com${icAppLink}`);
    } else {
      throw new Error(
        `IC_SSO_FAILED: Could not reach Infinite Campus for district "${district.id}". ` +
        `Run debug-classlink.ts --dump-ic to inspect the portal HTML.`
      );
    }
  }

  // Step 2: Parallel fetch of all IC pages
  const [scheduleResult, gradesResult, attendanceResult, transcriptResult] = await Promise.allSettled([
    http.get(`${icBase}/${appName}/portal/schedule.xsl`).then((r: any) => r.data as string),
    http.get(`${icBase}/${appName}/portal/grades.xsl`).then((r: any) => r.data as string),
    http.get(`${icBase}/${appName}/portal/attendance.xsl`).then((r: any) => r.data as string),
    http.get(`${icBase}/${appName}/portal/transcript.xsl`).then((r: any) => r.data as string),
  ]);

  const schedule = scheduleResult.status === 'fulfilled' ? parseICSchedule(cheerio.load(scheduleResult.value)) : [];
  const reportCards = gradesResult.status === 'fulfilled' ? parseICGrades(cheerio.load(gradesResult.value)) : [];
  const attendance = attendanceResult.status === 'fulfilled' ? parseICAttendance(cheerio.load(attendanceResult.value)) : [];
  const transcript = transcriptResult.status === 'fulfilled' ? parseICTranscript(cheerio.load(transcriptResult.value)) : [];

  let counselorName: string | null = null;
  let counselorEmail: string | null = null;
  try {
    const profileResp = await http.get(`${icBase}/${appName}/portal/student.xsl`);
    const $p = cheerio.load(profileResp.data as string);
    counselorName = $p('dt:contains("Counselor"), td:contains("Counselor")').next().text().trim() || null;
    counselorEmail = $p('a[href*="mailto:"]').filter((_i: number, el: any) => {
      return $p(el).closest('tr, .counselor-row').text().toLowerCase().includes('counselor');
    }).attr('href')?.replace('mailto:', '') || null;
  } catch { /* non-fatal */ }

  return { schedule, reportCards, attendance, transcript, counselorName, counselorEmail };
}

// NOTE: IC portal renders .xsl pages as HTML. Selectors below cover common IC layouts.
// Run debug-classlink.ts --dump-ic to capture raw HTML and tune selectors per district.

function parseICSchedule($: cheerio.CheerioAPI): ICCourse[] {
  const courses: ICCourse[] = [];
  $('tr.schedule-row, .classRow, tr[data-period]').each((_i, el) => {
    const cells = $(el).find('td');
    if (cells.length >= 3) {
      courses.push({
        period: $(cells[0]).text().trim(),
        courseName: $(cells[1]).text().trim() || $(cells[2]).text().trim(),
        courseCode: $(cells[1]).attr('data-code') || '',
        teacherName: $(cells[3] || cells[2]).text().trim(),
        room: $(cells[4] || cells[3]).text().trim(),
        term: '',
        grade: null,
        letter: null,
        credits: null,
      });
    }
  });
  return courses;
}

function parseICGrades($: cheerio.CheerioAPI): ICReportCard[] {
  const reportCards: ICReportCard[] = [];
  $('.gradingPeriod, .term-header, h3, h4').each((_i, termEl) => {
    const term = $(termEl).text().trim();
    if (!term || term.length > 30) return;

    const courses: ICCourse[] = [];
    $(termEl).nextUntil('.gradingPeriod, .term-header, h3, h4', 'tr.courseRow, tr').each((_j, row) => {
      const courseName = $(row).find('.courseName, td:nth-child(1)').first().text().trim();
      const grade = $(row).find('.grade, td.grade').first().text().trim();
      const letter = $(row).find('.letter, td.letter').first().text().trim();
      if (courseName) {
        courses.push({
          courseName,
          courseCode: '',
          period: $(row).find('.period, td.period').first().text().trim(),
          teacherName: $(row).find('.teacher, td.teacher').first().text().trim(),
          room: '',
          term,
          grade: grade || null,
          letter: letter || null,
          credits: null,
        });
      }
    });

    const gpa = $('*:contains("GPA")').filter((_k, el) => $(el).children().length === 0)
      .first().text().replace(/[^0-9.]/g, '') || null;

    if (courses.length > 0) {
      reportCards.push({ term, courses, gpa });
    }
  });
  return reportCards;
}

function parseICAttendance($: cheerio.CheerioAPI): ICAttendanceRecord[] {
  const records: ICAttendanceRecord[] = [];
  $('tr.attendance-row, tr[data-date]').each((_i, el) => {
    const cells = $(el).find('td');
    records.push({
      date: $(el).attr('data-date') || $(cells[0]).text().trim(),
      period: $(cells[1]).text().trim(),
      courseName: $(cells[2]).text().trim(),
      status: $(cells[3]).text().trim() || 'Unknown',
    });
  });
  return records;
}

function parseICTranscript($: cheerio.CheerioAPI): ICCourse[] {
  const courses: ICCourse[] = [];
  $('tr.transcript-row, tr[data-course]').each((_i, el) => {
    const cells = $(el).find('td');
    if (cells.length >= 3) {
      courses.push({
        courseName: $(cells[0]).text().trim() || $(cells[1]).text().trim(),
        courseCode: $(cells[0]).attr('data-code') || '',
        period: '',
        teacherName: '',
        room: '',
        term: $(cells[1]).text().trim(),
        grade: $(cells[cells.length - 2]).text().trim() || null,
        letter: $(cells[cells.length - 1]).text().trim() || null,
        credits: null,
      });
    }
  });
  return courses;
}
