import * as cheerio from 'cheerio';
import { ClasslinkSession } from './classlinkClient';
import { DistrictConfig } from './districtConfig';

export interface SchoologyCourse {
  sectionId: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  period: string;
  teacherName: string;
  overallGrade: string | null;
  overallLetter: string | null;
}

export interface SchoologyAssignment {
  id: string;
  title: string;
  dueDate: string | null;
  maxPoints: number | null;
  earnedPoints: number | null;
  grade: string | null;
  category: string;
  isGraded: boolean;
  isMissing: boolean;
  isExcused: boolean;
  courseId: string;
  sectionId: string;
}

export interface SchoologyGradebook {
  courses: SchoologyCourse[];
  assignments: SchoologyAssignment[];
  lastUpdated: Date;
}

export async function getSchoologyGradebook(
  session: ClasslinkSession,
  district: DistrictConfig
): Promise<SchoologyGradebook> {
  if (!district.schoology.enabled) {
    throw new Error(`Schoology is not enabled for district "${district.id}".`);
  }

  const { http } = session;
  const schoologyBase = `https://${district.schoology.domain}`;

  // Navigate to Schoology via ClassLink SSO to establish Schoology cookies
  await http.get(`https://launchpad.classlink.com/${district.classlink.tenant}/apps`);
  const schoologyHome = await http.get(schoologyBase);
  const finalUrl: string = (schoologyHome.request?.res?.responseUrl as string) || '';

  if (!finalUrl.includes(district.schoology.domain)) {
    throw new Error(
      `SCHOOLOGY_SSO_FAILED: Could not reach Schoology for district "${district.id}". ` +
      `Run debug-classlink.ts to inspect the redirect chain.`
    );
  }

  let courses: SchoologyCourse[] = [];
  const assignments: SchoologyAssignment[] = [];

  // Try Schoology's internal API first
  try {
    const sectionsResp = await http.get(`${schoologyBase}/iapi2/sections/student/me`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });
    if (sectionsResp.status === 200 && sectionsResp.data?.sections) {
      courses = parseSectionsFromAPI(sectionsResp.data.sections);
    }
  } catch {
    // fall through to HTML scrape
  }

  if (courses.length === 0) {
    const gradesPageResp = await http.get(`${schoologyBase}/grades`);
    const $ = cheerio.load(gradesPageResp.data as string);
    courses = parseSectionsFromGradesPage($);
  }

  for (const course of courses) {
    const courseAssignments = await getAssignmentsForSection(http, schoologyBase, course.sectionId, course.courseId);
    assignments.push(...courseAssignments);
  }

  return { courses, assignments, lastUpdated: new Date() };
}

function parseSectionsFromAPI(sections: any[]): SchoologyCourse[] {
  return sections.map((s: any) => ({
    sectionId: String(s.id || s.nid || ''),
    courseId: String(s.course_id || ''),
    courseName: s.course_title || s.title || 'Unknown Course',
    courseCode: s.course_code || '',
    period: s.section_title || s.period || '',
    teacherName: s.primary_teacher_display_name || '',
    overallGrade: s.grade ?? null,
    overallLetter: s.letter_grade ?? null,
  }));
}

function parseSectionsFromGradesPage($: cheerio.CheerioAPI): SchoologyCourse[] {
  const courses: SchoologyCourse[] = [];
  // Selectors cover common Schoology layouts — run debug harness to confirm for each district
  $('.gradebook-course-row, .course-row').each((_i, el) => {
    const sectionId = $(el).attr('data-section-nid') || $(el).attr('data-id') || '';
    const courseId = $(el).attr('data-course-nid') || '';
    const courseName = $(el).find('.title, .course-name').first().text().trim();
    const grade = $(el).find('.grade, .overall-grade').first().text().trim();
    if (courseName) {
      courses.push({ sectionId, courseId, courseName, courseCode: '', period: '', teacherName: '', overallGrade: grade || null, overallLetter: null });
    }
  });
  return courses;
}

async function getAssignmentsForSection(
  http: any,
  base: string,
  sectionId: string,
  _courseId: string
): Promise<SchoologyAssignment[]> {
  if (!sectionId) return [];

  try {
    const resp = await http.get(`${base}/iapi2/gradebook/student/${sectionId}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });
    if (resp.status === 200 && resp.data?.grade_items) {
      return parseAssignmentsFromAPI(resp.data.grade_items, sectionId);
    }
  } catch { /* fall through */ }

  try {
    const resp = await http.get(`${base}/grades/section/${sectionId}`);
    const $ = cheerio.load(resp.data as string);
    return parseAssignmentsFromHTML($, sectionId);
  } catch {
    return [];
  }
}

function parseAssignmentsFromAPI(items: any[], sectionId: string): SchoologyAssignment[] {
  return items.map((item: any) => ({
    id: String(item.id || item.assignment_id || ''),
    title: item.title || item.assignment_title || 'Untitled',
    dueDate: item.due || item.due_date || null,
    maxPoints: item.max_points != null ? Number(item.max_points) : null,
    earnedPoints: item.grade != null ? Number(item.grade) : null,
    grade: item.letter_grade || null,
    category: item.grading_category || item.category || 'Assignment',
    isGraded: item.is_graded ?? item.grade != null,
    isMissing: item.missing === 1 || item.is_missing === true,
    isExcused: item.excused === 1 || item.is_excused === true,
    courseId: String(item.course_id || ''),
    sectionId,
  }));
}

function parseAssignmentsFromHTML($: cheerio.CheerioAPI, sectionId: string): SchoologyAssignment[] {
  const assignments: SchoologyAssignment[] = [];
  $('tr.item-row, .gradebook-row').each((_i, el) => {
    const title = $(el).find('.title, .assignment-title').first().text().trim();
    const earned = $(el).find('.grade-column .rounded-grade, .score').first().text().trim();
    const max = $(el).find('.max-grade, .out-of').first().text().trim();
    const dueDate = $(el).find('.due-date').first().attr('data-date') || null;
    const category = $(el).find('.category').first().text().trim();
    if (title) {
      assignments.push({
        id: $(el).attr('data-id') || '',
        title,
        dueDate,
        maxPoints: max ? Number(max.replace(/[^0-9.]/g, '')) : null,
        earnedPoints: earned && earned !== '-' ? Number(earned.replace(/[^0-9.]/g, '')) : null,
        grade: null,
        category: category || 'Assignment',
        isGraded: earned !== '' && earned !== '-',
        isMissing: $(el).hasClass('missing'),
        isExcused: $(el).hasClass('excused'),
        courseId: '',
        sectionId,
      });
    }
  });
  return assignments;
}
