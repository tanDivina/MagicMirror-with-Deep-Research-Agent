import React from 'react';

const KineticMarquee: React.FC = () => {
  return (
    <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 z-0 pointer-events-none select-none overflow-hidden rotate-[-5deg] scale-110 opacity-40">
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="text-[18vw] font-display font-black leading-none text-gray-300 mx-4">
          SHOOT • SWAP • SELL • SHOOT • SWAP • SELL •
        </span>
        <span className="text-[18vw] font-display font-black leading-none text-gray-300 mx-4">
          SHOOT • SWAP • SELL • SHOOT • SWAP • SELL •
        </span>
      </div>
    </div>
  );
};

export default KineticMarquee;