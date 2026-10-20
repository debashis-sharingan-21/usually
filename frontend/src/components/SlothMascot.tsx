import React from 'react';

export type SlothSize = 'sm' | 'md' | 'lg' | 'xl' | number;
export type SlothMood = 'calm' | 'thinking' | 'witty' | 'peaceful' | 'sleeping' | 'celebrating' | 'contemplating';

interface SlothMascotProps {
  size?: SlothSize;
  mood?: SlothMood;
  variant?: SlothMood;
  className?: string;
}

export const SlothMascot: React.FC<SlothMascotProps> = ({
  size = 'md',
  mood,
  variant = 'calm',
  className = '',
}) => {
  const activeMood = mood || variant;

  const sizeClass = typeof size === 'string' ? {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size] : '';

  const sizeStyle = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div
      style={sizeStyle}
      className={`inline-flex items-center justify-center relative shrink-0 ${sizeClass} ${className}`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Soft paper backdrop circle */}
        <circle cx="24" cy="24" r="23" fill="#EEEBDD" stroke="#DFD9CA" strokeWidth="1.5" />

        {/* Sloth head contour */}
        <ellipse cx="24" cy="24" rx="14.5" ry="13" fill="#D6CEBE" />

        {/* Lighter face mask */}
        <ellipse cx="24" cy="25" rx="11.5" ry="9.5" fill="#FCFBF7" />

        {/* Distinctive sloth eye patches */}
        <ellipse cx="18" cy="23.5" rx="4.5" ry="3.2" transform="rotate(-15 18 23.5)" fill="#365844" fillOpacity="0.85" />
        <ellipse cx="30" cy="23.5" rx="4.5" ry="3.2" transform="rotate(15 30 23.5)" fill="#365844" fillOpacity="0.85" />

        {/* Eyes based on mood */}
        {activeMood === 'witty' || activeMood === 'celebrating' ? (
          <>
            {/* Playful winking eye */}
            <path d="M16 23.5 Q18 21.5 20 23.5" stroke="#FCFBF7" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="30" cy="23.5" r="1.3" fill="#FCFBF7" />
          </>
        ) : (
          <>
            {/* Calm curved sleepy eyelids */}
            <path d="M16 23.5 Q18 22 20 23.5" stroke="#FCFBF7" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M28 23.5 Q30 22 32 23.5" stroke="#FCFBF7" strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}

        {/* Small round dark nose */}
        <ellipse cx="24" cy="27" rx="2.4" ry="1.7" fill="#292D29" />

        {/* Contented subtle smile */}
        <path d="M21.5 30 Q24 32 26.5 30" stroke="#292D29" strokeWidth="1.3" strokeLinecap="round" fill="none" />

        {/* Thinking or resting leaf accent */}
        {(activeMood === 'thinking' || activeMood === 'contemplating') && (
          <path
            d="M36 12 C34 16 38 18 36 21 C33 19 32 15 36 12 Z"
            fill="#9CAF88"
            stroke="#365844"
            strokeWidth="0.8"
          />
        )}

        {/* Celebrating small star / sparkle accent */}
        {activeMood === 'celebrating' && (
          <path
            d="M36 10 L37.5 14 L41.5 15.5 L37.5 17 L36 21 L34.5 17 L30.5 15.5 L34.5 14 Z"
            fill="#E8C95D"
            stroke="#365844"
            strokeWidth="0.5"
          />
        )}
      </svg>
    </div>
  );
};
