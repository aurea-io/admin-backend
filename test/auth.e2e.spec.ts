import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PlatformRole } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('Auth Endpoints (E2E / HTTP Integration)', () => {
  let app: INestApplication;
  let mockPrisma: any;

  const testPassword = 'SecurePassword123!';
  let passwordHash: string;

  const mockOwner = {
    id: '65f1a2b3c4d5e6f7a8b9c001',
    email: 'owner@aurea.io',
    name: 'Platform Owner',
    passwordHash: '',
    googleId: null,
    role: PlatformRole.platform_owner,
    allowedFeatures: [],
    isActive: true,
    tokenVersion: 1,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    passwordHash = await bcrypt.hash(testPassword, 10);
    mockOwner.passwordHash = passwordHash;

    mockPrisma = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      platformUser: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.email === 'owner@aurea.io' || where.id === mockOwner.id) {
            return Promise.resolve({ ...mockOwner });
          }
          if (where.googleId === 'google-id-123') {
            return Promise.resolve({ ...mockOwner, googleId: 'google-id-123' });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          if (data.tokenVersion?.increment) {
            mockOwner.tokenVersion += data.tokenVersion.increment;
          } else if (typeof data.tokenVersion === 'number') {
            mockOwner.tokenVersion = data.tokenVersion;
          }
          if (data.googleId) {
            mockOwner.googleId = data.googleId;
          }
          if (data.passwordHash) {
            mockOwner.passwordHash = data.passwordHash;
          }
          return Promise.resolve({ ...mockOwner });
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login - should log in with valid credentials and return JWT with scope platform', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@aurea.io',
        password: testPassword,
      })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('owner@aurea.io');
    expect(res.body.user.role).toBe(PlatformRole.platform_owner);
  });

  it('POST /api/v1/auth/login - should return 401 on wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@aurea.io',
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('POST /api/v1/auth/google - should login / link googleId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        googleId: 'google-id-123',
        email: 'owner@aurea.io',
        name: 'Platform Owner',
      })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('owner@aurea.io');
  });

  it('GET /api/v1/auth/me - should reject unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('GET /api/v1/auth/me - should return user profile with valid Bearer token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@aurea.io',
        password: testPassword,
      });

    const token = loginRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.email).toBe('owner@aurea.io');
    expect(meRes.body.role).toBe(PlatformRole.platform_owner);
    expect(meRes.body.tokenVersion).toBe(1);
  });

  it('POST /api/v1/auth/change-password - should change password and invalidate previous token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@aurea.io',
        password: testPassword,
      });

    const initialToken = loginRes.body.accessToken;

    const changeRes = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${initialToken}`)
      .send({
        currentPassword: testPassword,
        newPassword: 'SuperNewPassword999!',
      })
      .expect(200);

    expect(changeRes.body.tokenVersion).toBe(2);
    expect(changeRes.body).toHaveProperty('accessToken');

    // The initial token should now be rejected (tokenVersion mismatch)
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${initialToken}`)
      .expect(401);

    // The newly returned token should work
    const newMeRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${changeRes.body.accessToken}`)
      .expect(200);

    expect(newMeRes.body.tokenVersion).toBe(2);
  });
});
