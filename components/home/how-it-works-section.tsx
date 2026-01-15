import { Card } from "@/components/ui/card"

const steps = [
  {
    number: "01",
    title: "Upload Your Receipts",
    description: "Drag and drop or select multiple receipt images. We support all common formats.",
  },
  {
    number: "02",
    title: "AI Extracts Data",
    description: "Our AI automatically reads and extracts all relevant information from each receipt.",
  },
  {
    number: "03",
    title: "Review & Customize",
    description: "Verify extracted data and customize fields to match your reporting requirements.",
  },
  {
    number: "04",
    title: "Export Your Report",
    description: "Generate and download your expense report in your preferred format instantly.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-balance">Simple process, powerful results</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">From receipt to report in four easy steps</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <Card key={step.number} className="p-6 bg-card border-border relative">
              <div className="text-5xl font-bold text-accent/20 mb-4">{step.number}</div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-[2px] bg-border" />
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
