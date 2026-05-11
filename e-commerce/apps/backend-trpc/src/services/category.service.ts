import { getCached } from "@ecommerce/shared";
import { prisma }   from "../config/database";
import { AppError } from "../middlewares/error.middleware";

const CATEGORY_SELECT = {
  id:          true,
  name:        true,
  slug:        true,
  description: true,
  _count:      { select: { products: { where: { isActive: true } } } },
} as const;

export async function getAll() {
  return getCached("categories:all", 600, () =>
    prisma.category.findMany({
      select:  CATEGORY_SELECT,
      orderBy: { name: "asc" },
    })
  );
}

export async function getBySlug(slug: string) {
  return getCached(`categories:slug:${slug}`, 600, async () => {
    const category = await prisma.category.findUnique({
      where:  { slug },
      select: CATEGORY_SELECT,
    });
    if (!category) throw new AppError("Kategori tidak ditemukan.", 404);
    return category;
  });
}