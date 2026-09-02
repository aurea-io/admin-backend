import { PrismaClient, PlatformRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const rawEmail = process.env.PLATFORM_OWNER_EMAIL;
  const rawPassword = process.env.PLATFORM_OWNER_PASSWORD;
  const name = process.env.PLATFORM_OWNER_NAME?.trim() || 'Platform Owner';

  if (!rawEmail || !rawPassword) {
    console.error(
      '\n[Seed Error] Missing required environment variables:\n' +
      '  - PLATFORM_OWNER_EMAIL\n' +
      '  - PLATFORM_OWNER_PASSWORD\n\n' +
      'Please define them in your environment or .env file before running seed.\n'
    );
    process.exit(1);
  }

  const email = rawEmail.toLowerCase().trim();
  const password = rawPassword.trim();

  console.log(`[Seed] Provisioning initial platform owner (${email})...`);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.platformUser.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: PlatformRole.platform_owner,
      isActive: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role: PlatformRole.platform_owner,
      allowedFeatures: [],
      isActive: true,
      tokenVersion: 1,
    },
  });

  console.log(`[Seed] Platform owner ready with ID: ${user.id} (${user.email}, role: ${user.role})`);
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
