import clsx from 'clsx';

export function Logo({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  // If no className is passed, give it a default height so it doesn't collapse
  const containerClass = className || "h-8";
  
  return (
    <div className={clsx("relative flex items-center", containerClass)} {...props}>
      {/* Single logo used for both light and dark backgrounds */}
      <img
        src="/images/logo-dark.png"
        alt="Yorkshire Businesswoman"
        className="block h-full w-auto object-contain"
      />
    </div>
  )
}
