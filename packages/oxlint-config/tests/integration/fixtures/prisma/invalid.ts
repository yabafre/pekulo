declare const prisma: { account: { findMany: (a: unknown) => Promise<unknown> } };
export async function listAccountsBad() {
  return prisma.account.findMany({ where: { foo: 1 } });
}
