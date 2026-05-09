declare const prisma: { account: { findMany: (a: unknown) => Promise<unknown> } };
declare const ctx: { userId: string };
export async function listAccounts() {
  return prisma.account.findMany({ where: { userId: ctx.userId } });
}
