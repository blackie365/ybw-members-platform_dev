import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2]">
      <SignUp 
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        appearance={{
          variables: {
            colorPrimary: '#b79c65',
            fontFamily: 'var(--font-serif)',
          },
          elements: {
            card: 'shadow-none border-none bg-transparent',
            rootBox: 'shadow-none',
          }
        }}
      />
    </div>
  )
}
