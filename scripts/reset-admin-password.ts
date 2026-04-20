// Dev-Helper: Setzt das Passwort eines Users auf einen bekannten Wert.
// Nutzt Better-Auth's native scrypt-Hash.
// Usage: tsx scripts/reset-admin-password.ts <email> <new-password>

import { prisma } from "@play/db";
import { hashPassword } from "better-auth/crypto";

const email = process.argv[2];
const newPw = process.argv[3];
if (!email || !newPw) {
  console.error("Usage: tsx scripts/reset-admin-password.ts <email> <pw>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User ${email} nicht gefunden`);
    process.exit(1);
  }
  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!account) {
    console.error(`Kein credential-Account für ${email}`);
    process.exit(1);
  }
  const hash = await hashPassword(newPw);
  await prisma.account.update({
    where: { id: account.id },
    data: { password: hash },
  });
  console.log(`✓ Passwort für ${email} gesetzt.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
