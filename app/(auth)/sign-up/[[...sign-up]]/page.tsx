import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/dashboard"
      appearance={{ elements: { rootBox: "clerk-root", cardBox: "clerk-card-box" } }}
    />
  );
}
