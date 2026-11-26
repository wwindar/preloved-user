import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { Server } from 'http';
import { hashPassword } from '../src/utils/password';

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const INTERNAL_SECRET = 'sec_internal_preloved_service_shared_secret_99482';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function assertTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ PASSED: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ❌ FAILED: ${name} ->`, err.message);
  }
}

async function run() {
  console.log('\n=============================================');
  console.log('🧪 Starting User Service End-to-End API Tests');
  console.log('=============================================\n');

  const app = createApp();
  let server: Server;

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => resolve());
  });

  try {
    const unique = Date.now().toString().slice(-6);
    const testUser = {
      username: `windar_${unique}`,
      email: `windar_${unique}@example.com`,
      password: 'Password123!',
      fullName: 'Windar Wening',
    };

    let accessToken = '';
    let refreshToken = '';
    let userId = '';
    let rotatedOldRefreshToken = '';
    let loggedOutAccessToken = '';

    // Create an inactive user for inactive login test
    const inactivePasswordHash = await hashPassword('Password123!');
    const inactiveUser = await prisma.user.upsert({
      where: { username: 'inactive_user_test' },
      update: { isActive: false },
      create: {
        username: 'inactive_user_test',
        email: 'inactive_user@example.com',
        passwordHash: inactivePasswordHash,
        isActive: false,
        profile: {
          create: {
            fullName: 'Inactive User',
          },
        },
      },
    });

    // TEST 1: Register Success
    await assertTest('1. Register berhasil', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });
      const data = await res.json();
      if (res.status !== 201 || !data.success || !data.data.user.id) {
        throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(data)}`);
      }
      if (data.data.user.passwordHash || data.data.user.password_hash) {
        throw new Error('Password hash leaked in register response!');
      }
      userId = data.data.user.id;
    });

    // TEST 2: Duplicate Email
    await assertTest('2. Register dengan email duplikat ditolak (409)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `diff_${unique}`,
          email: testUser.email,
          password: 'Password123!',
          fullName: 'Duplicate Email',
        }),
      });
      const data = await res.json();
      if (res.status !== 409 || data.success) {
        throw new Error(`Expected 409 Conflict, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 3: Duplicate Username
    await assertTest('3. Register dengan username duplikat ditolak (409)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser.username,
          email: `diff_${unique}@example.com`,
          password: 'Password123!',
          fullName: 'Duplicate Username',
        }),
      });
      const data = await res.json();
      if (res.status !== 409 || data.success) {
        throw new Error(`Expected 409 Conflict, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 4: Invalid Email
    await assertTest('4. Register dengan format email tidak valid ditolak (400)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `val_${unique}`,
          email: 'not-an-email',
          password: 'Password123!',
          fullName: 'Invalid Email',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || data.success) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 5: Short Password
    await assertTest('5. Register dengan password terlalu pendek (< 8 karakter) ditolak (400)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `short_${unique}`,
          email: `short_${unique}@example.com`,
          password: 'short',
          fullName: 'Short Password',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || data.success) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 6: Login with Username
    await assertTest('6. Login menggunakan username berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testUser.username,
          password: testUser.password,
        }),
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.accessToken || !data.data.refreshToken) {
        throw new Error(`Expected 200 OK with tokens, got ${res.status}: ${JSON.stringify(data)}`);
      }
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
    });

    // TEST 7: Login with Email
    await assertTest('7. Login menggunakan email berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testUser.email,
          password: testUser.password,
        }),
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.accessToken) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 8: Login Wrong Password
    await assertTest('8. Login dengan password salah ditolak (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testUser.username,
          password: 'IncorrectPassword999!',
        }),
      });
      const data = await res.json();
      if (res.status !== 401 || data.success) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}: ${JSON.stringify(data)}`);
      }
      if (data.message !== 'Email/username atau password salah') {
        throw new Error(`Expected generic error message, got: ${data.message}`);
      }
    });

    // TEST 9: Login Inactive Account
    await assertTest('9. Login akun tidak aktif ditolak (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: inactiveUser.username,
          password: 'Password123!',
        }),
      });
      const data = await res.json();
      if (res.status !== 403 || data.success) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 10: Refresh Token Rotation
    await assertTest('10. Refresh token valid berhasil dengan token rotation (200)', async () => {
      rotatedOldRefreshToken = refreshToken;
      const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.accessToken || !data.data.refreshToken) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
    });

    // TEST 11: Rotated Old Token Rejected
    await assertTest('11. Refresh token lama setelah rotation ditolak (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rotatedOldRefreshToken }),
      });
      const data = await res.json();
      if (res.status !== 401 || data.success) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 12: Logout Success
    await assertTest('12. Logout berhasil mencabut sesi (200)', async () => {
      loggedOutAccessToken = accessToken;
      const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedOutAccessToken}`,
        },
      });
      const data = await res.json();
      if (res.status !== 200 || !data.success) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 13: Revoked Session Token Rejected
    await assertTest('13. Token yang sesinya sudah dicabut ditolak (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${loggedOutAccessToken}` },
      });
      const data = await res.json();
      if (res.status !== 401 || data.success) {
        throw new Error(`Expected 401 Unauthorized for revoked session, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // Re-login to get fresh token for Profile tests
    const reLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.username,
        password: testUser.password,
      }),
    });
    const reLoginData = await reLoginRes.json();
    accessToken = reLoginData.data.accessToken;

    // TEST 14: Get Profile with Valid Token
    await assertTest('14. Get profile dengan token valid berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.user.profile) {
        throw new Error(`Expected 200 OK with profile, got ${res.status}: ${JSON.stringify(data)}`);
      }
      if (data.data.user.passwordHash || data.data.user.password_hash) {
        throw new Error('passwordHash leaked in getProfile response!');
      }
    });

    // TEST 15: Get Profile without Token
    await assertTest('15. Get profile tanpa token ditolak (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'GET',
      });
      const data = await res.json();
      if (res.status !== 401 || data.success) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 16: Update Profile Success
    await assertTest('16. Update profile berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: 'Windar Wening Updated',
          phoneNumber: '081234567890',
          bio: 'Pengguna Pre-Loved Marketplace',
          address: 'Surakarta',
        }),
      });
      const data = await res.json();
      if (res.status !== 200 || data.data.profile.fullName !== 'Windar Wening Updated') {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 17: Update Profile Mass Assignment Rejected
    await assertTest('17. Update profile dengan mass assignment ditolak (400)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          role: 'ADMIN',
          userId: 'attempt-overwrite',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || data.success) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 18: Change Password with Wrong Old Password
    await assertTest('18. Change password dengan password lama salah ditolak (400)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'WrongOldPassword123!',
          newPassword: 'NewPassword123!',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || data.success) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 19: Change Password Success
    await assertTest('19. Change password dengan password lama benar berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/users/me/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: testUser.password,
          newPassword: 'BrandNewPassword123!',
        }),
      });
      const data = await res.json();
      if (res.status !== 200 || !data.success) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 20: Internal Endpoint Without Secret Rejected
    await assertTest('20. Internal endpoint tanpa shared secret ditolak (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/internal/users/${userId}`, {
        method: 'GET',
      });
      const data = await res.json();
      if (res.status !== 401 || data.success) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}: ${JSON.stringify(data)}`);
      }
    });

    // TEST 21: Internal Endpoint With Secret Success
    await assertTest('21. Internal endpoint dengan shared secret berhasil (200)', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/internal/users/${userId}`, {
        method: 'GET',
        headers: {
          'X-Internal-Secret': INTERNAL_SECRET,
        },
      });
      const data = await res.json();
      if (res.status !== 200 || !data.data.user.id) {
        throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(data)}`);
      }
      if (data.data.user.passwordHash || data.data.user.password_hash) {
        throw new Error('passwordHash leaked in internal response!');
      }
    });

    // TEST 22: Swagger UI Endpoint
    await assertTest('22. Swagger docs /api-docs dapat diakses', async () => {
      const res = await fetch(`${BASE_URL}/api-docs/`);
      if (res.status !== 200) {
        throw new Error(`Expected 200 OK for /api-docs/, got ${res.status}`);
      }
    });
  } finally {
    server!.close();
    await prisma.$disconnect();
  }

  console.log('\n=============================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`📊 Test Summary: ${passed}/${total} Passed, ${failed} Failed`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
