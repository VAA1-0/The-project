interface GameRunLogoProps {
  size?: "sm" | "md" | "lg";
}

export function GameRunLogo({ size = "md" }: GameRunLogoProps) {
  const textSizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const iconSizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="flex items-center">
      <div className="relative">
        {/* Main GameRun text with gradient */}
        <span
          className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent tracking-tight`}
        >
          VAA1-
        </span>
        <span
          className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent tracking-tight`}
        >
          Video
        </span>
      </div>
    </div>
  );
}
