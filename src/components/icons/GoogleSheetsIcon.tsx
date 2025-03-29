import React from 'react';

// Google Sheets Icon component with updated design
const GoogleSheetsIcon: React.FC<{ size?: number, className?: string }> = ({ 
  size = 24, 
  className = "" 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0,0,256,256" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fillRule="nonzero"
    >
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10" strokeDasharray="" strokeDashoffset="0" fontFamily="none" fontWeight="none" fontSize="none" textAnchor="none" style={{ mixBlendMode: "normal" }}>
        <g transform="scale(5.33333,5.33333)">
          <path d="M37,45h-26c-1.657,0 -3,-1.343 -3,-3v-36c0,-1.657 1.343,-3 3,-3h19l10,10v29c0,1.657 -1.343,3 -3,3z" fill="#ffffff"></path>
          <path d="M40,13h-10v-10z" fill="#eef2ff"></path>
          <path d="M30,13l10,10v-10z" fill="#3490de"></path>
          <path d="M31,23h-14h-2v2v2v2v2v2v2v2h18v-2v-2v-2v-2v-2v-2v-2zM17,25h4v2h-4zM17,29h4v2h-4zM17,33h4v2h-4zM31,35h-8v-2h8zM31,31h-8v-2h8zM31,27h-8v-2h8z" fill="#3490de"></path>
        </g>
      </g>
    </svg>
  );
};

export default GoogleSheetsIcon; 