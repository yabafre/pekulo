"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, LayoutDashboard, Settings, Calendar, Wallet, PiggyBank, Home } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Nav({ email }: { email?: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Plan Financier</span>
        </Link>
        <div className="flex items-center gap-3">
          {email && (
            <>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
              >
                <Home className="h-4 w-4 mr-1" /> Accueil
              </Link>
              <Link
                href="/dashboard/mensuel"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
              >
                <Calendar className="h-4 w-4 mr-1" /> Mensuel
              </Link>
              <Link
                href="/dashboard/transactions"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
              >
                <Wallet className="h-4 w-4 mr-1" /> Transactions
              </Link>
              <Link
                href="/dashboard/portefeuille"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
              >
                <PiggyBank className="h-4 w-4 mr-1" /> Portefeuille
              </Link>
              <Link
                href="/dashboard/parametres"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
              >
                <Settings className="h-4 w-4 mr-1" /> Paramètres
              </Link>
            </>
          )}
          <ThemeToggle />
          {email && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{email.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1" /> Déco
          </Button>
        </div>
      </div>
    </header>
  )
}
