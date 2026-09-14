import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";

export const metadata = { title: "You are offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="card card-pad w-full max-w-sm text-center">
        <div className="flex justify-center pb-4">
          <BrandMark size={40} />
        </div>
        <span className="empty-state__icon mx-auto">
          <Icon name="offline" size={26} />
        </span>
        <h1 className="h1 pt-3">No connection</h1>
        <p className="body-sm pt-1">
          Bemblo needs a connection for messages and Moments. We will load everything as soon as you are back online — nothing is
          lost.
        </p>
        <Link href="/home" className="btn btn-primary btn-block mt-5">
          <Icon name="refresh" size={18} /> Try again
        </Link>
      </div>
    </main>
  );
}
