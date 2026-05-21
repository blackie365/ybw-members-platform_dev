'use client'

import React, { useState, Suspense } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function ForgotPasswordForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [successfulCreation, setSuccessfulCreation] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!isLoaded) return null

  // Send the password reset code to the user's email
  async function create(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      await signIn?.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      })
      setSuccessfulCreation(true)
    } catch (err: any) {
      console.error('error', err.errors?.[0]?.longMessage || err.message)
      setError(err.errors?.[0]?.longMessage || 'Something went wrong. Please check your email and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Reset the user's password.
  async function reset(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      })

      if (result?.status === 'complete') {
        await setActive({
          session: result.createdSessionId,
        })
        router.push('/dashboard')
      } else {
        console.log(result)
        setError('Verification failed. Please check the code and try again.')
      }
    } catch (err: any) {
      console.error('error', err.errors?.[0]?.longMessage || err.message)
      setError(err.errors?.[0]?.longMessage || 'Invalid code or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md bg-card rounded-2xl overflow-hidden shadow-xl border border-border p-8 flex-col">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-stone-900 font-medium tracking-tight mb-2">
            {successfulCreation ? 'Set new password' : 'Forgot password?'}
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed">
            {successfulCreation 
              ? 'Please enter the verification code sent to your email and your new password.' 
              : 'Enter your email address and we will send you a code to reset your password.'}
          </p>
        </div>

        <form onSubmit={!successfulCreation ? create : reset} className="space-y-6">
          {!successfulCreation ? (
            <div>
              <label htmlFor="email" className="text-stone-900 font-semibold text-sm block mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border-stone-200 text-stone-900 rounded-none h-12 px-4 focus:ring-2 focus:ring-[#b79c65]/20 focus:border-[#b79c65] transition-all border outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="code" className="text-stone-900 font-semibold text-sm block mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full bg-white border-stone-200 text-stone-900 rounded-none h-12 px-4 focus:ring-2 focus:ring-[#b79c65]/20 focus:border-[#b79c65] transition-all border outline-none"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-stone-900 font-semibold text-sm block mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white border-stone-200 text-stone-900 rounded-none h-12 px-4 focus:ring-2 focus:ring-[#b79c65]/20 focus:border-[#b79c65] transition-all border outline-none"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-none font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1c1917] hover:bg-[#292524] text-white text-sm font-semibold h-12 px-4 py-2 rounded-none transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : (successfulCreation ? 'Reset Password' : 'Send Reset Code')}
          </button>

          <div className="text-center pt-2">
            <Link 
              href="/login" 
              className="text-[#b79c65] hover:text-[#a08b57] font-bold text-sm transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
