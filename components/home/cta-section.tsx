import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl bg-accent/10 border border-accent/20 p-12 text-center">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,255,180,0.15),transparent_70%)]" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-balance">
              Ready to streamline your expense reporting?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of professionals who have saved countless hours
              with ExpenseLit
            </p>
            <Button size="lg" className="gap-2 text-base" asChild>
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
