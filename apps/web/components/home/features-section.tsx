import { Card } from "@/components/ui/card"
import { Upload, Brain, FileSpreadsheet, Zap, Lock, Users } from "lucide-react"

const features = [
  {
    icon: Upload,
    title: "Bulk Upload",
    description: "Upload multiple receipts at once. Supports images, PDFs, and scanned documents.",
  },
  {
    icon: Brain,
    title: "AI Extraction",
    description: "Advanced AI automatically extracts vendor, date, amount, category, and custom fields.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export Anywhere",
    description: "Generate reports in CSV, Excel, or PDF format. Integrate with your accounting software.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Process hundreds of receipts in minutes. No more tedious manual data entry.",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    description: "Enterprise-grade security. Your data is encrypted and never shared with third parties.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Invite team members, assign roles, and manage expense workflows together.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-balance">Everything you need to manage expenses</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features that save you time and eliminate manual work
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6 bg-card hover:bg-card/80 transition-colors border-border">
              <feature.icon className="h-10 w-10 mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
