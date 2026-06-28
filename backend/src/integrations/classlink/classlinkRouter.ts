import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { loginClasslink, getOrRefreshSession } from './classlinkClient';
import { getSchoologyGradebook } from './schoologyClient';
import { getInfiniteCampusData } from './infiniteCampusClient';
import { getDistrict, listDistricts } from './districtConfig';
import { encryptPassword, decryptPassword } from '../grades/credentialCrypto';

const router = Router();

const asyncHandler = (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// GET /integrations/classlink/districts
router.get('/districts', asyncHandler(async (_req, res) => {
  res.json({ districts: listDistricts() });
}));

// POST /integrations/classlink/connect
// Body: { districtId, username, password }
router.post('/connect', asyncHandler(async (req, res) => {
  const userId = req.userId!;
  const { districtId, username, password } = req.body as {
    districtId?: string; username?: string; password?: string;
  };

  if (!districtId || !username || !password) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'districtId, username, and password are required' } });
    return;
  }

  const district = getDistrict(districtId); // throws if unknown

  await loginClasslink(userId, username, password, district);

  // Persist credentials using existing SchoolConnection model:
  //   systemType = "CLASSLINK", districtUrl = districtId slug, hacUsername = username
  const encrypted = encryptPassword(password);
  await prisma.schoolConnection.upsert({
    where: { userId },
    create: {
      userId,
      systemType: 'CLASSLINK',
      districtUrl: districtId,
      hacUsername: username,
      encryptedPassword: encrypted,
    },
    update: {
      systemType: 'CLASSLINK',
      districtUrl: districtId,
      hacUsername: username,
      encryptedPassword: encrypted,
    },
  });

  res.json({
    success: true,
    districtName: district.name,
    schoology: district.schoology.enabled,
    infiniteCampus: district.infiniteCampus.enabled,
  });
}));

// GET /integrations/classlink/schoology/gradebook
router.get('/schoology/gradebook', asyncHandler(async (req, res) => {
  const userId = req.userId!;
  const connection = await prisma.schoolConnection.findFirst({
    where: { userId, systemType: 'CLASSLINK' },
    select: { districtUrl: true, hacUsername: true, encryptedPassword: true },
  });

  if (!connection?.districtUrl || !connection.hacUsername || !connection.encryptedPassword) {
    res.status(404).json({ error: { code: 'NOT_CONNECTED', message: 'No ClassLink connection found. POST /connect first.' } });
    return;
  }

  const password = decryptPassword(connection.encryptedPassword);
  const district = getDistrict(connection.districtUrl);
  const session = await getOrRefreshSession(userId, connection.hacUsername, password, district);
  const gradebook = await getSchoologyGradebook(session, district);
  res.json(gradebook);
}));

// GET /integrations/classlink/infinitecampus
router.get('/infinitecampus', asyncHandler(async (req, res) => {
  const userId = req.userId!;
  const connection = await prisma.schoolConnection.findFirst({
    where: { userId, systemType: 'CLASSLINK' },
    select: { districtUrl: true, hacUsername: true, encryptedPassword: true },
  });

  if (!connection?.districtUrl || !connection.hacUsername || !connection.encryptedPassword) {
    res.status(404).json({ error: { code: 'NOT_CONNECTED', message: 'No ClassLink connection found. POST /connect first.' } });
    return;
  }

  const password = decryptPassword(connection.encryptedPassword);
  const district = getDistrict(connection.districtUrl);
  const session = await getOrRefreshSession(userId, connection.hacUsername, password, district);
  const data = await getInfiniteCampusData(session, district);
  res.json(data);
}));

export default router;
