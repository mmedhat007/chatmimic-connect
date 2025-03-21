import React from 'react';

interface LifecycleIconProps {
  size?: number;
  color?: string;
  className?: string;
}

const LifecycleIcon: React.FC<LifecycleIconProps> = ({ 
  size = 24, 
  color = 'currentColor',
  className = "" 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
      style={color !== 'currentColor' ? { stroke: color } : undefined}
    >
      {/* Lifecycle stages representation */}
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <path d="M12 12L6 6" />
      <path d="M12 12l4 2" />
    </svg>
  );
};

export default LifecycleIcon; 