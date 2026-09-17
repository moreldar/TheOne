import { CartClient } from "@/components/CartClient";

export default function CartPage() {
  return (
    <div>
      <h1 className="mb-8 text-center text-2xl font-semibold">Your cart</h1>
      <CartClient />
    </div>
  );
}
