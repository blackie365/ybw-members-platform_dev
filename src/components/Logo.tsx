import Image from 'next/image';
import clsx from 'clsx';

export function Logo({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  // If no className is passed, give it a default height so it doesn't collapse
  const containerClass = className || "h-8";
  
  return (
    <div className={clsx("relative flex items-center", containerClass)} {...props}>
      {/* Light mode logo */}
      <img
        src="/images/logo-light.png"
        alt="Yorkshire Businesswoman"
        className="block dark:hidden h-full w-auto object-contain"
      />
      {/* Dark mode logo */}
      <img
        src="/images/logo-dark.png"
        alt="Yorkshire Businesswoman"
        className="hidden dark:block h-full w-auto object-contain"
      />
    </div>
  )
}
