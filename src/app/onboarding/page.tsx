import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PublicProviders } from "@/components/providers";
import { ProfileSetup } from "@/components/auth/profile-setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <PublicProviders>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6">
        <ProfileSetup
          initial={{
            name: user.name,
            username: user.username,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            accent: user.accent,
            profilePrivacy: user.profilePrivacy,
            messagePermission: user.messagePermission,
          }}
        />
      </div>
    </PublicProviders>
  );
}
