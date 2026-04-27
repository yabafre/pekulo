"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else {
        setSuccess("Compte créé. Vérifie tes emails pour confirmer.")
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message)
      else {
        router.push("/dashboard")
        router.refresh()
        return
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Plan Financier</CardTitle>
          <CardDescription>{mode === "login" ? "Connecte-toi à ton dashboard" : "Crée ton compte"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.fr" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-muted-foreground">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer un compte"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Pas de compte ? <Link href="/auth/signup" className="text-primary hover:underline">S'inscrire</Link></>
            ) : (
              <>Déjà un compte ? <Link href="/auth/login" className="text-primary hover:underline">Se connecter</Link></>
            )}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
