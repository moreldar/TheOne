export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="mt-2 text-neutral-600">Your cart is still saved — no charge was made.</p>
      <a href="/cart" className="mt-6 inline-block underline">
        Back to cart
      </a>
    </div>
  );
}
