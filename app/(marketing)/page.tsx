import { Contact } from "@/components/marketing/contact";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Packages } from "@/components/marketing/packages";
import { Process } from "@/components/marketing/process";
import { Services } from "@/components/marketing/services";

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Services />
      <Packages />
      <Process />
      <Faq />
      <Contact />
    </>
  );
}