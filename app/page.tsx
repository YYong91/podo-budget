import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { MessengerSection } from "@/components/landing/messenger-section"
import { SharedSection } from "@/components/landing/shared-section"
import { InsightsSection } from "@/components/landing/insights-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { CTAFooter } from "@/components/landing/cta-footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <HeroSection />
      <MessengerSection />
      <SharedSection />
      <InsightsSection />
      <FeaturesSection />
      <CTAFooter />
    </main>
  )
}
