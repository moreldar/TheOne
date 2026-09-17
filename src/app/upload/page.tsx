import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div>
      <h1 className="mb-2 text-center text-2xl font-semibold">Upload a photo</h1>
      <p className="mb-8 text-center text-neutral-600">
        Choose a clear photo of the person you&apos;d like to turn into art.
      </p>
      <UploadForm />
    </div>
  );
}
