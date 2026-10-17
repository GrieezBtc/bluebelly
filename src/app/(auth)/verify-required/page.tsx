import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";

export const metadata = { title: "Verify your email" };

export default function VerifyRequiredPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center pb-2">
        <BrandMark size={64} />
      </div>

      <div className="text-center">
        <h1 className="h1">Verify your email to continue</h1>
        <p className="body-sm pt-2">
          Your Bemblo account has been created, but you need to verify your email
          address before you can enter Bemblo.
        </p>
      </div>

      <div className="card card-pad">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="mail" size={20} />
          </span>
          <div>
            <p className="font-semibold">Check your inbox</p>
            <p className="body-sm pt-1">
              We sent a verification link to the email address you used to create
              your account. Check your spam or junk folder if you do not see it.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link href="/login" className="btn btn-primary btn-lg btn-block">
          I verified my email — log in
        </Link>
        <Link href="/support" className="btn btn-secondary btn-block">
          I didn&apos;t receive the email
        </Link>
      </div>

      <p className="caption text-center">
        You must verify the email address before accessing your Bemblo account.
      </p>
    </div>
  );
}
