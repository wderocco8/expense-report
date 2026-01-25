import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,255,180,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(120,200,255,0.05),transparent_50%)]" />

      <div className="container mx-auto max-w-5xl text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-sm rounded-full bg-accent/20 text-accent border border-accent/30">
          <Sparkles className="h-3 w-3" />
          <span>Powered by OpenAI</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
          Transform receipts into reports in{" "}
          <span className="text-accent">seconds</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload your receipts, let AI extract all the data, and generate
          professional expense reports. No more manual data entry. Ever.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="gap-2 text-base" asChild>
            <Link href="/sign-up">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base bg-transparent"
            asChild
          >
            <Link href="#demo">Watch Demo</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
          <div>
            <div className="text-3xl md:text-4xl font-bold mb-2">98%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold mb-2">10x</div>
            <div className="text-sm text-muted-foreground">Faster</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold mb-2">$50k+</div>
            <div className="text-sm text-muted-foreground">Time Saved</div>
          </div>
        </div>
      </div>
    </section>
  );
}
