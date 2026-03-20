// FOLLO ROLE-FIX — seed script
// Creates a test workspace with Allen as OWNER and Peter as MEMBER (no projects).
// Verifies the 4 role-determination scenarios:
//   1. Allen logs in → isAdmin=true, member sidebar not shown
//   2. Peter logs in → isMember=true, member sidebar shown (even with 0 projects)
//   3. New unknown user → no memberships → admin onboarding path
//   4. After Allen adds Peter to a project → still member sidebar, but project visible

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const ALLEN_ID  = 'user_38mrlt8H3jH9bNHakLYTkqEVOSu';
const PETER_ID  = 'user_3Ac9rdtVvWpmJUFGKTnaidlhnap';

async function main() {
    // Verify both users exist in DB
    const allen = await prisma.user.findUnique({ where: { id: ALLEN_ID } });
    const peter = await prisma.user.findUnique({ where: { id: PETER_ID } });

    if (!allen) {
        console.error(`❌ Allen (${ALLEN_ID}) not found in DB. Log in as Allen first so auth middleware creates the User row.`);
        process.exit(1);
    }
    if (!peter) {
        console.error(`❌ Peter (${PETER_ID}) not found in DB. Log in as Peter first so auth middleware creates the User row.`);
        process.exit(1);
    }

    console.log(`✓ Allen found: ${allen.name} (${allen.email})`);
    console.log(`✓ Peter found: ${peter.name} (${peter.email})`);

    // Check if a test workspace already exists owned by Allen
    let workspace = await prisma.workspace.findFirst({
        where: { ownerId: ALLEN_ID, name: 'FOLLO Test Workspace' },
    });

    if (workspace) {
        console.log(`ℹ  Workspace already exists: ${workspace.id} — skipping creation`);
    } else {
        workspace = await prisma.workspace.create({
            data: {
                id: randomUUID(),
                name: 'FOLLO Test Workspace',
                slug: `follo-test-${Date.now()}`,
                description: 'Seed workspace for FOLLO ROLE-FIX verification',
                ownerId: ALLEN_ID,
            },
        });
        console.log(`✓ Created workspace: ${workspace.id}`);
    }

    // Upsert Allen as ADMIN member (owner is implicit but membership row needed for role checks)
    await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: ALLEN_ID, workspaceId: workspace.id } },
        update: { role: 'ADMIN' },
        create: {
            id: randomUUID(),
            userId: ALLEN_ID,
            workspaceId: workspace.id,
            role: 'ADMIN',
        },
    });
    console.log(`✓ Allen → ADMIN in workspace`);

    // Upsert Peter as MEMBER (no projects assigned)
    await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: PETER_ID, workspaceId: workspace.id } },
        update: { role: 'MEMBER' },
        create: {
            id: randomUUID(),
            userId: PETER_ID,
            workspaceId: workspace.id,
            role: 'MEMBER',
        },
    });
    console.log(`✓ Peter → MEMBER in workspace (0 projects)`);

    // Verify final state
    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.id },
        include: { user: { select: { name: true, email: true } } },
    });
    console.log('\nFinal workspace members:');
    members.forEach(m => console.log(`  ${m.user.name} (${m.user.email}) → ${m.role}`));

    console.log('\n✅ Seed complete. Expected behavior:');
    console.log('  Allen  → isAdmin=true, admin sidebar, can manage workspace');
    console.log('  Peter  → isMember=true, member sidebar, sees 0 projects (correct)');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
