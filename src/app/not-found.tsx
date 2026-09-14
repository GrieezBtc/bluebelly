import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="card card-pad w-full max-w-sm text-center">
        <div className="flex justify-center pb-4">
          <BrandMark size={36} />
        </div>
        <span className="empty-state__icon mx-auto">
          <Icon name="search" size={26} />
        </span>
        <h1 className="h1 pt-3">We cannot find that page</h1>
        <p className="body-sm pt-1">The link may be old, or the Moment was deleted by its author.</p>
        <Link href="/home" className="btn btn-primary btn-block mt-5">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
