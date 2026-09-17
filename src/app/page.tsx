import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Turn their favorite photo into a gift they&apos;ll keep forever
      </h1>
      <p className="max-w-xl text-neutral-600">
        Upload a photo, pick an art style, preview an AI-illustrated portrait
        instantly, then order it printed on canvas or a mug — shipped
        straight to you or as a gift.
      </p>
      <Link
        href="/upload"
        className="rounded-full bg-neutral-900 px-8 py-3 font-medium text-white transition hover:bg-neutral-700"
      >
        Start with a photo
      </Link>
    </div>
  );
}
