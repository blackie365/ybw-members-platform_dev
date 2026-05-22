import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f2]">
      <SignIn 
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        appearance={{
          variables: {
            colorPrimary: '#b79c65',
            fontFamily: 'var(--font-serif)',
          },
          elements: {
            card: 'shadow-none border-none bg-transparent',
            rootBox: 'shadow-none',
            headerTitle: 'font-serif text-2xl text-stone-900',
          }
        }}
      />
    </div>
  )
}
