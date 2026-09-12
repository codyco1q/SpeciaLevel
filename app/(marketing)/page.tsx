import { Contact } from "@/components/marketing/contact";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { Packages } from "@/components/marketing/packages";
import { Process } from "@/components/marketing/process";
import { Services } from "@/components/marketing/services";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function MarketingPage() {
  const dict = await getDictionary();

  return (
    <>
      <Hero dict={dict.hero} />
      <Services dict={dict.services} />
      <Packages dict={dict.packages} />
      <Process dict={dict.process} />
      <Faq dict={dict.faq} />
      <Contact dict={dict.contact} />
    </>
  );
}