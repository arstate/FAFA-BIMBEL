import React from 'react';

// --- BUTTON ---
interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const NeoButton: React.FC<NeoButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  ...props 
}) => {
  const baseStyle = "font-bold border-2 border-black transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
  
  const variants = {
    primary: "bg-blue-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-300",
    secondary: "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50",
    accent: "bg-yellow-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300",
    danger: "bg-red-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-500",
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-6 py-2 text-base",
    lg: "px-8 py-3 text-lg",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- INPUT ---
interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const NeoInput: React.FC<NeoInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="font-bold text-sm uppercase tracking-wider">{label}</label>}
      <input 
        className={`border-2 border-black p-3 font-medium outline-none focus:ring-4 focus:ring-yellow-400/50 shadow-[4px_4px_0px_0px_#000000] transition-all focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[2px_2px_0px_0px_#000000] ${className}`}
        {...props}
      />
    </div>
  );
};

// --- TEXTAREA ---
interface NeoTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const NeoTextArea: React.FC<NeoTextAreaProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="font-bold text-sm uppercase tracking-wider">{label}</label>}
      <textarea 
        className={`border-2 border-black p-3 font-medium outline-none focus:ring-4 focus:ring-yellow-400/50 shadow-[4px_4px_0px_0px_#000000] transition-all focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[2px_2px_0px_0px_#000000] ${className}`}
        {...props}
      />
    </div>
  );
};

// --- CARD ---
interface NeoCardProps {
  children: React.ReactNode;
  title?: string;
  color?: 'white' | 'yellow' | 'pink' | 'green' | 'blue';
  className?: string;
}

export const NeoCard: React.FC<NeoCardProps> = ({ 
  children, 
  title, 
  color = 'white',
  className = '' 
}) => {
  const colors = {
    white: "bg-white",
    yellow: "bg-yellow-300",
    pink: "bg-pink-300",
    green: "bg-emerald-300",
    blue: "bg-sky-300"
  };

  return (
    <div className={`border-2 border-black ${colors[color]} p-6 shadow-[6px_6px_0px_0px_#000000] ${className}`}>
      {title && (
        <h2 className="text-2xl font-black mb-4 uppercase border-b-2 border-black pb-2">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
};

// --- BADGE ---
export const NeoBadge: React.FC<{children: React.ReactNode, color?: string}> = ({children, color = "bg-purple-300"}) => (
  <span className={`${color} px-2 py-1 text-xs font-bold border border-black shadow-[2px_2px_0px_0px_#000] inline-block mr-2`}>
    {children}
  </span>
);