'use client'

import { motion } from 'framer-motion'
import { Header } from "@/components/magazine/header"
import { Footer } from "@/components/magazine/footer"
import { NewsletterSection } from "@/components/magazine/newsletter-section"
import { 
  Users, 
  Award, 
  Sparkles, 
  Target, 
  Heart, 
  Compass 
} from 'lucide-react'

const values = [
  {
    icon: Users,
    title: 'Community',
    description: 'Fostering a supportive network where businesswomen can connect and grow together.',
  },
  {
    icon: Target,
    title: 'Ambition',
    description: 'Empowering women to reach their full potential and achieve their professional goals.',
  },
  {
    icon: Award,
    title: 'Excellence',
    description: 'Celebrating outstanding achievements and raising the profile of women in business.',
  },
  {
    icon: Compass,
    title: 'Support',
    description: 'Providing the tools, resources, and mentorship needed for business success.',
  },
]

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 bg-primary text-primary-foreground overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
          </div>
          
          <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent mb-6">Our Story</p>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight mb-8">
                Empowering <span className="italic text-accent">Yorkshire&apos;s</span><br />
                Businesswomen
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/70 max-w-3xl mx-auto leading-relaxed">
                Yorkshire Businesswoman is more than just a network. We are a community dedicated to supporting, 
                celebrating, and elevating women in business across the region.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="font-serif text-4xl md:text-5xl font-medium mb-8">
                  Our <span className="italic text-accent">Vision</span>
                </h2>
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    Founded with a passion for Yorkshire and its incredible business talent, 
                    Yorkshire Businesswoman has grown into the region&apos;s premier platform for 
                    female leaders, entrepreneurs, and professionals.
                  </p>
                  <p>
                    We believe that when women support each other, incredible things happen. 
                    Our mission is to provide the connections, recognition, and resources 
                    that enable every member to thrive in their chosen field.
                  </p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="absolute inset-0 bg-accent/10 mix-blend-multiply" />
                <img 
                  src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80" 
                  alt="Yorkshire Businesswoman Community"
                  className="object-cover w-full h-full"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 md:py-32 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl md:text-5xl font-medium">
                Our Core <span className="italic text-accent">Values</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-8 hover:border-accent/50 transition-all duration-300"
                >
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                    <value.icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-serif text-xl font-medium mb-3">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Magazine & Community Split */}
        <section className="py-24 md:py-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="order-2 lg:order-1"
              >
                <h2 className="font-serif text-4xl md:text-5xl font-medium mb-8">
                  The <span className="italic text-accent">Magazine</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  Our digital magazine is the heartbeat of the community, sharing stories of success, 
                  offering expert advice, and keeping you informed about the latest trends in leadership, 
                  finance, and lifestyle across Yorkshire.
                </p>
                <div className="flex items-center gap-4 text-accent font-medium">
                  <Heart className="h-5 w-5" />
                  <span>Written for businesswomen, by businesswomen.</span>
                </div>
              </motion.div>
              
              <div className="order-1 lg:order-2 grid grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-4"
                >
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80" className="object-cover w-full h-full" alt="Leadership" />
                  </div>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-accent/20" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-4 pt-12"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden bg-primary/10" />
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80" className="object-cover w-full h-full" alt="Networking" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <NewsletterSection />
      </main>

      <Footer />
    </div>
  )
}

