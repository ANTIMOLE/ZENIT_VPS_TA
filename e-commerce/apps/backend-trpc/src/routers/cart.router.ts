import { z }                  from "zod";
import { router, protectedProcedure } from "../trpc/init";
import { serviceCall }        from "../trpc/errors";
import { addCartItemSchema }  from "@ecommerce/shared";
import * as cartService       from "../services/cart.service";

// ============================================================
// CART ROUTER — tRPC
//
// FIX #17: cart mutations (addItem, updateItem, removeItem) sebelumnya
// membuang return value dari service lalu memanggil getCartByUserId() ekstra.
//
// Alur LAMA (buang + panggil ekstra):
//   await serviceCall(() => cartService.addItemToCart(...));   ? return DIBUANG
//   return serviceCall(() => cartService.getCartByUserId(...)); ? extra heavy call
//
// Masalahnya:
//   - addItemToCart() sudah memanggil fetchFreshCart() di akhir dan return cart.
//   - getCartByUserId() adalah versi BERAT dengan rekonsiliasi stok + harga.
//   - Artinya setiap cart mutation di tRPC = 1 mutation + 1 heavy reconciliation read.
//   - REST hanya = 1 mutation (yang sudah include lean fetchFreshCart di dalamnya).
//   - Ini membiaskan benchmark S-02 dan S-03: tRPC tampak lebih lambat bukan karena
//     overhead protokol, tapi karena extra work yang tidak dilakukan REST.
//
// Alur BARU (langsung return dari service):
//   return serviceCall(() => cartService.addItemToCart(...)); ? return langsung
//   ? addItemToCart sudah return fetchFreshCart() (lean read) di dalamnya.
//
// Behavior dari sisi client identik: tetap dapat cart terbaru setelah mutasi.
// ============================================================

export const cartRouter = router({

  // -- cart.get ----------------------------------------------
  // REST: GET /cart
  // Memanggil getCartByUserId() yang include rekonsiliasi stok + harga.
  // Tidak berubah — ini memang GET endpoint, rekonsiliasi tepat di sini.
  get: protectedProcedure.query(async ({ ctx }) => {
    return serviceCall(() => cartService.getCartByUserId(ctx.userId!));
  }),

  // -- cart.addItem ------------------------------------------
  // REST: POST /cart  body: { productId, quantity }
  // FIX #17: langsung return dari addItemToCart — tidak perlu extra getCartByUserId.
  addItem: protectedProcedure
    .input(addCartItemSchema)
    .mutation(async ({ input, ctx }) => {
      return serviceCall(() =>
        cartService.addItemToCart(ctx.userId!, input.productId, input.quantity)
      );
    }),

  // -- cart.updateItem ---------------------------------------
  // REST: PATCH /cart/:itemId  body: { quantity }
  // FIX #17: langsung return dari updateCartItem.
  updateItem: protectedProcedure
    .input(
      z.object({
        itemId:   z.string().uuid(),
        quantity: z.number().int().min(1, "Quantity minimal 1").max(99),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return serviceCall(() =>
        cartService.updateCartItem(ctx.userId!, input.itemId, input.quantity)
      );
    }),

  // -- cart.removeItem ---------------------------------------
  // REST: DELETE /cart/:itemId
  // FIX #17: langsung return dari removeCartItem.
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return serviceCall(() =>
        cartService.removeCartItem(ctx.userId!, input.itemId)
      );
    }),

  // -- cart.clear --------------------------------------------
  // REST: DELETE /cart
  // Tidak berubah — clearCart return { success: true }, bukan cart.
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await serviceCall(() => cartService.clearCart(ctx.userId!));
    return { success: true };
  }),
});