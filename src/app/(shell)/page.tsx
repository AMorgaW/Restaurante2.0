import { HomeScreen } from "@/components/menu/home-screen";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategoriesInUse, getFeaturedItems, menuItems } from "@/data/menu";
import { restaurantJsonLd } from "@/lib/seo/structured-data";

export default function HomePage() {
  const categories = getCategoriesInUse();
  const featured = getFeaturedItems();
  const onboardingItem = featured[0] ?? menuItems[0];

  return (
    <>
      <JsonLd data={restaurantJsonLd()} />
      {onboardingItem ? (
        <OnboardingGate
          image={onboardingItem.image}
          imageAlt={`Fotografía de ${onboardingItem.fullName}`}
          dishSlug={onboardingItem.slug}
        />
      ) : null}
      <HomeScreen items={menuItems} categories={categories} />
    </>
  );
}
