import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { restaurantJsonLd } from "@/lib/seo/structured-data";

/** Portada permanente, independiente del AppShell comercial. */
export default function LandingPage() {
  return (
    <>
      <JsonLd data={restaurantJsonLd()} />
      <OnboardingScreen />
    </>
  );
}
