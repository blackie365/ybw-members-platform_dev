import clsx from 'clsx';

export function Logo({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  // If no className is passed, give it a default height so it doesn't collapse
  const containerClass = className || "h-8";
  
  return (
    <div className={clsx("relative flex items-center", containerClass)} {...props}>
      {/* Light mode logo (Dark text, for light backgrounds) */}
      <img
        src="https://yorkshirebusinesswoman.co.uk/content/images/2024/04/Asset-1@4x.png"
        alt="Yorkshire Businesswoman"
        className="block dark:hidden h-full w-auto object-contain"
      />
      {/* Dark mode logo (White text, for dark backgrounds) */}
      <img
        src="https://yorkshirebusinesswoman.co.uk/content/images/2026/03/Asset-9@3x-2.png"
        alt="Yorkshire Businesswoman"
        className="hidden dark:block h-full w-auto object-contain"
      />
    </div>
  )
}
