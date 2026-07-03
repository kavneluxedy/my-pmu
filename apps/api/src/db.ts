import { PrismaClient } from "@prisma/client";

/** Client Prisma unique, partagé par toutes les routes. */
export const prisma = new PrismaClient();
